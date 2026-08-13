#!/usr/bin/env python3
"""
Synchronize the canonical assets/js/i18n/items_i18n.js translation dictionary.

The localized droptables under data/droptable/{bb,dc,ngc}/data/ are
authoritative for Chinese translations of overlapping English names.
items_i18n.js remains the canonical dictionary consumed by the site and owns
translations for names that are not present in a droptable. Character-width
variants are a presentation concern and do not alter the authoritative text.

After synchronization, items_i18n.js is rewritten with entries sorted by slug
key. Existing keys/values are preserved; new entries get a generated
snake_case slug from their English name.

Usage:
  python3 scripts/merge_item_i18n.py [--dry-run]
"""
import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ITEMS_I18N = REPO / 'assets/js/i18n/items_i18n.js'
DROPTABLE_DIR = REPO / 'data/droptable'
REGIONS = ['bb', 'dc', 'ngc']


class DroptableShapeError(ValueError):
    """Raised when localized droptable structures cannot be paired safely."""


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", '_', s)
    return s.strip('_') or 'item'


def is_placeholder(s: str | None) -> bool:
    """True if s is empty/whitespace or made up entirely of placeholder
    glyphs the upstream uses for unidentified items (`?`, `？`, `-`)."""
    if not s:
        return True
    stripped = s.strip()
    if not stripped:
        return True
    return all(c in '?？-' for c in stripped)


def load_items_i18n() -> dict:
    js = ITEMS_I18N.read_text(encoding='utf-8')
    m = re.search(r"window\.ITEMS_I18N\s*=\s*(\{.*?\});", js, re.DOTALL)
    if not m:
        raise RuntimeError('Could not parse items_i18n.js')
    return json.loads(m.group(1))


def parse_droptable(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f'Required droptable locale is missing: {path}')
    js = path.read_text(encoding='utf-8')
    m = re.search(r"window\.DROP_DATA_\w+\s*=\s*(\{.*\});?\s*$", js, re.DOTALL)
    if not m:
        raise DroptableShapeError(f'Could not parse droptable locale: {path}')
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as error:
        raise DroptableShapeError(
            f'Invalid JSON in droptable locale {path}: {error}'
        ) from error


def parallel_entries(en_values, zh_values, ja_values, *, context: str):
    """Pair three localized sequences after validating their lengths."""
    values = (en_values, zh_values, ja_values)
    if not all(isinstance(value, list) for value in values):
        raise DroptableShapeError(f'{context}: expected three lists')
    lengths = tuple(len(value) for value in values)
    if len(set(lengths)) != 1:
        raise DroptableShapeError(
            f'{context}: en/zh/ja lengths differ: {lengths}'
        )
    return zip(*values)


def walk_parallel_drop_items(en_drop, zh_drop, ja_drop, *, context: str):
    """Yield localized item triples from one flat or nested drop node."""
    drops = (en_drop, zh_drop, ja_drop)
    if not all(isinstance(drop, dict) for drop in drops):
        raise DroptableShapeError(f'{context}: expected three drop objects')

    shapes = tuple(
        'item' if 'item' in drop else 'items' if 'items' in drop else 'unknown'
        for drop in drops
    )
    if len(set(shapes)) != 1 or shapes[0] == 'unknown':
        raise DroptableShapeError(
            f'{context}: en/zh/ja drop shapes differ: {shapes}'
        )

    if shapes[0] == 'item':
        items = tuple(drop['item'] for drop in drops)
        if not all(isinstance(item, str) for item in items):
            raise DroptableShapeError(f'{context}: item values must be strings')
        yield items
        return

    nested = parallel_entries(
        *(drop['items'] for drop in drops),
        context=f'{context}.items',
    )
    for index, child_drops in enumerate(nested):
        yield from walk_parallel_drop_items(
            *child_drops,
            context=f'{context}.items[{index}]',
        )


