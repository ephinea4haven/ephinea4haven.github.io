"""Unit tests for item-translation droptable synchronization."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))

from merge_item_i18n import (  # noqa: E402
    DroptableShapeError,
    coverage_check,
    merge,
    parse_droptable,
    walk_droptable_items,
)


def droptable_with(drops):
    """Build the smallest droptable fixture containing the supplied drops."""
    return {
        'data': {
            'Normal': {
                'monsters': {
                    'Episode 1': [{'drops': drops}],
                },
                'boxes': {},
            },
        },
    }


class WalkDroptableItemsTest(unittest.TestCase):
    """Verify flat and grouped localized drop nodes stay aligned."""

    def test_walks_flat_item(self) -> None:
        tables = [
            droptable_with([{'item': value}])
            for value in ('AddSlot', '扩展插槽', 'アドスロット')
        ]

        self.assertEqual(
            list(walk_droptable_items(*tables)),
            [('AddSlot', '扩展插槽', 'アドスロット')],
        )

    def test_walks_nested_items(self) -> None:
        tables = [
            droptable_with([{'items': [{'item': first}, {'item': second}]}])
            for first, second in (
                ('AddSlot', 'Amplifier of Foie'),
                ('扩展插槽', '火球增幅器'),
                ('アドスロット', 'フォイエアンプ'),
            )
        ]

        self.assertEqual(
            list(walk_droptable_items(*tables)),
            [
                ('AddSlot', '扩展插槽', 'アドスロット'),
                ('Amplifier of Foie', '火球增幅器', 'フォイエアンプ'),
            ],
        )

    def test_rejects_mismatched_drop_shapes(self) -> None:
        tables = [
            droptable_with([{'item': 'AddSlot'}]),
            droptable_with([{'items': [{'item': '扩展插槽'}]}]),
            droptable_with([{'item': 'アドスロット'}]),
        ]

        with self.assertRaisesRegex(
            DroptableShapeError,
            'drop shapes differ',
        ):
            list(walk_droptable_items(*tables))

    def test_rejects_missing_locale_data(self) -> None:
        with self.assertRaisesRegex(
            DroptableShapeError,
            'must all be present',
        ):
            list(walk_droptable_items(droptable_with([]), {}, droptable_with([])))


class ParseDroptableTest(unittest.TestCase):
    """Required locale files must never be skipped silently."""

    def test_rejects_missing_file_with_its_path(self) -> None:
        missing = Path('/definitely/missing/droptable/zh.js')
        with self.assertRaisesRegex(FileNotFoundError, str(missing)):
            parse_droptable(missing)

    def test_rejects_unparseable_file_with_its_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            malformed = Path(directory) / 'zh.js'
            malformed.write_text('window.UNRELATED = {};', encoding='utf-8')
            with self.assertRaisesRegex(DroptableShapeError, str(malformed)):
                parse_droptable(malformed)


class MergeItemTranslationsTest(unittest.TestCase):
    """Verify synchronization follows authoritative droptable translations."""

    def test_fills_missing_fields_and_updates_existing_zh(self) -> None:
        source = {
            'sh2': {'en': 'SH2'},
            'pole': {'en': 'Pole', 'zh': '长杖'},
        }

        merged, stats = merge(
            source,
            {'SH2': 'SH2', 'Pole': '棍'},
            {'SH2': 'ＳＨ２', 'Pole': 'ポール'},
        )

        self.assertEqual(
            merged['sh2'],
            {'en': 'SH2', 'zh': 'SH2', 'ja': 'ＳＨ２'},
        )
        self.assertEqual(
            merged['pole'],
            {'en': 'Pole', 'zh': '棍', 'ja': 'ポール'},
        )
        self.assertEqual(stats['added_from_droptable'], 0)
        self.assertEqual(stats['zh_filled'], 1)
        self.assertEqual(stats['zh_updated_from_droptable'], 1)
        self.assertEqual(stats['ja_filled_from_droptable'], 2)

    def test_rejects_mismatched_nested_lengths(self) -> None:
        tables = [
            droptable_with([{'items': [{'item': 'AddSlot'}]}]),
            droptable_with([{'items': []}]),
            droptable_with([{'items': [{'item': 'アドスロット'}]}]),
        ]

        with self.assertRaisesRegex(
            DroptableShapeError,
            'en/zh/ja lengths differ',
        ):
            list(walk_droptable_items(*tables))

    def test_rejects_typographic_apostrophe_duplicate_identity(self) -> None:
        source = {
            'smart': {'en': 'Tyrell’s Parasol', 'zh': '旧译名'},
            'ascii': {'en': "Tyrell's Parasol", 'zh': '权威译名'},
        }

        with self.assertRaisesRegex(
            ValueError,
            'duplicate English item names',
        ):
            merge(source, {}, {})

    def test_droptable_updates_same_apostrophe_identity(self) -> None:
        source = {
            'parasol': {'en': 'Tyrell’s Parasol', 'zh': '旧译名'},
        }

        merged, stats = merge(
            source,
            {"Tyrell's Parasol": '总督恩赐的阳伞'},
            {"Tyrell's Parasol": '総督恩賜パラソル'},
        )

        self.assertEqual(
            merged['parasol'],
            {
                'en': 'Tyrell’s Parasol',
                'zh': '总督恩赐的阳伞',
                'ja': '総督恩賜パラソル',
            },
        )
        self.assertEqual(stats['added_from_droptable'], 0)
        self.assertEqual(stats['zh_updated_from_droptable'], 1)


class CoverageCheckTest(unittest.TestCase):
    """Verify catalog coverage uses the same name identity as merging."""

    def test_matches_case_insensitively_and_decodes_escaped_quotes(self) -> None:
        itemdata = r'''
            this.armors = {
                "18": ["HUNTER FIELD", 0],
            };
            this.shields = {
                "8e": ["GOD'S SHIELD \"KOURYU\"", 0],
            };
            this.units = {
                "08-1": ["Knight/Power--", 0],
            };
        '''
        translations = {
            'hunter_field': {'en': 'Hunter Field', 'zh': '猎人战场'},
            'kouryu': {
                'en': 'GOD\'S SHIELD "KOURYU"',
                'zh': '四神盾「黄龙」',
            },
        }

        self.assertEqual(
            coverage_check(translations, itemdata=itemdata),
            (2, 2, []),
        )


if __name__ == '__main__':
    unittest.main()
