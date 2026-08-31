#!/usr/bin/env python3
"""Build a read-only plan for publishing one weekly RBR rotation.

The planner accepts the three quests observed through the in-game ``/rbr``
command. It reads the current Wiki templates, validates the rotation state,
renders candidate Wikitext, and asks MediaWiki to parse the candidates. It
never edits the Wiki or writes the site's committed RBR snapshot.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Callable

from build_rbr_data import (
    API_URL,
    CURRENT_RBR_TEMPLATE,
    EPISODES,
    QUEST_LINK_RE,
    RBR_PAGE,
    RBR_TRACKER_TEMPLATE,
    TRACKER_ENTRY_RE,
    RbrDataError,
    WikiPage,
    build_tracker_summary,
    expected_rbr_week,
    fetch_wiki_page,
    normalize_rbr_week,
    normalize_current_quests,
    parse_current_rbr,
    parse_eligible_quests,
    parse_rbr_tracker,
    quest_abbreviation,
)


USER_AGENT = "Haven-PSOBB-RBR-update-planner/1.0"
WEEK_MARKER_RE = re.compile(
    r"(?P<prefix><!--WEEK \(DD Month YYYY\) GOES HERE:-->)"
    r"\s*(?P<week>\d{1,2} [A-Za-z]+ \d{4})"
)


class RbrUpdatePlanError(RbrDataError):
    """Raised when the observed game rotation cannot be planned safely."""


def _records_from_pool(pool_page: WikiPage, /) -> list[dict[str, Any]]:
    return [
        {
            "episode": link.episode,
            "page": link.page,
            "name": link.name,
            "abbreviation": quest_abbreviation(link.name),
        }
        for link in parse_eligible_quests(pool_page.wikitext)
    ]


def _validate_record_identities(
    records: list[dict[str, Any]],
    /,
) -> None:
    for field in ("abbreviation", "page"):
        values = [str(record[field]).casefold() for record in records]
        if len(values) != len(set(values)):
            raise RbrUpdatePlanError(
                f"RBR candidate pool contains a duplicate {field}"
            )


def _current_with_abbreviations(
    wikitext: str,
    records: list[dict[str, Any]],
    /,
) -> dict[str, Any]:
    current = parse_current_rbr(wikitext)
    try:
        return normalize_current_quests(current, records)
    except RbrDataError as error:
        raise RbrUpdatePlanError(str(error)) from error


def _normalize_selection(
    selected: dict[int, str],
    records: list[dict[str, Any]],
    /,
) -> dict[int, dict[str, Any]]:
    records_by_abbreviation = {
        record["abbreviation"].casefold(): record for record in records
    }
    normalized: dict[int, dict[str, Any]] = {}
    for episode in EPISODES:
        raw = selected.get(episode, "").strip()
        try:
            record = records_by_abbreviation[raw.casefold()]
        except KeyError as error:
            raise RbrUpdatePlanError(
                f"Unknown Episode {episode} RBR abbreviation: {raw!r}"
            ) from error
        if record["episode"] != episode:
            raise RbrUpdatePlanError(
                f"{record['abbreviation']} belongs to Episode "
                f"{record['episode']}, not Episode {episode}"
            )
        normalized[episode] = record
    return normalized


def transition_tracker(
    statuses: dict[str, int],
    records: list[dict[str, Any]],
    selected: dict[int, dict[str, Any]],
    /,
) -> dict[str, int]:
    """Advance all three Episode trackers by exactly one weekly rotation."""
    result = dict(statuses)
    for episode in EPISODES:
        episode_keys = [
            record["abbreviation"].casefold()
            for record in records
            if record["episode"] == episode
        ]
        selected_key = selected[episode]["abbreviation"].casefold()
        possible = [key for key in episode_keys if result[key] == 0]
        current = [key for key in episode_keys if result[key] == 1]
        if len(current) != 1:
            raise RbrUpdatePlanError(
                f"Episode {episode} has {len(current)} current tracker entries"
            )

        if possible:
            selected_status = result[selected_key]
            if selected_status != 0:
                raise RbrUpdatePlanError(
                    f"Episode {episode} cannot select "
                    f"{selected[episode]['abbreviation']} with tracker status "
                    f"{selected_status} while {len(possible)} possible quests remain"
                )
            result[current[0]] = 2
            result[selected_key] = 1
            continue

        # A completed Episode rotation resets independently. The first quest
        # of the new rotation may repeat the previous current quest.
        for key in episode_keys:
            result[key] = 0
        result[selected_key] = 1
    return result


def render_current_template(
    source: str,
    week: str,
    selected: dict[int, dict[str, Any]],
    /,
) -> str:
    week_matches = list(WEEK_MARKER_RE.finditer(source))
    if len(week_matches) != 1:
        raise RbrUpdatePlanError(
            f"Expected one current-template week marker, found {len(week_matches)}"
        )
    week_match = week_matches[0]
    rendered = (
        source[: week_match.start("week")]
        + week
        + source[week_match.end("week") :]
    )

    links = list(QUEST_LINK_RE.finditer(rendered))
    if len(links) != len(EPISODES):
        raise RbrUpdatePlanError(
            f"Expected 3 current-template quest links, found {len(links)}"
        )
    replacements = iter(selected[episode] for episode in EPISODES)

    def replace_link(_match: re.Match[str]) -> str:
        record = next(replacements)
        return f"{{{{Quest link|{record['page']}|{record['name']}}}}}"

    return QUEST_LINK_RE.sub(replace_link, rendered)


def render_tracker_template(
    source: str,
    statuses: dict[str, int],
    /,
) -> str:
    matches = list(TRACKER_ENTRY_RE.finditer(source))
    matched_keys = {
        match.group("abbreviation").casefold() for match in matches
    }
    if matched_keys != set(statuses) or len(matches) != len(statuses):
        raise RbrUpdatePlanError(
            "Tracker template entries do not match the validated candidate pool"
        )

    def replace_status(match: re.Match[str]) -> str:
        key = match.group("abbreviation").casefold()
        relative_start = match.start("status") - match.start()
        relative_end = match.end("status") - match.start()
        return (
            match.group(0)[:relative_start]
            + str(statuses[key])
            + match.group(0)[relative_end:]
        )

    return TRACKER_ENTRY_RE.sub(replace_status, source)


def preview_wikitext(
    title: str,
    wikitext: str,
    /,
    *,
    timeout: float = 30.0,
    opener: Any = urllib.request.urlopen,
) -> int:
    """Return the rendered HTML byte length using read-only ``action=parse``."""
    body = urllib.parse.urlencode(
        {
            "action": "parse",
            "title": title,
            "text": wikitext,
            "contentmodel": "wikitext",
            "prop": "text",
            "format": "json",
            "formatversion": "2",
        }
    ).encode()
    request = urllib.request.Request(
        API_URL,
        data=body,
        headers={"User-Agent": USER_AGENT},
    )
    try:
        response = opener(request, timeout=timeout)
        with response:
            payload = json.load(response)
        if "error" in payload:
            raise RbrUpdatePlanError(
                f"MediaWiki parse failed for {title}: {payload['error']}"
            )
        html = payload["parse"]["text"]
    except RbrUpdatePlanError:
        raise
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise RbrUpdatePlanError(
            f"Could not preview {title!r} through MediaWiki: {error}"
        ) from error
    return len(html.encode("utf-8"))


def _diff(title: str, revision: int, before: str, after: str, /) -> str:
    return "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"{title}@{revision}",
            tofile=f"{title}@planned",
        )
    )


def build_update_plan(
    pool_page: WikiPage,
    current_page: WikiPage,
    tracker_page: WikiPage,
    selected_input: dict[int, str],
    /,
    *,
    now: datetime | None = None,
    previewer: Callable[[str, str], int] = preview_wikitext,
    include_wikitext: bool = False,
) -> dict[str, Any]:
    """Validate one observed rotation and return a non-mutating update plan."""
    records = _records_from_pool(pool_page)
    _validate_record_identities(records)
    current = _current_with_abbreviations(current_page.wikitext, records)
    statuses = parse_rbr_tracker(tracker_page.wikitext)
    tracker = build_tracker_summary(statuses, records, current)

    selected = _normalize_selection(selected_input, records)
    target_week = expected_rbr_week(now)
    current_week = normalize_rbr_week(current["week"])
    target_date = datetime.strptime(target_week, "%d %B %Y").date()
    current_date = datetime.strptime(current_week, "%d %B %Y").date()
    week_delta = (target_date - current_date).days
    current_selection = {
        quest["episode"]: quest["abbreviation"] for quest in current["quests"]
    }
    selected_abbreviations = {
        episode: selected[episode]["abbreviation"] for episode in EPISODES
    }
    tracker_selection = {
        int(episode): grouped["current"][0]
        for episode, grouped in tracker["byEpisode"].items()
    }
    current_is_target = selected_abbreviations == current_selection
    tracker_is_target = selected_abbreviations == tracker_selection

    if week_delta == 0:
        if not current_is_target:
            raise RbrUpdatePlanError(
                "Wiki already has the target week with a different rotation; "
                "automatic Tracker correction would be ambiguous"
            )
        current_text = current_page.wikitext
        if tracker_is_target:
            next_statuses = statuses
            result = "already-current"
            tracker_text = tracker_page.wikitext
        else:
            next_statuses = transition_tracker(statuses, records, selected)
            result = "resume-tracker"
            tracker_text = render_tracker_template(
                tracker_page.wikitext,
                next_statuses,
            )
    elif week_delta == 7:
        current_text = render_current_template(
            current_page.wikitext,
            target_week,
            selected,
        )
        if tracker["isConsistentWithCurrentTemplate"]:
            next_statuses = transition_tracker(statuses, records, selected)
            result = "planned"
            tracker_text = render_tracker_template(
                tracker_page.wikitext,
                next_statuses,
            )
        elif tracker_is_target:
            next_statuses = statuses
            result = "resume-current"
            tracker_text = tracker_page.wikitext
        else:
            raise RbrUpdatePlanError(
                "Current Wiki template and Tracker disagree in an unknown state"
            )
    else:
        raise RbrUpdatePlanError(
            "Wiki current week must be either the target week or exactly one "
            f"week behind: current={current_week}, target={target_week}"
        )

    planned_current = _current_with_abbreviations(current_text, records)
    planned_statuses = parse_rbr_tracker(tracker_text)
    if planned_statuses != next_statuses:
        raise RbrUpdatePlanError("Rendered Tracker did not preserve planned statuses")
    planned_tracker = build_tracker_summary(
        planned_statuses,
        records,
        planned_current,
    )
    if not planned_tracker["isConsistentWithCurrentTemplate"]:
        raise RbrUpdatePlanError(
            "Rendered current template and Tracker are inconsistent"
        )

    current_preview_bytes = previewer(CURRENT_RBR_TEMPLATE, current_text)
    tracker_preview_bytes = previewer(RBR_TRACKER_TEMPLATE, tracker_text)
    plan = {
        "mode": "dry-run",
        "result": result,
        "targetWeek": target_week,
        "input": {
            str(episode): selected_abbreviations[episode]
            for episode in EPISODES
        },
        "sourceRevisions": {
            "candidatePool": pool_page.revision_id,
            "currentRotation": current_page.revision_id,
            "tracker": tracker_page.revision_id,
        },
        "wiki": {
            "currentRotation": {
                "title": CURRENT_RBR_TEMPLATE,
                "changed": current_text != current_page.wikitext,
                "previewHtmlBytes": current_preview_bytes,
                "diff": _diff(
                    CURRENT_RBR_TEMPLATE,
                    current_page.revision_id,
                    current_page.wikitext,
                    current_text,
                ),
            },
            "tracker": {
                "title": RBR_TRACKER_TEMPLATE,
                "changed": tracker_text != tracker_page.wikitext,
                "previewHtmlBytes": tracker_preview_bytes,
                "diff": _diff(
                    RBR_TRACKER_TEMPLATE,
                    tracker_page.revision_id,
                    tracker_page.wikitext,
                    tracker_text,
                ),
            },
        },
        "localProjection": {
            "eligibleCounts": {
                str(episode): sum(
                    record["episode"] == episode for record in records
                )
                for episode in EPISODES
            },
            "current": planned_current,
            "tracker": planned_tracker,
        },
    }
    if include_wikitext:
        plan["candidateWikitext"] = {
            CURRENT_RBR_TEMPLATE: current_text,
            RBR_TRACKER_TEMPLATE: tracker_text,
        }
    return plan


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episode-1", required=True, help="Episode 1 abbreviation")
    parser.add_argument("--episode-2", required=True, help="Episode 2 abbreviation")
    parser.add_argument("--episode-4", required=True, help="Episode 4 abbreviation")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        plan = build_update_plan(
            fetch_wiki_page(RBR_PAGE),
            fetch_wiki_page(CURRENT_RBR_TEMPLATE),
            fetch_wiki_page(RBR_TRACKER_TEMPLATE),
            {
                1: args.episode_1,
                2: args.episode_2,
                4: args.episode_4,
            },
        )
    except RbrDataError as error:
        raise SystemExit(f"RBR update plan failed: {error}") from error

    print(json.dumps(plan, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
