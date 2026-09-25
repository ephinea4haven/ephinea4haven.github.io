#!/usr/bin/env python3
"""Turn the Character HD class banners into web-ready assets.

The supplied banners are 4352x544 RGB PNGs (~2.5MB each). The coloured class
panel sits inside a light grey mat and silver bevel that reads as a white
border on the page. The panel's dark rim is found separately in each image,
because the mat width differs by a few pixels between classes, and the banner
is cropped to it in two variants:

- `framed/`: the outside of the rim, keeping the dark rim and bevel highlight.
- `borderless/`: just inside the bevel, so the coloured panel runs to the edge.

The rounded corners become transparent and every class in a variant is
resized to the same size so they can be swapped in place.

Output goes to `class-banner/` beside the full-body class art in `class/`.

Usage:  python3 scripts/make_class_banners.py ~/Downloads/"Character HD.zip"
"""
from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "img" / "class-banner"
WIDTH = 1600
QUALITY = 86
# Variant: (inset from the rim's outer edge, corner radius), in 4352px source
# pixels. 14px clears the rim and bevel on every class.
VARIANTS = {
    "framed": (0, 18),
    "borderless": (14, 22),
}
# Luminance below this is the panel's dark rim; the mat is ~210-230.
RIM = 150

CLASSES = [
    "HUmar", "HUnewearl", "HUcast", "HUcaseal",
    "RAmar", "RAmarl", "RAcast", "RAcaseal",
    "FOmar", "FOmarl", "FOnewm", "FOnewearl",
]


def rim_box(img: Image.Image) -> tuple[int, int, int, int]:
    """Outer edge of the dark rim, as the median over many scanlines so
    artwork touching the rim on one line does not move the crop."""
    lum = np.asarray(img.convert("L")).astype(int)
    h, w = lum.shape
    xs = np.linspace(w * 0.05, w * 0.95, 40).astype(int)
    ys = np.linspace(h * 0.2, h * 0.8, 20).astype(int)

    def first(lines: np.ndarray) -> int:
        hits = [np.flatnonzero(line < RIM) for line in lines]
        return int(np.median([found[0] for found in hits if len(found)]))

    top = first(lum[: h // 3, xs].T)
    bottom = h - first(lum[::-1][: h // 3, xs].T)
    left = first(lum[ys, : w // 10])
    right = w - first(lum[ys, ::-1][:, : w // 10])
    return left, top, right, bottom


def rounded_mask(size: tuple[int, int], radius: float) -> Image.Image:
    scale = 4
    big = Image.new("L", (size[0] * scale, size[1] * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, big.width - 1, big.height - 1), radius * scale, fill=255)
    return big.resize(size, Image.Resampling.LANCZOS)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    with zipfile.ZipFile(sys.argv[1]) as archive:
        sources = {name: Image.open(io.BytesIO(archive.read(f"{name}.png"))).convert("RGB")
                   for name in CLASSES}

    rims = {name: rim_box(img) for name, img in sources.items()}
    for variant, (inset, source_radius) in VARIANTS.items():
        boxes = {name: (l + inset, t + inset, r - inset, b - inset)
                 for name, (l, t, r, b) in rims.items()}
        ratios = [(r - l) / (b - t) for l, t, r, b in boxes.values()]
        height = round(WIDTH / float(np.median(ratios)))
        radius = source_radius * WIDTH / float(np.median([r - l for l, _, r, _ in boxes.values()]))
        mask = rounded_mask((WIDTH, height), radius)

        out = OUT / variant
        out.mkdir(parents=True, exist_ok=True)
        total = 0
        for name, img in sources.items():
            banner = img.crop(boxes[name]).resize((WIDTH, height), Image.Resampling.LANCZOS)
            banner.putalpha(mask)
            dst = out / f"{name}.webp"
            banner.save(dst, quality=QUALITY, method=6)
            size = dst.stat().st_size
            total += size
            print(f"{dst.relative_to(ROOT)}  crop {boxes[name]}  {WIDTH}x{height}  {size // 1024}KB")
        print(f"{variant} total {total // 1024}KB")


if __name__ == "__main__":
    main()
