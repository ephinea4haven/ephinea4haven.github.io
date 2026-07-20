#!/usr/bin/env python3
"""Build machine-readable RBR source data from the Ephinea PSO Wiki.

The generated JSON contains the official RBR candidate pool, current weekly
selection, boost rules, quest metadata, Ultimate experience totals, and enemy
counts. It intentionally does not generate subjective Tier ratings.

Usage:
    python3 scripts/build_rbr_data.py
    python3 scripts/build_rbr_data.py --output /tmp/rbr-source.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import sleep
from typing import Any


API_URL = "https://wiki.pioneer2.net/api.php"
RBR_PAGE = "Ragol Boost Road"
CURRENT_RBR_TEMPLATE = "Template:RagolBoostRoad"
RBR_TRACKER_TEMPLATE = "Template:RagolBoostRoadTracker"
DEFAULT_OUTPUT = Path("data/rbr/source.json")
USER_AGENT = "Haven-PSOBB-RBR-data-builder/1.0"
EPISODES = (1, 2, 4)
EXPECTED_QUEST_COUNTS = {1: 23, 2: 21, 4: 14}
TRACKER_STATUS_NAMES = {
    0: "possible",
    1: "current",
    2: "unavailable",
}

QUEST_LINK_RE = re.compile(
    r"\{\{Quest link\|(?P<page>[^|}]+)"
    r"(?:\|(?P<label>[^}]+))?\}\}"
)
EPISODE_BLOCK_RE = re.compile(
    r"<big>Episode (?P<episode>[124])</big>.*?"
    r"(?P<body>(?:\n\* \{\{Quest link\|.*?\}\})+)",
    re.DOTALL,
)
WIKI_LINK_RE = re.compile(r"\[\[(?:[^]|]+\|)?(?P<label>[^]]+)\]\]")
TRACKER_ENTRY_RE = re.compile(
    r"<!--\s*(?P<abbreviation>[A-Za-z0-9]+)\s*-->\s*"
    r"(?P<status>[012])"
)


class RbrDataError(Exception):
    """Base exception for known RBR data generation failures."""


class SourceFetchError(RbrDataError):
    """Raised when a wiki API request fails."""


class SourceParseError(RbrDataError):
    """Raised when upstream content no longer matches the expected structure."""


@dataclass(frozen=True)
class WikiPage:
    """Raw source and revision metadata returned by MediaWiki."""

    title: str
    page_id: int
    revision_id: int
    wikitext: str


@dataclass(frozen=True)
class QuestLink:
    """One quest reference from the RBR candidate list."""

    episode: int
    page: str
    name: str


@dataclass(frozen=True)
class EnemyCountData:
    """Parsed enemy totals plus any conditional/raw count annotations."""

    counts: dict[str, int]
    variants: dict[str, str]


def fetch_wiki_page(
    title: str,
    /,
    *,
    timeout: float = 30.0,
    retries: int = 3,
    opener: Any = urllib.request.urlopen,
) -> WikiPage:
    """Fetch one page's raw wikitext through the MediaWiki API.

    Args:
        title: Exact MediaWiki page title.
        timeout: Network timeout in seconds.
        retries: Attempts for transient network and HTTP failures.
        opener: Injectable URL opener used by tests.

    Returns:
        The page title, IDs, and raw wikitext.

    Raises:
        SourceFetchError: If the request fails or returns invalid JSON.
        SourceParseError: If required fields are absent.
    """
    query = urllib.parse.urlencode(
        {
            "action": "parse",
            "page": title,
            "prop": "wikitext|revid",
            "format": "json",
            "formatversion": "2",
        }
    )
    request = urllib.request.Request(
        f"{API_URL}?{query}",
        headers={"User-Agent": USER_AGENT},
    )

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = opener(request, timeout=timeout)
            with response:
                payload = json.load(response)
            break
        except (
            OSError,
            urllib.error.URLError,
            json.JSONDecodeError,
        ) as error:
            last_error = error
            if attempt < retries:
                sleep(0.5 * attempt)
    else:
        raise SourceFetchError(
            f"Could not fetch {title!r} after {retries} attempts: {last_error}"
        ) from last_error

    try:
        parsed = payload["parse"]
        return WikiPage(
            title=parsed["title"],
            page_id=int(parsed["pageid"]),
            revision_id=int(parsed["revid"]),
            wikitext=parsed["wikitext"],
        )
    except (KeyError, TypeError, ValueError) as error:
        raise SourceParseError(
            f"MediaWiki returned an unexpected payload for {title!r}"
        ) from error


def parse_eligible_quests(wikitext: str, /) -> list[QuestLink]:
    """Parse the official RBR candidate pool from the guide's wikitext."""
    quests: list[QuestLink] = []
    found_episodes: set[int] = set()

    for match in EPISODE_BLOCK_RE.finditer(wikitext):
        episode = int(match.group("episode"))
        found_episodes.add(episode)
        for link_match in QUEST_LINK_RE.finditer(match.group("body")):
            page = link_match.group("page").strip()
            label = link_match.group("label")
            name = label.strip() if label else page
            quests.append(QuestLink(episode=episode, page=page, name=name))

    if found_episodes != set(EPISODES):
        raise SourceParseError(
            f"Expected Episodes {EPISODES}, found {sorted(found_episodes)}"
        )

    actual_counts = {
        episode: sum(quest.episode == episode for quest in quests)
        for episode in EPISODES
    }
    if actual_counts != EXPECTED_QUEST_COUNTS:
        raise SourceParseError(
            "RBR candidate counts changed: "
            f"expected {EXPECTED_QUEST_COUNTS}, found {actual_counts}"
        )

    return quests


