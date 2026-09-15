"""Structural tests for the challenge-map data (docs/CHALLENGE_MAP_REDRAW.md §7).

These tests read only the JSON and the source image headers, so they run in CI
without the map generator's numpy/scipy/potrace toolchain. Floor-based checks
(anchors on the floor, coverage, route fidelity) run in the generator.
"""

from __future__ import annotations

import json
import struct
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EP1 = json.loads((ROOT / "content/challenge-maps/ep1.json").read_text(encoding="utf-8"))
SOURCE = ROOT / "assets/img/challenge/ep1/original"

LANGUAGES = {"zh", "en", "ja"}
STRING_KEYS = {"area", "start", "next", "boss", "tips", "main", "split", "solo", "optional", "sources"}
ROUTE_ROLES = {"main", "split", "solo", "optional"}
SYMBOL_KINDS = {
    "switch", "timed-switch", "door", "warp", "box", "trap", "turret", "rocks",
    "heal", "target", "console", "press", "false-wall", "sequence", "dark-room",
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
        for area_id in EP1["areas"]:
            for language in LANGUAGES:
                self.assertIn(f"/assets/img/challenge/ep1/maps/{language}/area_{int(area_id):02d}.svg", page)

    def test_every_area_is_well_formed(self) -> None:
        for area_id, area in EP1["areas"].items():
            with self.subTest(area=area_id):
                size = png_size(SOURCE / area["source"])
                self.assertEqual(area["source"], f"area_{int(area_id):02d}.png")
                self.assertIn(area["exit_kind"], EXIT_KINDS)
                self.assertTrue(inside(area["start"], size))
                self.assertTrue(inside(area["exit"], size))
                self.assertIn("main", {route["role"] for route in area["routes"]})

                warps: dict[int, dict[bool, list[int]]] = {}
                for symbol in area["symbols"]:
                    self.assertIn(symbol["kind"], SYMBOL_KINDS)
                    if symbol["kind"] == "dark-room":
                        self.assertGreaterEqual(len(symbol["points"]), 3)
                        for point in symbol["points"]:
                            self.assertTrue(inside(point, size))
                        continue
                    self.assertTrue(inside(symbol["at"], size), symbol)
                    if symbol["kind"] == "warp":
                        pair = warps.setdefault(symbol["n"], {})
                        self.assertNotIn(symbol["prime"], pair, f"duplicate warp {symbol['n']}")
                        pair[symbol["prime"]] = symbol["at"]
                    if symbol["kind"] == "sequence":
                        self.assertGreater(symbol["count"], 1)
                for number, pair in warps.items():
                    self.assertEqual(set(pair), {False, True}, f"warp {number} is not paired")

                for route in area["routes"]:
                    self.assertIn(route["role"], ROUTE_ROLES)
                    for leg in route["legs"]:
                        self.assertGreaterEqual(len(leg), 2)
                        for point in leg:
                            self.assertTrue(inside(point, size), point)
                    for before, after in zip(route["legs"], route["legs"][1:]):
                        self.assertTrue(
                            any(near(before[-1], pair[False]) and near(after[0], pair[True]) for pair in warps.values()),
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


if __name__ == "__main__":
    unittest.main()
