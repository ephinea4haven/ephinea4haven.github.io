#!/usr/bin/env python3
"""Build localized Episode II challenge maps from Ephinea Wiki originals.

The high-resolution Wiki PNGs are immutable source evidence. Each map embeds
two raster layers extracted from its source (floor geometry below the routes,
room numbers and mechanism icons above them); routes, terminals, badges and
notes come from content/challenge-maps/ep2.json. See
docs/CHALLENGE_MAP_REDRAW.md.
"""

from __future__ import annotations

import argparse
import base64
import io

import numpy as np
from PIL import Image, ImageChops, ImageFilter

import challenge_maps as maps


SOURCE = maps.ROOT / "assets/img/challenge/ep2/original/wiki"
OUTPUT = maps.ROOT / "assets/img/challenge/ep2/maps"

# Wiki floor classes: normal floor and its edge shading, dark rooms, poison rooms.
FLOOR_COLOR = (62, 65, 69)
DARK_COLOR = (33, 34, 32)
POISON_COLOR = (74, 0, 74)
BACKGROUND = (7, 26, 49, 255)
FILL = (31, 90, 140, 255)
DARK_FILL = (22, 52, 84, 255)
DARK_HATCH = (79, 227, 255, 70)
POISON_FILL = (84, 44, 118, 255)
OUTLINE = (79, 227, 255, 255)


def floor_classes(source: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Exact floor, dark-room and poison-room pixels of the wiki map."""
    rgb = np.asarray(source.convert("RGB")).astype(np.int16)
    normal = np.all(rgb == FLOOR_COLOR, axis=2)
    shade = (np.abs(rgb - (38, 42, 44)).max(axis=2) <= 4)
    dark = np.all(rgb == DARK_COLOR, axis=2)
    poison = np.all(rgb == POISON_COLOR, axis=2)
    return normal | shade | dark | poison, dark, poison


def _closed(mask: np.ndarray) -> Image.Image:
    image = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8))
    return image.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.MinFilter(21))


def base_layer(floor: np.ndarray, dark: np.ndarray, poison: np.ndarray) -> Image.Image:
    """Filled floor with an outline, dark rooms hatched and poison rooms tinted.
    Closing repairs the small holes that labels and icons punch into the floor."""
    mask = _closed(floor)
    outline = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(7)), mask)
    base = Image.new("RGBA", mask.size, BACKGROUND)
    base.paste(Image.new("RGBA", mask.size, FILL), mask=mask)
    if dark.any():
        dark_mask = ImageChops.multiply(_closed(dark), mask)
        base.paste(Image.new("RGBA", mask.size, DARK_FILL), mask=dark_mask)
        y, x = np.indices(dark.shape)
        stripes = Image.fromarray(np.where(((x + y) % 14) < 3, 255, 0).astype(np.uint8))
        hatch = Image.new("RGBA", mask.size, DARK_HATCH)
        base.alpha_composite(Image.composite(hatch, Image.new("RGBA", mask.size, (0, 0, 0, 0)), ImageChops.multiply(stripes, dark_mask)))
    if poison.any():
        base.paste(Image.new("RGBA", mask.size, POISON_FILL), mask=ImageChops.multiply(_closed(poison), mask))
    base.paste(Image.new("RGBA", mask.size, OUTLINE), mask=outline)
    return base


def label_layer(source: Image.Image) -> Image.Image:
    """Keep coloured mechanisms and bright room labels; drop the black and grey map."""
    rgb = np.asarray(source.convert("RGB")).astype(np.int16)
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    saturation = np.where(high == 0, 0, (high - low) / np.maximum(high, 1))
    poison = np.all(rgb == POISON_COLOR, axis=2)
    keep = ((saturation >= 0.24) | (low >= 185)) & ~poison
    rgba = np.zeros((*rgb.shape[:2], 4), np.uint8)
    rgba[..., :3] = rgb
    rgba[..., 3] = np.where(keep, 255, 0)
    return Image.fromarray(rgba, "RGBA")


def png_data_uri(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def geometry_for(floor: np.ndarray) -> maps.Geometry:
    height, width = floor.shape
    empty = np.zeros_like(floor)
    return maps.Geometry(
        width=width, height=height, floor=floor, outline=empty, dark_room=empty,
        dashes=empty, coverage=100.0, dash_max=0, symbol_min=0,
    )


def build(selected: set[int] | None) -> None:
    content = maps.load_content("ep2.json")
    strings = content["strings"]
    languages = list(strings)
    errors: list[str] = []
    for area_id, area in content["areas"].items():
        if selected and int(area_id) not in selected:
            continue
        source = Image.open(SOURCE / area["source"])
        floor, dark, poison = floor_classes(source)
        labels = label_layer(source)
        geometry = geometry_for(floor)
        geometry.extent = floor | (np.asarray(labels)[..., 3] > 0)
        area_errors = maps.validate_area(area_id, area, geometry, languages)
        errors.extend(area_errors)
        if area_errors:
            continue
        stem = f"c{area['stage']}_area_{int(area_id):02d}"
        width, height = source.size
        layer = '<image href="{}" x="0" y="0" width="{}" height="{}" preserveAspectRatio="none"/>'
        below = layer.format(png_data_uri(base_layer(floor, dark, poison)), width, height)
        above = layer.format(png_data_uri(labels), width, height)
        for language in languages:
            words = strings[language]
            title = words["area"].replace("{stage}", str(area["stage"])).replace("{n}", f"{int(area_id):02d}")
            stage_note = content["stages"][str(area["stage"])][language]
            notes = maps.panel_notes(area, language, stage_note)
            svg = maps.render_svg(area, geometry, words, title, notes, below, above)
            directory = OUTPUT / language
            directory.mkdir(parents=True, exist_ok=True)
            (directory / f"{stem}.svg").write_text(svg, encoding="utf-8")
        print(f"area {area_id}: built {stem} in {', '.join(languages)}")
    if errors:
        raise SystemExit("EP2 challenge map data failed validation:\n" + "\n".join(errors))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--area", type=int, action="append", help="build only this area (repeatable)")
    build(set(parser.parse_args().area or []) or None)


if __name__ == "__main__":
    main()
