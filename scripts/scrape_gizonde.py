#!/usr/bin/env python3
"""
Scrape Gizonde stunlock tables from wiki.pioneer2.net/w/Vol_Opt
and output JS data for volopt.html.

Usage:
    python3 scripts/scrape_gizonde.py > assets/js/volopt_data.js
"""

import json
import re
import sys
import urllib.request
from html.parser import HTMLParser


class SimpleTableParser(HTMLParser):
    """Parse a single HTML table into rows of text cells."""

    def __init__(self):
        super().__init__()
        self.rows = []
        self.current_row = []
        self.in_cell = False
        self.cell_text = ""
        self.cell_colspan = 1

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "tr":
            self.current_row = []
        elif tag in ("th", "td"):
            self.in_cell = True
            self.cell_text = ""
            self.cell_colspan = int(a.get("colspan", 1))

    def handle_endtag(self, tag):
        if tag == "tr":
            if self.current_row:
                self.rows.append(self.current_row)
        elif tag in ("th", "td") and self.in_cell:
            self.in_cell = False
            text = self.cell_text.strip()
            for _ in range(self.cell_colspan):
                self.current_row.append(text)

    def handle_data(self, data):
        if self.in_cell:
            self.cell_text += data


def extract_weapon_name(cell_html):
    """Extract weapon name from HTML cell."""
    titles = re.findall(r'title="([^"]+)"', cell_html)
    weapon_titles = [t for t in titles if t not in ("Weapon", "Attributes", "Gizonde")]
    if not weapon_titles:
        return None
    name = weapon_titles[0]
    # Check for set item suffix like "+ Crimson Coat"
    after_span = re.sub(r'<[^>]+>', ' ', cell_html)
    after_span = re.sub(r'\s+', ' ', after_span).strip()
    if "+" in after_span:
        m = re.search(r'\+\s*\S.*', after_span)
        if m:
            suffix = m.group(0).strip()
            # Clean: get just "+ ItemName"
            for title in titles:
                if title != name and title in suffix:
                    name = name + " + " + title
                    break
    return name


def parse_table(table_html):
    """Parse a Gizonde table, return {weapon: {pct: val}}."""
    PCTS = [0, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]

    # Extract weapon names from raw HTML (td cells with links)
    weapon_names = []
    for m in re.finditer(r'<td[^>]*style="text-align:left"[^>]*>(.*?)</td>', table_html, re.DOTALL):
        wn = extract_weapon_name(m.group(1))
        if wn:
            weapon_names.append(wn)

    # Parse table cells
    parser = SimpleTableParser()
    parser.feed(table_html)

    weapons = {}
    data_row_idx = 0

    for row in parser.rows:
        if not row:
            continue
        # Skip header rows (contain "Weapon", "Machine Percent", or percentage headers)
        first = row[0].strip()
        if first in ("Weapon", "", "0", "15") or "Machine" in first:
            continue

        # This is a data row
        wname = weapon_names[data_row_idx] if data_row_idx < len(weapon_names) else first
        data_row_idx += 1

        vals = {}
        for i, pct in enumerate(PCTS):
            ci = i + 1
            if ci < len(row):
                v = row[ci].strip()
                if v:
                    try:
                        vals[pct] = int(v)
                    except ValueError:
                        pass

        if vals:
            weapons[wname] = vals

    return weapons


def main():
    url = "https://wiki.pioneer2.net/w/Vol_Opt"
    print(f"Fetching {url} ...", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode()

    # Find the Gizonde section
    giz_start = html.find("Number of")
    if giz_start < 0:
        print("ERROR: Could not find Gizonde section", file=sys.stderr)
        sys.exit(1)

    search_start = html.rfind('class="tabber"', 0, giz_start)
    giz_end = html.find('<h2', giz_start)
    if giz_end < 0:
        giz_end = len(html)
    section = html[search_start:giz_end]

    # Collect events: TABs and TABLEs with positions
    tab_re = re.compile(r'<div\s+class="tabbertab"\s+title="([^"]+)">')
    table_re = re.compile(r'<table[^>]*>.*?</table>', re.DOTALL)

    events = []
    for m in tab_re.finditer(section):
        events.append((m.start(), "TAB", m.group(1)))
    for m in table_re.finditer(section):
        events.append((m.start(), "TABLE", m.group(0)))
    events.sort(key=lambda x: x[0])

    # Known tab values
    MODES = {"Normal", "One person"}
    CLASSES = {"HUmar", "HUnewearl", "RAmar", "RAmarl", "FOmar", "FOmarl", "FOnewm", "FOnewearl"}
    SHIFTA_RE = re.compile(r'^S\d+$', re.IGNORECASE)

    # Initial state: first tabs are implicit (Normal > HUmar)
    current_mode = "normal"
    current_class = "humar"
    current_shifta = None

    data = {}
    total = 0

    for pos, etype, value in events:
        if etype == "TAB":
            title = value.strip()
            if title in MODES:
                current_mode = "normal" if title == "Normal" else "one_person"
                current_class = "humar"  # first class tab is implicit
                current_shifta = None
            elif title in CLASSES:
                current_class = title.lower()
                current_shifta = None
            elif SHIFTA_RE.match(title):
                current_shifta = title.lower()

        elif etype == "TABLE":
            if not current_shifta:
                continue

            weapons = parse_table(value)
            if not weapons:
                continue

            data.setdefault(current_mode, {}).setdefault(current_class, {})[current_shifta] = weapons
            total += 1
            print(f"  {current_mode}/{current_class}/{current_shifta}: {len(weapons)} weapons", file=sys.stderr)

    print(f"Total: {total} table combinations", file=sys.stderr)

    # Collect all shifta levels that appear in the data
    all_shifta = set()
    all_weapons = set()
    for mode in data:
        for cls in data[mode]:
            for shifta in data[mode][cls]:
                all_shifta.add(shifta)
                for w in data[mode][cls][shifta]:
                    all_weapons.add(w)

    print(f"Shifta levels: {sorted(all_shifta)}", file=sys.stderr)
    print(f"Weapons: {sorted(all_weapons)}", file=sys.stderr)

    # Output as JS
    print("// Auto-generated from wiki.pioneer2.net/w/Vol_Opt")
    print("// Run: python3 scripts/scrape_gizonde.py > data/gizonde_data.js")
    print("var DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";")


if __name__ == "__main__":
    main()
