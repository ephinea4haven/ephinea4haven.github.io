#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "assets" / "js" / "mag-evolution.js"
OUT_DIR = ROOT / "assets" / "img" / "mag" / "wiki"


def chart_mag_names() -> list[str]:
    """Sprite names come from the generated chart data, which is the sole
    source of truth for which mags the charts draw."""
    src = DATA_PATH.read_text(encoding="utf-8")
    names = set(re.findall(r'"name":\s*"([A-Za-z&; ]+)"', src))
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Mag PNG assets used by the evolution charts.")
    parser.add_argument("--force", action="store_true", help="download assets even when a valid local PNG exists")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in chart_mag_names():
        url_name = quote(f"{name}.png")
        url = f"https://wiki.pioneer2.net/index.php?title=Special:Redirect/file/{url_name}"
        out = OUT_DIR / f"{name}.png"
        if not args.force and valid_png(out):
            print(f"kept {out.relative_to(ROOT)}")
            continue
        subprocess.run(["rtk", "curl", "-L", "--fail", "--silent", "--show-error", "-o", str(out), url], check=True)
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
