#!/usr/bin/env python3
"""Build the hand-authored, localized challenge-map atlas."""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import challenge_maps as maps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/img/challenge/ep1/maps"
SOURCE = ROOT / "assets/img/challenge/ep1/original"
MEASURED_GEOMETRY = {
    area: geometry
    for path in sorted((ROOT / "content/challenge-maps").glob("ep1-c*-geometry.json"))
    for area, geometry in json.loads(path.read_text(encoding="utf-8"))["areas"].items()
}
def polygon_paths(contours: list[list[list[int]]]) -> str:
    return " ".join("M" + "L".join(f"{x} {y}" for x, y in contour) + "Z" for contour in contours)


def measured_geometry(area: int, stage: int) -> maps.Geometry:
    """Use source-measured vector walls, independently of annotation pixels.

    C9 scans contain thin black walls, dark rooms and symbols crossing walls.
    Thresholding those pixels loses corridors and turns labels into geometry.
    The authored paths retain the source coordinate system for the overlays.
    """
    geometry = MEASURED_GEOMETRY[str(area)]
    prefix = f"c{stage}"
    with Image.open(SOURCE / f"area_{area:02d}.png") as source:
        if list(source.size) != geometry["size"]:
            raise ValueError(f"area {area}: source dimensions changed; recheck the measured geometry")
        width, height = source.size
        # Trace short, elongated route dashes, not red switch/trap centres or
        # door bars. Diagonal dashes are elongated too, despite square bounds.
        rgb = np.asarray(source.convert("RGB"))
        route_pixels = ((rgb[..., 0] >= 210) & (rgb[..., 1] <= 125) & (rgb[..., 2] <= 145)
                        & (np.abs(rgb[..., 1].astype(int) - rgb[..., 2].astype(int)) <= 20))
        labels, _ = ndimage.label(route_pixels)
        sizes = np.bincount(labels.ravel())
        dash_ids = []
        for component, box in enumerate(ndimage.find_objects(labels), start=1):
            if not 3 <= sizes[component] <= maps.DASH_MAX_PIXELS:
                continue
            coordinates = np.column_stack(np.nonzero(labels[box] == component))
            minor, major = np.linalg.eigvalsh(np.cov(coordinates, rowvar=False))
            if major >= 2.5 * max(minor, 0.25):
                dash_ids.append(component)
        route_pixels &= np.isin(labels, dash_ids)

    floor_path = polygon_paths(geometry["floor"])
    dark_path = polygon_paths(geometry["dark_rooms"])
    interior_path = polygon_paths(geometry["interior_walls"])
    rooms = f'''<g id="{prefix}-floor" data-source="PSO World area_{area:02d}.png">
  <defs>
    <clipPath id="{prefix}-floor-clip"><path d="{floor_path}" clip-rule="evenodd"/></clipPath>
    <pattern id="{prefix}-dark-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M-2 2L2-2M0 8L8 0M6 10L10 6" fill="none" stroke="#4fe3ff" stroke-opacity=".18" stroke-width="1"/>
    </pattern>
  </defs>
  <path d="{floor_path}" fill="#173d60" fill-rule="evenodd"/>
  <g id="{prefix}-dark-rooms" clip-path="url(#{prefix}-floor-clip)">
    <path d="{dark_path}" fill="#102b42"/>
    <path d="{dark_path}" fill="url(#{prefix}-dark-hatch)"/>
  </g>
</g>'''
    boundaries = f'''<g id="{prefix}-walls" fill="none" stroke="#8edfff" stroke-width="1.5" stroke-linejoin="miter">
  <path d="{floor_path}"/>
  <path d="{dark_path}"/>
  <path d="{interior_path}"/>
</g>'''
    def mask(contours: list, *, even_odd: bool = False) -> np.ndarray:
        result = np.zeros((height, width), dtype=bool)
        for contour in contours:
            polygon = Image.new("1", (width, height))
            ImageDraw.Draw(polygon).polygon([tuple(p) for p in contour], fill=1)
            pixels = np.asarray(polygon, dtype=bool)
            if even_odd:
                result ^= pixels
            else:
                result |= pixels
        return result

    floor = mask(geometry["floor"], even_odd=True)
    return maps.Geometry(
        width=width, height=height, floor=floor,
        outline=ndimage.binary_dilation(floor) & ~floor,
        dark_room=mask(geometry["dark_rooms"]) & floor,
        # Some source routes pass straight over a pillar. Such pixels are not
        # walkable route evidence; authored paths must go around the pillar.
        dashes=route_pixels & floor,
        # Pixel-tracer parity consistency does not apply to measured contours.
        coverage=float("nan"), dash_max=maps.DASH_MAX_PIXELS, symbol_min=0,
        floor_svg=rooms, outline_svg=boundaries,
    )