def walk_droptable_items(en_data, zh_data, ja_data):
    """Yield item triples from structurally aligned localized droptables."""
    if not en_data or not zh_data or not ja_data:
        raise DroptableShapeError('en/zh/ja droptable data must all be present')
    for difficulty in en_data['data']:
        en_diff = en_data['data'][difficulty]
        try:
            zh_diff = zh_data['data'][difficulty]
            ja_diff = ja_data['data'][difficulty]
        except KeyError as error:
            raise DroptableShapeError(
                f'{difficulty}: missing localized difficulty'
            ) from error
        for section in ('monsters', 'boxes'):
            en_sec = en_diff.get(section, {})
            zh_sec = zh_diff.get(section, {})
            ja_sec = ja_diff.get(section, {})
            for episode in en_sec:
                en_list = en_sec[episode]
                try:
                    zh_list = zh_sec[episode]
                    ja_list = ja_sec[episode]
                except KeyError as error:
                    raise DroptableShapeError(
                        f'{difficulty}/{section}/{episode}: '
                        'missing localized episode'
                    ) from error
                context = f'{difficulty}/{section}/{episode}'
                entries = parallel_entries(
                    en_list, zh_list, ja_list, context=context
                )
                for entry_index, entries_by_language in enumerate(entries):
                    entry_context = f'{context}[{entry_index}]'
                    drops = tuple(
                        entry.get('drops', [])
                        for entry in entries_by_language
                    )
                    parallel_drops = parallel_entries(
                        *drops, context=f'{entry_context}.drops'
                    )
                    for drop_index, drops_by_language in enumerate(parallel_drops):
                        yield from walk_parallel_drop_items(
                            *drops_by_language,
                            context=f'{entry_context}.drops[{drop_index}]',
                        )


def load_droptable_pairs() -> tuple[dict, dict]:
    en_to_zh, en_to_ja = {}, {}
    for region in REGIONS:
        en_data = parse_droptable(DROPTABLE_DIR / region / 'data/en.js')
        zh_data = parse_droptable(DROPTABLE_DIR / region / 'data/zh.js')
        ja_data = parse_droptable(DROPTABLE_DIR / region / 'data/ja.js')
        for en, zh, ja in walk_droptable_items(en_data, zh_data, ja_data):
            en = en.strip()
            zh = (zh or '').strip()
            ja = (ja or '').strip()
            if is_placeholder(en):
                continue
            if zh and not is_placeholder(zh) and zh != en:
                en_to_zh.setdefault(en, zh)
            if ja and not is_placeholder(ja) and ja != en:
                en_to_ja.setdefault(en, ja)
    return en_to_zh, en_to_ja


def merge(items_i18n, dt_zh, dt_ja):
    """
    Merge sources into a slug-keyed dict with zh/en/ja per entry.

    Returns: (merged_dict, stats)
    """
    # Start with existing items_i18n; index by EN name (and lowercased EN) for lookup.
    by_en = {}
    by_en_lower = {}
    for slug, entry in items_i18n.items():
        en = entry.get('en')
        if en:
            lower = en.lower()
            if lower in by_en_lower:
                other_slug, _ = by_en_lower[lower]
                raise ValueError(
                    f'duplicate English item names: {other_slug!r} and {slug!r}'
                )
            copied = dict(entry)
            by_en[en] = (slug, copied)
            by_en_lower[lower] = (slug, copied)

    stats = {
        'pre_existing': len(items_i18n),
        'added_from_droptable': 0,
        'zh_filled': 0,
        'zh_updated_from_droptable': 0,
        'ja_filled_from_droptable': 0,
    }

    def upsert(en: str, zh: str | None, ja: str | None) -> bool:
        if not en:
            return False
        # Match case-insensitively to avoid creating duplicate entries that
        # differ only in case (Title Case vs UPPERCASE).
        existing_key = en if en in by_en else None
        if not existing_key:
            existing_key_lower = en.lower()
            if existing_key_lower in by_en_lower:
                # Use the canonical (lowercased) match's slug
                slug, entry = by_en_lower[existing_key_lower]
                existing_key = entry.get('en')
        if existing_key:
            slug, entry = by_en[existing_key]
            if zh and not entry.get('zh'):
                entry['zh'] = zh
                stats['zh_filled'] += 1
            elif zh and entry['zh'] != zh:
                entry['zh'] = zh
                stats['zh_updated_from_droptable'] += 1
            # ja: fill if missing
            if ja and not entry.get('ja'):
                entry['ja'] = ja
                stats['ja_filled_from_droptable'] += 1
            return False
        else:
            slug = slugify(en)
            # Disambiguate slug collision
            base = slug
            n = 2
            while slug in items_i18n:
                slug = f'{base}_{n}'
                n += 1
            # Only set fields we know — leave ja missing if not provided so
            # later droptable pass can fill it (and consumers can fall back
            # to en at render time).
            entry = {'en': en}
            if zh:
                entry['zh'] = zh
            if ja:
                entry['ja'] = ja
            items_i18n[slug] = entry
            by_en[en] = (slug, entry)
            by_en_lower[en.lower()] = (slug, entry)
            return True

    # Apply each discovered English name once. Droptable zh wins on overlap.
    for en in dict.fromkeys((*dt_zh, *dt_ja)):
        if upsert(en, dt_zh.get(en), dt_ja.get(en)):
            stats['added_from_droptable'] += 1

    # Sync entries dict from by_en mutations
    for slug, entry in by_en.values():
        items_i18n[slug] = entry

    stats['final_total'] = len(items_i18n)
    return items_i18n, stats


