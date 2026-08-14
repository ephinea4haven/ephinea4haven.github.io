"""Tests for the authoritative item-name synchronizer."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))

from sync_item_i18n import (  # noqa: E402
    DEFAULT_AUTHORITY,
    OUTPUT,
    build_site_dictionary,
    load_authority,
    render,
    slugify,
)


class SyncItemTranslationsTest(unittest.TestCase):
    def test_checked_in_dictionary_matches_authority(self) -> None:
        authority_bytes = DEFAULT_AUTHORITY.read_bytes()
        authority = load_authority(DEFAULT_AUTHORITY)
        expected = render(
            build_site_dictionary(authority),
            authority_bytes,
        )

        self.assertEqual(OUTPUT.read_text(encoding='utf-8'), expected)
        self.assertEqual(authority["Blade"]["zh"], "突刺匕首")
        self.assertEqual(authority["BLADE"]["zh"], "匕首")
        self.assertEqual(authority["HAMMER"]["zh"], "锤子")
        self.assertEqual(authority["Hammer"]["zh"], "金槌")
        self.assertEqual(authority["Launcher"]["zh"], "强袭散弹枪")
        self.assertEqual(authority["LAUNCHER"]["zh"], "发射器")

    def test_builds_deterministic_ids_and_preserves_mixed_width(self) -> None:
        result = build_site_dictionary(
            {
                "Angel/TP": {"zh": "天使级/ＴＰ", "ja": "エンジェル/ＴＰ"},
                "Agito (1975)": {"zh": "腭刀「1975」"},
            }
        )

        self.assertEqual(result["angel_tp"]["zh"], "天使级/ＴＰ")
        self.assertEqual(result["agito_1975"]["zh"], "腭刀「1975」")

    def test_disambiguates_slug_collisions(self) -> None:
        result = build_site_dictionary(
            {"A-B": {"zh": "一"}, "A B": {"zh": "二"}}
        )

        self.assertEqual(list(result), ["a_b", "a_b_2"])

    def test_slugify_matches_structured_page_ids(self) -> None:
        self.assertEqual(slugify("Rappy's Beak"), "rappy_s_beak")
        self.assertEqual(slugify("L&K14 COMBAT"), "l_k14_combat")


if __name__ == "__main__":
    unittest.main()
