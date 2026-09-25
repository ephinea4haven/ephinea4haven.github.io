"""Shared geometry, validation and SVG rendering for the challenge-map atlases.

The design brief is docs/CHALLENGE_MAP_REDRAW.md. Coordinates in the map data
are source-image pixels; everything here renders in that coordinate system.
"""

from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
import tempfile
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content/challenge-maps"
FONT = "system-ui,-apple-system,sans-serif"
NO_LINE_START = set("。，、；：！？）」』.,;:!?)")

PALETTE = {
    "background": "#071a31",
    "floor": "#1f5a8c",
    "outline": "#4fe3ff",
    "dark_hatch": "#4fe3ff",
    "main": "#ffd23f",
    "split": "#f5f7ff",
    "solo": "#b48cff",
    "optional": "#c9d6e8",
    "halo": "#071a31",
    "start": "#39d6ff",
    "exit": "#ff5ca8",
    "badge": "#ff9f43",
    "ink": "#061329",
}

ROUTE_ROLES = ("main", "split", "solo", "optional")
ROUTE_STYLE = {
    "main": {"width": 7, "dash": None},
    "split": {"width": 5, "dash": None},
    "solo": {"width": 5, "dash": None},
    "optional": {"width": 4, "dash": "14 10"},
}
SYMBOL_KINDS = {
    "switch", "timed-switch", "door", "warp", "box", "trap", "turret", "rocks",
    "heal", "target", "console", "press", "false-wall", "sequence", "dark-room",
    "mag-switch", "item-switch", "light-switch", "jar-trap", "avoid-target", "avoid-switch", "avoid-warp", "barrier-grid", "barrier-switch",
}
EXIT_KINDS = {"next", "boss", "finish"}

ANCHOR_TOLERANCE = 12
CONSISTENCY_FLOOR = 90.0  # % of wall-crossing evidence the floor parity agrees with
DASH_MAX_PIXELS = 40
FIDELITY_RADIUS = 10
SYMBOL_EXCLUSION = 20
FIDELITY_DASH_COVERED = 85.0
FIDELITY_ROUTE_ON_DASH = 90.0

CROSS_STEPS = 7
STROKE_CORE = 175
CORRIDOR_GAP = 5
MIN_FLOOR_PIECE = 60
MIN_OUTLINE_PIECE = 20
DARK_BAND = (45, 200)
TEXT_MAX_HEIGHT = 24
TEXT_MAX_WIDTH = 170
DIRECTIONS = ((0, 1), (1, 0), (1, 1), (1, -1))
INK_BRIDGE_RADIUS = 9
MAP_PADDING = 24

EIGHT = np.ones((3, 3), dtype=bool)


def load_content(name: str) -> dict:
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


# --------------------------------------------------------------------------
# Geometry (docs/CHALLENGE_MAP_REDRAW.md §5.1)
# --------------------------------------------------------------------------


@dataclass
class Geometry:
    width: int
    height: int
    floor: np.ndarray
    outline: np.ndarray
    dark_room: np.ndarray
    dashes: np.ndarray
    coverage: float  # wall-crossing consistency of the floor parity, %
    dash_max: int
    symbol_min: int
    floor_svg: str = ""
    outline_svg: str = ""
    detail_svg: str = ""
    extent: np.ndarray | None = None  # drawn area for cropping when it exceeds the floor


def _shift(array: np.ndarray, dy: int, dx: int, fill) -> np.ndarray:
    out = np.full_like(array, fill)
    h, w = array.shape
    ys = slice(max(dy, 0), h + min(dy, 0))
    xs = slice(max(dx, 0), w + min(dx, 0))
    yd = slice(max(-dy, 0), h + min(-dy, 0))
    xd = slice(max(-dx, 0), w + min(-dx, 0))
    out[yd, xd] = array[ys, xs]
    return out


class ParityUnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))
        self.parity = [0] * size  # parity relative to parent

    def find(self, node: int) -> tuple[int, int]:
        path = []
        while self.parent[node] != node:
            path.append(node)
            node = self.parent[node]
        root = node
        # compress with accumulated parity
        acc = 0
        for item in reversed(path):
            acc ^= self.parity[item]
            self.parity[item] = acc
            self.parent[item] = root
        return root, (self.parity[path[0]] if path else 0)

    def union(self, a: int, b: int, differ: int) -> bool:
        ra, pa = self.find(a)
        rb, pb = self.find(b)
        if ra == rb:
            return (pa ^ pb) == differ
        self.parent[rb] = ra
        self.parity[rb] = pa ^ pb ^ differ
        return True


def outside_dilated(outside: np.ndarray) -> np.ndarray:
    """Pixels touching the outside: a gap next to it is exterior, not corridor."""
    return ndimage.binary_dilation(outside, structure=EIGHT)


