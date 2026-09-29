#!/usr/bin/env python3
"""Render the separately identified NEI'S CLAW 000D02 appearance variant."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
HERE = ROOT / "resources" / "supplemental-render" / "variants" / "nei-claw-000D02"
PREVIEWS = ROOT / "resources" / "model-previews"
STUDY = ROOT.parents[2]
sys.path[:0] = [str(PREVIEWS), str(STUDY / "bb-psov4"),
                str(STUDY / "pso-assets" / "tools"),
                str(STUDY / "gc-psov3" / "tools" / "dolphin-re")]
from model_adapters import read_model  # noqa: E402
from prs import decompress  # noqa: E402
from xvm_inspect import parse_xvm  # noqa: E402


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def entry(archive: bytes, slot: int) -> bytes:
    if archive[:3] != b"AFS" or slot >= int.from_bytes(archive[4:8], "little"):
        raise ValueError(f"Invalid AFS slot {slot}")
    offset = int.from_bytes(archive[8 + slot * 8:12 + slot * 8], "little")
    size = int.from_bytes(archive[12 + slot * 8:16 + slot * 8], "little")
    if not offset or not size or offset + size > len(archive):
        raise ValueError(f"Invalid AFS entry {slot}")
    return archive[offset:offset + size]


def main() -> None:
    pmt_path = ROOT / "pmt" / "records.json"
    names_path = ROOT / "resources" / "item-names.json"
    variants_path = ROOT / "supplemental-variants.json"
    pmt = json.loads(pmt_path.read_text())
    names = json.loads(names_path.read_text())
    variants = json.loads(variants_path.read_text())
    record = next(item for item in pmt["records"] if item["code"] == "000D02")
    label = next(item for item in names["items"] if item["code"] == "000D02")
    group = next(item for item in variants["groups"] if item["name"] == "NEI'S CLAW")
    if not (record["family"] == "weapon" and label["name_status"] == "source_matched"
            and label["names"]["en"] == "NEI'S CLAW"
            and group["presentation"] == "show_code_variants"
            and {item["code"] for item in group["codes"]} == {"000D02", "009B00"}):
        raise ValueError("NEI'S CLAW variant identity evidence changed")
    HERE.mkdir(parents=True, exist_ok=True)
    sources = []
    decoded_paths = []
    for kind, archive_name, slot, extension in (
        ("model", "ItemModelEp4", record["type"], "xj"),
        ("texture", "ItemTextureEp4", record["skin"], "xvm"),
    ):
        archive_path = ROOT / "resources" / "originals" / f"{archive_name}.afs"
        archive = archive_path.read_bytes()
        compressed = entry(archive, slot)
        decoded = decompress(compressed)
        if kind == "model":
            model = read_model(decoded)
            if model.source_format not in ("xj", "nj"):
                raise ValueError(f"Unsupported model format {model.source_format}")
            extension = model.source_format
            validation = {"sourceFormat": model.source_format, "roots": len(model.roots)}
        else:
            textures = parse_xvm(decoded).entries
            if not textures or any(item.format not in (6, 7, 8) for item in textures):
                raise ValueError("Unusable XVM texture format")
            validation = {"textures": len(textures)}
        prs_path = HERE / f"{kind}_{slot:03d}.prs"
        decoded_path = HERE / f"{kind}_{slot:03d}.{extension}"
        prs_path.write_bytes(compressed)
        decoded_path.write_bytes(decoded)
        decoded_paths.append(decoded_path)
        sources.append({"kind": kind, "archive": str(archive_path.relative_to(ROOT)),
                        "archiveSha256": sha256(archive), "entry": slot,
                        "prs": str(prs_path.relative_to(HERE)),
                        "prsSha256": sha256(compressed),
                        "decoded": str(decoded_path.relative_to(HERE)),
                        "decodedSha256": sha256(decoded), **validation})
    renderer = PREVIEWS / "render_textured.py"
    adapter = PREVIEWS / "model_adapters.py"
    image_path = HERE / "000D02_model.png"
    command = ["/Applications/Blender.app/Contents/MacOS/Blender", "-b",
               "--python-exit-code", "1", "--python", str(renderer), "--",
               *(str(path) for path in decoded_paths), str(image_path),
               "--size", "800", "--samples", "32"]
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, check=False)
    (HERE / "render.log").write_text(result.stdout)
    if result.returncode:
        raise RuntimeError(f"NEI'S CLAW 000D02 render failed:\n{result.stdout[-1800:]}")
    with Image.open(image_path) as image:
        if image.mode != "RGBA" or image.getchannel("A").getbbox() is None:
            raise ValueError("NEI'S CLAW 000D02 render is empty/non-RGBA")
    manifest = {
        "schema": "destiny-nei-claw-code-variant-v1",
        "name": "NEI'S CLAW", "code": "000D02",
        "variantOnly": True, "unqualifiedDropMapping": False,
        "nameStatus": "source_matched",
        "websiteParameterRowMatchesOtherCode": "009B00",
        "runtimeVerified": False, "visualQa": "pending",
        "sources": {"pmtSha256": sha256(pmt_path.read_bytes()),
                    "namesSha256": sha256(names_path.read_bytes()),
                    "variantsSha256": sha256(variants_path.read_bytes()),
                    "rendererSha256": sha256(renderer.read_bytes()),
                    "modelAdapterSha256": sha256(adapter.read_bytes()),
                    "resources": sources},
        "image": str(image_path.relative_to(HERE)), "imageSha256": sha256(image_path.read_bytes()),
    }
    (HERE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"code": manifest["code"], "imageSha256": manifest["imageSha256"]}))


if __name__ == "__main__":
    main()
