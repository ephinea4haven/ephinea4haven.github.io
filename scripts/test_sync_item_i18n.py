"""Tests for the authoritative item-name synchronizer."""

from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))

from sync_item_i18n import (  # noqa: E402
    DEFAULT_AUTHORITY,
    OUTPUT,
    MAG_OUTPUT,
    render_mag_names,
    REPO,
    build_site_dictionary,
    load_authority,
    render,
    slugify,
)


class SyncItemTranslationsTest(unittest.TestCase):
    def test_ci_uses_immutable_authority_revision(self) -> None:
        workflow = (REPO / ".github" / "workflows" / "pages.yml").read_text(
            encoding="utf-8"
        )
        checkout = re.search(
            r"repository: warmonipa/dropcharts\s+ref: ([^\s#]+)", workflow
        )

        self.assertIsNotNone(checkout)
        self.assertRegex(checkout.group(1), r"\A[0-9a-f]{40}\Z")

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
        self.assertEqual(authority["Hammer"]["zh"], "铁锤")
        self.assertEqual(authority["Launcher"]["zh"], "强袭霰弹枪")
        self.assertEqual(authority["LAUNCHER"]["zh"], "发射器")

    def test_structured_rewards_resolve_current_authority(self) -> None:
        dictionary = build_site_dictionary(load_authority(DEFAULT_AUTHORITY))
        for relative in ("data/bdp/data.js", "data/prizelist/data.js"):
            source = (REPO / relative).read_text(encoding="utf-8")
            sections = json.loads(source.split("=", 1)[1].strip().removesuffix(";"))
            for section in sections:
                ids = ([section["label_id"]] if "label_id" in section else [])
                ids += [item for column in section["columns"] for item in column]
                for item_id in ids:
                    with self.subTest(source=relative, item_id=item_id):
                        self.assertTrue(item_id in dictionary, f"Unresolved item identity: {item_id}")
            if relative == "data/bdp/data.js":
                dorphon = next(s for s in sections if s["label_id"] == "dorphon")
                # Ephinea quest chart, Dorphon Normal: 3069 Chris, not Torato.
                self.assertEqual(dorphon["columns"][0][1], "db_s_saber_3069_chris")

    def test_mag_names_match_authority(self) -> None:
        source = MAG_OUTPUT.read_text(encoding="utf-8")
        self.assertEqual(render_mag_names(source, load_authority(DEFAULT_AUTHORITY)), source)

    def test_mag_sync_preserves_rules_and_requires_exact_identity(self) -> None:
        data = {"classes": [{"name": "Naraka", "zh": "旧译", "cond": ["POW > DEX"],
                              "triggers": {"100PB": {"rate": "50%"}}}],
                "meta": {"name": "source", "rate": 3}}
        source = "/* provenance */\nwindow.MAG_EVOLUTION = " + json.dumps(data) + ";\n"
        result = render_mag_names(source, {"Naraka": {"zh": "那罗迦"}})
        expected = json.loads(json.dumps(data))
        expected["classes"][0]["zh"] = "那罗迦"
        self.assertEqual(json.loads(result.split("window.MAG_EVOLUTION = ")[1].strip()[:-1]), expected)
        self.assertTrue(result.startswith("/* provenance */\n"))
        with self.assertRaisesRegex(ValueError, "Missing Mag identity"):
            render_mag_names(source, {"naraka": {"zh": "那罗迦"}})

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
