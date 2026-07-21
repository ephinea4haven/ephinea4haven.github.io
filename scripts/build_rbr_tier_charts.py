#!/usr/bin/env python3
"""Build the two RBR tier charts with the drop table's Section ID palette."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DROP_DATA = ROOT / "data/droptable/bb/data/zh.js"
OUTPUT_DIR = ROOT / "assets/img/guide/rbr"

RBR_ROWS = (
    ("S", (("EN2", "Bluefull"), ("SR3", "Yellowboze"), ("EN4", "Bluefull"), ("PW1", "Whitill"), ("PW3", "Bluefull"), ("PS2", "Oran"), ("LCV", "Purplenum"), ("NMU4", "Redria"), ("WoL4", "Redria"))),
    ("A", (("SU2", "Purplenum"), ("MU2", "Bluefull"), ("SU3", "Purplenum"), ("LHP", "Skyly"), ("LBA", "Oran"))),
    ("B", (("SR2", "Skyly"), ("MU4", "Bluefull"), ("SA2", "Yellowboze"), ("SU6", "Oran"), ("SU7", "Skyly"), ("SU8", "Redria"), ("WoL2", "Oran"), ("SU13", "Pinkal"), ("SU14", "Pinkal"))),
    ("C", (("LHS", "Whitill"), ("LIS", "Greenill"), ("MU1", "Whitill"), ("MU3", "Purplenum"), ("EN3", "Oran"), ("SU4", "Oran"), ("SR4", "Oran"), ("PS1", "Purplenum"), ("PS3", "Skyly"), ("PS4", "Purplenum"), ("PS5", "Whitill"), ("PS6", "Skyly"), ("LSR", "Purplenum"), ("NMU2", "Oran"), ("WoL3", "Purplenum"), ("SU12", "Redria"))),
    ("D", (("SU1", "Pinkal"), ("EN1", "Greenill"), ("SR1", "Pinkal"), ("SA1", "Redria"), ("AO1", "Redria"), ("AO2", "Purplenum"), ("SU5", "Pinkal"), ("LDR", "Bluefull"), ("TET", "Whitill"), ("TWT", "Bluefull"), ("AO3", "Pinkal"), ("AO4", "Bluefull"), ("AO5", "Whitill"), ("SU10", "Bluefull"), ("SU11", "Greenill"), ("NMU1", "Bluefull"), ("NMU5", "Pinkal"), ("WoL1", "Bluefull"), ("WoL5", "Pinkal"))),
)

NON_RBR_ROWS = (
    ("SS", (("MAE4", "Viridia"),)),
    ("S", (("TS", "Purplenum"), ("MSB", "Yellowboze"), ("PW2", "Pinkal"))),
    ("A", (("TTF", "Greenill"), ("RT", "Yellowboze"), ("GDV", "Purplenum"))),
    ("RER", (("TE", "Whitill"), ("5-3", "Whitill"), ("PoD", "Purplenum"), ("MA4B", "Greenill"))),
)

TIER_COLORS = {
    "SS": "#FA625F",
    "S": "#FE8F29",
    "A": "#FED858",
    "B": "#95D65E",
    "C": "#74B4F7",
    "D": "#B7A5F4",
    "RER": "#FDF791",
}


def load_section_palette() -> dict[str, str]:
    """Read the canonical names and colors directly from the BB drop table."""
    source = DROP_DATA.read_text(encoding="utf-8")

    def array(name: str) -> list[str]:
        match = re.search(rf'"{name}"\s*:\s*(\[[^]]+\])', source)
        if not match:
            raise ValueError(f"Could not find {name} in {DROP_DATA}")
        return json.loads(match.group(1))

    names = array("sectionIds")
    colors = array("sectionColors")
    if len(names) != len(colors):
        raise ValueError("Section ID names and colors have different lengths")
    return dict(zip(names, colors, strict=True))


def contrast_text(hex_color: str) -> str:
    """Match the drop viewer's foreground-color calculation."""
    red, green, blue = (
        int(hex_color[index : index + 2], 16) for index in (1, 3, 5)
    )
    luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
    return "#000000" if luminance > 0.5 else "#FFFFFF"


