"""Unit tests for the RBR source-data generator."""

from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).parent))

import build_rbr_data as rbr  # noqa: E402
from build_rbr_data import (  # noqa: E402
    CurrentRotationPending,
    QuestLink,
    SourceParseError,
    WikiPage,
    _reusable_automated_snapshot,
    build_tracker_summary,
    existing_snapshot_is_current,
    expected_rbr_week,
    parse_current_rbr,
    parse_enemy_count_data,
    parse_enemy_counts,
    parse_quest_metadata,
    parse_rbr_tracker,
    quest_abbreviation,
    require_publishable_rotation,
    write_json_atomic,
)


class CurrentRbrParserTest(unittest.TestCase):
    """Verify current-week template parsing."""

    def test_parses_week_and_episode_order(self) -> None:
        source = """
<!--WEEK (DD Month YYYY) GOES HERE:-->12 July 2026
* {{Quest link|Endless Nightmare 2|Endless Nightmare #2}}
* {{Quest link|Lost BIND ASSAULT|Lost BIND ASSAULT}}
* {{Quest link|Sweep-up Operation 10|Sweep-up Operation #10}}
"""
        result = parse_current_rbr(source)

        self.assertEqual(result["week"], "12 July 2026")
        self.assertEqual(
            [quest["episode"] for quest in result["quests"]],
            [1, 2, 4],
        )
        self.assertEqual(
            [quest["page"] for quest in result["quests"]],
            [
                "Endless Nightmare 2",
                "Lost BIND ASSAULT",
                "Sweep-up Operation 10",
            ],
        )

    def test_rejects_missing_week(self) -> None:
        with self.assertRaises(SourceParseError):
            parse_current_rbr(
                "* {{Quest link|Endless Nightmare 2}}\n"
                "* {{Quest link|Lost BIND ASSAULT}}\n"
                "* {{Quest link|Sweep-up Operation 10}}\n"
            )


class RbrTrackerParserTest(unittest.TestCase):
    """Verify tracker parsing and candidate-pool validation."""

    def test_parses_status_markers_case_insensitively(self) -> None:
        result = parse_rbr_tracker(
            "<!--EN2-->1\n<!--LBA-->0\n<!--WOL3-->2\n"
        )

        self.assertEqual(result, {"en2": 1, "lba": 0, "wol3": 2})

    def test_rejects_duplicate_markers(self) -> None:
        with self.assertRaises(SourceParseError):
            parse_rbr_tracker("<!--EN2-->1\n<!--en2-->0\n")

    def test_groups_statuses_and_checks_current_template(self) -> None:
        records = [
            {"episode": 1, "abbreviation": "EN1"},
            {"episode": 1, "abbreviation": "EN2"},
            {"episode": 2, "abbreviation": "LBA"},
            {"episode": 4, "abbreviation": "WoL3"},
        ]
        current = {
            "quests": [
                {"episode": 1, "abbreviation": "EN2"},
                {"episode": 2, "abbreviation": "LBA"},
                {"episode": 4, "abbreviation": "WoL3"},
            ]
        }

        result = build_tracker_summary(
            {"en1": 0, "en2": 1, "lba": 1, "wol3": 1},
            records,
            current,
        )

        self.assertTrue(result["isConsistentWithCurrentTemplate"])
        self.assertEqual(
            result["byEpisode"]["1"],
            {
                "possible": ["EN1"],
                "current": ["EN2"],
                "unavailable": [],
            },
        )

    def test_rejects_missing_candidate(self) -> None:
        with self.assertRaises(SourceParseError):
            build_tracker_summary(
                {"en2": 1},
                [
                    {"episode": 1, "abbreviation": "EN2"},
                    {"episode": 2, "abbreviation": "LBA"},
                ],
                {"quests": []},
            )