def parse_current_rbr(wikitext: str, /) -> dict[str, Any]:
    """Parse the week and three current quests from RagolBoostRoad template."""
    date_match = re.search(
        r"<!--WEEK \(DD Month YYYY\) GOES HERE:-->"
        r"\s*(?P<week>\d{1,2} [A-Za-z]+ \d{4})",
        wikitext,
    )
    if not date_match:
        raise SourceParseError("Could not find the current RBR week")

    links = [
        {
            "episode": episode,
            "page": match.group("page").strip(),
            "name": (
                match.group("label").strip()
                if match.group("label")
                else match.group("page").strip()
            ),
        }
        for episode, match in zip(
            EPISODES,
            QUEST_LINK_RE.finditer(wikitext),
            strict=True,
        )
    ]
    if len(links) != 3:
        raise SourceParseError(
            f"Expected 3 current RBR quests, found {len(links)}"
        )

    return {"week": date_match.group("week"), "quests": links}


def parse_rbr_tracker(wikitext: str, /) -> dict[str, int]:
    """Parse quest status markers from RagolBoostRoadTracker."""
    statuses: dict[str, int] = {}
    for match in TRACKER_ENTRY_RE.finditer(wikitext):
        abbreviation = match.group("abbreviation")
        normalized = abbreviation.casefold()
        if normalized in statuses:
            raise SourceParseError(
                f"Duplicate RBR tracker entry for {abbreviation}"
            )
        statuses[normalized] = int(match.group("status"))

    if not statuses:
        raise SourceParseError("RBR tracker contains no quest status entries")
    return statuses


def build_tracker_summary(
    statuses: dict[str, int],
    records: list[dict[str, Any]],
    current: dict[str, Any],
    /,
) -> dict[str, Any]:
    """Validate tracker coverage and group statuses for page rendering."""
    records_by_abbreviation = {
        record["abbreviation"].casefold(): record for record in records
    }
    expected = set(records_by_abbreviation)
    actual = set(statuses)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise SourceParseError(
            "RBR tracker does not match candidate pool: "
            f"missing={missing}, extra={extra}"
        )

    by_episode: dict[str, dict[str, list[str]]] = {}
    for episode in EPISODES:
        grouped = {name: [] for name in TRACKER_STATUS_NAMES.values()}
        for record in records:
            if record["episode"] != episode:
                continue
            status = statuses[record["abbreviation"].casefold()]
            grouped[TRACKER_STATUS_NAMES[status]].append(
                record["abbreviation"]
            )
        if len(grouped["current"]) != 1:
            raise SourceParseError(
                f"Expected one current tracker quest for Episode {episode}, "
                f"found {len(grouped['current'])}"
            )
        by_episode[str(episode)] = grouped

    template_current = {
        str(quest["episode"]): quest["abbreviation"]
        for quest in current["quests"]
    }
    tracker_current = {
        episode: grouped["current"][0]
        for episode, grouped in by_episode.items()
    }
    return {
        "statusLabels": {
            "possible": "possible next week",
            "current": "current week",
            "unavailable": "already selected this cycle",
        },
        "byEpisode": by_episode,
        "isConsistentWithCurrentTemplate": (
            tracker_current == template_current
        ),
    }


