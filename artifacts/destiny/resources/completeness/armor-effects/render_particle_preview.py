"""Render a fixed particle simulation frame with the stock PSOBB sprite rules."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SOURCE_MANIFEST = HERE / "texture-manifest.json"
FRAME_SIZE = 800
FOCAL_PIXELS = 320.0
CAMERA_PITCH_DEGREES = 30.0
ADDITIVE_BACKGROUND = (10, 13, 23)
ALPHA_BACKGROUND = (198, 202, 211)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def choose_camera(particles: list[dict], renderer: dict) -> dict:
    if not particles:
        return {"target": (0.0, 0.0, 0.0), "distance": 8.0}
    min_x = min(float(p["x"]) for p in particles)
    max_x = max(float(p["x"]) for p in particles)
    min_y = min(float(p["y"]) for p in particles)
    max_y = max(float(p["y"]) for p in particles)
    min_z = min(float(p["z"]) for p in particles)
    max_z = max(float(p["z"]) for p in particles)
    center_x, center_y, center_z = (min_x + max_x) / 2, (min_y + max_y) / 2, (min_z + max_z) / 2
    pitch = math.radians(CAMERA_PITCH_DEGREES)
    sin_pitch, cos_pitch = math.sin(pitch), math.cos(pitch)
    rotation_margin = 2 ** 0.5 if renderer["type"] == 4 else 1.0
    scale_x = lambda p: float(p.get("scaleX", p["scale"]))
    scale_y = lambda p: float(p.get("scaleY", p["scale"]))
    distance = max(8.0, max(
        (float(p["y"]) - center_y) * sin_pitch + (float(p["z"]) - center_z) * cos_pitch
        + FOCAL_PIXELS / 340.0 * max(
            abs(float(p["x"]) - center_x) + rotation_margin * float(renderer["spriteHalfSize"][0]) * scale_x(p),
            abs((float(p["y"]) - center_y) * cos_pitch - (float(p["z"]) - center_z) * sin_pitch)
            + rotation_margin * float(renderer["spriteHalfSize"][1]) * scale_y(p),
        ) for p in particles
    ))
    return {"target": (center_x, center_y, center_z), "distance": distance}


def draw_sprite(canvas: np.ndarray, texture: Image.Image, particle: dict, renderer: dict, camera: dict) -> None:
    x, y, z = (float(particle[key]) for key in ("x", "y", "z"))
    cx, cy, cz = camera["target"]
    pitch = math.radians(CAMERA_PITCH_DEGREES)
    sin_pitch, cos_pitch = math.sin(pitch), math.cos(pitch)
    depth = camera["distance"] - (y - cy) * sin_pitch - (z - cz) * cos_pitch
    if depth <= 0.01:
        return
    center_x = FRAME_SIZE / 2 + FOCAL_PIXELS * (x - cx) / depth
    center_y = FRAME_SIZE / 2 - FOCAL_PIXELS * ((y - cy) * cos_pitch - (z - cz) * sin_pitch) / depth
    half_width = FOCAL_PIXELS * float(renderer["spriteHalfSize"][0]) * float(particle.get("scaleX", particle["scale"])) / depth
    half_height = FOCAL_PIXELS * float(renderer["spriteHalfSize"][1]) * float(particle.get("scaleY", particle["scale"])) / depth
    sprite = texture.resize((max(1, round(2 * half_width)), max(1, round(2 * half_height))), Image.Resampling.BILINEAR)
    if renderer["type"] == 4:
        angle_degrees = int(particle["angle"]) * 360.0 / 65536.0
        sprite = sprite.rotate(-angle_degrees, resample=Image.Resampling.BICUBIC, expand=True)
    left = round(center_x - sprite.width / 2)
    top = round(center_y - sprite.height / 2)
    right = min(FRAME_SIZE, left + sprite.width)
    bottom = min(FRAME_SIZE, top + sprite.height)
    clamped_left = max(0, left)
    clamped_top = max(0, top)
    if right <= clamped_left or bottom <= clamped_top:
        return
    source = np.asarray(sprite, dtype=np.float32)[
        clamped_top - top:bottom - top, clamped_left - left:right - left
    ]
    red, green, blue, alpha = (float(value) / 255.0 for value in particle["rgba"])
    factor = source[..., 3:4] / 255.0 * alpha
    rgb = source[..., :3] * np.array([red, green, blue], dtype=np.float32)
    destination = canvas[clamped_top:bottom, clamped_left:right]
    if renderer["blend"]["dst"] == "ONE":
        destination += rgb * factor
    elif renderer["blend"]["dst"] == "INVSRCALPHA":
        destination[:] = rgb * factor + destination * (1 - factor)
    else:
        raise ValueError(f"Unsupported blend mode: {renderer['blend']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("simulation", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    simulation = json.loads(args.simulation.read_text())
    sources = json.loads(SOURCE_MANIFEST.read_text())
    match = next(item for item in sources["items"] if item["particleId"] == simulation["source"]["index"])
    texture = Image.open(match["image"]["path"]).convert("RGBA")
    renderer = match["stockRenderer"]
    camera = choose_camera(simulation["particles"], renderer)
    background = ALPHA_BACKGROUND if renderer["blend"]["dst"] == "INVSRCALPHA" else ADDITIVE_BACKGROUND
    canvas = np.empty((FRAME_SIZE, FRAME_SIZE, 3), dtype=np.float32)
    canvas[:] = background
    for particle in simulation["particles"]:
        frame = int(particle["uvFrame"])
        if renderer["frames"] == 16:
            assert 0 <= frame < 16
            column, row = frame % 4, frame // 4
            source = texture.crop((column * 32, row * 32, (column + 1) * 32, (row + 1) * 32))
        else:
            assert frame == 0
            source = texture
        draw_sprite(canvas, source, particle, renderer, camera)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), "RGB").save(args.output)
    record = {
        "scope": "fixed-seed source-particle-effect preview; no player model; Destiny runtime unverified",
        "simulation": {"path": str(args.simulation), "sha256": sha256(args.simulation)},
        "texture": {"path": match["image"]["path"], "sha256": match["image"]["sha256"]},
        "renderer": renderer,
        "canvas": [FRAME_SIZE, FRAME_SIZE],
        "cameraEye": [camera["target"][0], camera["target"][1] + camera["distance"] * math.sin(math.radians(CAMERA_PITCH_DEGREES)), camera["target"][2] + camera["distance"] * math.cos(math.radians(CAMERA_PITCH_DEGREES))],
        "cameraTarget": camera["target"],
        "cameraPitchDegrees": CAMERA_PITCH_DEGREES,
        "cameraRule": "camera pitched down 30 degrees and centered on particle bounds; minimum distance 8 and enough distance to fit rotated sprite bounds within 340 px",
        "focalPixels": FOCAL_PIXELS,
        "backgroundRgb": background,
        "image": {"path": str(args.output), "sha256": sha256(args.output)},
    }
    args.output.with_suffix(".render.json").write_text(json.dumps(record, indent=2) + "\n")


if __name__ == "__main__":
    main()