def trace_geometry(path: Path) -> Geometry:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    height, width = rgb.shape[:2]
    value = rgb.max(axis=2)
    neutral = (value - rgb.min(axis=2)) <= 10

    # Annotation ink: coloured pixels plus the black borders drawn around them.
    coloured = ~neutral
    # Yellow label boxes (START, TO NEXT LEVEL, numbered labels) have grey
    # antialiased borders; everything else has near-black outlines.
    yellow = (rgb[..., 0] >= 225) & (rgb[..., 1] >= 225) & (rgb[..., 2] <= 80)
    label_border = neutral & (value <= 200) & ndimage.binary_dilation(yellow, structure=EIGHT, iterations=3)
    ink = coloured | label_border | (neutral & (value <= 60) & ndimage.binary_dilation(coloured, structure=EIGHT, iterations=3))

    # Dark rooms: solid grey fills.
    # Opening removes wall strokes (grey on the early maps) so only solid
    # fills remain; the fill is then restored to its full grey extent.
    grey = neutral & (value >= DARK_BAND[0]) & (value <= DARK_BAND[1]) & ~ink
    solid = ndimage.binary_opening(grey, structure=np.ones((5, 5), bool))
    solid = ndimage.binary_dilation(solid, structure=EIGHT, iterations=2) & grey
    grey_labels, _ = ndimage.label(solid, structure=EIGHT)
    dark_room = np.zeros((height, width), bool)
    for index, box in enumerate(ndimage.find_objects(grey_labels), start=1):
        component = grey_labels[box] == index
        size = int(component.sum())
        if size >= 400 and size >= 0.25 * component.size:
            dark_room[box] |= component

    # Smaller solid grey blobs are symbols (decoy switches, grey pads), not walls.
    grey_blobs = solid & ~dark_room
    ink |= grey_blobs | (neutral & (value <= 60) & ndimage.binary_dilation(grey_blobs, structure=EIGHT, iterations=2))

    wall = neutral & (value <= 200) & ~ink & ~dark_room

    # Text glyphs: small wall components that are at most one text line tall.
    # Text is near-black and stands apart from symbols; short wall stubs cut
    # by a symbol or label box touch that ink and stay walls.
    wall_labels, _ = ndimage.label(wall, structure=EIGHT)
    near_ink = ndimage.binary_dilation(ink, structure=EIGHT)
    text = np.zeros_like(wall)
    for index, box in enumerate(ndimage.find_objects(wall_labels), start=1):
        h = box[0].stop - box[0].start
        w = box[1].stop - box[1].start
        if h > TEXT_MAX_HEIGHT or not (w <= TEXT_MAX_HEIGHT or (h >= 5 and w <= TEXT_MAX_WIDTH)):
            continue
        component = wall_labels[box] == index
        if near_ink[box][component].any() or value[box][component].mean() > 90:
            continue
        text[box] |= component
    wall &= ~text

    barrier = ndimage.binary_closing(wall | ink | dark_room, structure=EIGHT, border_value=0) | wall | ink | dark_room
    free_labels, count = ndimage.label(~barrier)

    border = np.zeros((height, width), bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    # Border contact is weak evidence of "outside": scans crop some corridors
    # at the image edge, so wall crossings must be able to outvote it.
    border_ids, border_weights = np.unique(free_labels[border & ~barrier], return_counts=True)
    keep = border_ids != 0
    border_ids, border_weights = border_ids[keep], border_weights[keep]

    # Wall crossings: walk from each free pixel across barrier pixels.
    pairs_wall: list[np.ndarray] = []
    pairs_ink: list[np.ndarray] = []
    # A stroke is a run of dark core pixels; antialiasing and closed gaps
    # between two strokes are not. Crossing an even number of strokes (a
    # corridor drawn too narrow to have open floor) keeps the parity.
    core = wall & (value <= STROKE_CORE)
    for dy, dx in DIRECTIONS:
        start = free_labels
        running = start != 0
        saw_ink = np.zeros((height, width), bool)
        strokes = np.zeros((height, width), np.uint8)
        previous_core = np.zeros((height, width), bool)
        for step in range(1, CROSS_STEPS + 1):
            target = _shift(free_labels, dy * step, dx * step, 0)
            hit = running & (target != 0)
            if step > 1:
                crossing = hit & (target != start)
                if crossing.any():
                    a = start[crossing].astype(np.int64)
                    b = target[crossing].astype(np.int64)
                    code = np.minimum(a, b) * (count + 1) + np.maximum(a, b)
                    via_ink = saw_ink[crossing]
                    odd = (strokes[crossing] % 2 == 1) | (strokes[crossing] == 0)
                    pairs_ink.append(code[via_ink])
                    pairs_wall.append(code[~via_ink & odd])
                    pairs_ink.append(code[~via_ink & ~odd])
            here_core = _shift(core, dy * step, dx * step, False)
            strokes += (running & here_core & ~previous_core).astype(np.uint8)
            previous_core = here_core
            saw_ink |= _shift(ink, dy * step, dx * step, False)
            running = running & (target == 0)
            if not running.any():
                break

    def tally(chunks: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
        if not chunks:
            return np.array([], np.int64), np.array([], np.int64)
        codes, weights = np.unique(np.concatenate(chunks), return_counts=True)
        return codes, weights

    wall_codes, wall_weights = tally(pairs_wall)
    ink_codes, ink_weights = tally(pairs_ink)

    root = 0  # virtual outside node
    uf = ParityUnionFind(count + 1)
    edges = [(int(w), int(c), 0) for c, w in zip(border_ids, border_weights)]  # code c = pair (0, c)
    edges += [(int(w), int(c), 1) for c, w in zip(wall_codes, wall_weights)]
    edges += [(int(w), int(c), 0) for c, w in zip(ink_codes, ink_weights)]
    edges.sort(reverse=True)
    conflict = 0
    total = 0
    for weight, code, differ in edges:
        a, b = divmod(code, count + 1)
        total += weight
        if not uf.union(a, b, differ):
            conflict += weight

    parity = np.zeros(count + 1, np.uint8)
    known = np.zeros(count + 1, bool)
    root_set, root_parity = uf.find(root)
    for component in range(1, count + 1):
        r, p = uf.find(component)
        if r == root_set:
            parity[component] = p ^ root_parity
            known[component] = True
    floor = (parity[free_labels].astype(bool) & (free_labels != 0)) | dark_room
    # Free space with no crossing evidence (enclosed by thick ink, such as the
    # cells of a drawn maze grid) is decided after the ink by its surroundings.
    unknown = ~known[free_labels] & (free_labels != 0)
    outside = ~floor & ~barrier & ~unknown

    # Corridors drawn narrower than the closing leave no free pixels: the
    # pixels between two wall strokes at most CORRIDOR_GAP apart are floor.
    between = np.zeros((height, width), bool)
    for dy, dx in DIRECTIONS:
        before = np.zeros((height, width), bool)
        after = np.zeros((height, width), bool)
        for step in range(1, CORRIDOR_GAP + 1):
            before |= _shift(core, -dy * step, -dx * step, False)
            after |= _shift(core, dy * step, dx * step, False)
        between |= before & after
    corridor = between & ~core & barrier & ~outside_dilated(outside)
    floor |= corridor

    # Ink becomes floor when floor dominates its surroundings; a label box or
    # symbol that sits mostly outside the walls stays out.
    ink_labels, ink_count = ndimage.label(ink, structure=EIGHT)
    halo = ndimage.binary_dilation(ink, structure=EIGHT, iterations=2) & ~ink
    halo_labels = ndimage.grey_dilation(ink_labels, footprint=np.ones((5, 5), bool)) * halo
    floor_votes = ndimage.sum(floor & halo, halo_labels, index=np.arange(ink_count + 1))
    outside_votes = ndimage.sum(outside & halo, halo_labels, index=np.arange(ink_count + 1))
    floor_share = floor_votes / np.maximum(floor_votes + outside_votes, 1)
    floor |= ink & (floor_share[ink_labels] >= 0.5) & (ink_labels != 0)
    if unknown.any():
        unknown_labels, unknown_count = ndimage.label(unknown)
        ring = ndimage.binary_dilation(unknown, structure=EIGHT, iterations=2) & ~unknown
        ring_labels = ndimage.grey_dilation(unknown_labels, footprint=np.ones((5, 5), bool)) * ring
        share = ndimage.sum(floor & ring, ring_labels, index=np.arange(unknown_count + 1)) / np.maximum(
            ndimage.sum(ring, ring_labels, index=np.arange(unknown_count + 1)), 1)
        decided = share[unknown_labels] >= 0.6
        floor |= unknown & decided
        outside |= unknown & ~decided
    y, x = np.ogrid[-INK_BRIDGE_RADIUS:INK_BRIDGE_RADIUS + 1, -INK_BRIDGE_RADIUS:INK_BRIDGE_RADIUS + 1]
    disk = x * x + y * y <= INK_BRIDGE_RADIUS * INK_BRIDGE_RADIUS
    bridged = ndimage.binary_closing(floor, structure=disk, border_value=0)
    floor |= bridged & (ink | text) & ~outside
    # Small leftover islands of barrier fully inside floor (closing artefacts).
    gaps = ~floor & ~outside
    gap_labels, _ = ndimage.label(gaps, structure=EIGHT)
    open_gaps = np.unique(gap_labels[ndimage.binary_dilation(outside, structure=EIGHT) & gaps])
    small = [i for i, box in enumerate(ndimage.find_objects(gap_labels), start=1)
             if box is not None and (box[0].stop - box[0].start) * (box[1].stop - box[1].start) <= 16]
    floor |= np.isin(gap_labels, np.setdiff1d(small, open_gaps))

    # Text-sized wall pieces surrounded only by floor are labels inside rooms.
    rest_labels, _ = ndimage.label(wall & ~floor, structure=EIGHT)
    for index, box in enumerate(ndimage.find_objects(rest_labels), start=1):
        if box is None or box[0].stop - box[0].start > TEXT_MAX_HEIGHT or box[1].stop - box[1].start > TEXT_MAX_WIDTH:
            continue
        y0, y1 = max(box[0].start - 2, 0), min(box[0].stop + 2, height)
        x0, x1 = max(box[1].start - 2, 0), min(box[1].stop + 2, width)
        component = rest_labels[y0:y1, x0:x1] == index
        halo = ndimage.binary_dilation(component, structure=EIGHT, iterations=2) & ~component
        blocked = (wall[y0:y1, x0:x1] | ink[y0:y1, x0:x1]) & ~floor[y0:y1, x0:x1]
        neighbours = halo & ~blocked
        if neighbours.any() and floor[y0:y1, x0:x1][neighbours].mean() >= 0.85:
            floor[y0:y1, x0:x1] |= component
    # Specks of floor (digits inside symbols, text counters outside rooms).
    floor_labels, _ = ndimage.label(floor, structure=EIGHT)
    sizes = np.bincount(floor_labels.ravel())
    floor &= sizes[floor_labels] >= MIN_FLOOR_PIECE
    outline = wall & ~floor & (ndimage.distance_transform_edt(~floor) <= 2)
    # Whiskers: short outline stubs left where a door bar crosses a wall.
    outline_labels, _ = ndimage.label(outline, structure=EIGHT)
    outline &= np.bincount(outline_labels.ravel())[outline_labels] >= MIN_OUTLINE_PIECE

    # PSO World draws the main route with red dashes and split routes with
    # orange dashes; both are route references.
    red = (rgb[..., 0] >= 210) & (rgb[..., 1] <= 125) & (rgb[..., 2] <= 145)
    orange = (rgb[..., 0] >= 230) & (rgb[..., 1] >= 110) & (rgb[..., 1] <= 200) & (rgb[..., 2] <= 100)
    route_ink = red | orange
    red_labels, red_count = ndimage.label(route_ink)
    sizes = ndimage.sum(route_ink, red_labels, index=np.arange(1, red_count + 1)).astype(int) if red_count else np.array([], int)
    dash_ids = np.flatnonzero(sizes <= DASH_MAX_PIXELS) + 1
    dashes = np.isin(red_labels, dash_ids)
    dash_sizes = sizes[sizes <= DASH_MAX_PIXELS]
    symbol_sizes = sizes[sizes > DASH_MAX_PIXELS]

    return Geometry(
        width=width,
        height=height,
        floor=floor,
        outline=outline,
        dark_room=dark_room,
        dashes=dashes,
        coverage=100.0 * (1 - conflict / max(total, 1)),
        dash_max=int(dash_sizes.max()) if dash_sizes.size else 0,
        symbol_min=int(symbol_sizes.min()) if symbol_sizes.size else 0,
    )


def content_bounds(geometry: Geometry, area: dict) -> tuple[int, int, int, int]:
    """Bounding box of the floor and every authored point, padded, clipped to the source."""
    ys, xs = np.nonzero(geometry.floor if geometry.extent is None else geometry.extent)
    points = [area["start"], area["exit"], *(badge[1:] for badge in area["badges"])]
    points += [symbol["at"] for symbol in area["symbols"] if "at" in symbol]
    left = min(int(xs.min()), *(p[0] for p in points)) - MAP_PADDING
    top = min(int(ys.min()), *(p[1] for p in points)) - MAP_PADDING
    right = max(int(xs.max()), *(p[0] for p in points)) + MAP_PADDING
    bottom = max(int(ys.max()), *(p[1] for p in points)) + MAP_PADDING
    return max(left, 0), max(top, 0), min(right, geometry.width), min(bottom, geometry.height)


def potrace_executable() -> str:
    executable = shutil.which("potrace")
    if executable is None:
        raise SystemExit("The potrace binary is required (https://potrace.sourceforge.net); see README prerequisites.")
    return executable


def trace_mask(mask: np.ndarray, color: str) -> str:
    """Vectorize a boolean mask with potrace and return one filled SVG group."""
    with tempfile.TemporaryDirectory(prefix="challenge-map-") as directory:
        bitmap = Path(directory) / "layer.pbm"
        vector = Path(directory) / "layer.svg"
        Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).convert("1").save(bitmap)
        subprocess.run(
            [potrace_executable(), str(bitmap), "--svg", "--flat", "--turdsize", "3", "--alphamax", "1", "--output", str(vector)],
            check=True,
            capture_output=True,
        )
        content = vector.read_text(encoding="utf-8")
    group = re.search(r'(<g transform="[^"]+"[^>]*>.*</g>)', content, re.DOTALL)
    if not group:
        raise RuntimeError("potrace returned no SVG group")
    return re.sub(r'fill="#000000"', f'fill="{color}"', group.group(1), count=1)


# --------------------------------------------------------------------------
# Validation (§3.3, §4, §5.3)
# --------------------------------------------------------------------------


def _distance_to(mask: np.ndarray) -> np.ndarray:
    return ndimage.distance_transform_edt(~mask)


def _polyline_points(points: list[list[int]], step: float = 2.0) -> np.ndarray:
    samples: list[tuple[float, float]] = []
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        length = max(abs(x1 - x0), abs(y1 - y0), 1)
        count = max(int(length / step), 1)
        for index in range(count):
            t = index / count
            samples.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    samples.append(tuple(points[-1]))
    return np.array(samples)


def _inside(point: list[int], geometry: Geometry) -> bool:
    x, y = point
    return 0 <= x < geometry.width and 0 <= y < geometry.height


def validate_area(area_id: str, area: dict, geometry: Geometry, languages: list[str]) -> list[str]:
    errors: list[str] = []
    floor_distance = _distance_to(geometry.floor)

    def on_floor(point: list[int], what: str) -> None:
        if not _inside(point, geometry):
            errors.append(f"{what} {point} is outside the source image")
            return
        distance = floor_distance[point[1], point[0]]
        if distance > ANCHOR_TOLERANCE:
            errors.append(f"{what} {point} is {distance:.0f} px from the floor")

    for key in ("start", "exit"):
        if not _inside(area[key], geometry):
            errors.append(f"{key} {area[key]} is outside the source image")
    if area["exit_kind"] not in EXIT_KINDS:
        errors.append(f"exit_kind {area['exit_kind']!r} is not one of {sorted(EXIT_KINDS)}")

    warps: dict[int, dict[bool, list[list[int]]]] = {}
    for symbol in area["symbols"]:
        kind = symbol["kind"]
        if kind not in SYMBOL_KINDS:
            errors.append(f"unknown symbol kind {kind!r}")
            continue
        if kind == "dark-room":
            polygon = Image.new("1", (geometry.width, geometry.height), 0)
            from PIL import ImageDraw
            ImageDraw.Draw(polygon).polygon([tuple(p) for p in symbol["points"]], fill=1)
            mask = np.asarray(polygon, dtype=bool)
            if mask.sum() and (mask & geometry.floor).sum() < 0.95 * mask.sum():
                errors.append(f"dark-room polygon {symbol['points'][0]}… is not on the floor")
            continue
        on_floor(symbol["at"], f"{kind} symbol")
        if kind == "warp":
            pair = warps.setdefault(symbol["n"], {False: [], True: []})
            side = pair[symbol["prime"]]
            if symbol["at"] in side:
                errors.append(f"warp {symbol['n']} repeats endpoint {symbol['at']}")
            side.append(symbol["at"])
    for number, pair in warps.items():
        if not pair[False] or not pair[True]:
            errors.append(f"warp {number} is not paired")

    for route in area["routes"]:
        if route["role"] not in ROUTE_ROLES:
            errors.append(f"unknown route role {route['role']!r}")
        legs = route["legs"]
        for leg in legs:
            if len(leg) < 2:
                errors.append(f"{route['role']} route has a leg with fewer than two points")
            for point in leg:
                on_floor(point, f"{route['role']} route point")
        for before, after in zip(legs, legs[1:]):
            end, start = before[-1], after[0]
            matched = any(
                set(pair) == {False, True}
                and any(np.hypot(end[0] - origin[0], end[1] - origin[1]) <= ANCHOR_TOLERANCE
                        and np.hypot(start[0] - destination[0], start[1] - destination[1]) <= ANCHOR_TOLERANCE
                        for prime in (False, True) for origin in pair[prime] for destination in pair[not prime])
                for pair in warps.values()
            )
            if not matched:
                errors.append(f"{route['role']} route legs {end}→{start} do not meet a warp pair")

    for badge in area["badges"]:
        if not _inside(badge[1:], geometry):
            errors.append(f"badge {badge[0]} is outside the source image")
    numbers = sorted(badge[0] for badge in area["badges"])
    for language in languages:
        numbered = area["notes"][language]["numbered"]
        if numbers != list(range(1, len(numbered) + 1)):
            errors.append(f"{language}: badges {numbers} do not match {len(numbered)} numbered notes")

    return [f"area {area_id}: {error}" for error in errors]


def fidelity(area: dict, geometry: Geometry) -> tuple[float, float]:
    """Return (% of source dashes near the route, % of route near a dash)."""
    samples = np.vstack([_polyline_points(leg) for route in area["routes"] for leg in route["legs"]])
    route_mask = np.zeros_like(geometry.floor)
    xs = np.clip(np.rint(samples[:, 0]).astype(int), 0, geometry.width - 1)
    ys = np.clip(np.rint(samples[:, 1]).astype(int), 0, geometry.height - 1)
    route_mask[ys, xs] = True
    # Symbol outlines (warp triangles, switch rings) share the route colours;
    # pixels near a declared symbol are not route dashes.
    anchors = np.zeros_like(geometry.floor)
    for symbol in area["symbols"]:
        if "at" in symbol:
            anchors[symbol["at"][1], symbol["at"][0]] = True
    dashes = geometry.dashes & (_distance_to(anchors) > SYMBOL_EXCLUSION) if anchors.any() else geometry.dashes
    dash_total = int(dashes.sum())
    if dash_total == 0:
        return 100.0, 100.0
    near_route = _distance_to(route_mask) <= FIDELITY_RADIUS
    dash_covered = 100.0 * float((dashes & near_route).sum()) / dash_total
    main_samples = np.vstack([
        _polyline_points(leg) for route in area["routes"] if route["role"] != "optional" for leg in route["legs"]
    ])
    mx = np.clip(np.rint(main_samples[:, 0]).astype(int), 0, geometry.width - 1)
    my = np.clip(np.rint(main_samples[:, 1]).astype(int), 0, geometry.height - 1)
    near_dash = _distance_to(dashes)[my, mx] <= FIDELITY_RADIUS
    return dash_covered, 100.0 * float(near_dash.mean())


# --------------------------------------------------------------------------
# SVG pieces
# --------------------------------------------------------------------------


def text(content: str, x: float, y: float, *, size: int, fill: str, weight: int = 900, anchor: str = "middle") -> str:
    return (
        f'<text x="{x:g}" y="{y:g}" text-anchor="{anchor}" fill="{fill}" font-family="{FONT}" '
        f'font-size="{size}" font-weight="{weight}">{html.escape(content)}</text>'
    )


def wrap_text(content: str, width: int, size: int) -> list[str]:
    def advance(character: str) -> float:
        if unicodedata.east_asian_width(character) in {"W", "F"}:
            return size
        if character.isspace():
            return size * 0.34
        return size * 0.62

    # Latin words and numbers stay whole; CJK characters break anywhere except
    # before closing punctuation.
    tokens = re.findall(r"[A-Za-z0-9'’′/+→\-]+[.,;:!?)]?|\s+|.", content)
    lines: list[str] = []
    line = ""
    line_width = 0.0
    for token in tokens:
        token_width = sum(advance(character) for character in token)
        if line and line_width + token_width > width and token[0] not in NO_LINE_START:
            lines.append(line.rstrip())
            line, line_width = "", 0.0
            if token.isspace():
                continue
        line += token
        line_width += token_width
    if line:
        lines.append(line.rstrip())
    return lines


def wrapped_lines(content: str, x: int, y: int, width: int, *, size: int = 15) -> str:
    tspans = "".join(
        f'<tspan x="{x}" dy="{0 if index == 0 else 24}">{html.escape(line)}</tspan>'
        for index, line in enumerate(wrap_text(content, width, size))
    )
    return f'<text x="{x}" y="{y}" fill="#bcd7ea" font-family="{FONT}" font-size="{size}" font-weight="650">{tspans}</text>'


def badge(number: int, x: float, y: float, size: float = 30) -> str:
    half = size / 2
    return (
        f'<g transform="translate({x:g} {y:g})" filter="url(#shadow)">'
        f'<rect x="{-half:g}" y="{-half:g}" width="{size:g}" height="{size:g}" rx="7" fill="{PALETTE["badge"]}" stroke="{PALETTE["ink"]}" stroke-width="3"/>'
        f'{text(str(number), 0, size * 0.2, size=int(size * 0.6), fill=PALETTE["ink"], weight=950)}</g>'
    )


def label_width(content: str, size: int) -> float:
    return sum(size if unicodedata.east_asian_width(c) in {"W", "F"} else size * 0.62 for c in content)


def terminal(kind: str, x: float, y: float, label: str, label_offset: tuple[float, float] = (0, -46)) -> str:
    """Start or exit marker in screen coordinates, label pill above the point."""
    color = PALETTE["start"] if kind == "start" else PALETTE["exit"]
    pill = label_width(label, 16) + 22
    dx, dy = label_offset
    return (
        f'<g transform="translate({x:g} {y:g})" filter="url(#shadow)">'
        f'<circle r="12" fill="{color}" stroke="{PALETTE["ink"]}" stroke-width="4"/>'
        f'<rect x="{dx-pill / 2:g}" y="{dy:g}" width="{pill:g}" height="26" rx="13" fill="{PALETTE["ink"]}" fill-opacity=".9" stroke="{color}" stroke-width="2"/>'
        f'{text(label, dx, dy + 18.5, size=16, fill=color)}</g>'
    )


def _ring(body: str, x: float, y: float, scale: float, angle: float = 0) -> str:
    rotate = f" rotate({angle:g})" if angle else ""
    return (
        f'<g transform="translate({x:g} {y:g}) scale({1 / scale:g}){rotate}" stroke="{PALETTE["ink"]}" '
        f'stroke-width="3" stroke-linejoin="round" filter="url(#shadow)">{body}</g>'
    )


def symbol_svg(symbol: dict, scale: float) -> str:
    kind = symbol["kind"]
    color = symbol.get("color", "#ffe45c")
    if kind == "dark-room":
        points = " ".join(f"{x},{y}" for x, y in symbol["points"])
        return f'<polygon points="{points}" fill="url(#dark-hatch)" stroke="none"/>'
    x, y = symbol["at"]
    label = symbol.get("label")
    if kind in {"switch", "timed-switch", "barrier-switch"}:
        body = f'<circle r="10" fill="{color}"/>'
        if kind == "barrier-switch":
            body = f'<rect x="-9" y="-11" width="18" height="22" rx="3" fill="{color}"/>'
        if "step" in symbol:
            body += f'<text y="4" text-anchor="middle" font-family="{FONT}" font-size="11" font-weight="950" fill="{PALETTE["ink"]}" stroke="none">{symbol["step"]}</text>'
        if kind == "timed-switch":
            body += f'<path d="M0-5V0l4 3" fill="none" stroke="{PALETTE["ink"]}" stroke-width="2.4" stroke-linecap="round"/>'
    elif kind == "door":
        body = f'<rect x="-4" y="-19" width="8" height="38" rx="3" fill="{color}"/>'
        return _ring(body, x, y, scale, symbol.get("angle", 0))
    elif kind == "warp":
        mark = f'{symbol["n"]}′' if symbol["prime"] else str(symbol["n"])
        body = (
            f'<path d="M-14-11H14L0 14Z" fill="{color}"/>'
            f'<text y="4" text-anchor="middle" font-family="{FONT}" font-size="13" font-weight="950" fill="{PALETTE["ink"]}" stroke="none">{mark}</text>'
        )
    elif kind == "barrier-grid":
        width, height = symbol["width"], symbol["height"]
        lines = "".join(f'<path d="M{width * (i / 3 - .5):g} {-height / 2:g}v{height:g}M{-width / 2:g} {height * (i / 3 - .5):g}h{width:g}"/>' for i in range(4))
        return f'<g transform="translate({x} {y})" fill="none" stroke="{color}" stroke-width="{2 / scale:g}">{lines}</g>'
    elif kind == "box":
        body = f'<rect x="-10" y="-9" width="20" height="18" rx="4" fill="{color}"/><path d="M-10-2H10" fill="none"/>'
    elif kind == "trap":
        body = f'<path d="M0-13 13 11H-13Z" fill="{color}"/><path d="M0-4V3M0 7v1" stroke-linecap="round"/>'
    elif kind == "turret":
        body = f'<circle r="9" fill="{color}"/><path d="M0 0 14-8" stroke-width="5" stroke-linecap="round" stroke="{color}"/>'
    elif kind == "jar-trap":
        body = f'<path d="M-11 10V-2Q-11-12 0-12Q11-12 11-2V10Z" fill="{color}"/><circle cy="-3" r="4" fill="#f26573"/><path d="M-13 10H13"/>'
    elif kind == "avoid-target":
        body = f'<circle r="10" fill="{PALETTE["ink"]}" stroke="{color}"/><path d="M-5-5 5 5M-5 5 5-5" stroke="{color}" stroke-width="3"/>'
    elif kind == "avoid-warp":
        body = f'<path d="M-14-11H14L0 14Z" fill="{PALETTE["ink"]}" stroke="{color}"/><path d="M-5-6 5 4M-5 4 5-6" stroke="{color}" stroke-width="3"/>'
    elif kind == "avoid-switch":
        body = f'<rect x="-10" y="-10" width="20" height="20" rx="3" fill="{PALETTE["ink"]}" stroke="{color}"/><path d="M-5-5 5 5M-5 5 5-5" stroke="{color}" stroke-width="3"/>'
    elif kind == "rocks":
        body = f'<path d="M-15 6-11-6-4-3 1-11 8-3 15-7 17 6 8 10 0 6-6 11Z" fill="{color}"/>'
    elif kind == "heal":
        body = f'<circle r="10" fill="{color}"/><path d="M-5 0h10M0-5v10" stroke-width="3"/>'
    elif kind == "target":
        body = f'<circle r="9" fill="none" stroke="{color}" stroke-width="3"/><circle r="3" fill="{color}"/>'
    elif kind == "console":
        body = f'<rect x="-10" y="-8" width="20" height="14" rx="2" fill="{color}"/><path d="M-4 10h8" stroke-width="3"/>'
    elif kind == "mag-switch":
        body = f'<rect x="-13" y="-9" width="26" height="18" rx="4" fill="{color}"/><text y="4" text-anchor="middle" font-family="{FONT}" font-size="11" font-weight="900" stroke="none" fill="{PALETTE["ink"]}">MAG</text>'
    elif kind == "item-switch":
        icon = 'M-6-6H6V1Q6 5 0 8Q-6 5-6 1Z' if symbol["item"] == "shield" else 'M-7 7 6-6M1-7 7-7 7-1M-7 1-1 7'
        body = f'<rect x="-11" y="-11" width="22" height="22" rx="3" fill="{color}"/><path d="{icon}" fill="none" stroke-width="2"/>'
        if "count" in symbol:
            body += f'<circle cx="10" cy="10" r="7" fill="{PALETTE["ink"]}" stroke="none"/><text x="10" y="14" text-anchor="middle" font-family="{FONT}" font-size="11" font-weight="950" fill="{color}" stroke="none">{symbol["count"]}</text>'
    elif kind == "light-switch":
        body = f'<circle cy="-3" r="8" fill="{color}"/><path d="M-4 6H4M-3 10H3" stroke="{color}" stroke-width="3"/>'
    elif kind == "press":
        body = f'<rect x="-10" y="-11" width="20" height="7" fill="{color}"/><path d="M0-4V6M-8 9H8" stroke-width="3"/>'
    elif kind == "false-wall":
        body = "".join(f'<rect x="-2.5" y="{y}" width="5" height="8" rx="1" fill="{color}" stroke="none"/>' for y in (-18, -5, 8))
        return _ring(body, x, y, scale, symbol.get("angle", 0))
    else:  # sequence
        count = symbol["count"]
        body = "".join(
            f'<circle cx="{(index - (count - 1) / 2) * 20:g}" r="8" fill="{color}"/>'
            f'<text x="{(index - (count - 1) / 2) * 20:g}" y="4" text-anchor="middle" font-family="{FONT}" font-size="10" font-weight="950" fill="{PALETTE["ink"]}" stroke="none">{index + 1}</text>'
            for index in range(count)
        )
    if label:
        body += f'<text y="-15" text-anchor="middle" font-family="{FONT}" font-size="12" font-weight="900" fill="{color}" stroke="none">{html.escape(label)}</text>'
    return _ring(body, x, y, scale)


def route_svg(route: dict, scale: float) -> str:
    style = ROUTE_STYLE[route["role"]]
    color = PALETTE[route["role"]]
    width = style["width"] / scale
    dash = f' stroke-dasharray="{" ".join(f"{float(part) / scale:g}" for part in style["dash"].split())}"' if style["dash"] else ""
    paths: list[str] = []
    for index, leg in enumerate(route["legs"]):
        d = "M" + " L".join(f"{x:g} {y:g}" for x, y in leg)
        last = index == len(route["legs"]) - 1 and route["role"] != "optional"
        marker = f' marker-end="url(#arrow-{route["role"]})"' if last else ""
        paths.append(
            f'<path d="{d}" fill="none" stroke="{PALETTE["halo"]}" stroke-opacity=".85" stroke-width="{width + 5 / scale:g}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path data-role="{route["role"]}" d="{d}" fill="none" stroke="{color}" stroke-width="{width:g}" stroke-linecap="round" stroke-linejoin="round"{dash}{marker}/>'
        )
    return "".join(paths)


def defs(scale: float) -> str:
    markers = "".join(
        f'<marker id="arrow-{role}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">'
        f'<path d="M0 0 10 5 0 10Z" fill="{PALETTE[role]}" stroke="{PALETTE["ink"]}" stroke-width="1"/></marker>'
        for role in ("main", "split", "solo")
    )
    hatch = 10 / scale
    return (
        '<defs>'
        '<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity=".35"/></filter>'
        f'<pattern id="dark-hatch" width="{hatch:g}" height="{hatch:g}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
        f'<rect width="{hatch:g}" height="{hatch:g}" fill="#000" fill-opacity=".25"/>'
        f'<path d="M0 0V{hatch:g}" stroke="{PALETTE["dark_hatch"]}" stroke-opacity=".25" stroke-width="{3 / scale:g}"/></pattern>'
        f'{markers}</defs>'
    )


def key_strip(roles: list[str], strings: dict, width: int, y: int) -> tuple[str, int]:
    shown = [role for role in ROUTE_ROLES if role in roles]
    if shown == ["main"] or not shown:
        return "", 0
    items: list[str] = []
    x = 30
    for role in shown:
        style = ROUTE_STYLE[role]
        dash = f' stroke-dasharray="{style["dash"]}"' if style["dash"] else ""
        items.append(
            f'<path d="M{x} {y + 18}h34" stroke="{PALETTE[role]}" stroke-width="{style["width"]}" stroke-linecap="round"{dash}/>'
            + text(strings[role], x + 44, y + 24, size=15, fill="#dff8ff", weight=800, anchor="start")
        )
        x += 44 + label_width(strings[role], 15) + 36
    return "".join(items), 40


def symbol_key_strip(symbols: list[dict], labels: dict[str, str], width: int, y: int) -> tuple[str, int]:
    """Show each mechanism used on this map once, with a localized caption."""
    examples = {}
    for symbol in symbols:
        key = symbol["kind"]
        if key == "item-switch":
            key += ":" + symbol["item"]
        examples.setdefault(key, symbol)
    x, row = 34, 0
    items = []
    for key, example in examples.items():
        label = labels[key]
        item_width = 32 + label_width(label, 13) + 28
        if x + item_width > width - 20:
            x, row = 34, row + 1
        icon = {**example, "at": [x, y + 16 + row * 34], "color": "#a9d8ed"}
        icon.pop("step", None)
        if icon["kind"] == "barrier-grid":
            icon.update(width=18, height=18)
        if icon["kind"] == "warp":
            icon.update(n=1, prime=False)
        items.append(symbol_svg(icon, 1.3))
        items.append(text(label, x + 20, y + 21 + row * 34, size=13, fill="#a9d8ed", weight=650, anchor="start"))
        x += item_width
    return "".join(items), (row + 1) * 34 + 8


def callout_height(callout: dict, language: str) -> int:
    text_height = len(wrap_text(callout["text"][language], callout["box"][2] - 16, 13)) * 18 + 14
    return text_height + (len(callout["grid"]) * 28 + 12 if "grid" in callout else 0)


def callout_svg(callout: dict, anchor: tuple[float, float], language: str) -> tuple[str, str]:
    """Keep a source instruction next to its location, with a leader line.

    Anchors use source coordinates; label boxes use the 1000-unit page layout.
    Their placement is shared by all languages, with text wrapped to fit.
    """
    x, y, width = callout["box"]
    lines = wrap_text(callout["text"][language], width - 16, 13)
    height = callout_height(callout, language)
    ax, ay = anchor
    edge_x = min(max(ax, x), x + width)
    edge_y = min(max(ay, y), y + height)
    color = {"warning": "#ffbe99", "supply": "#a0e5b6", "action": "#a9d8ed"}[callout["tone"]]
    caption = "".join(text(line, x + 8, y + 20 + index * 18, size=13, fill=color, weight=650, anchor="start")
                      for index, line in enumerate(lines))
    if "grid" in callout:
        rows = callout["grid"]
        top = y + len(lines) * 18 + 24
        left = x + width / 2 - (len(rows[0]) - 1) * 18
        cells = []
        for row, values in enumerate(rows):
            for col, value in enumerate(values):
                if not value:
                    continue
                cx, cy = left + col * 36, top + row * 28
                ink = "#ffbe99" if value == "×" else "#a0e5b6"
                cells.append(f'<circle cx="{cx:g}" cy="{cy:g}" r="11" fill="#071a31" stroke="{ink}"/>'
                             + text(value, cx, cy + 4.5, size=14, fill=ink))
        caption += '<g data-switch-grid="">' + "".join(cells) + '</g>'
    leader = (
        f'<path d="M{ax:g} {ay:g}L{edge_x:g} {edge_y:g}" fill="none" stroke="{color}" stroke-opacity=".7" stroke-width="1" stroke-dasharray="2 3"/>'
        f'<circle cx="{ax:g}" cy="{ay:g}" r="2.5" fill="{color}"/>'
    )
    box = (
        f'<g data-callout="{html.escape(callout["id"], quote=True)}">'
        f'<title>{html.escape(callout["source"])}</title>'
        f'<rect data-callout-box="" x="{x}" y="{y}" width="{width}" height="{height}" rx="5" fill="#10263a" stroke="{color}" stroke-opacity=".35"/>'
        f'{caption}</g>'
    )
    # Paint all leaders before any caption so another annotation's leader
    # cannot cross the text in an already-painted box.
    return leader, box


def notes_panel(notes: list[tuple[int | dict | None, str]], strings: dict, width: int, y: int) -> tuple[str, int]:
    if not notes:
        return text(strings["sources"], width - 42, y + 24, size=12, fill="#8aabba", anchor="end"), 42
    columns = 2 if width >= 700 else 1
    column_width = (width - 72) // columns
    heights = [max(56, len(wrap_text(note, column_width - 54, 15)) * 24 + 22) for _, note in notes]
    offsets = [66] * columns
    items: list[str] = []
    for index, ((number, note), item_height) in enumerate(zip(notes, heights)):
        column = index % columns
        x = 26 + column * column_width
        item_y = offsets[column]
        if number is None:
            items.append(f'<circle cx="{x + 14}" cy="{item_y - 1}" r="5" fill="#7fb8d8"/>')
        elif isinstance(number, dict):
            # A sample of the map's own artwork, cropped to the source box it came from.
            left, top, box_width, box_height = number["box"]
            items.append(f'<svg x="{x}" y="{item_y - 19}" width="28" height="28" '
                         f'viewBox="{left:g} {top:g} {box_width:g} {box_height:g}">{number["art"]}</svg>')
        else:
            items.append(badge(number, x + 14, item_y - 5, size=28))
        items.append(wrapped_lines(note, x + 42, item_y, column_width - 54))
        offsets[column] += item_height
    height = max(offsets) + 34
    return f'''<g transform="translate(18 {y})">
  <rect width="{width - 36}" height="{height}" rx="14" fill="#0b2745" stroke="#2c648b" stroke-width="2"/>
  {text(strings["tips"], 24, 34, size=19, fill="#e7f9ff", anchor="start")}
  {''.join(items)}
  {text(strings["sources"], width - 60, height - 14, size=13, fill="#7698b1", weight=650, anchor="end")}
</g>''', height


def panel_notes(area: dict, language: str, stage_note: str | None = None) -> list[tuple[int | dict | None, str]]:
    """General notes are text, or {"text", "icon": {"box", "art"}} to show the symbol they explain."""
    notes = area["notes"][language]
    ordered: list[tuple[int | dict | None, str]] = []
    if stage_note:
        ordered.append((None, stage_note))
    ordered.extend((note["icon"], note["text"]) if isinstance(note, dict) else (None, note) for note in notes["general"])
    ordered.extend((index + 1, note) for index, note in enumerate(notes["numbered"]))
    return ordered


# --------------------------------------------------------------------------
# Whole map
# --------------------------------------------------------------------------

MAP_WIDTH = 1000
MAP_MAX_HEIGHT = 1000


def render_area(area_id: str, area: dict, geometry: Geometry, strings: dict, language: str, symbol_labels: dict) -> str:
    """Render measured geometry, routes and localized anchored captions."""
    words = {**strings[language]}
    if "attribution" in area:
        words["sources"] = area["attribution"]
    left, top, right, bottom = content_bounds(geometry, area)
    frame_x, frame_y, frame_width, frame_height = area.get(
        "map_frame", [65, 60, 870, MAP_MAX_HEIGHT]
    )
    scale = min(frame_width / (right - left), frame_height / (bottom - top))
    map_width = (right - left) * scale
    map_height = (bottom - top) * scale
    offset_x = frame_x + (frame_width - map_width) / 2 - left * scale
    offset_y = frame_y - top * scale

    def screen(point: list[int]) -> tuple[float, float]:
        return offset_x + point[0] * scale, offset_y + point[1] * scale

    number = f"{int(area_id):02d}"
    title = words["area"].replace("{n}", number).replace("{stage}", str(area["stage"]))
    notes = panel_notes(area, language)
    roles = [route["role"] for route in area["routes"]]
    map_bottom = max([frame_y + map_height] + [c["box"][1] + callout_height(c, language) + 4
                                              for c in area.get("callouts", [])])
    strip, strip_height = key_strip(roles, words, MAP_WIDTH, round(map_bottom + 14))
    symbol_strip, symbol_height = symbol_key_strip([s for s in area["symbols"] if s.get("visible", True)], symbol_labels, MAP_WIDTH, round(map_bottom + 14 + strip_height))
    strip_height += symbol_height
    panel, panel_height = notes_panel(notes, words, MAP_WIDTH, round(map_bottom + 18 + strip_height))
    total_height = round(map_bottom + 18 + strip_height + panel_height + 18)

    dark_rooms = [symbol for symbol in area["symbols"] if symbol["kind"] == "dark-room"]
    mechanisms = [symbol for symbol in area["symbols"] if symbol["kind"] != "dark-room" and symbol.get("visible", True)]
    routes = sorted(area["routes"], key=lambda route: ROUTE_ROLES.index(route["role"]))
    exit_label = words[area["exit_kind"]]
    badges = "".join(badge(badge_number, *screen([x, y])) for badge_number, x, y in area["badges"])
    terminals = terminal("start", *screen(area["start"]), words["start"] + (" · " + area["start_label"] if "start_label" in area else ""), area.get("start_label_offset", (0, -46))) + terminal("exit", *screen(area["exit"]), exit_label, area.get("exit_label_offset", (0, -46)))
    terminals += "".join(terminal("start", *screen(start["at"]), words["start"] + " · " + start["label"], start.get("label_offset", (0, -46))) for start in area.get("starts", []))
    source_labels = "".join(text(label["text"][language], *label["at"], size=18, fill="#dff8ff", weight=500, anchor="start") for label in area.get("item_labels", []))
    desc = " ".join(note for _, note in notes)
    callout_parts = [callout_svg(callout, screen(callout["at"]), language) for callout in area.get("callouts", [])]
    callouts = "".join(leader for leader, _ in callout_parts) + "".join(box for _, box in callout_parts)
    desc += " " + " ".join(callout["text"][language] for callout in area.get("callouts", []))
    # Dense map mechanisms should fit beside the measured narrow passages.
    symbol_scale = scale / 0.72
    route_scale = scale / 0.55
    heading = text((title if title.startswith("EP2") else f"C{area["stage"]} · {title}"), 26, 30, size=16, fill="#a9d8ed", anchor="start")

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MAP_WIDTH} {total_height}" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
<title id="title">{html.escape(title)}</title>
<desc id="desc">{html.escape(desc)}</desc>
{defs(scale)}
<rect width="{MAP_WIDTH}" height="{total_height}" rx="18" fill="{PALETTE["background"]}"/>
{heading}
<g transform="translate({offset_x:g} {offset_y:g}) scale({scale:g})">
  <g filter="url(#shadow)">{geometry.floor_svg}</g>
  {geometry.outline_svg}
  {"".join(symbol_svg(symbol, scale) for symbol in dark_rooms)}
  {"".join(route_svg(route, route_scale) for route in routes)}
  {geometry.detail_svg}{source_labels}{"".join(symbol_svg(symbol, symbol_scale / symbol.get("size", 1)) for symbol in mechanisms)}
</g>
{badges}
{terminals}
{callouts}
{strip}
{symbol_strip}
{panel}
</svg>
'''
