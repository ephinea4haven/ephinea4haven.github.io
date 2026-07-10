#!/usr/bin/env python3
"""Downscale the Section ID icons for use as inline chips.

The originals are 512x512 (~20KB each); the mag chart draws them at 18px, and
ten of them per chart would ship 200KB to render 180px of pixels.

Usage:  python3 scripts/make_section_icons.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "img" / "section"
OUT = SRC / "sm"
SIZE = 40

SECTION_IDS = [
    "Viridia", "Greenill", "Skyly", "Bluefull", "Purplenum",
    "Pinkal", "Redria", "Oran", "Yellowboze", "Whitill",
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name in SECTION_IDS:
        src = SRC / f"{name}.png"
        if not src.exists():
            raise SystemExit(f"missing {src}")
        img = Image.open(src).convert("RGBA")
        img.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
        dst = OUT / f"{name}.png"
        img.save(dst, optimize=True)
        size = dst.stat().st_size
        total += size
        print(f"{dst.relative_to(ROOT)}  {img.width}x{img.height}  {size}B")
    print(f"total {total // 1024}KB (was {sum((SRC / f'{n}.png').stat().st_size for n in SECTION_IDS) // 1024}KB)")


if __name__ == "__main__":
    main()
