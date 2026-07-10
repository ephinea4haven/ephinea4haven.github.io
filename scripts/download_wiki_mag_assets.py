#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import subprocess
from pathlib import Path
from urllib.parse import quote

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CHARTS_PATH = ROOT / "scripts" / "redraw_mag_charts.py"
OUT_DIR = ROOT / "assets" / "img" / "mag" / "wiki"


def load_chart_module():
    spec = importlib.util.spec_from_file_location("redraw_mag_charts", CHARTS_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {CHARTS_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def chart_mag_names() -> list[str]:
    module = load_chart_module()
    names = {"Mag"}
    for cfg in module.CHARTS:
        for key in ("lv10", "lv35", "left", "right", "special"):
            items = cfg.get(key, [])
            if key == "lv10":
                items = [items]
            for item in items:
                if item:
                    names.add(module.image_key(item[0]))
        for column in cfg["rare_columns"]:
            for item in column["items"]:
                names.add(module.image_key(item[0]))
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
