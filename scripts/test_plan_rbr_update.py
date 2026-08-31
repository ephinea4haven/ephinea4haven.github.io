"""Tests for the read-only RBR update planner."""

from __future__ import annotations

import io
import json
import sys
import unittest
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).parent))

import plan_rbr_update as planner  # noqa: E402
from build_rbr_data import WikiPage  # noqa: E402


NOW = datetime(2026, 8, 24, 12, tzinfo=timezone.utc)


def records(*, three_per_episode: bool = False) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    prefixes = {1: "A", 2: "B", 4: "C"}
    for episode, prefix in prefixes.items():
        count = 3 if three_per_episode else 2
        for index in range(1, count + 1):
            result.append(
                {
                    "episode": episode,
                    "page": f"Episode {episode} Quest {index}",
                    "name": f"Episode {episode} Quest {index}",
                    "abbreviation": f"{prefix}{index}",
                }
            )
    return result


def current_source(week: str, selected: tuple[str, str, str]) -> str:
    pages = {
        "A1": "Episode 1 Quest 1",
        "A2": "Episode 1 Quest 2",
        "A3": "Episode 1 Quest 3",
        "B1": "Episode 2 Quest 1",
        "B2": "Episode 2 Quest 2",
        "B3": "Episode 2 Quest 3",
        "C1": "Episode 4 Quest 1",
        "C2": "Episode 4 Quest 2",
        "C3": "Episode 4 Quest 3",
    }
    links = "\n".join(
        f"* {{{{Quest link|{pages[abbreviation]}|{pages[abbreviation]}}}}}"
        for abbreviation in selected
    )
    return (
        "<!--WEEK (DD Month YYYY) GOES HERE:-->"
        f"{week}\n{links}\n"
    )


def tracker_source(statuses: dict[str, int]) -> str:
    return "\n".join(
        f"<!--{abbreviation}-->{status}"
        for abbreviation, status in statuses.items()
    )


def pages(
    *,
    week: str = "16 August 2026",
    current: tuple[str, str, str] = ("A1", "B1", "C1"),
    statuses: dict[str, int] | None = None,
) -> tuple[WikiPage, WikiPage, WikiPage]:
    statuses = statuses or {
        "a1": 1,
        "a2": 0,
        "b1": 1,
        "b2": 0,
        "c1": 1,
        "c2": 0,
    }
    return (
        WikiPage("Ragol Boost Road", 1, 11, "pool"),
        WikiPage(
            planner.CURRENT_RBR_TEMPLATE,
            2,
            22,
            current_source(week, current),
        ),
        WikiPage(
            planner.RBR_TRACKER_TEMPLATE,
            3,
            33,
            tracker_source(statuses),
        ),
    )


