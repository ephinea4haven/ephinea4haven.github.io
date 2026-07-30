#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "assets" / "js" / "mag-evolution.js"
OUT_DIR = ROOT / "assets" / "img" / "mag" / "wiki"
COLOR_OUT_DIR = ROOT / "assets" / "img" / "mag" / "colors"

# Upstream uses the historical spellings "fuschia" and "grey" for these two
# filenames. Keep them verbatim so every local asset can be traced directly to
# its Pioneer 2 Wiki source.
COLOR_FILES = (
    "Mag_red-0.png", "Mag_blue-0.png", "Mag_yellow-0.png",
    "Mag_green-0.png", "Mag_purple-0.png", "Mag_black-0.png",
    "Mag_white-0.png", "Mag_cyan-0.png", "Mag_brown-0.png",
    "Mag_orange-0.png", "Mag_slate_blue-0.png", "Mag_olive-0.png",
    "Mag_turquoise-0.png", "Mag_fuschia-0.png", "Mag_grey-0.png",
    "Mag_cream-0.png", "Mag_pink-0.png", "Mag_dark_green-0.png",
    "Mag_chartreuse-0.png", "Mag_azure-0.png", "Mag_royal_purple-0.png",
    "Mag_ruby-0.png", "Mag_sapphire-0.png", "Mag_emerald-0.png",
    "Mag_gold-0.png", "Mag_silver-0.png", "Mag_bronze-0.png",
    "Mag_plum-0.png", "Mag_violet-0.png", "Mag_goldenrod-0.png",
)


def chart_mag_names() -> list[str]:
    """Sprite names come from the generated chart data, which is the sole
    source of truth for which mags the charts draw."""
    src = DATA_PATH.read_text(encoding="utf-8")
    body = src[src.index("{"): src.rindex("}") + 1]
    classes = json.loads(body)["classes"]
    names: set[str] = set()

    def collect(value: object) -> None:
        if isinstance(value, dict):
            name = value.get("name")
            if isinstance(name, str):
                names.add(name)
            for child in value.values():
                collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)

    collect(classes)
    if not names:
        raise RuntimeError(f"no mag names found in {DATA_PATH}")
    names.add("Mag")
    return sorted(names)


def valid_png(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except (OSError, SyntaxError):
        return False


def download_file(filename: str, out_dir: Path, force: bool) -> None:
    out = out_dir / filename
    if not force and valid_png(out):
        print(f"kept {out.relative_to(ROOT)}")
        return
    url_name = quote(filename)
    url = f"https://wiki.pioneer2.net/index.php?title=Special:Redirect/file/{url_name}"
    subprocess.run(
        ["rtk", "curl", "-L", "--fail", "--silent", "--show-error", "-o", str(out), url],
        check=True,
    )
    print(f"wrote {out.relative_to(ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download Mag sprites and all 30 color-reference PNGs used by mag.html."
    )
    parser.add_argument("--force", action="store_true", help="download assets even when a valid local PNG exists")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    COLOR_OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in chart_mag_names():
        download_file(f"{name}.png", OUT_DIR, args.force)
    for filename in COLOR_FILES:
        download_file(filename, COLOR_OUT_DIR, args.force)


if __name__ == "__main__":
    main()
