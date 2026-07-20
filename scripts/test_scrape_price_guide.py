"""Unit tests for price-guide table normalization."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))

from scrape_price_guide import _repeated_note_text  # noqa: E402


class RepeatedNoteTest(unittest.TestCase):
    """Verify colspan notes are not emitted as repeated price cells."""

    def test_extracts_long_repeated_note_for_same_item(self) -> None:
        note = (
            "Reminder High Attributes are 50+. Excal has lots of uses: "
            "Native Ep4 Lizard, A.Beast De Rol Le, and Machine Vol Opt Lock."
        )
        headers = ["Item Name", "N", "AB", "M", "D"]
        row = {
            "Item Name": "Excalibur",
            "N": note,
            "AB": note,
            "M": note,
            "D": note,
        }

        self.assertEqual(
            _repeated_note_text(
                row,
                headers,
                {"Item Name": "Excalibur", "N": "25+"},
            ),
            note,
        )

    def test_preserves_short_repeated_prices(self) -> None:
        headers = ["Item Name", "N", "AB", "M", "D"]
        row = {
            "Item Name": "Example",
            "N": "0.5",
            "AB": "0.5",
            "M": "0.5",
            "D": "0.5",
        }

        self.assertIsNone(
            _repeated_note_text(
                row,
                headers,
                {"Item Name": "Example"},
            )
        )


if __name__ == "__main__":
    unittest.main()
