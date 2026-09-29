#!/usr/bin/env python3
"""Extract and validate independent Destiny supplemental model preview jobs."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "resources" / "supplemental-render"
ASSETS = OUT / "assets"
ORIGINALS = ROOT / "resources" / "originals"
MODEL_PREVIEWS = ROOT / "resources" / "model-previews"
STUDY = ROOT.parents[2]
PRIMARY_MODEL_ONLY = {"004C02", "004C04"}
sys.path[:0] = [
    str(MODEL_PREVIEWS),
    str(STUDY / "bb-psov4"),
    str(STUDY / "pso-assets" / "tools"),
    str(STUDY / "gc-psov3" / "tools" / "dolphin-re"),
]
from model_adapters import read_model  # noqa: E402
from prs import decompress  # noqa: E402
from xvm_inspect import parse_xvm  # noqa: E402


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check_entry(archive: bytes, resource: dict) -> bytes:
    if sha256(archive) != resource["archiveSha256"]:
        raise ValueError(f"{resource['archive']}: source archive hash changed")
    index = resource["entry"]
    if index < 0 or index >= int.from_bytes(archive[4:8], "little"):
        raise ValueError(f"{resource['archive']}[{index}]: outside AFS table")
    offset = int.from_bytes(archive[8 + index * 8:12 + index * 8], "little")
    size = int.from_bytes(archive[12 + index * 8:16 + index * 8], "little")
    if offset != resource["offset"] or size != resource["bytes"] or not size:
        raise ValueError(f"{resource['archive']}[{index}]: entry metadata changed")
    data = archive[offset:offset + size]
    if len(data) != size or sha256(data) != resource["sha256"]:
        raise ValueError(f"{resource['archive']}[{index}]: compressed entry hash changed")
    return data


def main() -> None:
    source_path = ROOT / "supplemental-jobs.json"
    source_bytes = source_path.read_bytes()
    source = json.loads(source_bytes)
    if source["schema"] != "destiny-supplemental-model-candidates-v1":
        raise ValueError("Unexpected supplemental candidate schema")
    selected = [candidate for candidate in source["candidates"] if candidate["previousVisualQa"] is None]
    if len(selected) != 50:
        raise ValueError(f"Expected 50 new candidate pairs, found {len(selected)}")
    archives = {
        name: (ORIGINALS / name).read_bytes()
        for name in ("ItemModelEp4.afs", "ItemTextureEp4.afs")
    }
    normalization_path = OUT / "normalization-report.json"
    normalization_bytes = normalization_path.read_bytes()
    normalization = json.loads(normalization_bytes)
    if normalization["schema"] != "destiny-supplemental-xvm-normalization-v1":
        raise ValueError("Unexpected XVM normalization evidence schema")
    normalized_by_slot = {item["textureSlot"]: item for item in normalization["recovered"]}
    ASSETS.mkdir(parents=True, exist_ok=True)
    asset_manifest: dict[str, dict] = {}
    jobs: list[dict] = []
    excluded: list[dict] = []

    def extract(resource: dict, kind: str) -> tuple[str, dict]:
        slot = resource["entry"]
        name = f"{kind}_{slot:03d}"
        if name in asset_manifest:
            evidence = asset_manifest[name]
            if evidence["compressedSha256"] != resource["sha256"]:
                raise ValueError(f"{name}: two source entries have different hashes")
            return evidence["decodedPath"], evidence
        compressed = check_entry(archives[resource["archive"]], resource)
        decoded = decompress(compressed)
        if kind == "model":
            model = read_model(decoded)
            if model.source_format not in ("xj", "nj"):
                raise ValueError(f"{name}: unsupported model format {model.source_format}")
            details = {"sourceFormat": model.source_format, "roots": len(model.roots)}
            extension = "xj" if model.source_format == "xj" else "nj"
        else:
            normalized = normalized_by_slot.get(slot)
            if normalized:
                if normalized["sourceCompressedSha256"] != sha256(compressed):
                    raise ValueError(f"{name}: normalization source PRS hash changed")
                if normalized["sourceDecodedSha256"] != sha256(decoded):
                    raise ValueError(f"{name}: normalization source XVM hash changed")
                normalized_path = OUT / normalized["normalizedPath"]
                adapted = normalized_path.read_bytes()
                if sha256(adapted) != normalized["normalizedSha256"]:
                    raise ValueError(f"{name}: normalized XVM hash changed")
                decoded = adapted
            textures = parse_xvm(decoded).entries
            if not textures or any(entry.format not in (6, 7, 8) for entry in textures):
                raise ValueError(f"{name}: no textures or unsupported format")
            details = {"textures": len(textures), "formats": sorted({entry.format for entry in textures})}
            if normalized:
                details["normalization"] = {
                    "report": "normalization-report.json",
                    "sourceDecodedSha256": normalized["sourceDecodedSha256"],
                    "normalizedSha256": normalized["normalizedSha256"],
                    "payloadSha256": [chunk["payloadSha256"] for chunk in normalized["chunks"]],
                }
            extension = "xvm"
        compressed_path = ASSETS / f"{name}.prs"
        decoded_path = ASSETS / f"{name}.{extension}"
        compressed_path.write_bytes(compressed)
        decoded_path.write_bytes(decoded)
        evidence = {
            "archive": resource["archive"],
            "archiveSha256": resource["archiveSha256"],
            "entry": slot,
            "offset": resource["offset"],
            "compressedPath": str(compressed_path.relative_to(OUT)),
            "compressedBytes": len(compressed),
            "compressedSha256": sha256(compressed),
            "decodedPath": str(decoded_path.relative_to(OUT)),
            "decodedBytes": len(decoded),
            "decodedSha256": sha256(decoded),
            **details,
        }
        asset_manifest[name] = evidence
        return evidence["decodedPath"], evidence

    for candidate in selected:
        try:
            model_path, model = extract(candidate["model"], "model")
            texture_path, texture = extract(candidate["texture"], "texture")
        except Exception as error:
            excluded.append({"name": candidate["name"], "code": candidate["code"],
                             "evidenceTier": candidate["evidenceTier"], "reason": str(error)})
            continue
        jobs.append({
            "name": candidate["name"],
            "code": candidate["code"],
            "websiteRowIds": candidate["websiteRowIds"],
            "evidenceTier": candidate["evidenceTier"],
            "checkedParameters": candidate["checkedParameters"],
            "parameterConflicts": candidate["parameterConflicts"],
            "runtimeVerified": False,
            "model": model_path,
            "texture": texture_path,
            "modelEvidence": model,
            "textureEvidence": texture,
            "output": f"images/{candidate['code']}_model.png",
            "resourceVerified": True,
            "visualQa": "pending",
            **({"primaryModelOnly": True,
                "primaryModelOnlyEvidence": "model_428.xj root 0 has 2806 vertices; root 1 is a four-vertex quad spanning Y -15.73..-3.41 and expands the camera bounds beyond the weapon"}
               if candidate["code"] in PRIMARY_MODEL_ONLY else {}),
        })

    output = {
        "schema": "destiny-supplemental-render-jobs-v1",
        "sources": {
            "candidates": {"path": "../../supplemental-jobs.json", "sha256": sha256(source_bytes)},
            "renderer": {"path": "../model-previews/render_textured.py",
                         "sha256": sha256((MODEL_PREVIEWS / "render_textured.py").read_bytes())},
            "modelAdapter": {"path": "../model-previews/model_adapters.py",
                             "sha256": sha256((MODEL_PREVIEWS / "model_adapters.py").read_bytes())},
            "xvmNormalization": {"path": "normalization-report.json",
                                 "sha256": sha256(normalization_bytes)},
        },
        "selected": len(selected),
        "jobs": jobs,
        "excluded": excluded,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "jobs.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    (OUT / "assets-manifest.json").write_text(json.dumps({
        "schema": "destiny-supplemental-render-assets-v1", "assets": asset_manifest,
    }, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"selected": len(selected), "jobs": len(jobs),
                      "excluded": len(excluded), "assets": len(asset_manifest)}))


if __name__ == "__main__":
    main()
