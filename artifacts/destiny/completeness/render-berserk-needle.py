#!/usr/bin/env python3
"""Render the website-stat and weapon-special correlated BERSERK NEEDLE code."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "berserk-needle"
PREVIEWS = ROOT / "resources" / "model-previews"
STUDY = ROOT.parents[2]
SPECIAL_SOURCE = STUDY / "newserv" / "src" / "ItemNameIndex.cc"
sys.path[:0] = [str(PREVIEWS), str(STUDY / "bb-psov4"),
                str(STUDY / "pso-assets" / "tools"),
                str(STUDY / "gc-psov3" / "tools" / "dolphin-re")]
from model_adapters import read_model  # noqa: E402
from prs import decompress  # noqa: E402
from xvm_inspect import parse_xvm  # noqa: E402


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def afs_entry(archive: bytes, slot: int) -> tuple[int, bytes]:
    if archive[:3] != b"AFS" or slot >= int.from_bytes(archive[4:8], "little"):
        raise ValueError(f"Invalid AFS slot {slot}")
    offset = int.from_bytes(archive[8 + slot * 8:12 + slot * 8], "little")
    size = int.from_bytes(archive[12 + slot * 8:16 + slot * 8], "little")
    if not offset or not size or offset + size > len(archive):
        raise ValueError(f"Invalid AFS entry {slot}")
    return offset, archive[offset:offset + size]


def main() -> None:
    audit_path = ROOT / "missing-image-audit.json"
    pmt_path = ROOT / "pmt" / "records.json"
    db_path = ROOT / "database.json"
    audit = json.loads(audit_path.read_text())
    pmt = json.loads(pmt_path.read_text())
    database = json.loads(db_path.read_text())
    item = next(item for item in audit["items"] if item["name"] == "BERSERK NEEDLE")
    website = next(item for item in database["items"] if item["name"] == "BERSERK NEEDLE")
    if website["family"] != "weapon" or website["fields"]["Special"] != "Berserk":
        raise ValueError("Website BERSERK NEEDLE special or category changed")
    source_text = SPECIAL_SOURCE.read_text()
    special_table = source_text.split('name_for_weapon_special = {', 1)[1].split('};', 1)[0]
    special_names = re.findall(r'^\s*(nullptr|"(?:\\.|[^"\\])*")\s*,',
                               special_table, flags=re.MULTILINE)
    if len(special_names) <= 14 or special_names[14] != '"Berserk"':
        raise ValueError("newserv weapon special 14 evidence changed")
    by_code = {record["code"]: record for record in pmt["records"]}
    candidates = item["parameterOnlyCandidates"]
    if {candidate["code"] for candidate in candidates} != {
        "001201", "001202", "001203", "001208"
    } or any(candidate["checked"] != 6 for candidate in candidates):
        raise ValueError("Website/PMT six-field candidate set changed")
    matching_special = [candidate["code"] for candidate in candidates
                        if by_code[candidate["code"]]["parameters"]["special"] == 14]
    if matching_special != ["001208"]:
        raise ValueError("Berserk special does not isolate code 001208")
    record = by_code["001208"]
    OUT.mkdir(parents=True, exist_ok=True)
    sources = []
    decoded_paths = []
    for kind, archive_name, slot in (
        ("model", "ItemModelEp4", record["type"]),
        ("texture", "ItemTextureEp4", record["skin"]),
    ):
        archive_path = ROOT / "resources" / "originals" / f"{archive_name}.afs"
        archive = archive_path.read_bytes()
        offset, compressed = afs_entry(archive, slot)
        decoded = decompress(compressed)
        if kind == "model":
            model = read_model(decoded)
            if model.source_format not in ("xj", "nj"):
                raise ValueError(f"Unsupported model format {model.source_format}")
            extension = model.source_format
            detail = {"format": model.source_format, "roots": len(model.roots)}
        else:
            textures = parse_xvm(decoded).entries
            if not textures or any(texture.format not in (6, 7, 8) for texture in textures):
                raise ValueError("Unsupported XVM texture format")
            extension = "xvm"
            detail = {"textures": len(textures)}
        prs_path = OUT / f"{kind}_{slot:03d}.prs"
        decoded_path = OUT / f"{kind}_{slot:03d}.{extension}"
        prs_path.write_bytes(compressed)
        decoded_path.write_bytes(decoded)
        decoded_paths.append(decoded_path)
        sources.append({"kind": kind, "archive": str(archive_path.relative_to(ROOT)),
                        "archiveSha256": sha256(archive), "entry": slot, "offset": offset,
                        "compressed": str(prs_path.relative_to(OUT)),
                        "compressedSha256": sha256(compressed),
                        "decoded": str(decoded_path.relative_to(OUT)),
                        "decodedSha256": sha256(decoded), **detail})
    renderer = PREVIEWS / "render_textured.py"
    adapter = PREVIEWS / "model_adapters.py"
    output = OUT / "001208_model.png"
    command = ["/Applications/Blender.app/Contents/MacOS/Blender", "-b",
               "--python-exit-code", "1", "--python", str(renderer), "--",
               *(str(path) for path in decoded_paths), str(output),
               "--size", "800", "--samples", "32"]
    result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, check=False)
    (OUT / "render.log").write_text(result.stdout)
    if result.returncode:
        raise RuntimeError(result.stdout[-1800:])
    with Image.open(output) as image:
        if image.mode != "RGBA" or image.getchannel("A").getbbox() is None:
            raise ValueError("Render is empty/non-RGBA")
    manifest = {
        "schema": "destiny-berserk-needle-image-candidate-v1",
        "name": "BERSERK NEEDLE", "code": "001208", "family": "weapon",
        "identityEvidence": "Unique PMT special 14/Berserk among four codes matching all six website numeric weapon fields; source Unitxt text is a placeholder, so runtime name is not confirmed.",
        "runtimeVerified": False, "visualQa": "pending",
        "candidateCodes": [{"code": candidate["code"],
                            "special": by_code[candidate["code"]]["parameters"]["special"]}
                           for candidate in candidates],
        "sources": {"auditSha256": sha256(audit_path.read_bytes()),
                    "pmtSha256": sha256(pmt_path.read_bytes()),
                    "websiteSha256": sha256(db_path.read_bytes()),
                    "newservSpecialSource": str(SPECIAL_SOURCE),
                    "newservSpecialSourceSha256": sha256(SPECIAL_SOURCE.read_bytes()),
                    "rendererSha256": sha256(renderer.read_bytes()),
                    "modelAdapterSha256": sha256(adapter.read_bytes()),
                    "resources": sources},
        "image": output.name, "imageSha256": sha256(output.read_bytes()),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"code": manifest["code"], "imageSha256": manifest["imageSha256"]}))


if __name__ == "__main__":
    main()
