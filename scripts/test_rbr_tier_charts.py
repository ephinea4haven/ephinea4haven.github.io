"""Integrity tests for the generated RBR tier chart assets."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts import build_rbr_tier_charts as charts


class RbrTierChartTest(unittest.TestCase):
    """Keep checked-in charts synchronized with their data and palette."""

    def test_checked_in_charts_are_current(self) -> None:
        cases = (
            (
                charts.RBR_ROWS,
                "rbr-tier-section-colors.svg",
                7,
                967,
            ),
            (
                charts.NON_RBR_ROWS,
                "non-rbr-tier-section-colors.svg",
                4,
                1452,
            ),
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            for rows, filename, columns, width in cases:
                generated = Path(temp_dir) / filename
                charts.build_chart(
                    rows,
                    generated,
                    columns=columns,
                    width=width,
                )
                checked_in = charts.OUTPUT_DIR / filename
                self.assertEqual(
                    generated.read_text(encoding="utf-8"),
                    checked_in.read_text(encoding="utf-8"),
                    f"Regenerate {filename} with build_rbr_tier_charts.py",
                )

    def test_every_drop_table_color_is_embedded(self) -> None:
        palette = charts.load_section_palette()
        for filename in (
            "rbr-tier-section-colors.svg",
            "non-rbr-tier-section-colors.svg",
        ):
            svg = (charts.OUTPUT_DIR / filename).read_text(encoding="utf-8")
            for section_id, color in palette.items():
                self.assertIn(section_id, svg)
                self.assertIn(color, svg)


if __name__ == "__main__":
    unittest.main()
