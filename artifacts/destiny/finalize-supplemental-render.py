#!/usr/bin/env python3
"""Build the review manifest and labeled sheet for supplemental Destiny renders."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
HERE = ROOT / "resources" / "supplemental-render"
PREVIEWS = ROOT / "resources" / "model-previews"
CELL_W, CELL_H, IMAGE_SIDE = 320, 350, 282


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size: int):
    path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    return ImageFont.truetype(str(path), size) if path.is_file() else ImageFont.load_default()


def wrap(draw: ImageDraw.ImageDraw, value: str, max_width: int, selected_font) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in value.split():
        trial = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), trial, font=selected_font)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-background", action="store_true")
    args = parser.parse_args()
    candidates_path = ROOT / "supplemental-jobs.json"
    jobs_path = HERE / "jobs.json"
    assets_path = HERE / "assets-manifest.json"
    results_path = HERE / "render-results.json"
    candidates = json.loads(candidates_path.read_text())
    jobs = json.loads(jobs_path.read_text())
    results = json.loads(results_path.read_text())
    if results["sources"]["jobsSha256"] != sha256(jobs_path):
        raise ValueError("Render results were made from a different jobs manifest")
    if jobs["sources"]["renderer"]["sha256"] != sha256(PREVIEWS / "render_textured.py"):
        raise ValueError("Renderer changed after extraction")
    if jobs["sources"]["modelAdapter"]["sha256"] != sha256(PREVIEWS / "model_adapters.py"):
        raise ValueError("Model adapter changed after extraction")
    result_by_code = {result["code"]: result for result in results["results"]}
    job_by_code = {job["code"]: job for job in jobs["jobs"]}
    excluded_by_code = {item["code"]: item for item in jobs["excluded"]}
    alpha_empty: set[str] = set()
    selected = [item for item in candidates["candidates"] if item["previousVisualQa"] is None]
    if len(selected) != 50 or len(result_by_code) + len(excluded_by_code) != 50:
        raise ValueError("Fifty new candidates are not fully classified")
    entries = []
    for candidate in selected:
        code = candidate["code"]
        job = job_by_code.get(code)
        result = result_by_code.get(code)
        if not job:
            if code not in excluded_by_code:
                raise ValueError(f"Unclassified candidate {code}")
            continue
        if not result or result["status"] != "rendered_pending_visual_qa":
            raise ValueError(f"Render failed or is missing for {code}")
        image_path = HERE / result["output"]
        if not image_path.is_file() or sha256(image_path) != result["imageSha256"]:
            raise ValueError(f"Rendered image hash mismatch for {code}")
        with Image.open(image_path) as image:
            if image.mode != "RGBA":
                raise ValueError(f"Rendered image is not RGBA for {code}")
            if image.getchannel("A").getbbox() is None:
                alpha_empty.add(code)
                continue
        entries.append({
            "name": job["name"], "code": code,
            "websiteRowIds": job["websiteRowIds"],
            "evidenceTier": job["evidenceTier"],
            "checkedParameters": job["checkedParameters"],
            "parameterConflicts": job["parameterConflicts"],
            "runtimeVerified": False,
            "resourceVerified": True,
            "visualQa": "pending",
            "image": result["output"],
            "imageSha256": result["imageSha256"],
            "model": job["modelEvidence"],
            "texture": job["textureEvidence"],
        })
    manifest = {
        "schema": "destiny-supplemental-render-review-v1",
        "sources": {
            "candidates": {"path": "../../supplemental-jobs.json", "sha256": sha256(candidates_path)},
            "jobs": {"path": "jobs.json", "sha256": sha256(jobs_path)},
            "assets": {"path": "assets-manifest.json", "sha256": sha256(assets_path)},
            "results": {"path": "render-results.json", "sha256": sha256(results_path)},
            "renderer": jobs["sources"]["renderer"],
            "modelAdapter": jobs["sources"]["modelAdapter"],
            "xvmNormalization": jobs["sources"]["xvmNormalization"],
            "prepareScript": {"path": "../../prepare-supplemental-render.py",
                              "sha256": sha256(ROOT / "prepare-supplemental-render.py")},
            "renderRunner": {"path": "../../render-supplemental-jobs.py",
                             "sha256": sha256(ROOT / "render-supplemental-jobs.py")},
        },
        "counts": {"selected": 50, "renderedPendingVisualQa": len(entries),
                   "resourceRejected": len(jobs["excluded"]), "alphaEmpty": len(alpha_empty)},
        "entries": entries,
        "resourceRejected": jobs["excluded"],
        "alphaEmpty": sorted(alpha_empty),
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    columns, heading = 5, 58
    rows = math.ceil(len(selected) / columns)
    sheet = Image.new("RGB", (columns * CELL_W, rows * CELL_H + heading), "#20242b")
    draw = ImageDraw.Draw(sheet)
    title_font, label_font, note_font = font(24), font(17), font(13)
    draw.text((18, 14), f"Destiny supplemental | {len(entries)} QA candidates | {len(jobs['excluded'])} parser blocked | {len(alpha_empty)} alpha empty",
              fill="white", font=title_font)
    for index, candidate in enumerate(selected):
        code = candidate["code"]
        x, y = (index % columns) * CELL_W, (index // columns) * CELL_H + heading
        draw.rectangle((x + 3, y + 3, x + CELL_W - 3, y + CELL_H - 3),
                       fill="#2d323a", outline="#545d69")
        tile = Image.new("RGB", (IMAGE_SIDE, IMAGE_SIDE),
                         "#16213e" if args.site_background else "#b5b8bc")
        tile_draw = ImageDraw.Draw(tile)
        if not args.site_background:
            for cy in range(0, IMAGE_SIDE, 20):
                for cx in range(0, IMAGE_SIDE, 20):
                    if (cx // 20 + cy // 20) % 2:
                        tile_draw.rectangle((cx, cy, cx + 19, cy + 19), fill="#d6d8db")
        tile_text = "#e8e8e8" if args.site_background else "#232323"
        if code in excluded_by_code:
            tile_draw.text((12, 13), "PARSER BLOCKED", fill="#8c1d1d", font=label_font)
            reason = excluded_by_code[code]["reason"]
            for line_index, line in enumerate(wrap(tile_draw, reason, IMAGE_SIDE - 24, note_font)[:10]):
                tile_draw.text((12, 46 + line_index * 21), line, fill=tile_text, font=note_font)
        elif code in alpha_empty:
            tile_draw.text((12, 13), "ALPHA EMPTY", fill="#8c1d1d", font=label_font)
            tile_draw.text((12, 48), "Renderer fix pending", fill=tile_text, font=note_font)
        else:
            with Image.open(HERE / result_by_code[code]["output"]) as source:
                image = source.convert("RGBA")
            image = image.crop(image.getchannel("A").getbbox())
            image.thumbnail((IMAGE_SIDE - 22, IMAGE_SIDE - 22), Image.Resampling.LANCZOS)
            tile.paste(image, ((IMAGE_SIDE - image.width) // 2,
                               (IMAGE_SIDE - image.height) // 2), image)
        sheet.paste(tile, (x + (CELL_W - IMAGE_SIDE) // 2, y + 9))
        label = f"{candidate['name']} [{code}]"
        for line_index, line in enumerate(wrap(draw, label, CELL_W - 20, label_font)[:2]):
            draw.text((x + 10, y + 294 + line_index * 20), line, fill="white", font=label_font)
    sheet.save(HERE / ("contact-sheet-site.png" if args.site_background else "contact-sheet.png"))
    print(json.dumps(manifest["counts"]))


if __name__ == "__main__":
    main()
