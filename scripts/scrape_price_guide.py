#!/usr/bin/env python3
"""
Scrape the Ephinea PSO price guide from wiki.pioneer2.net
and output a JS data file for the price guide page.

Usage:
    python3 scripts/scrape_price_guide.py > assets/js/price_guide_data.js
"""

import json
import re
import sys
import urllib.request
from html.parser import HTMLParser


class WikiTableExtractor(HTMLParser):
    """Extract tables from MediaWiki HTML, handling rowspan/colspan correctly."""

    def __init__(self):
        super().__init__()
        self.tables = []          # list of (title, grid)
        self.in_table = False
        self.grid = []            # 2D grid of cells
        self.grid_meta = []       # track which cells are occupied by rowspan
        self.current_row_idx = -1
        self.current_col_idx = 0
        self.in_cell = False
        self.cell_tag = None      # 'th' or 'td'
        self.cell_text = ""
        self.cell_colspan = 1
        self.cell_rowspan = 1
        self.in_heading = False
        self.heading_text = ""
        self.last_h2 = ""
        self.last_h3 = ""
        self.table_depth = 0

    def _current_title(self):
        parts = [p for p in [self.last_h2, self.last_h3] if p]
        return " - ".join(parts)

    def _next_free_col(self, row_idx):
        """Find the next column not occupied by a rowspan."""
        col = 0
        while (row_idx, col) in self.grid_meta:
            col += 1
        return col

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("h2", "h3"):
            self.in_heading = True
            self.heading_text = ""
        elif tag == "table":
            self.table_depth += 1
            if self.table_depth == 1:
                self.in_table = True
                self.grid = []
                self.grid_meta = set()
                self.current_row_idx = -1
        elif self.in_table and self.table_depth == 1:
            if tag == "tr":
                self.current_row_idx += 1
                self.current_col_idx = self._next_free_col(self.current_row_idx)
                self.grid.append([])
            elif tag in ("th", "td"):
                self.in_cell = True
                self.cell_tag = tag
                self.cell_text = ""
                self.cell_colspan = int(a.get("colspan", 1))
                self.cell_rowspan = int(a.get("rowspan", 1))
                # Find next free column
                self.current_col_idx = self._next_free_col(self.current_row_idx)
            elif tag == "br" and self.in_cell:
                self.cell_text += " "

    def handle_endtag(self, tag):
        if tag in ("h2", "h3") and self.in_heading:
            self.in_heading = False
            text = self.heading_text.strip()
            # Remove [edit] links
            text = re.sub(r'\[edit\]', '', text).strip()
            if tag == "h2":
                self.last_h2 = text
                self.last_h3 = ""
            else:
                self.last_h3 = text
        elif tag == "table":
            if self.table_depth == 1 and self.in_table:
                self.in_table = False
                if self.grid:
                    self.tables.append((self._current_title(), self.grid))
            self.table_depth = max(0, self.table_depth - 1)
        elif tag in ("th", "td") and self.in_cell and self.table_depth == 1:
            self.in_cell = False
            text = self.cell_text.strip()
            text = re.sub(r'\s+', ' ', text)
            row_idx = self.current_row_idx
            col_idx = self.current_col_idx

            is_header = (self.cell_tag == "th")

            # Place cell in grid, expanding colspan/rowspan
            for dr in range(self.cell_rowspan):
                for dc in range(self.cell_colspan):
                    r, c = row_idx + dr, col_idx + dc
                    # Ensure row exists
                    while r >= len(self.grid):
                        self.grid.append([])
                    self.grid_meta.add((r, c))

            # Store in current row with metadata
            self.grid[row_idx].append({
                "text": text,
                "col": col_idx,
                "colspan": self.cell_colspan,
                "rowspan": self.cell_rowspan,
                "is_header": is_header,
            })

            # Advance column pointer
            self.current_col_idx = col_idx + self.cell_colspan
            # Skip occupied cols
            while (self.current_row_idx, self.current_col_idx) in self.grid_meta:
                self.current_col_idx += 1

    def handle_data(self, data):
        if self.in_heading:
            self.heading_text += data
        elif self.in_cell:
            self.cell_text += data


