"""Ensure additive model details remain visible after PNG alpha compositing."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
jobs = json.loads((HERE / "jobs.json").read_text())["jobs"]
for job in jobs:
    if job["visual_qa"] != "passed":
        continue
    image = Image.open((HERE / job["output"]).resolve()).convert("RGBA")
    hidden_color = sum(
        alpha == 0 and max(red, green, blue) > 20
        for red, green, blue, alpha in image.getdata()
    )
    assert hidden_color == 0, (job["item"], hidden_color)
    if job["item"] == "HONEYCOMB REFLECTOR":
        visible_cells = sum(
            alpha > 100 and green > red + 40 and green > blue + 20
            for red, green, blue, alpha in image.getdata()
        )
        assert visible_cells > 25_000, visible_cells
print("Passed model PNGs have no invisible additive color; Honeycomb cells remain visible")
