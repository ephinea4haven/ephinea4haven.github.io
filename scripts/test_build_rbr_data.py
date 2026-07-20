"""Unit tests for the RBR source-data generator."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))

from build_rbr_data import (  # noqa: E402
    SourceParseError,
    build_tracker_summary,
    parse_current_rbr,
    parse_enemy_count_data,
    parse_enemy_counts,
    parse_quest_metadata,
    parse_rbr_tracker,
    quest_abbreviation,
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