def build_expanded_grid(grid):
    """Expand a grid with rowspan/colspan into a flat 2D array."""
    # Find max columns
    max_col = 0
    for row in grid:
        for cell in row:
            end = cell["col"] + cell["colspan"]
            if end > max_col:
                max_col = end

    # Build expanded grid
    num_rows = len(grid)
    expanded = [[None] * max_col for _ in range(num_rows)]

    for row_idx, row in enumerate(grid):
        for cell in row:
            for dr in range(cell["rowspan"]):
                for dc in range(cell["colspan"]):
                    r = row_idx + dr
                    c = cell["col"] + dc
                    if r < num_rows and c < max_col:
                        expanded[r][c] = {
                            "text": cell["text"],
                            "is_header": cell["is_header"],
                            "is_span": dr > 0 or dc > 0,
                        }
    return expanded


def process_table(title, grid):
    """Convert a raw grid into structured section data."""
    expanded = build_expanded_grid(grid)
    if not expanded:
        return None

    # Find header rows (rows where all cells are th)
    header_rows = []
    data_rows = []
    for i, row in enumerate(expanded):
        cells = [c for c in row if c is not None]
        if cells and all(c["is_header"] for c in cells):
            header_rows.append(i)
        elif cells:
            data_rows.append(i)

    # Build column headers from header rows
    num_cols = len(expanded[0]) if expanded else 0
    col_headers = [""] * num_cols
    for hi in header_rows:
        for ci in range(num_cols):
            cell = expanded[hi][ci]
            if cell and cell["text"] and not cell.get("is_span"):
                if col_headers[ci]:
                    col_headers[ci] += " " + cell["text"]
                else:
                    col_headers[ci] = cell["text"]

    # If no explicit header rows, use first data row as header
    if not header_rows and data_rows:
        first = data_rows[0]
        for ci in range(num_cols):
            cell = expanded[first][ci]
            if cell:
                col_headers[ci] = cell["text"]
        data_rows = data_rows[1:]

    # Build headers from multiple header rows properly
    # For multi-row headers, the last non-span header text wins
    if len(header_rows) >= 2:
        second_row = header_rows[1]
        for ci in range(num_cols):
            cell = expanded[second_row][ci]
            if cell and cell["text"] and not cell.get("is_span"):
                col_headers[ci] = cell["text"]

    # Deduplicate headers like "Weapon Type Weapon Type" -> "Weapon Type"
    for ci in range(num_cols):
        h = col_headers[ci]
        if h:
            words = h.split()
            half = len(words) // 2
            if half > 0 and words[:half] == words[half:]:
                col_headers[ci] = " ".join(words[:half])

    # Extract data
    items = []
    for ri in data_rows:
        row_data = {}
        for ci in range(min(num_cols, len(col_headers))):
            cell = expanded[ri][ci]
            if cell is None:
                continue
            header = col_headers[ci] if col_headers[ci] else f"col{ci}"
            text = cell["text"]
            # Skip if this is a span copy and we already have the value
            if cell.get("is_span") and header in row_data:
                continue
            row_data[header] = text if text and text not in ("-", "—") else None
        if any(v is not None for v in row_data.values()):
            items.append(row_data)

    if not items:
        return None

    return {
        "section": title,
        "headers": [h for h in col_headers if h],
        "data": items,
    }


def fetch_page(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; PSO-PriceGuide-Scraper/1.0)"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def main():
    url = "https://wiki.pioneer2.net/w/Price_guide"
    print(f"Fetching {url} ...", file=sys.stderr)
    html = fetch_page(url)

    parser = WikiTableExtractor()
    parser.feed(html)

    print(f"Found {len(parser.tables)} raw tables", file=sys.stderr)

    sections = []
    for title, grid in parser.tables:
        result = process_table(title, grid)
        if result and result["data"]:
            sections.append(result)

    # Output as JS
    print("// Auto-generated from wiki.pioneer2.net/w/Price_guide")
    print("// Run: python3 scripts/scrape_price_guide.py > data/price_guide_data.js")
    print("var PRICE_DATA = " + json.dumps(sections, ensure_ascii=False, indent=2) + ";")

    total_items = sum(len(s["data"]) for s in sections)
    print(f"Output {len(sections)} sections, {total_items} items", file=sys.stderr)


if __name__ == "__main__":
    main()
