#!/usr/bin/env python3
"""Build localized Seabed route maps with the challenge-map renderer.

The Ultima forum source maps are flat renders: white floor on a #404040 ground,
the route as a red-bordered tube, grey obstacles inside rooms, and yellow
labels. Their floor is measured exactly from those colours and traced into
polygon contours; routes, terminals and warps are authored in
content/challenge-maps/seabed.json.
"""

from __future__ import annotations

import argparse
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import challenge_maps as maps


SOURCE = maps.ROOT / "assets/img/guide/seabed"
OUTPUT = SOURCE / "maps"
WHITE = (255, 255, 255)
ROUTE = (157, 18, 18)
EIGHT = np.ones((3, 3), dtype=bool)
MIN_HOLE = 6      # antialias specks inside the floor, not obstacles
MIN_PIECE = 30    # floor specks left by label text
LABEL_FRAGMENT = 120  # pieces this small touching a label box are box borders, not corridors
TOLERANCE = 0.9  # contour simplification in pixels: straightens staircases, keeps one-pixel features


def floor_mask(path) -> np.ndarray:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    white = (r == WHITE[0]) & (g == WHITE[1]) & (b == WHITE[2])
    route = (r == ROUTE[0]) & (g == ROUTE[1]) & (b == ROUTE[2])
    warp = (b > 150) & (r < 120) & (b - r > 60)
    # Yellow label boxes, warp badges and the title are annotations, never floor.
    yellow = (r > 150) & (g > 140) & (b < 90) & (r - b > 100)
    labels = ndimage.binary_dilation(ndimage.binary_fill_holes(ndimage.binary_dilation(yellow)), iterations=2)
    floor = (white | ndimage.binary_closing(route, EIGHT, iterations=2) | ndimage.binary_dilation(warp, iterations=2)) & ~labels
    holes, _ = ndimage.label(~floor)
    sizes = np.bincount(holes.ravel())
    floor |= (sizes[holes] < MIN_HOLE) & (holes > 0)
    pieces, _ = ndimage.label(floor, EIGHT)
    sizes = np.bincount(pieces.ravel())[pieces]
    near_label = np.isin(pieces, np.unique(pieces[ndimage.binary_dilation(labels, iterations=4)]))
    return floor & (sizes >= MIN_PIECE) & ~(near_label & (sizes < LABEL_FRAGMENT))


def contours(mask: np.ndarray) -> list[list[list[int]]]:
    """Trace pixel boundaries into closed polygons (even-odd), keeping corners exact."""
    height, width = mask.shape
    padded = np.pad(mask, 1)
    edges: dict[tuple[int, int], list[tuple[int, int]]] = {}
    # Directed edges keep the floor on the right; each pixel side facing outside is one edge.
    for y, x in zip(*np.nonzero(mask)):
        py, px = y + 1, x + 1
        if not padded[py - 1, px]: edges.setdefault((x, y), []).append((x + 1, y))
        if not padded[py, px + 1]: edges.setdefault((x + 1, y), []).append((x + 1, y + 1))
        if not padded[py + 1, px]: edges.setdefault((x + 1, y + 1), []).append((x, y + 1))
        if not padded[py, px - 1]: edges.setdefault((x, y + 1), []).append((x, y))
    loops = []
    while edges:
        start = next(iter(edges))
        loop = [start]
        current, previous = start, None
        while True:
            options = edges[current]
            if len(options) > 1 and previous is not None:
                # Where two regions touch at a corner, turn right to keep them separate.
                dx, dy = current[0] - previous[0], current[1] - previous[1]
                right = (current[0] - dy, current[1] + dx)
                following = right if right in options else options[0]
            else:
                following = options[0]
            options.remove(following)
            if not options:
                del edges[current]
            previous, current = current, following
            if current == start:
                break
            loop.append(current)
        loops.append(simplify(loop))
    return [loop for loop in loops if len(loop) >= 3]


def _reduce(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Ramer-Douglas-Peucker on an open polyline."""
    if len(points) < 3:
        return points
    (x0, y0), (x1, y1) = points[0], points[-1]
    length = np.hypot(x1 - x0, y1 - y0) or 1.0
    distances = [abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / length for x, y in points]
    index = int(np.argmax(distances))
    if distances[index] <= TOLERANCE:
        return [points[0], points[-1]]
    return _reduce(points[:index + 1])[:-1] + _reduce(points[index:])


def simplify(loop: list[tuple[int, int]]) -> list[list[int]]:
    """Straighten a closed pixel boundary; one-pixel staircases become diagonals."""
    far = max(range(len(loop)), key=lambda i: abs(loop[i][0] - loop[0][0]) + abs(loop[i][1] - loop[0][1]))
    points = _reduce(loop[:far + 1])[:-1] + _reduce(loop[far:] + [loop[0]])[:-1]
    return [list(point) for point in points]


def geometry_for(name: str, area: dict) -> maps.Geometry:
    source = SOURCE / area["source"]
    with Image.open(source) as image:
        width, height = image.size
    polygons = contours(floor_mask(source))
    rendered = np.zeros((height, width), dtype=bool)
    for polygon in polygons:
        layer = Image.new("1", (width, height))
        ImageDraw.Draw(layer).polygon([tuple(p) for p in polygon], fill=1)
        rendered ^= np.asarray(layer, dtype=bool)
    path = " ".join("M" + "L".join(f"{x} {y}" for x, y in polygon) + "Z" for polygon in polygons)
    floor_svg = f'<g id="seabed-{name}-floor"><path d="{path}" fill="#173d60" fill-rule="evenodd"/></g>'
    outline_svg = f'<path d="{path}" fill="none" stroke="#8edfff" stroke-width="1.2" stroke-linejoin="miter"/>'
    empty = np.zeros_like(rendered)
    return maps.Geometry(width, height, rendered, empty, empty, empty, float("nan"), 0, 0,
                         floor_svg=floor_svg, outline_svg=outline_svg)


def build(selected: set[str] | None) -> None:
    content = maps.load_content("seabed.json")
    languages = list(content["strings"])
    errors: list[str] = []
    for name, area in content["maps"].items():
        if selected and name not in selected:
            continue
        geometry = geometry_for(name, area)
        area_errors = maps.validate_area(name, area, geometry, languages)
        distance = ndimage.distance_transform_edt(~geometry.floor)
        for route in area["routes"]:
            for leg in route["legs"]:
                points = np.rint(maps._polyline_points(leg, step=1)).astype(int)
                if any(distance[y, x] > 2 for x, y in points):
                    area_errors.append(f"map {name}: {route['role']} route leaves the floor")
        errors.extend(area_errors)
        if area_errors:
            continue
        for language in languages:
            # The renderer titles a map from its "area" string; Seabed maps carry their own titles.
            strings = {language: {**content["strings"][language], "area": area["title"][language]}}
            svg = maps.render_area("0", {**area, "stage": 0}, geometry, strings, language, content["symbol_labels"][language])
            svg = "\n".join(line.rstrip() for line in svg.splitlines()) + "\n"
            directory = OUTPUT / language
            directory.mkdir(parents=True, exist_ok=True)
            (directory / f"{name}.svg").write_text(svg, encoding="utf-8")
        print(f"{name}: built in {', '.join(languages)}")
    if errors:
        raise SystemExit("Seabed map data failed validation:\n" + "\n".join(errors))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--map", action="append", help="build only this map, e.g. SU-1-1 (repeatable)")
    build(set(parser.parse_args().map or []) or None)


if __name__ == "__main__":
    main()
