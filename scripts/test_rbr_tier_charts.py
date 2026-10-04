"""Integrity tests for the generated RBR tier chart assets."""

from __future__ import annotations

import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from scripts import build_rbr_tier_charts as charts


class RbrTierChartTest(unittest.TestCase):
    """Keep checked-in charts synchronized with their data and palette."""

    def test_charts_contain_only_tiers_and_quest_labels(self) -> None:
        namespace = {"svg": "http://www.w3.org/2000/svg"}
        for language in charts.LANGUAGES:
            for rows, filename in charts.CHARTS:
                root = ET.parse(charts.OUTPUT_DIR / language / filename).getroot()
                self.assertEqual(root.findall(".//svg:image", namespace), [])
                self.assertEqual(root.findall(".//svg:use", namespace), [])
                # One background, one label per tier, and only occupied quest cells.
                self.assertEqual(
                    len(root.findall("svg:rect", namespace)),
                    1 + len(rows) + sum(len(entries) for _, entries in rows),
                )
                expected = []
                for tier, entries in rows:
                    expected.append(tier)
                    for quest, section_id in entries:
                        expected.extend((quest, section_id))
                self.assertEqual([node.text for node in root.findall("svg:text", namespace)], expected)

    def test_checked_in_charts_are_current(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            for language in charts.LANGUAGES:
                for rows, filename in charts.CHARTS:
                    generated = Path(temp_dir) / f"{language}-{filename}"
                    charts.build_chart(rows, generated, language=language)
                    checked_in = charts.OUTPUT_DIR / language / filename
                    self.assertEqual(
                        generated.read_text(encoding="utf-8"),
                        checked_in.read_text(encoding="utf-8"),
                        f"Regenerate {language}/{filename} with build_rbr_tier_charts.py",
                    )

    def test_quest_section_colors_match_drop_table(self) -> None:
        palette = charts.load_section_palette()
        for language in charts.LANGUAGES:
            for rows, filename in charts.CHARTS:
                svg = (charts.OUTPUT_DIR / language / filename).read_text(encoding="utf-8")
                for section_id in {section_id for _, entries in rows for _, section_id in entries}:
                    color = palette[section_id]
                    self.assertIn(section_id, svg)
                    self.assertIn(color, svg)

    def test_green_section_ids_match_source_articles(self) -> None:
        def section_id_for(rows, quest):
            return next(
                section_id
                for _, entries in rows
                for abbreviation, section_id in entries
                if abbreviation == quest
            )

        expected = {
            "LIS": "Viridia",
            "EN1": "Viridia",
            "SU11": "Viridia",
            "MAE4": "Greenill",
            "TTF": "Viridia",
            "MA4B": "Viridia",
        }
        for quest, section_id in expected.items():
            rows = charts.RBR_ROWS if quest in {"LIS", "EN1", "SU11"} else charts.NON_RBR_ROWS
            self.assertEqual(section_id_for(rows, quest), section_id)

    def test_green_section_ids_in_page_copy(self) -> None:
        page = (charts.ROOT / "guide/rbr.html").read_text(encoding="utf-8")
        expected_copy = (
            '<span data-item-en="Heart of Daisy Chain"></span>（Viridia）',
            '<span data-item-en="L&amp;K38 Combat"></span>（Viridia）',
            '<span data-item-en="Heaven Striker"></span>（Greenill / Redria）',
            'Greenill 可刷 Pyro Goran 的<span data-item-en="Heaven Striker"></span>',
            "出现 Hildetorr 时换 Viridia",
            'Viridia 可从 Dal Ra Lie 刷取 <span data-item-en="L&amp;K38 Combat"></span>',
            'Viridia 刷 <span data-item-en="L&amp;K38 Combat"></span>',
            "Dark Falz；Viridia / Redria 有效",
        )
        for text in expected_copy:
            self.assertIn(text, page)


if __name__ == "__main__":
    unittest.main()
