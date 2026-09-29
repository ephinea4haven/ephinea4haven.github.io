"""Render verified Destiny XJ/XVM model preview jobs with Blender."""

from __future__ import annotations

import argparse
import json
import struct
import subprocess
from pathlib import Path


HERE = Path(__file__).resolve().parent
DEFAULT_BLENDER = Path("/Applications/Blender.app/Contents/MacOS/Blender")


def png_is_rgba(path: Path) -> bool:
    with path.open("rb") as stream:
        header = stream.read(26)
    return (
        len(header) == 26
        and header[:8] == b"\x89PNG\r\n\x1a\n"
        and header[12:16] == b"IHDR"
        and struct.unpack_from(">I", header, 8)[0] == 13
        and header[25] == 6
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jobs", type=Path, help="jobs.json from the asset extraction pass")
    parser.add_argument("--blender", type=Path, default=DEFAULT_BLENDER)
    parser.add_argument("--size", type=int, default=800)
    parser.add_argument("--samples", type=int, default=32)
    args = parser.parse_args()
    if args.size <= 0 or args.samples <= 0:
        parser.error("size and samples must be positive")

    manifest = json.loads(args.jobs.read_text(encoding="utf-8"))
    all_jobs = manifest.get("jobs")
    if not isinstance(all_jobs, list) or not all_jobs:
        raise ValueError("Manifest must contain a nonempty jobs array")
    jobs = [job for job in all_jobs if job.get("visual_qa") != "rejected"]
    print(f"Skipping {len(all_jobs) - len(jobs)} rejected jobs", flush=True)

    failures = []
    for index, job in enumerate(jobs, 1):
        item = job["item"]
        if job.get("resource_verified") is not True:
            raise ValueError(f"Job {index} ({item}): resource pair is not verified")
        model = (HERE / job["model"]).resolve()
        texture = (HERE / job["texture"]).resolve()
        output = (HERE / job["output"]).resolve()
        if not model.is_file() or model.suffix.lower() != ".xj":
            raise ValueError(f"Job {index} ({item}): missing XJ model {model}")
        if not texture.is_file() or texture.suffix.lower() != ".xvm":
            raise ValueError(f"Job {index} ({item}): missing XVM texture {texture}")
        if output.suffix.lower() != ".png":
            raise ValueError(f"Job {index} ({item}): output must be PNG")
        print(f"Rendering {index}/{len(jobs)}: {item}", flush=True)
        command = [
            str(args.blender), "-b", "--python-exit-code", "1", "--python", str(HERE / "render_textured.py"),
            "--", str(model), str(texture), str(output),
            "--size", str(args.size), "--samples", str(args.samples)
        ]
        if job.get("primary_model_only") is True:
            command.append("--primary-model-only")
        result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        if result.returncode:
            failures.append((item, result.stdout))
            print(f"FAILED: {item}\n{result.stdout[-1400:]}", flush=True)
            continue
        if not output.is_file() or not png_is_rgba(output):
            failures.append((item, "render is not an RGBA PNG"))
            print(f"FAILED: {item}: render is not an RGBA PNG", flush=True)
            continue
        print(f"Rendered: {item} -> {output.name}", flush=True)
    print(f"Rendered {len(jobs) - len(failures)}/{len(jobs)} textured RGBA previews", flush=True)
    if failures:
        raise RuntimeError("Render failures: " + ", ".join(item for item, _ in failures))


if __name__ == "__main__":
    main()
