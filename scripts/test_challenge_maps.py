"""Structural tests for the challenge-map data (docs/CHALLENGE_MAP_REDRAW.md §7).

These tests read only the JSON and the source image headers, so they run in CI
without the map generator's numpy/scipy/potrace toolchain. Floor-based checks
(anchors on the floor, coverage, route fidelity) run in the generator.
"""

from __future__ import annotations

import json
import struct
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EP1 = json.loads((ROOT / "content/challenge-maps/ep1.json").read_text(encoding="utf-8"))
C9 = json.loads((ROOT / "content/challenge-maps/ep1-c9-geometry.json").read_text(encoding="utf-8"))["areas"]
MEASURED = {area: geometry for path in (ROOT / "content/challenge-maps").glob("ep1-c*-geometry.json")
            for area, geometry in json.loads(path.read_text(encoding="utf-8"))["areas"].items()}
SOURCE = ROOT / "assets/img/challenge/ep1/original"

LANGUAGES = {"zh", "en", "ja"}
STRING_KEYS = {"area", "start", "next", "boss", "tips", "main", "split", "solo", "optional", "sources"}
ROUTE_ROLES = {"main", "split", "solo", "optional"}
SYMBOL_KINDS = {
    "switch", "timed-switch", "door", "warp", "box", "trap", "turret", "rocks",
    "heal", "target", "console", "press", "false-wall", "sequence", "dark-room",
    "mag-switch", "item-switch", "light-switch", "jar-trap", "avoid-target", "avoid-switch", "avoid-warp", "barrier-grid", "barrier-switch",
}
EXIT_KINDS = {"next", "boss"}
WARP_TOLERANCE = 12


