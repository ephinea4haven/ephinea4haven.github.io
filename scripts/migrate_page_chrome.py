#!/usr/bin/env python3
"""
One-shot migration: replace the <header><h1 id="project_title">TITLE</h1></header>
+ adjacent .back-link in each page with a <page-chrome title="..."> custom element,
and add the page-chrome.js script tag to <head>.

After this script runs successfully and the result is reviewed, the script can
be deleted (one-shot, not part of the build).

Usage:
    python3 scripts/migrate_page_chrome.py [--dry-run] [path ...]
"""

import argparse
import re
import sys
from pathlib import Path

SCRIPT_TAG = '<script src="/assets/js/page-chrome.js"></script>'

# Default back-href/back-text pairs that don't need explicit attributes
DEFAULT_BACK_HREFS = {'/index.html', '../index.html'}
DEFAULT_BACK_TEXTS = {'← 返回首页', '&larr; 返回首页'}

HEADER_RE = re.compile(
    r'<header>\s*<h1 id="project_title">(.*?)</h1>\s*</header>',
    re.DOTALL,
)

BACKLINK_RE = re.compile(
    r'<a href="([^"]*)" class="back-link">(.*?)</a>',
    re.DOTALL,
)

# Match the indent before the header (so we can preserve it on replacement)
HEADER_BLOCK_RE = re.compile(
    r'([ \t]*)<header>\s*<h1 id="project_title">(.*?)</h1>\s*</header>'
    r'\s*\n\s*'
    r'<a href="([^"]*)" class="back-link">(.*?)</a>',
    re.DOTALL,
)


def migrate(html, path):
    # 1. Inject script tag into <head> if not present
    if SCRIPT_TAG not in html:
        if '</head>' not in html:
            print(f'  SKIP (no </head>): {path}')
            return None
        html = html.replace(
            '</head>',
            f'    {SCRIPT_TAG}\n</head>',
            1,
        )

    # 2. Replace header + back-link with <page-chrome> tag
    m = HEADER_BLOCK_RE.search(html)
    if not m:
        print(f'  SKIP (no header+back-link block): {path}')
        return None

    indent, title, back_href, back_text = m.groups()
    title = title.strip()
    back_href = back_href.strip()
    back_text = back_text.strip()

    # Build attributes
    attrs = [f'title="{title}"']
    if back_href not in DEFAULT_BACK_HREFS:
        attrs.append(f'back-href="{back_href}"')
    if back_text not in DEFAULT_BACK_TEXTS:
        attrs.append(f'back-text="{back_text}"')

    tag = f'{indent}<page-chrome {" ".join(attrs)}></page-chrome>'

    new_html = html[:m.start()] + tag + html[m.end():]
    return new_html


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('paths', nargs='*', help='HTML files to migrate (default: from grep)')
    args = ap.parse_args()

    if args.paths:
        paths = [Path(p) for p in args.paths]
    else:
        # Default set: any HTML with #project_title, minus index.html (custom landing)
        # and the bdp/prizelist pages (which use #pageTitle, not in the standard chrome).
        repo = Path('.')
        paths = []
        for p in repo.rglob('*.html'):
            # Skip node_modules and event/christmas/ fragments
            if 'node_modules' in p.parts or 'christmas' in p.parts:
                continue
            text = p.read_text(encoding='utf-8', errors='replace')
            if '<h1 id="project_title">' not in text:
                continue
            if p == Path('index.html'):
                continue
            paths.append(p)

    print(f'Migrating {len(paths)} files...')
    changed = 0
    for path in paths:
        html = path.read_text(encoding='utf-8')
        new_html = migrate(html, path)
        if new_html is None or new_html == html:
            continue
        if args.dry_run:
            print(f'  [dry-run] would update: {path}')
        else:
            path.write_text(new_html, encoding='utf-8')
            print(f'  updated: {path}')
        changed += 1

    print(f'Done. {changed}/{len(paths)} files {"would be" if args.dry_run else "were"} changed.')


if __name__ == '__main__':
    main()
