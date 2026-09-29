#!/usr/bin/env python3
"""Render the independent supplemental Destiny candidate batch for visual QA."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HERE = ROOT / "resources" / "supplemental-render"
RENDERER = ROOT / "resources" / "model-previews" / "render_textured.py"
ADAPTER = ROOT / "resources" / "model-previews" / "model_adapters.py"
BLENDER = Path("/Applications/Blender.app/Contents/MacOS/Blender")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rgba_png(path: Path) -> bool:
    if not path.is_file():
        return False
    header = path.read_bytes()[:26]
    return (len(header) == 26 and header[:8] == b"\x89PNG\r\n\x1a\n"
            and header[12:16] == b"IHDR" and struct.unpack_from(">I", header, 8)[0] == 13
            and header[25] == 6)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--size", type=int, default=800)
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--only-code", action="append", default=[],
                        help="Rerender selected codes after a reviewed per-job option change")
    args = parser.parse_args()
    if args.size <= 0 or args.samples <= 0:
        parser.error("size and samples must be positive")
    jobs_path = HERE / "jobs.json"
    jobs = json.loads(jobs_path.read_text())
    renderer_hash = sha256(RENDERER)
    adapter_hash = sha256(ADAPTER)
    if renderer_hash != jobs["sources"]["renderer"]["sha256"]:
        raise ValueError("Renderer changed since extraction; regenerate jobs first")
    if adapter_hash != jobs["sources"]["modelAdapter"]["sha256"]:
        raise ValueError("Model adapter changed since extraction; regenerate jobs first")
    output_dir = HERE / "images"
    log_dir = HERE / "logs"
    output_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)
    selected = set(args.only_code)
    if selected:
        previous_path = HERE / "jobs-before-primary.json"
        previous = json.loads(previous_path.read_text())
        previous_results = json.loads((HERE / "render-results.json").read_text())
        if previous_results["sources"]["jobsSha256"] != sha256(previous_path):
            raise ValueError("Previous result hash does not match saved pre-option jobs")
        if len(previous["jobs"]) != len(jobs["jobs"]):
            raise ValueError("Job count changed during selective rerender")
        for old, new in zip(previous["jobs"], jobs["jobs"], strict=True):
            original = {key: value for key, value in new.items()
                        if key not in ("primaryModelOnly", "primaryModelOnlyEvidence")}
            if old != original:
                raise ValueError(f"Non-option job data changed for {new['code']}")
            if new.get("primaryModelOnly") and new["code"] not in selected:
                raise ValueError(f"Primary-only job {new['code']} omitted from rerender")
        results_by_code = {result["code"]: result for result in previous_results["results"]}
    else:
        results_by_code = {}
    if selected - {job["code"] for job in jobs["jobs"]}:
        raise ValueError("Unknown code selected for rerender")
    render_jobs = [job for job in jobs["jobs"] if not selected or job["code"] in selected]
    for index, job in enumerate(render_jobs, 1):
        name, code = job["name"], job["code"]
        model = HERE / job["model"]
        texture = HERE / job["texture"]
        output = HERE / job["output"]
        if sha256(model) != job["modelEvidence"]["decodedSha256"]:
            raise ValueError(f"{name}: model hash changed")
        if sha256(texture) != job["textureEvidence"]["decodedSha256"]:
            raise ValueError(f"{name}: texture hash changed")
        print(f"Rendering {index}/{len(render_jobs)}: {name}", flush=True)
        command = [
            str(BLENDER), "-b", "--python-exit-code", "1", "--python", str(RENDERER),
            "--", str(model), str(texture), str(output),
            "--size", str(args.size), "--samples", str(args.samples),
        ]
        if job.get("primaryModelOnly"):
            command.append("--primary-model-only")
        process = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT, check=False)
        log_path = log_dir / f"{code}.log"
        log_path.write_text(process.stdout)
        valid = process.returncode == 0 and rgba_png(output)
        result = {
            "name": name, "code": code, "evidenceTier": job["evidenceTier"],
            "status": "rendered_pending_visual_qa" if valid else "render_failed",
            "returnCode": process.returncode,
            "output": job["output"] if valid else None,
            "imageSha256": sha256(output) if valid else None,
            "log": str(log_path.relative_to(HERE)),
            "errorTail": None if valid else process.stdout[-1800:],
        }
        results_by_code[code] = result
        results = [results_by_code[item["code"]] for item in jobs["jobs"]
                   if item["code"] in results_by_code]
        (HERE / "render-results.json").write_text(json.dumps({
            "schema": "destiny-supplemental-render-results-v1",
            "sources": {"jobsSha256": sha256(jobs_path), "rendererSha256": renderer_hash,
                        "modelAdapterSha256": adapter_hash},
            "size": args.size, "samples": args.samples,
            "results": results,
        }, ensure_ascii=False, indent=2) + "\n")
        print(f"{'RENDERED' if valid else 'FAILED'}: {name}", flush=True)
    results = [results_by_code[item["code"]] for item in jobs["jobs"]]
    print(f"Rendered {sum(item['status'] == 'rendered_pending_visual_qa' for item in results)}"
          f"/{len(results)}; preparation excluded {len(jobs['excluded'])}", flush=True)


if __name__ == "__main__":
    main()