class UpdatePlanTest(unittest.TestCase):
    def build(
        self,
        selected: dict[int, str],
        *,
        source_pages: tuple[WikiPage, WikiPage, WikiPage] | None = None,
        candidate_records: list[dict[str, object]] | None = None,
        now: datetime = NOW,
    ) -> dict[str, object]:
        with patch.object(
            planner,
            "_records_from_pool",
            return_value=candidate_records or records(),
        ):
            return planner.build_update_plan(
                *(source_pages or pages()),
                selected,
                now=now,
                previewer=lambda _title, text: len(text.encode()),
            )

    def test_plans_a_normal_week_without_mutating_sources(self) -> None:
        source_pages = pages()
        before = [page.wikitext for page in source_pages]

        plan = self.build(
            {1: "a2", 2: "B2", 4: "c2"},
            source_pages=source_pages,
        )

        self.assertEqual(plan["mode"], "dry-run")
        self.assertEqual(plan["result"], "planned")
        self.assertEqual(plan["targetWeek"], "23 August 2026")
        self.assertEqual(plan["input"], {"1": "A2", "2": "B2", "4": "C2"})
        self.assertTrue(plan["wiki"]["currentRotation"]["changed"])
        self.assertTrue(plan["wiki"]["tracker"]["changed"])
        self.assertIn("23 August 2026", plan["wiki"]["currentRotation"]["diff"])
        self.assertEqual(
            plan["localProjection"]["tracker"]["byEpisode"]["1"],
            {
                "possible": [],
                "current": ["A2"],
                "unavailable": ["A1"],
            },
        )
        self.assertEqual([page.wikitext for page in source_pages], before)

    def test_same_week_and_selection_is_an_idempotent_plan(self) -> None:
        plan = self.build(
            {1: "A1", 2: "B1", 4: "C1"},
            source_pages=pages(week="23 August 2026"),
        )

        self.assertEqual(plan["result"], "already-current")
        self.assertFalse(plan["wiki"]["currentRotation"]["changed"])
        self.assertFalse(plan["wiki"]["tracker"]["changed"])
        self.assertEqual(plan["wiki"]["currentRotation"]["diff"], "")

    def test_idempotent_plan_preserves_a_non_padded_week_label(self) -> None:
        plan = self.build(
            {1: "A1", 2: "B1", 4: "C1"},
            source_pages=pages(week="9 August 2026"),
            now=datetime(2026, 8, 10, 12, tzinfo=timezone.utc),
        )

        self.assertEqual(plan["targetWeek"], "09 August 2026")
        self.assertEqual(plan["result"], "already-current")
        self.assertFalse(plan["wiki"]["currentRotation"]["changed"])
        self.assertEqual(plan["localProjection"]["current"]["week"], "09 August 2026")

    def test_completed_cycle_can_repeat_the_previous_current_quest(self) -> None:
        completed = {
            "a1": 1,
            "a2": 2,
            "b1": 1,
            "b2": 2,
            "c1": 1,
            "c2": 2,
        }

        plan = self.build(
            {1: "A1", 2: "B1", 4: "C1"},
            source_pages=pages(statuses=completed),
        )

        tracker = plan["localProjection"]["tracker"]["byEpisode"]
        self.assertEqual(tracker["1"]["current"], ["A1"])
        self.assertEqual(tracker["1"]["possible"], ["A2"])
        self.assertEqual(tracker["1"]["unavailable"], [])

    def test_completed_cycle_can_select_a_previously_unavailable_quest(self) -> None:
        completed = {
            "a1": 1,
            "a2": 2,
            "b1": 1,
            "b2": 2,
            "c1": 1,
            "c2": 2,
        }

        plan = self.build(
            {1: "A2", 2: "B2", 4: "C2"},
            source_pages=pages(statuses=completed),
        )

        tracker = plan["localProjection"]["tracker"]["byEpisode"]
        self.assertEqual(tracker["1"]["current"], ["A2"])
        self.assertEqual(tracker["1"]["possible"], ["A1"])

    def test_rejects_unavailable_or_current_quest_before_cycle_end(self) -> None:
        candidate_records = records(three_per_episode=True)
        mixed = {
            "a1": 1,
            "a2": 0,
            "a3": 2,
            "b1": 1,
            "b2": 0,
            "b3": 2,
            "c1": 1,
            "c2": 0,
            "c3": 2,
        }
        source_pages = pages(statuses=mixed)

        for invalid in ("A1", "A3"):
            with self.subTest(invalid=invalid):
                with self.assertRaisesRegex(
                    planner.RbrUpdatePlanError,
                    "possible quests remain",
                ):
                    self.build(
                        {1: invalid, 2: "B2", 4: "C2"},
                        source_pages=source_pages,
                        candidate_records=candidate_records,
                    )

    def test_rejects_wrong_episode_and_unknown_abbreviation(self) -> None:
        for selected, message in (
            ({1: "B2", 2: "B2", 4: "C2"}, "belongs to Episode 2"),
            ({1: "NOPE", 2: "B2", 4: "C2"}, "Unknown Episode 1"),
        ):
            with self.subTest(selected=selected):
                with self.assertRaisesRegex(planner.RbrUpdatePlanError, message):
                    self.build(selected)

    def test_rejects_duplicate_candidate_identity_before_mapping(self) -> None:
        duplicated = records()
        duplicated.append(
            {
                "episode": 1,
                "page": "Duplicate Quest",
                "name": "Duplicate Quest",
                "abbreviation": "A1",
            }
        )

        with self.assertRaisesRegex(planner.RbrUpdatePlanError, "duplicate abbreviation"):
            self.build(
                {1: "A2", 2: "B2", 4: "C2"},
                candidate_records=duplicated,
            )

    def test_resumes_after_current_template_was_published_first(self) -> None:
        inconsistent = pages(
            week="23 August 2026",
            current=("A2", "B2", "C2"),
            statuses={
                "a1": 1,
                "a2": 0,
                "b1": 1,
                "b2": 0,
                "c1": 1,
                "c2": 0,
            },
        )

        plan = self.build(
            {1: "A2", 2: "B2", 4: "C2"},
            source_pages=inconsistent,
        )

        self.assertEqual(plan["result"], "resume-tracker")
        self.assertFalse(plan["wiki"]["currentRotation"]["changed"])
        self.assertTrue(plan["wiki"]["tracker"]["changed"])

    def test_resumes_after_tracker_was_published_first(self) -> None:
        inconsistent = pages(
            statuses={
                "a1": 2,
                "a2": 1,
                "b1": 2,
                "b2": 1,
                "c1": 2,
                "c2": 1,
            },
        )

        plan = self.build(
            {1: "A2", 2: "B2", 4: "C2"},
            source_pages=inconsistent,
        )

        self.assertEqual(plan["result"], "resume-current")
        self.assertTrue(plan["wiki"]["currentRotation"]["changed"])
        self.assertFalse(plan["wiki"]["tracker"]["changed"])

    def test_rejects_unknown_inconsistent_or_skipped_wiki_state(self) -> None:
        inconsistent = pages(
            statuses={
                "a1": 0,
                "a2": 1,
                "b1": 1,
                "b2": 0,
                "c1": 1,
                "c2": 0,
            },
        )
        with self.assertRaisesRegex(planner.RbrUpdatePlanError, "unknown state"):
            self.build(
                {1: "A2", 2: "B2", 4: "C2"},
                source_pages=inconsistent,
            )

        with self.assertRaisesRegex(planner.RbrUpdatePlanError, "exactly one week"):
            self.build(
                {1: "A2", 2: "B2", 4: "C2"},
                source_pages=pages(week="09 August 2026"),
            )

    def test_rejects_a_different_rotation_already_labeled_target_week(self) -> None:
        with self.assertRaisesRegex(planner.RbrUpdatePlanError, "ambiguous"):
            self.build(
                {1: "A2", 2: "B2", 4: "C2"},
                source_pages=pages(week="23 August 2026"),
            )

    def test_renderers_reject_unexpected_template_structure(self) -> None:
        with self.assertRaisesRegex(planner.RbrUpdatePlanError, "quest links"):
            planner.render_current_template(
                "<!--WEEK (DD Month YYYY) GOES HERE:-->16 August 2026\n",
                "23 August 2026",
                {
                    1: records()[0],
                    2: records()[2],
                    4: records()[4],
                },
            )

        with self.assertRaisesRegex(planner.RbrUpdatePlanError, "candidate pool"):
            planner.render_tracker_template("<!--A1-->1", {"a1": 1, "a2": 0})


class PreviewRequestTest(unittest.TestCase):
    def test_preview_uses_parse_and_never_edit(self) -> None:
        captured: dict[str, str] = {}

        class Response(io.BytesIO):
            def __enter__(self) -> "Response":
                return self

            def __exit__(self, *_args: object) -> None:
                self.close()

        def opener(request: object, *, timeout: float) -> Response:
            captured.update(
                urllib.parse.parse_qsl(request.data.decode(), keep_blank_values=True)
            )
            self.assertEqual(timeout, 12)
            return Response(json.dumps({"parse": {"text": "<p>ok</p>"}}).encode())

        size = planner.preview_wikitext(
            planner.CURRENT_RBR_TEMPLATE,
            "candidate",
            timeout=12,
            opener=opener,
        )

        self.assertEqual(size, len("<p>ok</p>".encode()))
        self.assertEqual(captured["action"], "parse")
        self.assertNotIn("edit", captured.values())
        self.assertEqual(captured["text"], "candidate")


if __name__ == "__main__":
    unittest.main()