class AutomatedRotationTest(unittest.TestCase):
    """Verify unattended publication waits safely and remains idempotent."""

    @staticmethod
    def wiki_pages() -> list[WikiPage]:
        return [
            WikiPage("Ragol Boost Road", 1, 11, "candidate source"),
            WikiPage("Template:RagolBoostRoad", 2, 22, "current source"),
            WikiPage("Template:RagolBoostRoadTracker", 3, 33, "tracker source"),
        ]

    def test_waits_for_current_week(self) -> None:
        current = {
            "week": "09 August 2026",
            "expectedWeek": "16 August 2026",
            "isFresh": False,
        }
        tracker = {"isConsistentWithCurrentTemplate": True}

        with self.assertRaisesRegex(CurrentRotationPending, "stale"):
            require_publishable_rotation(current, tracker)

    def test_detects_an_already_published_week(self) -> None:
        now = datetime(2026, 8, 16, 12, tzinfo=timezone.utc)
        existing = {
            "schemaVersion": 2,
            "sources": {},
            "current": {"week": "16 August 2026"},
            "tracker": {"isConsistentWithCurrentTemplate": True},
        }

        self.assertEqual(expected_rbr_week(now), "16 August 2026")
        self.assertTrue(existing_snapshot_is_current(existing, now))
        existing["sources"]["weekConfirmation"] = {"source": "manual"}
        self.assertFalse(existing_snapshot_is_current(existing, now))

    def test_accepts_a_non_padded_wiki_day(self) -> None:
        now = datetime(2026, 8, 9, 12, tzinfo=timezone.utc)
        existing = {
            "schemaVersion": 2,
            "sources": {},
            "current": {"week": "9 August 2026"},
            "tracker": {"isConsistentWithCurrentTemplate": True},
        }

        self.assertTrue(existing_snapshot_is_current(existing, now))

    def test_waits_for_tracker_to_match(self) -> None:
        current = {
            "week": "16 August 2026",
            "expectedWeek": "16 August 2026",
            "isFresh": True,
        }
        tracker = {"isConsistentWithCurrentTemplate": False}

        with self.assertRaisesRegex(CurrentRotationPending, "do not match"):
            require_publishable_rotation(current, tracker)

    def test_reuses_identical_snapshot_without_manual_confirmation(self) -> None:
        sources = {
            "candidatePool": {"revision": 1},
            "currentRotation": {"revision": 2},
            "tracker": {"revision": 3},
        }
        current = {"week": "16 August 2026", "quests": []}
        tracker = {"isConsistentWithCurrentTemplate": True}
        links = [QuestLink(episode=1, page="Example", name="Example")]
        existing = {
            "schemaVersion": 2,
            "generatedAt": "2026-08-16T01:00:00+00:00",
            "sources": {
                **sources,
                "weekConfirmation": {"source": "manual"},
            },
            "current": current,
            "tracker": tracker,
            "quests": [{"page": "Example"}],
        }

        reused = _reusable_automated_snapshot(
            existing,
            sources=sources,
            current=current,
            tracker=tracker,
            links=links,
        )

        self.assertIsNotNone(reused)
        self.assertNotIn("weekConfirmation", reused["sources"])
        self.assertIn("weekConfirmation", existing["sources"])

    def test_atomic_writer_skips_identical_data(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "source.json"
            data = {"schemaVersion": 2, "current": {"week": "16 August 2026"}}

            self.assertTrue(write_json_atomic(data, output))
            first_contents = output.read_text(encoding="utf-8")
            self.assertFalse(write_json_atomic(data, output))
            self.assertEqual(output.read_text(encoding="utf-8"), first_contents)

    def test_pending_week_never_fetches_all_quest_pages(self) -> None:
        current = {
            "week": "01 January 2025",
            "quests": [
                {
                    "episode": 1,
                    "page": "Lost HEAT SWORD",
                    "name": "Lost HEAT SWORD",
                }
            ],
        }
        links = [
            QuestLink(
                episode=1,
                page="Lost HEAT SWORD",
                name="Lost HEAT SWORD",
            )
        ]
        tracker = {"isConsistentWithCurrentTemplate": True}

        with (
            patch.object(rbr, "fetch_wiki_page", side_effect=self.wiki_pages()),
            patch.object(rbr, "parse_eligible_quests", return_value=links),
            patch.object(rbr, "parse_current_rbr", return_value=current),
            patch.object(rbr, "parse_rbr_tracker", return_value={}),
            patch.object(rbr, "build_tracker_summary", return_value=tracker),
            patch.object(rbr, "fetch_quest_records") as fetch_records,
        ):
            with self.assertRaises(CurrentRotationPending):
                rbr.build_source_data(require_current=True)

        fetch_records.assert_not_called()

    def test_published_week_reuses_snapshot_before_quest_page_fetch(self) -> None:
        week = expected_rbr_week()
        current = {
            "week": week,
            "quests": [
                {
                    "episode": 1,
                    "page": "Lost HEAT SWORD",
                    "name": "Lost HEAT SWORD",
                    "abbreviation": "LHS",
                }
            ],
            "expectedWeek": week,
            "isFresh": True,
        }
        links = [
            QuestLink(
                episode=1,
                page="Lost HEAT SWORD",
                name="Lost HEAT SWORD",
            )
        ]
        tracker = {"isConsistentWithCurrentTemplate": True}
        sources = {
            "candidatePool": {
                "url": "https://wiki.pioneer2.net/w/Ragol_Boost_Road",
                "pageId": 1,
                "revision": 11,
            },
            "currentRotation": {
                "url": "https://wiki.pioneer2.net/w/Template:RagolBoostRoad",
                "pageId": 2,
                "revision": 22,
            },
            "tracker": {
                "url": "https://wiki.pioneer2.net/w/Template:RagolBoostRoadTracker",
                "pageId": 3,
                "revision": 33,
            },
        }
        existing = {
            "schemaVersion": 2,
            "generatedAt": "2026-08-16T01:00:00+00:00",
            "sources": sources,
            "current": current,
            "tracker": tracker,
            "quests": [{"page": "Lost HEAT SWORD"}],
        }

        parsed_current = {
            "week": week,
            "quests": [
                {
                    "episode": 1,
                    "page": "Lost HEAT SWORD",
                    "name": "Lost HEAT SWORD",
                }
            ],
        }
        with (
            patch.object(rbr, "fetch_wiki_page", side_effect=self.wiki_pages()),
            patch.object(rbr, "parse_eligible_quests", return_value=links),
            patch.object(rbr, "parse_current_rbr", return_value=parsed_current),
            patch.object(rbr, "parse_rbr_tracker", return_value={}),
            patch.object(rbr, "build_tracker_summary", return_value=tracker),
            patch.object(rbr, "fetch_quest_records") as fetch_records,
        ):
            result = rbr.build_source_data(
                require_current=True,
                existing=existing,
            )

        self.assertEqual(result, existing)
        fetch_records.assert_not_called()


class EnemyCountParserTest(unittest.TestCase):
    """Verify full-clear enemy-count extraction."""

    def test_prefers_total_table(self) -> None:
        source = """
==Enemy Counts==
{|class="wikitable questTable"
!colspan=2|[[Mine|Mine 1]]
|-
!Enemy
!Count
|-
|[[Gillchic]]
|54
|}
{|class="wikitable questTable"
!colspan=2|Total
|-
!Enemy
!Count
|-
|[[Gillchic]]
|108
|-
|[[Sinow Gold]]
|14
|}
==Quest Maps==
"""
        self.assertEqual(
            parse_enemy_counts(source),
            {"Gillchic": 108, "Sinow Gold": 14},
        )

    def test_sums_areas_when_total_is_absent(self) -> None:
        source = """
==Enemy Counts==
{|class="wikitable questTable"
!colspan=2|Forest 1
|-
!Enemy
!Count
|-
|[[Booma]]
|10
|}
{|class="wikitable questTable"
!colspan=2|Forest 2
|-
!Enemy
!Count
|-
|[[Booma]]
|12
|-
|[[Hildebear]]
|2
|}
==Quest Maps==
"""
        self.assertEqual(
            parse_enemy_counts(source),
            {"Booma": 22, "Hildebear": 2},
        )

    def test_preserves_conditional_count_annotations(self) -> None:
        source = """
==Enemy Counts==
{|class="wikitable questTable"
!colspan=2|Total
|-
!Enemy
!Count
|-
|[[Dimenian]]
|38 (73)
|-
|[[Delbiter]]
|19 (+2)
|}
==Quest Maps==
"""
        result = parse_enemy_count_data(source)

        self.assertEqual(result.counts, {"Dimenian": 38, "Delbiter": 19})
        self.assertEqual(
            result.variants,
            {"Dimenian": "38 (73)", "Delbiter": "19 (+2)"},
        )

    def test_parses_three_column_total_using_final_count(self) -> None:
        source = """
==Enemy Counts==
{|class="wikitable questTable"
!colspan=3|Total
|-
!Enemy
!(Solo)
!Count
|-
|[[Dimenian]]
|(30)
|54
|}
==Quest Maps==
"""
        self.assertEqual(parse_enemy_counts(source), {"Dimenian": 54})

    def test_parses_inline_wiki_table_cells(self) -> None:
        source = """
==Enemy Counts==
{|class="wikitable"
!colspan=3|Total
|-
!Enemy !! (Solo) !! Count
|-
|[[Dimenian]] || (30) || 54
|}
==Quest Maps==
"""
        self.assertEqual(parse_enemy_counts(source), {"Dimenian": 54})

    def test_parses_collapsed_solo_and_total_count(self) -> None:
        source = """
==Enemy Counts==
{|class="wikitable questTable"
!colspan=2|Total
|-
!Enemy
!(Solo) Count
|-
|[[Dimenian]]
|(30) 54
|}
==Quest Maps==
"""
        result = parse_enemy_count_data(source)

        self.assertEqual(result.counts, {"Dimenian": 54})
        self.assertEqual(result.variants, {"Dimenian": "(30) 54"})


class AbbreviationTest(unittest.TestCase):
    """Verify stable quest abbreviations used by the Tier tables."""

    def test_numbered_series(self) -> None:
        cases = {
            "Mop-up Operation #2": "MU2",
            "Sweep-up Operation #14": "SU14",
            "Phantasmal World #3": "PW3",
            "Penumbral Surge #6": "PS6",
            "New Mop-Up Operation #4": "NMU4",
            "War of Limits 5": "WoL5",
        }
        for title, expected in cases.items():
            with self.subTest(title=title):
                self.assertEqual(quest_abbreviation(title), expected)

    def test_fixed_names(self) -> None:
        self.assertEqual(quest_abbreviation("Lost CHARGE VULCAN"), "LCV")
        self.assertEqual(quest_abbreviation("The East Tower"), "TET")


class QuestMetadataTest(unittest.TestCase):
    """Verify incomplete upstream XP values remain explicit."""

    def test_preserves_unknown_ultimate_experience(self) -> None:
        source = """
{{Quest
|title=Example
|category=Extermination
|RBR=Yes
|uxpon=???
}}
"""
        result = parse_quest_metadata(source)

        self.assertIsNone(result["ultimateExperience"])
        self.assertEqual(result["ultimateExperienceRaw"], "???")


if __name__ == "__main__":
    unittest.main()
