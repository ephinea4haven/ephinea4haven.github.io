"""Integrity tests for curated RBR and non-RBR Tier data."""

from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TIERS_PATH = ROOT / "data/rbr/tiers.json"
SOURCE_PATH = ROOT / "data/rbr/source.json"


def load_json(path: Path, /) -> dict:
    """Load one UTF-8 JSON document."""
    with path.open(encoding="utf-8") as source:
        return json.load(source)


class RbrTierIntegrityTest(unittest.TestCase):
    """Ensure subjective ratings cover the generated candidate pool once."""

    @classmethod
    def setUpClass(cls) -> None:
        """Load curated and generated data once for all assertions."""
        cls.tiers = load_json(TIERS_PATH)
        cls.source = load_json(SOURCE_PATH)

    def test_all_58_candidates_appear_once(self) -> None:
        tier_groups = self.tiers["rbr"]["tiers"]
        rated = [
            abbreviation
            for abbreviations in tier_groups.values()
            for abbreviation in abbreviations
        ]
        candidates = [
            quest["abbreviation"] for quest in self.source["quests"]
        ]

        self.assertEqual(len(rated), 58)
        self.assertEqual(len(rated), len(set(rated)), "duplicate Tier entry")
        self.assertEqual(set(rated), set(candidates))

    def test_tier_order_is_stable(self) -> None:
        self.assertEqual(
            list(self.tiers["rbr"]["tiers"]),
            ["S", "A", "B", "C", "D"],
        )
        self.assertEqual(
            list(self.tiers["nonRbr"]["tiers"]),
            ["SS", "S", "A"],
        )


if __name__ == "__main__":
    unittest.main()
