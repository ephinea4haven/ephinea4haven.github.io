#!/usr/bin/env python3
"""Derive list images for TypeM weapons whose Ephinea Wiki file was never uploaded.

TypeM weapons reuse the base weapon's ItemKT texture with a colourless photon.
Every TypeM image on the Wiki is the first (green) colour variant with the
pixels that differ between the five colour variants replaced by their
luminance. This applies the same rule to the base texture, then doubles the
size with Lanczos resampling.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = "ItemKTep4.afs"
ARCHIVE_SHA256 = "6c203b495cf4a3e0d8b308ed1133f2eff7bcb504a2bb93a67bf86fba59d422a6"
OUT_DIR = ROOT / "assets" / "img" / "items" / "itemkt"
MANIFEST = ROOT / "content" / "item-catalog" / "itemkt-images.json"
# Item title -> first of the base weapon's five colour-variant entries.
ITEMS = {"TypeRI/Rifle": 146, "TypeSH/Shot": 138}
VARIANTS = 5
PHOTON_THRESHOLD = 24
VISIBLE = (0, 0, 160, 120)
SCALE = 2


def prs_decompress(src: bytes) -> bytes:
    out = bytearray()
    pos = bits = remaining = 0

    def bit() -> int:
        nonlocal pos, bits, remaining
        if remaining == 0:
            bits, remaining = src[pos], 8
            pos += 1
        value = bits & 1
        bits >>= 1
        remaining -= 1
        return value

    while True:
        if bit():
            out.append(src[pos])
            pos += 1
            continue
        if bit():
            word = src[pos] | src[pos + 1] << 8
            pos += 2
            if word == 0:
                return bytes(out)
            offset, size = (word >> 3) - 0x2000, word & 7
            if size:
                size += 2
            else:
                size = src[pos] + 1
                pos += 1
        else:
            size = (bit() << 1 | bit()) + 2
            offset = src[pos] - 0x100
            pos += 1
        for _ in range(size):
            out.append(out[offset])


def texture(archive: bytes, entry: int) -> Image.Image:
    offset, size = struct.unpack_from("<II", archive, 8 + 8 * entry)
    xvm = prs_decompress(archive[offset:offset + size])
    chunk = xvm.find(b"XVRT")
    _, _, data_format, _, width, height, data_size = struct.unpack_from("<IIIIHHI", xvm, chunk + 4)
    if data_format != 6:
        raise ValueError(f"entry {entry}: expected DXT1 texture, got format {data_format}")
    # Wrap the DXT1 payload in a minimal DDS header so Pillow can decode it.
    header = struct.pack(
        "<4sIIIIIII44sII4sIIIII5I", b"DDS ", 124, 0x1007, height, width, data_size, 0, 1,
        b"\0" * 44, 32, 4, b"DXT1", 0, 0, 0, 0, 0, 0x1000, 0, 0, 0, 0,
    )
    return Image.open(io.BytesIO(header + xvm[chunk + 0x40:chunk + 0x40 + data_size])).convert("RGB").crop(VISIBLE)


def colourless_photon(variants: list[Image.Image]) -> Image.Image:
    base = variants[0].copy()
    pixels = [variant.load() for variant in variants]
    out = base.load()
    for y in range(base.height):
        for x in range(base.width):
            colours = [p[x, y] for p in pixels]
            if max(max(c[i] for c in colours) - min(c[i] for c in colours) for i in range(3)) > PHOTON_THRESHOLD:
                r, g, b = colours[0]
                grey = round(0.299 * r + 0.587 * g + 0.114 * b)
                out[x, y] = (grey, grey, grey)
    return base


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--archive", type=Path, default=ROOT.parent / "PSOBB-Haven" / "data" / ARCHIVE)
    archive = parser.parse_args().archive.read_bytes()
    if hashlib.sha256(archive).hexdigest() != ARCHIVE_SHA256:
        raise SystemExit(f"{ARCHIVE} does not match SHA-256 {ARCHIVE_SHA256}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for title, first in ITEMS.items():
        entries = list(range(first, first + VARIANTS))
        image = colourless_photon([texture(archive, entry) for entry in entries])
        image = image.resize((image.width * SCALE, image.height * SCALE), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, "PNG", optimize=True)
        data = buffer.getvalue()
        sha1 = hashlib.sha1(data).hexdigest()
        path = OUT_DIR / f"{sha1[:16]}.png"
        path.write_bytes(data)
        manifest[title] = {
            "path": "/" + path.relative_to(ROOT).as_posix(), "sha1": sha1,
            "width": image.width, "height": image.height,
            "archive": ARCHIVE, "archiveSha256": ARCHIVE_SHA256, "entries": entries,
        }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Derived {len(manifest)} ItemKT images.")


if __name__ == "__main__":
    main()
