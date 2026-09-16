#!/usr/bin/env python3
"""Build localized Episode II maps from reviewed vector contours and annotations."""

from __future__ import annotations

import argparse
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import challenge_maps as maps


SOURCE = maps.ROOT / "assets/img/challenge/ep2/original/wiki"
OUTPUT = maps.ROOT / "assets/img/challenge/ep2/maps"

def polygon_path(contours: list) -> str:
    """Join measured contours with even-odd holes."""
    return " ".join("M" + "L".join(f"{x} {y}" for x, y in polygon) + "Z" for polygon in contours)


def geometry_for(area_id: str, area: dict) -> maps.Geometry:
    """Load reviewed floor contours; source annotations never define the floor."""
    data = maps.load_content(f"ep2-c{area['stage']}-geometry.json")["areas"][area_id]
    width, height = data["size"]
    with Image.open(SOURCE / area["source"]) as source:
        if source.size != (width, height):
            raise ValueError(f"area {area_id}: source dimensions changed")
    def mask(contours: list) -> np.ndarray:
        result = np.zeros((height, width), dtype=bool)
        for polygon in contours:
            layer = Image.new("1", (width, height))
            ImageDraw.Draw(layer).polygon([tuple(p) for p in polygon], fill=1)
            result ^= np.asarray(layer, dtype=bool)
        return result
    floor = mask(data["floor"])
    path = polygon_path(data["floor"])
    prefix = f"ep2-{area_id}"
    dark = polygon_path(data["dark_rooms"])
    poison = polygon_path(data["poison_rooms"])
    base = f'<g id="{prefix}-floor"><path d="{path}" fill="#173d60" fill-rule="evenodd"/></g>'
    base += f'<path d="{dark}" fill="#102b42" fill-rule="evenodd"/><path d="{dark}" fill="url(#dark-hatch)" fill-rule="evenodd"/><path d="{poison}" fill="#542c76" fill-rule="evenodd"/>'
    walls = f'<path d="{path}" fill="none" stroke="#8edfff" stroke-width="1.5" stroke-linejoin="round"/>'
    # Source mechanism artwork is kept independently at its original coordinates.
    # Reviewed room labels and terminals are replaced by authored vector text.
    detail = data["mechanisms_svg"]
    for room in area.get("rooms", []):
        detail += maps.text(room["label"], *room["at"], size=24, fill="#ffffff")
    empty = np.zeros_like(floor)
    return maps.Geometry(width, height, floor, empty, mask(data["dark_rooms"]), empty,
                         100.0, 0, 0, floor_svg=base, outline_svg=walls, detail_svg=detail)



def build(selected: set[int] | None) -> None:
    content = maps.load_content("ep2.json")
    strings = content["strings"]
    languages = list(strings)
    errors: list[str] = []
    for area_id, area in content["areas"].items():
        if selected and int(area_id) not in selected:
            continue
        geometry = geometry_for(area_id, area)
        area_errors = maps.validate_area(area_id, area, geometry, languages)
        distance = ndimage.distance_transform_edt(~geometry.floor)
        for route in area["routes"]:
            for leg in route["legs"]:
                points = np.rint(maps._polyline_points(leg, step=1)).astype(int)
                if any(distance[y, x] > 2 for x, y in points):
                    area_errors.append(f"area {area_id}: {route['role']} route crosses a wall")
        errors.extend(area_errors)
        if area_errors:
            continue
        stem = f"c{area['stage']}_area_{int(area_id):02d}"
        for language in languages:
            localized = {**area, "notes": {**area["notes"], language: {"general": content["source_legend"][language], "numbered": []}}}
            svg = maps.render_area(area_id, localized, geometry, strings, language, content["symbol_labels"][language])
            svg = "\n".join(line.rstrip() for line in svg.splitlines()) + "\n"
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
