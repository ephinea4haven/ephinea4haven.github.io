"""Unit tests for price-guide table normalization."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))

from scrape_price_guide import WikiTableExtractor, process_table, _repeated_note_text  # noqa: E402


class PriceColumnsTest(unittest.TestCase):
    """Price columns must remain distinct and addressable after extraction."""

    def extract(self, html):
        parser = WikiTableExtractor()
        parser.feed(html)
        return [process_table(title, grid) for title, grid in parser.tables]

    def test_blank_name_header_keeps_frame_identities(self):
        result = self.extract('''<h2>Frames</h2><table>
            <tr><th></th><th>1-3 slots</th><th>4 slots</th></tr>
            <tr><td>Common frames</td><td>0</td><td>0.5-1</td></tr>
            <tr><td>Common armors</td><td>0</td><td>0.5-1</td></tr></table>''')[0]
        self.assertEqual(result['headers'], ['Item Name', '1-3 slots', '4 slots'])
        self.assertEqual(result['data'][0]['Item Name'], 'Common frames')
        self.assertEqual(result['data'][1]['Item Name'], 'Common armors')

    def test_duplicate_prices_do_not_overwrite_each_other(self):
        result = self.extract('''<table>
            <tr><th>Old Paints</th><th>Price</th><th>New Paints</th><th>Price</th></tr>
            <tr><td>Black Paint</td><td>2-3</td><td>Cyan Paint</td><td>5</td></tr></table>''')[0]
        self.assertEqual(result['headers'], ['Old Paints', 'Price', 'New Paints', 'Price [2]'])
        self.assertEqual(result['data'][0]['Price'], '2-3')
        self.assertEqual(result['data'][0]['Price [2]'], '5')

    def test_unlabeled_trailing_values_remain_visible(self):
        result = self.extract('''<table><tr><th>Item Name</th><th>Price</th></tr>
            <tr><td>Kunai</td><td>5</td><td>Inestimable</td></tr></table>''')[0]
        self.assertEqual(result['headers'], ['Item Name', 'Price', 'Unlabeled column 3'])
        self.assertEqual(result['data'][0]['Unlabeled column 3'], 'Inestimable')

    def test_repeated_prices_with_two_header_rows_and_spanning_names(self):
        result = self.extract('''<table>
            <tr><th>Item Name</th><th rowspan="2">Price</th><th>Item Name</th><th rowspan="2">Price</th></tr>
            <tr><th>Old Paints</th><th>New Paints</th></tr>
            <tr><td rowspan="2">Black Paint</td><td>2-3</td><td>Cyan Paint</td><td>5</td></tr>
            <tr><td>4</td><td>Rose Paint</td><td>6</td></tr></table>''')[0]
        self.assertEqual(result['headers'], ['Old Paints', 'Price', 'New Paints', 'Price [2]'])
        self.assertEqual(result['data'], [
            {'Old Paints': 'Black Paint', 'Price': '2-3', 'New Paints': 'Cyan Paint', 'Price [2]': '5'},
            {'Old Paints': 'Black Paint', 'Price': '4', 'New Paints': 'Rose Paint', 'Price [2]': '6'},
        ])

    def test_wiki_navigation_is_not_a_price_table(self):
        self.assertEqual(self.extract('''<h2>Services</h2><table class="navbox">
            <tr><th>Guides</th></tr><tr><td>Basics</td></tr></table>'''), [])


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
