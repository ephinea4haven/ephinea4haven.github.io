#!/usr/bin/env python3
"""
Fill missing Japanese item names in assets/js/i18n/items_i18n.js by
scraping wiki.pioneer2.net/w/<EnglishName>.

Each item page has the Japanese name in the right-side infobox as:
    <span class="more_info" title="<EN_NAME>">JAPANESE_NAME</span>

Uses a thread pool to fetch in parallel (much faster than serial). The
default concurrency of 20 keeps total time under a minute for ~700 items
without hammering the wiki.

Usage:
    python3 scripts/scrape_wiki_ja.py                      # all missing ja
    python3 scripts/scrape_wiki_ja.py --limit 5            # smoke test
    python3 scripts/scrape_wiki_ja.py --names Frame Armor  # specific items
    python3 scripts/scrape_wiki_ja.py --workers 10         # tune concurrency
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ITEMS_I18N = REPO / 'assets/js/i18n/items_i18n.js'

WIKI_BASE = 'https://wiki.pioneer2.net/w/'
UA = 'Ephinea i18n one-shot scraper'


def load_items_i18n() -> dict:
    js = ITEMS_I18N.read_text(encoding='utf-8')
    m = re.search(r'window\.ITEMS_I18N\s*=\s*(\{.*\});', js, re.DOTALL)
    return json.loads(m.group(1))


def write_items_i18n(data: dict) -> None:
    sorted_dict = {k: data[k] for k in sorted(data.keys())}
    body = json.dumps(sorted_dict, ensure_ascii=False, indent=2)
    out = (
        "/* Single source of truth for item translations.\n"
        " * Edit by hand to fix zh/en/ja strings; `scripts/merge_item_i18n.py`\n"
        " * preserves your edits — it only fills missing fields and appends new\n"
        " * items discovered in en2chinese.html / data/droptable/. */\n"
        f"window.ITEMS_I18N = {body};\n"
    )
    ITEMS_I18N.write_text(out, encoding='utf-8')


def is_japanese(s: str) -> bool:
    return any(
        '぀' <= c <= 'ヿ' or '一' <= c <= '鿿' or c == '・'
        for c in s
    )


def fetch_japanese(en_name: str) -> tuple[str | None, str]:
    page = en_name.replace(' ', '_')
    page_url = WIKI_BASE + urllib.parse.quote(page, safe='/_')
    req = urllib.request.Request(page_url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return None, f'HTTP {e.code}'
    except Exception as e:
        return None, f'{type(e).__name__}'
    pattern = (
        r'<span\s+class="more_info"\s+title="' + re.escape(en_name) +
        r'"[^>]*>([^<]+)</span>'
    )
    m = re.search(pattern, html)
    if not m:
        return None, 'no more_info span'
    ja = m.group(1).strip()
    if not is_japanese(ja):
        return None, f'span not japanese'
    return ja, ''


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--names', nargs='+', default=None)
    ap.add_argument('--workers', type=int, default=20)
    args = ap.parse_args()

    data = load_items_i18n()
    by_en = {e['en']: (slug, e) for slug, e in data.items() if e.get('en')}

    if args.names:
        targets = [(by_en[n][0], by_en[n][1]) for n in args.names if n in by_en]
    else:
        targets = [(slug, e) for slug, e in data.items()
                   if e.get('en') and not e.get('ja')]
        if args.limit:
            targets = targets[:args.limit]

    print(f'Scraping {len(targets)} items missing ja with {args.workers} workers...', flush=True)

    filled = 0
    skipped = 0
    done = 0
    futures = {}
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for slug, entry in targets:
            futures[ex.submit(fetch_japanese, entry['en'])] = (slug, entry)
        for fut in as_completed(futures):
            slug, entry = futures[fut]
            ja, err = fut.result()
            done += 1
            if ja:
                entry['ja'] = ja
                filled += 1
            else:
                skipped += 1
            if done % 50 == 0:
                write_items_i18n(data)
                print(f'  progress: {done}/{len(targets)} ({filled} filled, {skipped} skipped)', flush=True)

    write_items_i18n(data)
    print(f'\nDone. Filled {filled}/{len(targets)} ({skipped} skipped).', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