def quest_abbreviation(title: str, /) -> str:
    """Return the community abbreviation for an RBR quest title."""
    numbered_patterns = (
        (r"^Mop-up Operation #?(\d+)$", "MU"),
        (r"^Sweep-up Operation #?(\d+)$", "SU"),
        (r"^Endless Nightmare #?(\d+)$", "EN"),
        (r"^Anomalous Ordeal #?(\d+)$", "AO"),
        (r"^Scarlet Realm #?(\d+)$", "SR"),
        (r"^Silent Afterimage #?(\d+)$", "SA"),
        (r"^Phantasmal World #?(\d+)$", "PW"),
        (r"^Penumbral Surge #?(\d+)$", "PS"),
        (r"^War of Limits #?(\d+)$", "WoL"),
        (r"^New Mop-Up Operation #?(\d+)$", "NMU"),
    )
    for pattern, prefix in numbered_patterns:
        if match := re.match(pattern, title, flags=re.IGNORECASE):
            return f"{prefix}{match.group(1)}"

    fixed = {
        "Lost HEAT SWORD": "LHS",
        "Lost ICE SPINNER": "LIS",
        "Lost HELL PALLASCH": "LHP",
        "Lost SHOCK RIFLE": "LSR",
        "Lost BIND ASSAULT": "LBA",
        "Lost DEMON'S RAILGUN": "LDR",
        "Lost CHARGE VULCAN": "LCV",
        "The East Tower": "TET",
        "The West Tower": "TWT",
    }
    try:
        return fixed[title]
    except KeyError as error:
        raise SourceParseError(
            f"No abbreviation rule exists for quest {title!r}"
        ) from error


def _strip_wiki_markup(value: str, /) -> str:
    """Reduce the small subset of wiki markup used by enemy-count tables."""
    value = value.strip()
    if match := WIKI_LINK_RE.fullmatch(value):
        return match.group("label").strip()
    return re.sub(r"'{2,}", "", value).strip()


def _parse_count(value: str, /) -> tuple[int, str | None]:
    """Parse a leading count while preserving conditional annotations."""
    numbers = re.findall(r"\d+", value)
    if not numbers:
        raise SourceParseError(f"Count contains no number: {value!r}")
    # Most annotated counts begin with the primary value (for example
    # ``19 (+2)``). Some multi-route tables collapse ``(solo) total`` into
    # one cell, in which case the final value is the full-clear count.
    count = int(numbers[0] if value[0].isdigit() else numbers[-1])
    return count, value if value != str(count) else None


def _quest_table_heading(table: str, /) -> str:
    """Return the area/title heading from one questTable."""
    heading_match = re.search(
        r"!\s*colspan\s*=\s*(?:\"?\d+\"?)\s*\|\s*(?P<heading>[^\n]+)",
        table,
        flags=re.IGNORECASE,
    )
    if not heading_match:
        raise SourceParseError("Enemy-count table has no area heading")
    return _strip_wiki_markup(heading_match.group("heading"))


def _parse_quest_table(table: str, /) -> tuple[str, EnemyCountData]:
    """Parse one questTable into its heading and enemy counts."""
    rows: dict[str, int] = {}
    variants: dict[str, str] = {}
    heading = _quest_table_heading(table)
    for raw_row in re.split(r"\n\|-", table)[1:]:
        cells = []
        for cell_line in re.findall(
            r"^\|(?!-)(.*)$",
            raw_row,
            flags=re.MULTILINE,
        ):
            cells.extend(
                cell.strip()
                for cell in cell_line.split("||")
                if cell.strip() != "}"
            )
        if len(cells) < 2:
            continue
        pairs: list[tuple[str, str]]
        if len(cells) == 2:
            pairs = [(cells[0], cells[1])]
        elif heading.casefold() == "total" and len(cells) == 3:
            pairs = [(cells[0], cells[-1])]
        elif heading.casefold() == "total" and len(cells) % 2 == 0:
            pairs = list(zip(cells[::2], cells[1::2], strict=True))
        else:
            raise SourceParseError(
                f"Unsupported {len(cells)}-column row in {heading!r} table"
            )

        for enemy_cell, count_cell in pairs:
            enemy = _strip_wiki_markup(enemy_cell)
            count_text = _strip_wiki_markup(count_cell)
            if enemy.lower() == "enemy" or count_text.lower() == "count":
                continue
            count, raw_variant = _parse_count(count_text)
            rows[enemy] = count
            if raw_variant:
                variants[enemy] = raw_variant

    return heading, EnemyCountData(counts=rows, variants=variants)