def write_items_i18n(merged: dict):
    """Write items_i18n.js, sorted by slug, preserving the file header comment."""
    sorted_keys = sorted(merged.keys())
    sorted_dict = {k: merged[k] for k in sorted_keys}
    body = json.dumps(sorted_dict, ensure_ascii=False, indent=2)
    out = (
        "/* Canonical site dictionary for item translations.\n"
        " * Droptable zh is authoritative for overlapping English names;\n"
        " * other entries are maintained here. Width is a display preference.\n"
        " * Run `scripts/merge_item_i18n.py` after droptable updates. */\n"
        f"window.ITEMS_I18N = {body};\n"
    )
    ITEMS_I18N.write_text(out, encoding='utf-8')


def coverage_check(merged: dict, *, itemdata: str | None = None):
    """Report translation coverage for canonical armor/shield/unit names.

    Hyphenated item-data keys represent stat variants of a canonical unit and
    are intentionally excluded. English-name matching follows the merge
    contract and is case-insensitive.
    """
    if itemdata is None:
        itemdata = (REPO / 'src/app/status/item-data.js').read_text(
            encoding='utf-8'
        )
    # Capture a JSON-compatible JavaScript string, including escaped quotes,
    # from entries such as: "00": ["Frame", 5, 0, ...].
    pattern = re.compile(r'^\s*"\w+":\s*\["((?:\\.|[^"\\])*)"', re.MULTILINE)
    names = {
        json.loads(f'"{match.group(1)}"')
        for match in pattern.finditer(itemdata)
    }
    translated_names = {
        entry['en'].casefold()
        for entry in merged.values()
        if entry.get('en')
    }
    missing = sorted(
        name for name in names if name.casefold() not in translated_names
    )
    covered = len(names) - len(missing)
    return covered, len(names), missing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    print('Loading sources...')
    items_i18n = load_items_i18n()
    dt_zh, dt_ja = load_droptable_pairs()
    print(f'  items_i18n.js: {len(items_i18n)} entries')
    print(f'  droptable: {len(dt_zh)} en->zh, {len(dt_ja)} en->ja')

    print('\nMerging...')
    merged, stats = merge(items_i18n, dt_zh, dt_ja)
    for k, v in stats.items():
        print(f'  {k}: {v}')

    print('\nCoverage check vs itemdata.js armor/shield/unit names:')
    covered, total, missing = coverage_check(merged)
    print(f'  {covered}/{total} covered')
    if missing:
        print(f'  Missing examples (first 20): {missing[:20]}')

    if args.dry_run:
        print('\n[dry-run] Not writing items_i18n.js.')
        return

    print(f'\nWriting items_i18n.js ({stats["final_total"]} entries)...')
    write_items_i18n(merged)
    print('Done.')


if __name__ == '__main__':
    main()
