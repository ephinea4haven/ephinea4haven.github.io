#!/usr/bin/env python3
"""
Merge item translation data from multiple sources into the canonical
assets/js/i18n/items_i18n.js dictionary.

Sources (priority high -> low for conflict resolution on zh):
  1. Existing items_i18n.js (hand-edited zh names — keep as-is)
  2. data/en2chinese.html (hand-curated en->zh, no Japanese)
  3. data/droptable/{bb,dc,ngc}/data/{en,zh,ja}.js (read-only; pair walks)

For en/ja, source #1 wins; otherwise droptable fills gaps. en2chinese has
no Japanese so it never sets ja.

After merging, items_i18n.js is rewritten with entries sorted by slug
key. Existing keys/values are preserved if no new info; new entries
get a generated snake_case slug from their English name.

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
EN2CHINESE = REPO / 'data/en2chinese.html'
DROPTABLE_DIR = REPO / 'data/droptable'
REGIONS = ['bb', 'dc', 'ngc']


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


def load_en2chinese() -> dict:
    """Parse <li>EN ZH</li> entries -> en->zh dict."""
    html = EN2CHINESE.read_text(encoding='utf-8')
    pairs = {}
    for m in re.finditer(r'<li>([^<]+)</li>', html):
        line = m.group(1).strip()
        # Split: leading non-CJK chars are EN, then CJK starts the ZH part.
        m2 = re.match(r'^([^一-鿿＀-￯　-〿]+?)\s+([一-鿿＀-￯　-〿].*)$', line)
        if m2:
            en, zh = m2.group(1).strip(), m2.group(2).strip()
            if is_placeholder(en) or is_placeholder(zh) or en == zh:
                continue
            pairs.setdefault(en, zh)
    return pairs


def parse_droptable(path: Path) -> dict | None:
    if not path.exists():
        return None
    js = path.read_text(encoding='utf-8')
    m = re.search(r"window\.DROP_DATA_\w+\s*=\s*(\{.*\});?\s*$", js, re.DOTALL)
    if not m:
        return None
    return json.loads(m.group(1))


def walk_droptable_items(en_data, zh_data, ja_data):
    """Yield (en, zh, ja) item triples from parallel walk of monsters + boxes."""
    if not en_data or not zh_data or not ja_data:
        return
    for difficulty in en_data['data']:
        en_diff = en_data['data'][difficulty]
        zh_diff = zh_data['data'].get(difficulty, {})
        ja_diff = ja_data['data'].get(difficulty, {})
        for section in ('monsters', 'boxes'):
            en_sec = en_diff.get(section, {})
            zh_sec = zh_diff.get(section, {})
            ja_sec = ja_diff.get(section, {})
            for episode in en_sec:
                en_list = en_sec[episode]
                zh_list = zh_sec.get(episode, [])
                ja_list = ja_sec.get(episode, [])
                for i, en_entry in enumerate(en_list):
                    if i >= len(zh_list) or i >= len(ja_list):
                        continue
                    en_drops = en_entry.get('drops', [])
                    zh_drops = zh_list[i].get('drops', [])
                    ja_drops = ja_list[i].get('drops', [])
                    for j, en_drop in enumerate(en_drops):
                        if j >= len(zh_drops) or j >= len(ja_drops):
                            continue
                        yield en_drop['item'], zh_drops[j]['item'], ja_drops[j]['item']


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


def merge(items_i18n, en2cn, dt_zh, dt_ja):
    """
    Merge sources into a slug-keyed dict with zh/en/ja per entry.

    Returns: (merged_dict, stats)
    """
    # Drop any existing placeholder entries (?? / ??? / -- etc.) before merging.
    placeholder_slugs = [
        slug for slug, entry in items_i18n.items()
        if is_placeholder(entry.get('en')) or is_placeholder(entry.get('zh'))
    ]
    for slug in placeholder_slugs:
        del items_i18n[slug]

    # Start with existing items_i18n; index by EN name for lookup.
    by_en = {}
    for slug, entry in items_i18n.items():
        en = entry.get('en')
        if en:
            by_en[en] = (slug, dict(entry))  # dict copy

    stats = {
        'pre_existing': len(items_i18n) + len(placeholder_slugs),
        'placeholders_pruned': len(placeholder_slugs),
        'added_from_en2chinese': 0,
        'added_from_droptable': 0,
        'zh_filled': 0,
        'ja_filled_from_droptable': 0,
        'zh_conflicts_kept_existing': 0,
    }

    def upsert(en: str, zh: str | None, ja: str | None):
        if not en:
            return
        if en in by_en:
            slug, entry = by_en[en]
            # Don't overwrite hand-edited zh
            if zh and entry.get('zh') and entry['zh'] != zh:
                stats['zh_conflicts_kept_existing'] += 1
            elif zh and not entry.get('zh'):
                entry['zh'] = zh
                stats['zh_filled'] += 1
            # ja: fill if missing
            if ja and not entry.get('ja'):
                entry['ja'] = ja
                stats['ja_filled_from_droptable'] += 1
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

    # Apply en2chinese (en -> zh, no ja)
    for en, zh in en2cn.items():
        before = en in by_en
        upsert(en, zh, None)
        if not before:
            stats['added_from_en2chinese'] += 1

    # Apply droptable (en -> zh and ja, in two passes so en->zh adds entries first)
    for en, zh in dt_zh.items():
        before = en in by_en
        upsert(en, zh, dt_ja.get(en))
        if not before:
            stats['added_from_droptable'] += 1
    for en, ja in dt_ja.items():
        if en not in by_en:
            upsert(en, dt_zh.get(en), ja)
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
        "/* Single source of truth for item translations.\n"
        " * Edit by hand to fix zh/en/ja strings; `scripts/merge_item_i18n.py`\n"
        " * preserves your edits — it only fills missing fields and appends new\n"
        " * items discovered in en2chinese.html / data/droptable/. */\n"
        f"window.ITEMS_I18N = {body};\n"
    )
    ITEMS_I18N.write_text(out, encoding='utf-8')


def coverage_check(merged: dict):
    """Report how many itemdata.js armor/shield/unit names are covered."""
    itemdata = (REPO / 'assets/js/itemdata.js').read_text(encoding='utf-8')
    # Extract the English item name from each entry like:
    #   "00": ["Frame", 5, 0, ...],
    names = set()
    for m in re.finditer(r'"\w+":\s*\["([^"]+)"', itemdata):
        names.add(m.group(1))
    by_en = {entry['en']: slug for slug, entry in merged.items()}
    covered = sum(1 for n in names if n in by_en)
    missing = [n for n in names if n not in by_en]
    return covered, len(names), missing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    print('Loading sources...')
    items_i18n = load_items_i18n()
    en2cn = load_en2chinese()
    dt_zh, dt_ja = load_droptable_pairs()
    print(f'  items_i18n.js: {len(items_i18n)} entries')
    print(f'  en2chinese.html: {len(en2cn)} en->zh pairs')
    print(f'  droptable: {len(dt_zh)} en->zh, {len(dt_ja)} en->ja')

    print('\nMerging...')
    merged, stats = merge(items_i18n, en2cn, dt_zh, dt_ja)
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