def parse_enemy_count_data(wikitext: str, /) -> EnemyCountData:
    """Return full-clear totals and annotations from quest-page wikitext."""
    section_match = re.search(
        r"==\s*Enemy Counts\s*==(?P<body>.*?)(?=\n==[^=]|\Z)",
        wikitext,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not section_match:
        raise SourceParseError("Quest page has no Enemy Counts section")

    tables = re.findall(
        r"\{\|(?P<table>.*?\n\|})",
        section_match.group("body"),
        flags=re.DOTALL,
    )
    quest_tables = [table for table in tables if "questTable" in table]
    if not quest_tables:
        quest_tables = tables
    total_tables = [
        table
        for table in quest_tables
        if _quest_table_heading(table).casefold() == "total"
    ]
    tables_to_parse = total_tables or quest_tables
    parsed_tables = [_parse_quest_table(table) for table in tables_to_parse]
    if not parsed_tables:
        raise SourceParseError("Enemy Counts section has no questTable")

    for heading, count_data in parsed_tables:
        if heading.casefold() == "total":
            return count_data

    totals: dict[str, int] = {}
    variants: dict[str, str] = {}
    for _, count_data in parsed_tables:
        for enemy, count in count_data.counts.items():
            totals[enemy] = totals.get(enemy, 0) + count
        variants.update(count_data.variants)
    return EnemyCountData(counts=totals, variants=variants)


def parse_enemy_counts(wikitext: str, /) -> dict[str, int]:
    """Return the primary full-clear enemy totals for compatibility."""
    return parse_enemy_count_data(wikitext).counts


def parse_quest_metadata(wikitext: str, /) -> dict[str, Any]:
    """Extract stable fields from the leading Quest template."""
    template_match = re.search(
        r"\{\{Quest(?P<body>.*?)\n}}",
        wikitext,
        flags=re.DOTALL,
    )
    if not template_match:
        raise SourceParseError("Quest page has no Quest template")

    fields = {
        key.strip(): value.strip()
        for key, value in re.findall(
            r"^\|([^=\n]+)=(.*)$",
            template_match.group("body"),
            flags=re.MULTILINE,
        )
    }
    metadata: dict[str, Any] = {
        "title": fields.get("title"),
        "category": fields.get("category"),
        "rbr": fields.get("RBR", "").casefold() == "yes",
    }
    if ultimate_xp := fields.get("uxpon"):
        metadata["ultimateExperience"] = (
            int(ultimate_xp) if ultimate_xp.isdigit() else None
        )
        if not ultimate_xp.isdigit():
            metadata["ultimateExperienceRaw"] = ultimate_xp
    return metadata


def build_quest_record(link: QuestLink, page: WikiPage, /) -> dict[str, Any]:
    """Combine one candidate link with its quest-page source data."""
    metadata = parse_quest_metadata(page.wikitext)
    if not metadata["rbr"]:
        raise SourceParseError(f"{link.page!r} is not marked RBR=Yes")

    try:
        count_data = parse_enemy_count_data(page.wikitext)
        count_status = "available"
        count_note = None
    except SourceParseError as error:
        count_data = EnemyCountData(counts={}, variants={})
        count_status = "unavailable"
        count_note = str(error)

    abbreviation = quest_abbreviation(link.name)
    return {
        "episode": link.episode,
        "abbreviation": abbreviation,
        "page": link.page,
        "name": link.name,
        "wikiUrl": (
            "https://wiki.pioneer2.net/w/"
            f"{urllib.parse.quote(link.page.replace(' ', '_'))}"
        ),
        "wikiRevision": page.revision_id,
        "category": metadata["category"],
        "ultimateExperience": metadata.get("ultimateExperience"),
        "ultimateExperienceRaw": metadata.get("ultimateExperienceRaw"),
        "enemyCountStatus": count_status,
        "enemyCountNote": count_note,
        "totalEnemies": (
            sum(count_data.counts.values()) if count_data.counts else None
        ),
        "enemyCounts": dict(sorted(count_data.counts.items())),
        "enemyCountVariants": dict(sorted(count_data.variants.items())),
    }


def fetch_quest_records(
    links: list[QuestLink],
    /,
    *,
    workers: int = 8,
) -> list[dict[str, Any]]:
    """Fetch candidate quest pages concurrently and return ordered records."""
    records_by_page: dict[str, dict[str, Any]] = {}
    errors: list[str] = []

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(fetch_wiki_page, link.page): link for link in links
        }
        for future in as_completed(futures):
            link = futures[future]
            try:
                page = future.result()
                records_by_page[link.page] = build_quest_record(link, page)
            except RbrDataError as error:
                errors.append(f"{link.page}: {error}")

    if errors:
        details = "\n".join(f"- {error}" for error in sorted(errors))
        raise RbrDataError(f"Could not build all quest records:\n{details}")

    return [records_by_page[link.page] for link in links]


