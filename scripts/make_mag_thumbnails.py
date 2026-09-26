#!/usr/bin/env python3
"""Make item-list thumbnails from the Mag evolution chart's original-model renders.

Each 900 x 900 transparent render is trimmed to the model and fitted into the
list's 4:3 image frame at twice its largest displayed size.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RENDERS = ROOT / "assets" / "img" / "mag" / "default"
OUT_DIR = ROOT / "assets" / "img" / "mag" / "thumbs"
SIZE = (256, 192)
MARGIN = 0.9


def thumbnail(render: Image.Image) -> Image.Image:
    model = render.crop(render.getchannel("A").getbbox())
    scale = min(SIZE[0] * MARGIN / model.width, SIZE[1] * MARGIN / model.height)
    model = model.resize((round(model.width * scale), round(model.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(model, ((SIZE[0] - model.width) // 2, (SIZE[1] - model.height) // 2))
    return canvas


def main() -> None:
    names = [model["name"] for model in json.loads((RENDERS / "manifest.json").read_text(encoding="utf-8"))["models"]]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("*.webp"):
        if stale.stem not in names:
            stale.unlink()
    for name in names:
        with Image.open(RENDERS / f"{name}.webp") as render:
            thumbnail(render.convert("RGBA")).save(OUT_DIR / f"{name}.webp", "WEBP", quality=85, method=6)
    print(f"Made {len(names)} Mag thumbnails.")


if __name__ == "__main__":
    main()
