#!/usr/bin/env python3
"""Render monster portraits from their game models through phantasmal-world.

content/monster-catalog/model-renders.json lists each render (model, motion frame, camera,
hidden effect materials) and binds catalog entries' normal and Ultimate appearances to renders.
A phantasmal-world build with the npcBatch export entry must be served at --harness.
A render names either a model among phantasmal-world's extracted NPC assets (`npc`) or an
entry in an Ephinea client archive (`archive` + `model`, with `motion` from the same archive);
archive entries are extracted into the harness's asset directory (--harness-assets) first.
Each model is rendered on black and on white; the difference recovers alpha, so additive
glows stay translucent. Portraits are cropped to the model, centred and saved as WebP.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from pso_archives import bml_entries, gsl_files, pack_xvm, reorder_xvm


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "content/monster-catalog/model-renders.json"
OUTPUT = ROOT / "assets/img/monsters/render"
RENDER_SIZE = 2048
OUTPUT_SIZE = 1024
THUMB_SIZE = 160   # list rows show 48–64 px
MARGIN = 0.06


def file_name(label: str) -> str:
    return label.replace(".ult", "-ult") + ".webp"


def matte(black: Image.Image, white: Image.Image) -> Image.Image:
    b = np.asarray(black.convert("RGB"), dtype=float)
    w = np.asarray(white.convert("RGB"), dtype=float)
    alpha = np.clip(1 - (w - b).mean(axis=2) / 255, 0, 1)
    colour = np.where(alpha[..., None] > 0, b / np.maximum(alpha[..., None], 1e-3), 0)
    return Image.fromarray(np.dstack([np.clip(colour, 0, 255), alpha * 255]).round().astype(np.uint8), "RGBA")


def portrait(image: Image.Image) -> Image.Image:
    """Crop to the model, centre it in a square with a margin and scale to the output size."""
    box = image.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    model = image.crop(box)
    side = round(max(model.size) / (1 - 2 * MARGIN))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(model, ((side - model.width) // 2, (side - model.height) // 2))
    return canvas.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)


def extract_archives(renders: dict, ephinea_data: Path, harness_assets: Path) -> dict:
    """Write the archive entries renders need as raw/<archive>/<entry>.{nj,xj,xvm,njm}; return jobs."""
    gsl = None
    bundles: dict[str, list] = {}

    def bundle(archive: str) -> list:
        nonlocal gsl
        if archive not in bundles:
            loose = ephinea_data / archive
            if loose.exists():
                data = loose.read_bytes()
            else:
                gsl = gsl or gsl_files(ephinea_data / "data.gsl")
                data = gsl[archive]
            bundles[archive] = bml_entries(data)
        return bundles[archive]

    def extract(render: dict) -> dict:
        job = {key: value for key, value in render.items() if key not in ("archive", "model", "texture", "textureOrder", "parts")}
        if "archive" in render:
            entries = bundle(render["archive"])
            # Models and motions may share a base name (fs_obj_hiraishin_a.nj / .njm); index them apart.
            models = {name.rsplit(".", 1)[0]: (name, body, textures) for name, body, textures in entries if name.endswith((".nj", ".xj"))}
            motions = {name.rsplit(".", 1)[0]: (name, body) for name, body, _ in entries if name.endswith(".njm")}
            stem = render["archive"].removesuffix(".bml")
            directory = harness_assets / "raw" / stem
            directory.mkdir(parents=True, exist_ok=True)
            # Without `model`, the archive only supplies the motion for a phantasmal-world model.
            if "model" in render:
                name, body, textures = models[render["model"]]
                (directory / name).write_bytes(body)
                # Models without their own texture archive use the named one, else the bundle's first.
                texture_source = render.get("texture")
                textures = models[texture_source][2] if texture_source else textures or next(t for _, _, t in entries if t)
                textures = pack_xvm(textures)
                # textureOrder remaps texture slots when a model's indices point at another skin's textures.
                if "textureOrder" in render:
                    textures = reorder_xvm(textures, render["textureOrder"])
                (directory / f"{render['model']}.xvm").write_bytes(textures)
                job["npc"] = f"raw/{stem}/{render['model']}"
            if "motion" in render:
                motion_name, motion = motions[render["motion"]]
                (directory / motion_name).write_bytes(motion)
                job["motion"] = f"raw/{stem}/{render['motion']}"
        if "parts" in render:
            job["parts"] = [extract(part) for part in render["parts"]]
        return job

    return {label: extract(render) for label, render in renders.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--harness", default="http://127.0.0.1:8765/index.html?npcBatch=1")
    parser.add_argument("--render", action="append", help="render only this label (repeatable)")
    parser.add_argument("--ephinea-data", type=Path, default=Path("/Applications/EphineaPSO.app/Contents/SharedSupport/prefix/drive_c/EphineaPSO/data"))
    parser.add_argument("--harness-assets", type=Path, help="the harness's assets/npcs directory, for archive renders")
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    renders = {label: job for label, job in config["renders"].items() if not args.render or label in args.render}
    used = {label for binding in config["bindings"].values() for label in (binding["normal"], binding["ultimate"])}
    used |= {alternate["render"] for binding in config["bindings"].values() for alternate in binding.get("alternates", [])}
    if missing := used - set(config["renders"]):
        raise SystemExit(f"Bindings name undefined renders: {sorted(missing)}")
    if unused := set(config["renders"]) - used:
        raise SystemExit(f"Renders bound to no catalog entry: {sorted(unused)}")

    (OUTPUT / "thumbs").mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="monster-renders-") as directory:
        work = Path(directory)
        if any("archive" in json.dumps(render) for render in renders.values()) and not args.harness_assets:
            raise SystemExit("Archive renders need --harness-assets")
        jobs = [{"label": label, "size": RENDER_SIZE, "frame": 0, **job}
                for label, job in extract_archives(renders, args.ephinea_data, args.harness_assets).items()]
        (work / "jobs.json").write_text(json.dumps(jobs), encoding="utf-8")
        subprocess.run(["node", str(ROOT / "scripts/render_monster_models.mjs"), str(work / "jobs.json"), str(work), args.harness], check=True)
        for label in renders:
            image = portrait(matte(Image.open(work / f"{label}-black.png"), Image.open(work / f"{label}-white.png")))
            image.save(OUTPUT / file_name(label), "WEBP", quality=85, method=6)
            image.resize((THUMB_SIZE, THUMB_SIZE), Image.Resampling.LANCZOS).save(OUTPUT / "thumbs" / file_name(label), "WEBP", quality=85, method=6)
            print(f"{label}: {file_name(label)}")

    if not args.render:
        for stale in [*OUTPUT.glob("*.webp"), *(OUTPUT / "thumbs").glob("*.webp")]:
            if stale.name not in {file_name(label) for label in config["renders"]}:
                stale.unlink()
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    manifest = {label: {"file": file_name(label), "sha256": digest(OUTPUT / file_name(label)),
                        "thumbSha256": digest(OUTPUT / "thumbs" / file_name(label))}
                for label in config["renders"]}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