def build_source_data(*, workers: int = 8) -> dict[str, Any]:
    """Fetch and assemble the complete generated RBR source document."""
    rbr_page = fetch_wiki_page(RBR_PAGE)
    current_page = fetch_wiki_page(CURRENT_RBR_TEMPLATE)
    tracker_page = fetch_wiki_page(RBR_TRACKER_TEMPLATE)
    links = parse_eligible_quests(rbr_page.wikitext)
    current = parse_current_rbr(current_page.wikitext)
    tracker_statuses = parse_rbr_tracker(tracker_page.wikitext)
    records = fetch_quest_records(links, workers=workers)
    generated_at = datetime.now(tz=timezone.utc)
    current_week = datetime.strptime(
        current["week"],
        "%d %B %Y",
    ).date()
    expected_week = (
        generated_at
        - timedelta(days=(generated_at.weekday() + 1) % 7)
    ).date()
    current["expectedWeek"] = expected_week.strftime("%d %B %Y")
    current["isFresh"] = current_week == expected_week

    abbreviation_by_page = {
        record["page"]: record["abbreviation"] for record in records
    }
    for quest in current["quests"]:
        try:
            quest["abbreviation"] = abbreviation_by_page[quest["page"]]
        except KeyError as error:
            raise SourceParseError(
                f"Current RBR quest {quest['page']!r} is not in candidate pool"
            ) from error

    tracker = build_tracker_summary(tracker_statuses, records, current)
    warnings = [
        {
            "scope": "quest-enemy-counts",
            "quest": record["abbreviation"],
            "page": record["page"],
            "issue": record["enemyCountNote"],
        }
        for record in records
        if record["enemyCountStatus"] != "available"
    ]
    if not current["isFresh"]:
        warnings.append(
            {
                "scope": "current-rotation",
                "issue": (
                    "Wiki current-rotation template is stale: "
                    f"expected {current['expectedWeek']}, "
                    f"found {current['week']}"
                ),
            }
        )
    if not tracker["isConsistentWithCurrentTemplate"]:
        warnings.append(
            {
                "scope": "rbr-tracker",
                "issue": (
                    "Wiki tracker current quests do not match the "
                    "current-rotation template"
                ),
            }
        )

    return {
        "schemaVersion": 2,
        "generatedAt": generated_at.isoformat(),
        "sources": {
            "candidatePool": {
                "url": "https://wiki.pioneer2.net/w/Ragol_Boost_Road",
                "pageId": rbr_page.page_id,
                "revision": rbr_page.revision_id,
            },
            "currentRotation": {
                "url": (
                    "https://wiki.pioneer2.net/w/"
                    "Template:RagolBoostRoad"
                ),
                "pageId": current_page.page_id,
                "revision": current_page.revision_id,
            },
            "tracker": {
                "url": (
                    "https://wiki.pioneer2.net/w/"
                    "Template:RagolBoostRoadTracker"
                ),
                "pageId": tracker_page.page_id,
                "revision": tracker_page.revision_id,
            },
        },
        "boosts": {
            "rates": ["DAR", "RDR", "EXP"],
            "byPlayerCount": {"1": 15, "2": 20, "3": 25, "4": 25},
            "rareEnemyRate": 0,
        },
        "eligibleCounts": {
            str(episode): EXPECTED_QUEST_COUNTS[episode]
            for episode in EPISODES
        },
        "current": current,
        "tracker": tracker,
        "warnings": warnings,
        "quests": records,
    }


def write_json_atomic(data: dict[str, Any], output: Path, /) -> None:
    """Write JSON atomically so a failed run cannot truncate existing data."""
    output.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        dir=output.parent,
        prefix=f".{output.name}.",
        suffix=".tmp",
        text=True,
    )
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as temporary:
            json.dump(data, temporary, ensure_ascii=False, indent=2)
            temporary.write("\n")
        os.replace(temporary_name, output)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def parse_args() -> argparse.Namespace:
    """Parse command-line options."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"generated JSON path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="concurrent wiki requests (default: 8)",
    )
    return parser.parse_args()


def main() -> int:
    """Run the generator and report its audited output."""
    args = parse_args()
    if args.workers < 1:
        raise SystemExit("--workers must be at least 1")

    try:
        data = build_source_data(workers=args.workers)
        write_json_atomic(data, args.output)
    except RbrDataError as error:
        raise SystemExit(f"RBR data generation failed: {error}") from error

    print(
        f"Wrote {len(data['quests'])} RBR quests to {args.output} "
        f"(current week: {data['current']['week']}, "
        f"warnings: {len(data['warnings'])})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