def png_size(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    return struct.unpack(">II", header[16:24])


def inside(point: list[int], size: tuple[int, int]) -> bool:
    return 0 <= point[0] < size[0] and 0 <= point[1] < size[1]


def near(first: list[int], second: list[int]) -> bool:
    return ((first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2) ** 0.5 <= WARP_TOLERANCE


class ChallengeMapDataTest(unittest.TestCase):
    def test_strings_are_complete_and_keep_attribution(self) -> None:
        self.assertEqual(set(EP1["strings"]), LANGUAGES)
        for language, strings in EP1["strings"].items():
            self.assertEqual(set(strings), STRING_KEYS, language)
            self.assertIn("{n}", strings["area"])
            self.assertIn("PSO World", strings["sources"])
            self.assertIn("Sakura", strings["sources"])

    def test_areas_are_referenced_by_the_page(self) -> None:
        page = (ROOT / "guide/ep1ch.html").read_text(encoding="utf-8")
        # The page names the Chinese map; the build swaps in each language's redraw.
        for area_id in EP1["areas"]:
            self.assertIn(f"/assets/img/challenge/ep1/maps/zh/area_{int(area_id):02d}.svg", page)
            for language in LANGUAGES:
                self.assertTrue((ROOT / f"assets/img/challenge/ep1/maps/{language}/area_{int(area_id):02d}.svg").exists())

    def test_every_area_is_well_formed(self) -> None:
        for area_id, area in EP1["areas"].items():
            with self.subTest(area=area_id):
                size = png_size(SOURCE / area["source"])
                self.assertEqual(area["source"], f"area_{int(area_id):02d}.png")
                self.assertIn(area["exit_kind"], EXIT_KINDS)
                self.assertTrue(inside(area["start"], size))
                self.assertTrue(inside(area["exit"], size))
                self.assertIn("main", {route["role"] for route in area["routes"]})

                warps: dict[int, dict[bool, list[list[int]]]] = {}
                for symbol in area["symbols"]:
                    self.assertIn(symbol["kind"], SYMBOL_KINDS)
                    if symbol["kind"] == "dark-room":
                        self.assertGreaterEqual(len(symbol["points"]), 3)
                        for point in symbol["points"]:
                            self.assertTrue(inside(point, size))
                        continue
                    self.assertTrue(inside(symbol["at"], size), symbol)
                    if symbol["kind"] == "warp":
                        pair = warps.setdefault(symbol["n"], {False: [], True: []})
                        self.assertNotIn(symbol["at"], pair[symbol["prime"]], f"duplicate warp endpoint {symbol['n']}")
                        pair[symbol["prime"]].append(symbol["at"])
                    if symbol["kind"] == "sequence":
                        self.assertGreater(symbol["count"], 1)
                for number, pair in warps.items():
                    self.assertTrue(pair[False] and pair[True], f"warp {number} lacks a destination")

                for route in area["routes"]:
                    self.assertIn(route["role"], ROUTE_ROLES)
                    for leg in route["legs"]:
                        self.assertGreaterEqual(len(leg), 2)
                        for point in leg:
                            self.assertTrue(inside(point, size), point)
                    for before, after in zip(route["legs"], route["legs"][1:]):
                        self.assertTrue(
                            any(near(before[-1], origin) and near(after[0], destination)
                                for pair in warps.values() for prime in (False, True)
                                for origin in pair[prime] for destination in pair[not prime]),
                            f"{route['role']} legs {before[-1]} → {after[0]} do not meet a warp pair",
                        )

                numbers = sorted(badge[0] for badge in area["badges"])
                for badge in area["badges"]:
                    self.assertTrue(inside(badge[1:], size))
                self.assertEqual(set(area["notes"]), LANGUAGES)
                for language, notes in area["notes"].items():
                    self.assertEqual(numbers, list(range(1, len(notes["numbered"]) + 1)), language)
                    self.assertTrue(all(note.strip() for note in notes["general"] + notes["numbered"]))
                counts = {len(notes["numbered"]) for notes in area["notes"].values()}
                general = {len(notes["general"]) for notes in area["notes"].values()}
                self.assertEqual(len(counts), 1, "languages disagree on numbered notes")
                self.assertEqual(len(general), 1, "languages disagree on general notes")


def in_contours(point: tuple[int, int], contours: list) -> bool:
    """Even-odd containment, independent of the SVG renderer."""
    x, y = point
    inside = False
    for polygon in contours:
        for (ax, ay), (bx, by) in zip(polygon, polygon[1:] + polygon[:1]):
            if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
                inside = not inside
    return inside


def crossing(a: list[int], b: list[int], c: list[int], d: list[int]) -> bool:
    def side(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return side(a, b, c) * side(a, b, d) < 0 and side(c, d, a) * side(c, d, b) < 0


class MeasuredGeometryTest(unittest.TestCase):
    def test_local_instructions_are_sourced_and_visible_in_all_languages(self) -> None:
        # Source-caption inventory is independent of route coverage. A correct
        # route must not pass acceptance after dropping its operating advice.
        required = {
            "1": {"two-player-boxes", "blue-pad-red-switch", "wait-at-purple-door",
                  "skip-central-enemies", "skip-east-enemies", "pink-switch-return"},
            "2": {"turn-back-warp", "skip-forward-warp", "timed-switch-holder"},
            "4": {"timed-switch-return", "two-fixed-handguns", "shoot-above-door", "one-weapon-recover", "left-rock-healing"},
            "5": {"north-false-wall", "right-pad-supply-relay", "collector-green-pink"},
            "6": {"shoot-supply-switch", "four-weapons", "fixed-armor", "crescent-traps-rocks"},
            "7": {"first-room-false-wall", "high-rock-dark-room", "left-rock-switch", "four-shields-next-area"},
            "8": {"six-switch-coordination", "six-switch-layout", "green-releases-party", "four-shields-only", "trap-then-flames"},
            "9": {"clear-center-traps", "piston-coordination", "ignore-return-warp", "left-shooting-target", "nine-pad-order"},
            "10": {"hallway-traps", "open-warp-one", "green-pads-only", "false-wall-supplies", "right-rocks-only"},
            "11": {"hold-piston-pad", "six-pad-safe-pair", "cyan-door-duty", "four-hidden-targets", "light-path-hold-return", "follow-light-path", "simultaneous-exit-pads"},
            "12": {"skip-side-room"},
            "13": {"right-pads-only", "piston-relay-safety", "north-switch-first", "warp-team-bush-switch", "four-correct-switches", "corridor-traps", "last-cyan-switch"},
            "14": {"first-room-edge", "east-switch-return", "piston-split-holders", "left-switch-ignore-enemies", "right-console-release", "optional-healing-hold", "branch-warps-regroup", "hold-dark-room-light"},
            "15": {"left-warp-only", "switch-breaks-rocks", "false-wall-boxes"},
            "16": {"timed-gate-runner", "left-pad-only", "dark-room-no-light", "route-traps"},
            "17": {"relay-eight-layout", "relay-wait-before-moving", "find-dark-false-wall", "timer-cannot-catch-up", "hold-middle-piston"},
            "18": {"split-release-each-other", "rightmost-pad-only", "left-branch-switch", "right-route-left-turn", "meeting-cage-relay", "boss-door-early"},
            '20': {'turret-fence-relay', 'dark-room-light', 'optional-boxes', 'healing-turrets', 'final-room-right-edge'},
            '21': {'far-side-release', 'second-turrets-clear', 'first-turrets-run'},
            '22': {'dark-room-pink-only', 'corridor-traps', 'entrance-right-console', 'raised-platform-turrets'},
            '23': {'second-room-traps', 'turn-back-false-wall', 'entrance-left-warp'},
            '24': {'u-room-traps', 'light-and-run', 'last-turret-run', 'healing-overhead-target', 'safe-boxes'},
            '25': {'ignore-wall-target', 'light-room-enemies', 'force-side-boxes', 'rear-left-pad-only', 'first-and-corridor-traps'},
            '26': {'fixed-buster', 'trap-free-box-room'},
            '27': {'light-before-party-enters', 'safe-prewarp-boxes', 'garanz-scout-first', 'ignore-third-room-pad'},
            '28': {'one-runner-nine-barriers', 'warp-two-corrected', 'clear-warp-turrets', 'eight-pad-layout', 'center-switch-before-warp', 'optional-rooms-source-conflict'},
            '29': {'lower-route-hallway-traps', 'clear-before-light', 'timer-runner-return', 'timer-spawns-turret', 'front-left-pad-only', 'garanz-scout-and-traps'},
            '31': {'waterfall-boxes', 'warp-one-first-relay', 'switch-runner-ignore-enemies', 'ignore-final-warp', 'ignore-first-turrets', 'warp-three-two-player-door', 'optional-healing'},
            '32': {'timer-turret-cover', 'break-rock-open-inner-path', 'boxes-before-timer', 'avoid-console-use-inner'},
            '33': {'shrinking-two-player-pads', 'upper-hallway-traps', 'waterfall-trapped-boxes', 'left-warp-normal-route', 'optional-healing'},
            '34': {'high-waterfall-rocks', 'repeat-light-for-two-rooms', 'alternating-interact-switches', 'wrong-switches-traps'},
            '35': {'one-warp-runner', 'late-healing-optional', 'platform-switches-return-four', 'left-edge-foie-turrets', 'rock-hidden-light'},
            '36': {'skip-exit-turret-boxes', 'optional-warp-one-boxes', 'normal-route-light-left-three', 'hanging-jar-item-detour', 'turrets-after-three', 'four-spare-weapon-shortcut', 'hall-boxes-optional-warps', 'poison-jar-hidden-light'},
            '37': {'ignore-barrier-room', 'between-hanging-jars'},
            '38': {'timer-wait-until-ready', 'safe-boxes-during-setup', 'second-timer-turret-cover', 'dark-room-light-skip-turrets', 'relay-first-three-moves', 'relay-ready-and-timer', 'second-timer-split'},
            '39': {'rocks-spawn-turrets', 'last-room-side-switches', 'crossed-rocks-untouched', 'hidden-pair-maze-switches'},
            '40': {'four-door-duties', 'south-warp-one-then-three', 'north-three-pad-return', 'eight-weapons-mandatory', 'skip-warp-mag-heal', 'south-rock-switch-two', 'timer-stops-before-last-door', 'north-held-light', 'safe-optional-boxes'},
            "41": {"shooting-traps", "mag-light", "safe-boxes"},
            "42": {"timed-switch-traps", "cage-box-traps", "left-switch-only"},
            "43": {"shooting-traps", "fourth-switch-retreat", "rock-hidden-light", "mag-pad-trap",
                   "first-room-light", "shoot-light-switch", "fixed-armor-boxes", "exit-box-traps"},
            "44": {"hold-central-pad", "west-shooting-traps", "east-two-hunters", "right-switch-only",
                   "skip-platform-boxes", "ceiling-traps"},
            "45": {"two-switch-traps", "equipment-shortcut", "do-not-shoot-wall", "do-not-shoot-overhead",
                   "near-switch-only", "safe-north-boxes", "safe-south-boxes", "optional-force-heal",
                   "upper-light", "lower-light", "break-rocks"},
        }
        ns = {"s": "http://www.w3.org/2000/svg"}
        for area_id, expected in required.items():
            callouts = EP1["areas"][area_id]["callouts"]
            self.assertEqual({c["id"] for c in callouts}, expected)
            self.assertEqual(len(callouts), len(expected), "duplicate caption ID")
            for callout in callouts:
                self.assertTrue(callout["source"].strip())
                self.assertTrue(inside(callout["at"], MEASURED[area_id]["size"]))
                x, y, width = callout["box"]
                self.assertTrue(0 <= x < x + width <= 1000 and y >= 0)
                self.assertIn(callout["tone"], {"action", "supply", "warning"})
                self.assertEqual(set(callout["text"]), LANGUAGES)
            for language in LANGUAGES:
                root = ET.parse(ROOT / f"assets/img/challenge/ep1/maps/{language}/area_{int(area_id):02d}.svg").getroot()
                groups = {g.get("data-callout"): g for g in root.findall('.//s:g[@data-callout]', ns)}
                self.assertEqual(set(groups), expected)
                for callout in callouts:
                    group = groups[callout["id"]]
                    visible = "".join(t.text or "" for t in group.findall("s:text", ns))
                    self.assertTrue(visible.strip())
                    self.assertEqual("".join(visible.split()), "".join(callout["text"][language].split()))
                    self.assertEqual(group.find("s:title", ns).text, callout["source"])

    def test_source_operating_details_are_not_generic_symbols(self) -> None:
        for area, count in {"42": 2, "44": 1, "45": 1}.items():
            self.assertEqual(sum(s["kind"] == "jar-trap" for s in EP1["areas"][area]["symbols"]), count)
        steps = {tuple(s["at"]): s["step"] for s in EP1["areas"]["43"]["symbols"] if "step" in s}
        self.assertEqual(steps, {(318, 440): 1, (299, 459): 2, (245, 406): 3, (264, 388): 4})
        pads = [s for s in EP1["areas"]["45"]["symbols"] if s["kind"] == "item-switch"]
        self.assertEqual(len(pads), 4)
        self.assertTrue(all(s["count"] == 4 for s in pads))
        for item in ("weapon", "shield"):
            self.assertEqual(sum(s["count"] for s in pads if s["item"] == item), 8)
        self.assertEqual(sum(s["kind"] == "avoid-target" for s in EP1["areas"]["45"]["symbols"]), 3)
        for area, positions in {"42": {(454, 482), (486, 571)}, "44": {(279, 564)}, "45": {(1271, 131)}}.items():
            self.assertEqual({tuple(s["at"]) for s in EP1["areas"][area]["symbols"]
                              if s["kind"] == "avoid-switch"}, positions)

    def test_all_ep1_stages_have_measured_geometry(self) -> None:
        expected = {str(n) for n in range(1, 46) if n not in {3, 19, 30}}
        self.assertEqual(set(EP1["areas"]), expected)
        self.assertEqual(set(MEASURED), expected)
        self.assertEqual({area["stage"] for area in EP1["areas"].values()}, set(range(1, 10)))

    def test_late_stage_puzzles_keep_their_distinct_requirements(self) -> None:
        # C8's optional four-weapon shortcut must not be confused with its
        # mandatory final eight-weapon gate.
        for area, expected in [("36", [1, 1, 1, 1]), ("40", [4, 4])]:
            pads = [s for s in EP1["areas"][area]["symbols"]
                    if s["kind"] == "item-switch" and "count" in s]
            self.assertEqual([s["count"] for s in pads], expected)
            self.assertTrue(all(s["item"] == "weapon" for s in pads))
        blue_gates = {tuple(s["at"]) for s in EP1["areas"]["31"]["symbols"]
                      if s["kind"] == "door" and s["color"] == "#43c8df"}
        self.assertEqual(blue_gates, {(370, 601), (400, 601)})
        interactions = [s for s in EP1["areas"]["34"]["symbols"] if "step" in s]
        self.assertEqual([s["step"] for s in interactions], [1, 2, 3, 4])
        self.assertTrue(all(s["kind"] == "barrier-switch" for s in interactions))
        maze = EP1["areas"]["28"]
        self.assertEqual([s["at"] for s in maze["symbols"] if s["kind"] == "warp" and s["n"] == 2 and s["prime"]], [[591, 369]])
        self.assertEqual({s["step"] for s in maze["symbols"] if "step" in s}, set(range(1, 9)))
        relay = EP1["areas"]["38"]["symbols"]
        self.assertEqual({s["step"] for s in relay if "step" in s}, {1, 2, 3, 4})
        self.assertEqual(sum(s["kind"] == "timed-switch" for s in relay), 2)
        self.assertEqual(sum(s["kind"] == "barrier-switch" for s in EP1["areas"]["39"]["symbols"]), 2)

    def test_warp_annotation_tips_do_not_become_floor(self) -> None:
        for area, points in {"36": [(484, 7), (494, 333)], "37": [(384, 94), (346, 388)],
                             "40": [(680, 238), (679, 745), (263, 688)]}.items():
            for point in points:
                self.assertFalse(in_contours(point, MEASURED[area]["floor"]), (area, point))

    def test_c2_equipment_and_puzzle_requirements(self) -> None:
        for area, kind, count in [("4", "weapon", 1), ("6", "weapon", 4), ("8", "shield", 4)]:
            pads = [s for s in EP1["areas"][area]["symbols"] if s["kind"] == "item-switch"]
            self.assertEqual([(s["item"], s["count"]) for s in pads], [(kind, count)])
        steps = {s["step"]: tuple(s["at"]) for s in EP1["areas"]["8"]["symbols"] if "step" in s}
        self.assertEqual(steps, {1: (171, 329), 2: (176, 321), 3: (160, 313),
                                 4: (162, 329), 5: (168, 313), 6: (156, 321)})
        # The southern timer was previously mislabeled as a healing ring.
        self.assertEqual([s["at"] for s in EP1["areas"]["4"]["symbols"] if s["kind"] == "heal"], [[848, 652]])
        self.assertEqual([s["at"] for s in EP1["areas"]["4"]["symbols"] if s["kind"] == "timed-switch"], [[150, 502]])

    def test_c3_puzzles_preserve_safe_transit_and_unsafe_choices(self) -> None:
        grids = {area: next(c["grid"] for c in EP1["areas"][area]["callouts"] if "grid" in c)
                 for area in ("8", "9", "11")}
        self.assertEqual(grids["8"], [["3", "5"], ["6", "2"], ["4", "1"]])
        self.assertEqual(grids["9"], [["×", "×", "3"], ["4", "2", "•"], ["1", "×", "×"]])
        self.assertEqual(grids["11"], [["×", "×"], ["×", "✓"], ["✓", "×"]])
        for area, expected in [("9", 3), ("11", 4), ("13", 4)]:
            kind = "avoid-target" if area == "9" else "avoid-switch"
            self.assertEqual(sum(s["kind"] == kind for s in EP1["areas"][area]["symbols"]), expected)
        # Both greens are valid in Sakura's Area 10 diagram.
        greens = {tuple(s["at"]) for s in EP1["areas"]["10"]["symbols"]
                  if s["kind"] == "switch" and s["color"] == "#8ee26b"}
        self.assertEqual(greens, {(149, 319), (175, 342)})
        for area, grid in grids.items():
            for language in LANGUAGES:
                root = ET.parse(ROOT / f"assets/img/challenge/ep1/maps/{language}/area_{int(area):02d}.svg").getroot()
                ns = {"s": "http://www.w3.org/2000/svg"}
                group = root.find('.//s:g[@data-switch-grid]', ns)
                self.assertEqual([t.text for t in group.findall('s:text', ns)], [v for row in grid for v in row])

    def test_c4_relays_and_shared_return_warp(self) -> None:
        for area, count in {"14": 7, "15": 2, "16": 2, "17": 2, "18": 0}.items():
            self.assertEqual(sum(s["kind"] == "warp" for s in EP1["areas"][area]["symbols"]), count)
        shared = [s for s in EP1["areas"]["14"]["symbols"] if s["kind"] == "warp" and s["n"] == 3]
        self.assertEqual(sum(not s["prime"] for s in shared), 2)
        self.assertEqual([s["at"] for s in shared if s["prime"]], [[328, 800]])
        relay = EP1["areas"]["17"]
        self.assertEqual({s["step"] for s in relay["symbols"] if "step" in s}, set(range(1, 9)))
        main = relay["routes"][0]["legs"][0]
        solo = relay["routes"][1]["legs"][0]
        for point in ([444, 154], [444, 124], [416, 103]):
            self.assertIn(point, main)
        for point in ([491, 174], [472, 154], [471, 124], [499, 102]):
            self.assertIn(point, solo)
        self.assertNotIn([472, 154], main)
        exclusions = EP1["areas"]["16"]["source_route_exclusions"]
        self.assertEqual([e["points"] for e in exclusions], [[[69, 94], [112, 94]]])
        self.assertTrue(exclusions[0]["reason"])
        # This diagram connector must not be published as a walking leg.
        self.assertFalse(any([69, 94] in leg and [112, 94] in leg
                             for r in EP1["areas"]["16"]["routes"] for leg in r["legs"]))

    def test_area_42_cage_is_not_drawn_as_a_walkable_shortcut(self) -> None:
        # Both source walkthroughs describe teleporting into the optional cage;
        # the unnumbered warp endpoints are not mapped in either source scan.
        # Do not replace missing endpoint evidence with a line through its wall.
        for route in EP1["areas"]["42"]["routes"]:
            for leg in route["legs"]:
                self.assertFalse(any(290 <= x <= 330 and 100 <= y <= 145 for x, y in leg))

    def test_c9_warp_inventory_and_symbol_legends(self) -> None:
        # Numbered warp pairs in the five PSO World scans / Sakura diagrams.
        for area, count in {"1": 1, "2": 4, "4": 1, "5": 1, "6": 0, "7": 1, "8": 0, "9": 1, "10": 2, "11": 3, "12": 0, "13": 2, "41": 3, "42": 4, "43": 3, "44": 4, "45": 1}.items():
            symbols = EP1["areas"][area]["symbols"]
            self.assertEqual(sum(s["kind"] == "warp" for s in symbols), count * 2)
            self.assertFalse(any(s["kind"] == "sequence" for s in symbols))
            for language in LANGUAGES:
                labels = EP1["symbol_labels"][language]
                for symbol in symbols:
                    key = symbol["kind"]
                    if key == "item-switch":
                        self.assertIn(symbol["item"], {"weapon", "shield"})
                        key += ":" + symbol["item"]
                    self.assertTrue(labels[key].strip())

    def test_entire_measured_route_segments_stay_on_measured_floor(self) -> None:
        # Testing vertices alone misses diagonals through walls and the gap
        # between the two halves of Area 43's H-shaped room.
        def distance_squared(point, a, b):
            dx, dy = b[0] - a[0], b[1] - a[1]
            t = max(0, min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)))
            return (point[0] - a[0] - t * dx) ** 2 + (point[1] - a[1] - t * dy) ** 2

        for area, geometry in MEASURED.items():
            contours = geometry["floor"]
            edges = [edge for polygon in contours for edge in zip(polygon, polygon[1:] + polygon[:1])]
            for route in EP1["areas"][area]["routes"]:
                for leg in route["legs"]:
                    for a, b in zip(leg, leg[1:]):
                        steps = max(abs(a[0] - b[0]), abs(a[1] - b[1]), 1)
                        for step in range(steps + 1):
                            point = [a[i] + (b[i] - a[i]) * step / steps for i in (0, 1)]
                            if not in_contours(point, contours):
                                self.assertLessEqual(min(distance_squared(point, c, d) for c, d in edges), 4,
                                                     (area, route["role"], a, b, point))

    def test_contours_match_source_dimensions_and_do_not_cross(self) -> None:
        self.assertEqual(set(C9), {"41", "42", "43", "44", "45"})
        for area, geometry in MEASURED.items():
            with self.subTest(area=area):
                size = png_size(SOURCE / f"area_{int(area):02d}.png")
                self.assertEqual(geometry["size"], list(size))
                for key in ("floor", "interior_walls", "dark_rooms"):
                    for contour in geometry[key]:
                        self.assertGreaterEqual(len(contour), 3)
                        for point in contour:
                            self.assertTrue(inside(point, size), point)
                        edges = list(zip(contour, contour[1:] + contour[:1]))
                        for i, (a, b) in enumerate(edges):
                            self.assertNotEqual(a, b)
                            for c, d in edges[i + 2:]:
                                self.assertFalse(crossing(a, b, c, d), (area, key, a, b, c, d))
                contours = geometry["floor"]
                for i, first in enumerate(contours):
                    for second in contours[i + 1:]:
                        for a, b in zip(first, first[1:] + first[:1]):
                            for c, d in zip(second, second[1:] + second[:1]):
                                self.assertFalse(crossing(a, b, c, d), (area, a, b, c, d))

    def test_source_landmarks_keep_narrow_corridors_and_side_rooms(self) -> None:
        # Coordinates checked against the original scans, especially locations
        # lost by the old threshold/flood-fill reconstruction.
        landmarks = {
            "1": [(73, 38), (157, 565), (136, 241), (472, 405)],
            "2": [(46, 45), (580, 550), (663, 686), (605, 313)],
            "41": [(188, 48), (159, 170), (210, 432), (331, 484), (330, 580),
                   (157, 500), (335, 850), (337, 995), (450, 1100), (92, 485), (365, 365)],
            "42": [(70, 45), (280, 92), (342, 180), (470, 450), (470, 596),
                   (420, 500), (517, 173), (570, 406)],
            "43": [(699, 128), (775, 166), (434, 240), (308, 362), (256, 500),
                   (317, 448), (414, 500), (400, 570), (607, 580), (592, 620), (506, 700), (935, 486)],
            "44": [(263, 285), (265, 460), (262, 590), (551, 137), (432, 170),
                   (460, 155), (105, 370), (480, 370)],
            "45": [(656, 300), (929, 275), (775, 393), (1099, 400), (877, 554),
                   (976, 650), (1030, 703), (1139, 800), (1200, 175), (850, 33)],
        }
        for area, points in landmarks.items():
            for point in points:
                with self.subTest(area=area, point=point):
                    self.assertTrue(in_contours(point, MEASURED[area]["floor"]))

    def test_text_symbols_and_pillars_do_not_become_floor(self) -> None:
        exterior = {
            "1": [(505, 405), (470, 141), (300, 617)],
            "2": [(592, 609), (340, 450), (620, 600)],
            "41": [(171, 1159), (375, 477), (247, 268)],
            "42": [(300, 639), (353, 124), (200, 300)],
            "43": [(701, 878), (185, 461), (1061, 167)],
            "44": [(400, 608), (340, 260)],
            "45": [(650, 806), (1126, 562), (260, 244)],
        }
        for area, points in exterior.items():
            for point in points:
                with self.subTest(area=area, point=point):
                    self.assertFalse(in_contours(point, MEASURED[area]["floor"]))

    def test_dark_rooms_include_the_connecting_strip(self) -> None:
        for area, point in [("41", (365, 365)), ("43", (255, 580)),
                            ("43", (400, 570)), ("43", (500, 780)),
                            ("45", (980, 600)), ("45", (980, 710)), ("45", (1140, 720))]:
            with self.subTest(area=area, point=point):
                self.assertTrue(in_contours(point, C9[area]["dark_rooms"]))
                self.assertTrue(in_contours(point, MEASURED[area]["floor"]))
        self.assertFalse(C9["42"]["dark_rooms"])
        self.assertFalse(C9["44"]["dark_rooms"])

    def test_all_languages_use_identical_measured_geometry(self) -> None:
        ns = {"s": "http://www.w3.org/2000/svg"}
        for area, geometry in MEASURED.items():
            expected = " ".join("M" + "L".join(f"{x} {y}" for x, y in p) + "Z" for p in geometry["floor"])
            for language in LANGUAGES:
                path = ROOT / f"assets/img/challenge/ep1/maps/{language}/area_{int(area):02d}.svg"
                root = ET.parse(path).getroot()
                with self.subTest(area=area, language=language):
                    self.assertFalse(root.findall(".//s:image", ns), "Measured maps must remain vector geometry")
                    stage = EP1["areas"][area]["stage"]
                    floor = root.find(f'.//s:g[@id="c{stage}-floor"]/s:path', ns)
                    self.assertIsNotNone(floor)
                    self.assertEqual(floor.get("d"), expected)
                    walls = root.find(f'.//s:g[@id="c{stage}-walls"]/s:path', ns)
                    self.assertEqual(walls.get("d"), expected)


EP2 = json.loads((ROOT / 'content/challenge-maps/ep2.json').read_text())
EP2_GEOMETRY = {area: geometry for path in (ROOT / 'content/challenge-maps').glob('ep2-c*-geometry.json')
                for area, geometry in json.loads(path.read_text())['areas'].items()}


class EpisodeTwoAlignmentTest(unittest.TestCase):
    def test_all_stages_have_localized_instructions_and_explicit_warps(self):
        expected = {1,2,3,4,5,6,8,9,10,11,12,13,15,16,17,18,19,21,22,23,24,25,26,28,29}
        self.assertEqual({int(n) for n in EP2['areas']}, expected)
        self.assertEqual(set(EP2_GEOMETRY), set(EP2['areas']))
        for n, area in EP2['areas'].items():
            with self.subTest(area=n):
                self.assertEqual(tuple(EP2_GEOMETRY[n]['size']), png_size(ROOT / 'assets/img/challenge/ep2/original/wiki' / area['source']))
                self.assertTrue(any(r['role']=='main' for r in area['routes']))
                self.assertGreaterEqual(len(area['callouts']), 2)
                self.assertEqual(len({c['id'] for c in area['callouts']}), len(area['callouts']))
                for callout in area['callouts']:
                    self.assertEqual(set(callout['text']), LANGUAGES)
                    self.assertTrue(all(callout['text'].values()))
                    self.assertIn('Ephinea Wiki', callout['source'])
                warps={}
                for symbol in area['symbols']:
                    if symbol['kind']=='warp':
                        warps.setdefault(symbol['n'], {False:[],True:[]})[symbol['prime']].append(symbol['at'])
                for pair in warps.values():
                    self.assertTrue(pair[False] and pair[True])
                for route in area['routes']:
                    for leg in route['legs']:
                        self.assertGreaterEqual(len(leg), 2)
                    for before, after in zip(route['legs'], route['legs'][1:]):
                        self.assertTrue(any(near(before[-1], p) and near(after[0], q)
                                            for pair in warps.values() for prime in (False,True)
                                            for p in pair[prime] for q in pair[not prime]), (n,before[-1],after[0]))

    def test_every_language_keeps_vector_geometry_and_real_instructions(self):
        ns={'s':'http://www.w3.org/2000/svg'}
        for n, area in EP2['areas'].items():
            paths=[]
            for language in LANGUAGES:
                file=ROOT / f"assets/img/challenge/ep2/maps/{language}/c{area['stage']}_area_{int(n):02d}.svg"
                root=ET.fromstring(file.read_text())
                self.assertFalse(root.findall('.//s:image',ns), str(file))
                floor=root.find(f'.//s:g[@id="ep2-{n}-floor"]/s:path',ns)
                self.assertIsNotNone(floor,str(file));paths.append(floor.get('d'))
                text=''.join(root.itertext())
                for c in area['callouts']:
                    self.assertIn(c['text'][language],text,(n,language,c['id']))
                for label in area['item_labels']:
                    self.assertIn(label['text'][language],text,(n,language,label['item']))
            self.assertEqual(len(set(paths)),1,n)

    def test_operating_rules_and_source_conflicts_are_kept(self):
        required={
            '1':['trap-order','bridge-relay'], '3':['relay-right-left-right','avoid-return-warp'],
            '4':['four-branches','lily-slalom','belra-wall'], '6':['double-stomper','third-barrier'],
            '8':['correct-target','keep-lights'], '10':['north-timer','south-timer','hold-light','return-garanz'],
            '11':['parallel-warp-chain','poison-off'], '12':['hold-poison-pad','wait-six-dubchics'],
            '13':['correct-warp-chain','heal-decoy'], '15':['four-switch-objective'],
            '17':['resta-and-regroup','four-slot-frames'], '18':['gibbles-gate'],
            '19':['fixed-boss-supplies','auto-warp-menu'], '21':['p1-solo','p4-wait'],
            '22':['second-bridge-box','doll-hidden-wall'], '23':['west-wall-stack','one-player-gate-relay'],
            '24':['west-poison-duty'], '25':['hidden-heal-switch'],
            '26':['auto-warp-lanes','room-seven-switch','fixed-cache','final-auto-warp'],
            '28':['floor-four-warp','floor-nine-gills'], '29':['floor-seven-fixed-units','epsilon-finish'],
        }
        for n, ids in required.items():
            self.assertLessEqual(set(ids),{c['id'] for c in EP2['areas'][n]['callouts']},n)
        west=EP2['areas']['29']
        self.assertEqual(west['exit_kind'],'finish')
        self.assertIn('Ogre/Power',{label['item'] for label in west['item_labels']})
        self.assertNotIn('General/Power',{label['item'] for label in west['item_labels']})
        self.assertEqual(len(EP2['areas']['21']['starts']),3)
        self.assertIn('100',next(c for c in EP2['areas']['6']['callouts'] if c['id']=='double-stomper')['text']['en'])

    def test_narrow_structure_survives_annotation_repair(self):
        floor=EP2_GEOMETRY['1']['floor']
        for p in [(537,207),(599,207),(537,282),(599,282)]:
            self.assertFalse(in_contours(p,floor),p)
        for p in [(568,151),(753,702),(753,901),(165,225)]:
            self.assertTrue(in_contours(p,floor),p)
        self.assertTrue(EP2_GEOMETRY['15']['dark_rooms'])
        self.assertTrue(EP2_GEOMETRY['12']['poison_rooms'])
        self.assertFalse(in_contours((288,510),EP2_GEOMETRY['28']['floor']), '4F warp gap must stay open')

    def test_route_segments_do_not_cross_walls(self):
        for n, area in EP2['areas'].items():
            contours=EP2_GEOMETRY[n]['floor']
            edges=[edge for polygon in contours for edge in zip(polygon,polygon[1:]+polygon[:1]) if edge[0]!=edge[1]]
            def edge_distance(p,a,b):
                dx,dy=b[0]-a[0],b[1]-a[1]
                t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
                return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
            for route in area['routes']:
                for leg in route['legs']:
                    for a,b in zip(leg,leg[1:]):
                        steps=max(abs(a[0]-b[0]),abs(a[1]-b[1]),1)
                        for i in range(0,steps+1,2):
                            point=[a[k]+(b[k]-a[k])*i/steps for k in (0,1)]
                            if not in_contours(point,contours):
                                self.assertLessEqual(min(edge_distance(point,c,d) for c,d in edges),4,(n,point))


if __name__ == "__main__":
    unittest.main()