def text_element(
    x: float,
    y: float,
    value: str,
    *,
    size: int,
    fill: str,
    weight: int = 700,
    anchor: str = "middle",
) -> str:
    return (
        f'<text x="{x:g}" y="{y:g}" text-anchor="{anchor}" '
        f'font-family="Arial, Helvetica, sans-serif" font-size="{size}" '
        f'font-weight="{weight}" fill="{fill}">{html.escape(value)}</text>'
    )


def build_chart(
    rows: tuple[tuple[str, tuple[tuple[str, str], ...]], ...],
    output: Path,
    *,
    columns: int,
    width: int,
) -> None:
    palette = load_section_palette()
    margin = 4
    legend_height = 112
    tier_width = 150 if width < 1100 else 240
    cell_width = (width - tier_width - margin * 2) / columns
    cell_height = 104
    background = "#1E2E46"
    grid = "#08101D"

    tier_row_counts = [max(1, (len(items) + columns - 1) // columns) for _, items in rows]
    height = int(margin * 2 + legend_height + sum(tier_row_counts) * cell_height)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',
        '<title>任务 Tier 表；任务格颜色和文字表示推荐 Section ID</title>',
        f'<rect width="{width}" height="{height}" fill="{background}"/>',
        text_element(margin + 10, 28, "格子颜色 = Section ID（与掉落表一致）", size=18, fill="#FFFFFF", anchor="start"),
    ]

    legend_columns = 5
    legend_cell_width = (width - margin * 2) / legend_columns
    for index, (section_id, color) in enumerate(palette.items()):
        column = index % legend_columns
        row = index // legend_columns
        x = margin + column * legend_cell_width
        y = 40 + row * 32
        parts.append(f'<rect x="{x:g}" y="{y}" width="{legend_cell_width:g}" height="28" fill="{color}" stroke="{grid}" stroke-width="2"/>')
        parts.append(text_element(x + legend_cell_width / 2, y + 20, section_id, size=14, fill=contrast_text(color)))

    y = legend_height
    for (tier, items), row_count in zip(rows, tier_row_counts, strict=True):
        tier_height = row_count * cell_height
        tier_color = TIER_COLORS[tier]
        parts.append(f'<rect x="{margin}" y="{y}" width="{tier_width}" height="{tier_height}" fill="{tier_color}" stroke="{grid}" stroke-width="4"/>')
        tier_size = 54 if len(tier) <= 2 else 34
        parts.append(text_element(margin + tier_width / 2, y + tier_height / 2 + tier_size / 3, tier, size=tier_size, fill="#000000", weight=800))

        for index in range(row_count * columns):
            column = index % columns
            row = index // columns
            cell_x = margin + tier_width + column * cell_width
            cell_y = y + row * cell_height
            if index < len(items):
                quest, section_id = items[index]
                color = palette[section_id]
                foreground = contrast_text(color)
                parts.append(f'<rect x="{cell_x:g}" y="{cell_y:g}" width="{cell_width:g}" height="{cell_height}" fill="{color}" stroke="{grid}" stroke-width="4"/>')
                parts.append(text_element(cell_x + cell_width / 2, cell_y + 47, quest, size=27, fill=foreground, weight=800))
                parts.append(text_element(cell_x + cell_width / 2, cell_y + 76, section_id, size=14, fill=foreground, weight=600))
            else:
                parts.append(f'<rect x="{cell_x:g}" y="{cell_y:g}" width="{cell_width:g}" height="{cell_height}" fill="{background}" stroke="{grid}" stroke-width="4"/>')
        y += tier_height

    parts.append("</svg>")
    output.write_text("\n".join(parts) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build_chart(
        RBR_ROWS,
        OUTPUT_DIR / "rbr-tier-section-colors.svg",
        columns=7,
        width=967,
    )
    build_chart(
        NON_RBR_ROWS,
        OUTPUT_DIR / "non-rbr-tier-section-colors.svg",
        columns=4,
        width=1452,
    )


if __name__ == "__main__":
    main()
