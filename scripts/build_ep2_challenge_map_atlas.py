#!/usr/bin/env python3
"""Build localized Episode II maps from reviewed vector contours and annotations."""

from __future__ import annotations

import argparse
import json
import re
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import challenge_maps as maps


SOURCE = maps.ROOT / "assets/img/challenge/ep2/original/wiki"
OUTPUT = maps.ROOT / "assets/img/challenge/ep2/maps"
LEGEND = maps.ROOT / "assets/img/challenge/ep2/legend"

def polygon_path(contours: list) -> str:
    """Join measured contours with even-odd holes."""
    return " ".join("M" + "L".join(f"{x} {y}" for x, y in polygon) + "Z" for polygon in contours)


_TOKEN = re.compile(r"[MmLlCcZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE]-?\d+)?")


def _subpath_bounds(d: str) -> tuple[float, float, float, float]:
    """Bounds (in path units) of a traced subpath, control points included."""
    xs: list[float] = []
    ys: list[float] = []
    x = y = 0.0
    command = ""
    values: list[float] = []
    arity = {"m": 2, "l": 2, "c": 6}

    def flush() -> None:
        nonlocal x, y, command
        size = arity.get(command.lower(), 0)
        for start in range(0, len(values), size or 1):
            chunk = values[start:start + size]
            if len(chunk) < size:
                break
            relative = command.islower()
            for i in range(0, size, 2):
                px, py = (x + chunk[i], y + chunk[i + 1]) if relative else (chunk[i], chunk[i + 1])
                xs.append(px)
                ys.append(py)
            x, y = xs[-1], ys[-1]
        values.clear()

    for token in _TOKEN.findall(d):
        if token.isalpha():
            flush()
            command = token
        else:
            values.append(float(token))
    flush()
    return min(xs), min(ys), max(xs), max(ys)


def artwork_sample(area_id: str, stage: int, box: list[float]) -> str:
    """Crop one mechanism from an area's traced Wiki artwork, as standalone vector
    groups in source-image coordinates (for legends that show the map's own icons)."""
    artwork = maps.load_content(f"ep2-c{stage}-geometry.json")["areas"][area_id]["mechanisms_svg"]
    left, top, width, height = box
    groups = []
    for attributes, body in re.findall(r"<g ([^>]*)>(.*?)</g>", artwork, re.S):
        tx, ty, sx, sy = map(float, re.search(
            r"translate\(([-\d.]+),([-\d.]+)\)\s*scale\(([-\d.]+),([-\d.]+)\)", attributes).groups())
        kept = []
        for d in re.findall(r'd="([^"]*)"', body):
            for subpath in re.split(r"(?=M)", d.replace("\n", " ")):
                if not subpath.strip():
                    continue
                x0, y0, x1, y1 = _subpath_bounds(subpath)
                xa, xb = sorted((tx + sx * x0, tx + sx * x1))
                ya, yb = sorted((ty + sy * y0, ty + sy * y1))
                if xa < left + width and xb > left and ya < top + height and yb > top:
                    kept.append(subpath.strip())
        if kept:
            groups.append(f'<g {" ".join(attributes.split())}><path d="{" ".join(kept)}"/></g>')
    if not groups:
        raise ValueError(f"area {area_id}: no artwork inside legend sample {box}")
    return "".join(groups)


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
    # The legend explains the Wiki's own mechanism icons with crops of that artwork;
    # its wording is the site's interface text, shared with the guide page's legend.
    messages = {language: json.loads((maps.ROOT / f"content/i18n/messages/{language}.json").read_text(encoding="utf-8"))
                for language in languages}
    legend = []
    for entry in content["legend"]:
        sample = entry["sample"]
        art = artwork_sample(sample["area"], content["areas"][sample["area"]]["stage"], sample["box"])
        legend.append({**entry, "icon": {"box": sample["box"], "art": art}})
        left, top, width, height = sample["box"]
        LEGEND.mkdir(parents=True, exist_ok=True)
        (LEGEND / f"{entry['id']}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:g}" height="{height:g}" '
            f'viewBox="{left:g} {top:g} {width:g} {height:g}">{art}</svg>\n', encoding="utf-8")
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
            general = [{"text": messages[language][entry["message"]], "icon": entry["icon"]} for entry in legend]
            localized = {**area, "notes": {**area["notes"], language: {"general": general, "numbered": []}}}
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
