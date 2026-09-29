"""Regenerate the verified client-source armor effect previews and provenance."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
OUT = HERE / "previews"
SOURCE_MANIFEST = HERE / "texture-manifest.json"
SIMULATOR_0 = HERE / "simulate_particles.py"
SIMULATOR_1 = HERE / "simulate_type1.py"
RENDERER = HERE / "render_particle_preview.py"
EXTRACTOR = HERE / "extract_effect_textures.py"
STOCK_CLIENT = Path("/Users/wangzhen/study/PSOBB-Haven/Psobb.exe")
SEED = "0x51bb"
FRAME = 40


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dependency(role: str, path: Path) -> dict:
    return {"role": role, "path": str(path), "sha256": sha256(path)}


def main() -> None:
    subprocess.run([sys.executable, str(EXTRACTOR)], check=True)
    sources = json.loads(SOURCE_MANIFEST.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    items = []
    for source in sources["items"]:
        stem = source["name"].lower().replace(" ", "-")
        simulation_file = OUT / f"{stem}-particles.json"
        image_file = OUT / f"armor-effect-{stem}.png"
        particle_type = int(source["particleType"])
        simulator = SIMULATOR_0 if particle_type == 0 else SIMULATOR_1
        renderer = source["stockRenderer"]
        nt_flags = 2 if renderer["blend"]["dst"] == "INVSRCALPHA" else 1
        burst = source["emitterMode"] == "burst"
        frame = 20 if burst else FRAME
        subprocess.run([
            sys.executable, str(simulator), "--particle-id", hex(source["particleId"]),
            "--seed", SEED, "--frame", str(frame),
            "--uv-count", str(renderer["frames"]), "--nt-flags", str(nt_flags),
            "--output", str(simulation_file),
            *(["--one-shot"] if burst else []),
        ], check=True)
        subprocess.run([
            sys.executable, str(RENDERER), str(simulation_file),
            "--output", str(image_file),
        ], check=True)
        simulation = json.loads(simulation_file.read_text())
        render = json.loads(image_file.with_suffix(".render.json").read_text())
        assert simulation["source"]["index"] == source["particleId"]
        assert render["image"]["sha256"] == sha256(image_file)
        items.append({
            "name": source["name"],
            "code": source["code"],
            "scope": "offline_equipment_effect_preview",
            "runtimeVerified": False,
            "visualQa": "passed",
            "image": {"path": str(image_file), "sha256": sha256(image_file)},
            "seed": int(SEED, 0),
            "frame": frame,
            "emitterMode": source["emitterMode"],
            "emitted": simulation["emitted"],
            "visibleParticles": len(simulation["particles"]),
            "cameraEye": render["cameraEye"],
            "cameraTarget": render["cameraTarget"],
            "cameraPitchDegrees": render["cameraPitchDegrees"],
            "transparentBackground": render["transparentBackground"],
            "displayBlend": render["displayBlend"],
            "dependencies": [
                dependency("particle_data", Path(sources["particleSource"]["path"])),
                dependency("texture_data", Path(sources["textureSource"]["path"])),
                dependency("stock_client", STOCK_CLIENT),
                dependency("texture_extractor", EXTRACTOR),
                dependency("texture_manifest", SOURCE_MANIFEST),
                dependency("texture_png", Path(source["image"]["path"])),
                dependency("simulator", simulator),
                dependency("renderer", RENDERER),
                dependency("render_batch", Path(__file__)),
                dependency("simulation", simulation_file),
                dependency("render_sidecar", image_file.with_suffix(".render.json")),
            ],
        })
    output = {"schema": "destiny-armor-effect-preview-v1", "items": items}
    (HERE / "render-manifest.json").write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