MAP_WIDTH = 1000
MAP_MAX_HEIGHT = 1000
render_area = maps.render_area

def build_data_areas(selected: set[int] | None) -> None:
    content = maps.load_content("ep1.json")
    strings = content["strings"]
    languages = list(strings)
    errors: list[str] = []
    for area_id, area in content["areas"].items():
        if selected and int(area_id) not in selected:
            continue
        geometry = measured_geometry(int(area_id), area["stage"])
        # Some source diagrams join teleport endpoints with a red line. Keep
        # these reviewed ink exclusions separate from authored walking routes.
        excluded_pixels = 0
        for exclusion in area.get("source_route_exclusions", []):
            ink = Image.new("1", (geometry.width, geometry.height))
            ImageDraw.Draw(ink).line([tuple(p) for p in exclusion["points"]], fill=1, width=7)
            excluded_pixels += int((geometry.dashes & np.asarray(ink, dtype=bool)).sum())
            geometry.dashes &= ~np.asarray(ink, dtype=bool)
        area_errors: list[str] = []
        area_errors.extend(maps.validate_area(area_id, area, geometry, languages))
        dash_covered, route_on_dash = maps.fidelity(area, geometry)
        print(
            f"area {area_id}: measured contours  dark room {int(geometry.dark_room.sum())} px  "
            f"dashes <={geometry.dash_max} px, symbols >={geometry.symbol_min} px  "
            f"fidelity {dash_covered:.1f}% dashes covered, {route_on_dash:.1f}% route on dashes"
            + (f"; {excluded_pixels} reviewed teleport-connector pixels excluded" if excluded_pixels else "")
        )
        if area["fidelity"] is None and (
            dash_covered < maps.FIDELITY_DASH_COVERED or route_on_dash < maps.FIDELITY_ROUTE_ON_DASH
        ):
            area_errors.append(f"area {area_id}: route fidelity below threshold and no fidelity reason recorded")
        if dash_covered < 95:
            area_errors.append(f"area {area_id}: routes cover only {dash_covered:.1f}% of source dashes (minimum 95%)")
        errors.extend(area_errors)
        if area_errors:
            continue
        # Check every segment, including bends between distant waypoints.
        distance = ndimage.distance_transform_edt(~geometry.floor)
        for route in area["routes"]:
            for leg in route["legs"]:
                for x, y in np.rint(maps._polyline_points(leg, step=1)).astype(int):
                    if distance[y, x] > 2:
                        raise SystemExit(f"area {area_id}: {route['role']} route leaves floor at {(int(x), int(y))}")
        for language in languages:
            directory = OUTPUT / language
            directory.mkdir(parents=True, exist_ok=True)
            svg = render_area(area_id, area, geometry, strings, language, content["symbol_labels"][language])
            svg = "\n".join(line.rstrip() for line in svg.splitlines()) + "\n"
            (directory / f"area_{int(area_id):02d}.svg").write_text(svg, encoding="utf-8")
    if errors:
        raise SystemExit("Challenge map data failed validation:\n" + "\n".join(errors))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--area", type=int, action="append", help="build only this area (repeatable)")
    selected = set(parser.parse_args().area or []) or None
    build_data_areas(selected)
    print("Built localized EP1 challenge maps.")


if __name__ == "__main__":
    main()
