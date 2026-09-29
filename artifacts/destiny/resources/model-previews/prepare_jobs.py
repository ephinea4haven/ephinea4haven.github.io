#!/usr/bin/env python3
"""Extract Destiny model/texture pairs for dropped items lacking ItemKT images."""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RESOURCES = HERE.parent
ASSETS = HERE / "assets"
DECODER = Path("/Users/wangzhen/study/gc-psov3/tools/dolphin-re/dump_item_textures.py")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_decoder():
    spec = importlib.util.spec_from_file_location("dump_item_textures", DECODER)
    module = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(DECODER.parent))
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    from prs import decompress

    return module.parse_afs, decompress


def load_json(path: Path):
    return json.loads(path.read_text())


def main() -> None:
    catalog = load_json(ROOT / "catalog.json")
    pmt = load_json(ROOT / "pmt" / "records.json")
    icons = load_json(ROOT / "dropcharts" / "destiny" / "images" / "mapping.json")
    candidates = load_json(HERE / "name-candidates.json")
    inventory = load_json(RESOURCES / "inventory.json")
    by_code = {record["code"]: record for record in pmt["records"]}
    drop_names = {item["name"] for item in catalog["dropItems"]}

    requested: list[dict] = []
    for item in catalog["dropItems"]:
        association = item["association"]
        if association["status"] != "parameter_consistent" or item["name"] in icons:
            continue
        code = association["code"]
        if by_code[code]["family"] in {"weapon", "shield"}:
            requested.append({"name": item["name"], "code": code, "source_status": "source_matched"})
    for item in candidates["matches"]:
        if item["name"] in drop_names and item["name"] not in icons:
            requested.append({"name": item["name"], "code": item["code"], "source_status": "website_parameter_correlated_candidate"})
    assert len({item["code"] for item in requested}) == len(requested)

    parse_afs, decompress = load_decoder()
    archive_bytes = {}
    entries = {}
    for archive in ("ItemModelEp4", "ItemTextureEp4"):
        path = RESOURCES / "originals" / f"{archive}.afs"
        blob = path.read_bytes()
        expected = next(row["sha256"] for row in inventory["files"] if row["copy"] == f"originals/{archive}.afs")
        if sha256(blob) != expected:
            raise ValueError(f"archive hash mismatch: {archive}")
        archive_bytes[archive] = blob
        entries[archive] = parse_afs(blob)

    ASSETS.mkdir(parents=True, exist_ok=True)
    asset_manifest: dict[str, dict] = {}
    jobs = []
    excluded = []

    def extract(archive: str, slot: int, kind: str) -> tuple[str, str]:
        entry = entries[archive][slot]
        if entry.size <= 0:
            raise ValueError(f"{archive}[{slot}] is empty")
        compressed = archive_bytes[archive][entry.offset : entry.offset + entry.size]
        decoded = decompress(compressed)
        if kind == "model" and not (decoded.startswith((b"NJTL", b"NJCM")) and b"NJCM" in decoded):
            raise ValueError(f"{archive}[{slot}] lacks validated XJ chunks")
        if kind == "texture" and not decoded.startswith(b"XVMH"):
            raise ValueError(f"{archive}[{slot}] lacks XVMH signature")
        extension = "xj" if kind == "model" else "xvm"
        stem = f"{kind}_{slot:03d}"
        compressed_path = ASSETS / f"{stem}.prs"
        decoded_path = ASSETS / f"{stem}.{extension}"
        compressed_path.write_bytes(compressed)
        decoded_path.write_bytes(decoded)
        asset_manifest[stem] = {
            "archive": f"originals/{archive}.afs",
            "archive_sha256": sha256(archive_bytes[archive]),
            "entry": slot,
            "entry_offset": entry.offset,
            "prs": {"path": str(compressed_path.relative_to(HERE)), "bytes": len(compressed), "sha256": sha256(compressed)},
            "decoded": {"path": str(decoded_path.relative_to(HERE)), "bytes": len(decoded), "sha256": sha256(decoded)},
            "signature": decoded[:4].decode("ascii"),
        }
        return str(decoded_path.relative_to(HERE)), str(compressed_path.relative_to(HERE))

    for item in requested:
        record = by_code[item["code"]]
        family = record["family"]
        model_slot = record["type"] + (354 if family == "shield" else 0)
        texture_slot = record["skin"] + (378 if family == "shield" else 0)
        if not (0 <= model_slot < len(entries["ItemModelEp4"])) or not (
            0 <= texture_slot < len(entries["ItemTextureEp4"])
        ):
            excluded.append({**item, "family": family, "model_slot": model_slot, "texture_slot": texture_slot, "reason": "slot_out_of_range"})
            continue
        try:
            model, model_prs = extract("ItemModelEp4", model_slot, "model")
            texture, texture_prs = extract("ItemTextureEp4", texture_slot, "texture")
        except Exception as error:
            excluded.append({**item, "family": family, "model_slot": model_slot, "texture_slot": texture_slot, "reason": str(error)})
            continue
        jobs.append({
            "item": item["name"],
            "drop_names": [item["name"]],
            "code": item["code"],
            "family": family,
            "source_status": item["source_status"],
            "pmt_id": record["pmt_id"],
            "model_slot": model_slot,
            "texture_slot": texture_slot,
            "model": model,
            "texture": texture,
            "model_prs": model_prs,
            "texture_prs": texture_prs,
            "output": f"../../dropcharts/destiny/images/{item['code']}_model.png",
            "resource_verified": True,
            "visual_qa": "pending",
        })

    jobs.sort(key=lambda item: (item["source_status"], item["item"].casefold()))
    excluded.sort(key=lambda item: item["name"].casefold())
    (HERE / "jobs.json").write_text(json.dumps({"schema": "destiny-model-preview-jobs-v1", "jobs": jobs, "excluded": excluded}, indent=2) + "\n")
    (HERE / "assets-manifest.json").write_text(json.dumps({"schema": "destiny-model-preview-assets-v1", "assets": asset_manifest}, indent=2) + "\n")
    print(f"requested={len(requested)} jobs={len(jobs)} excluded={len(excluded)} assets={len(asset_manifest)}")


if __name__ == "__main__":
    main()
