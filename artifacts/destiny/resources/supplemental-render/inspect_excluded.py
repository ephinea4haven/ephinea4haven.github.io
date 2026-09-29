"""Read-only structural diagnostics for rejected supplemental AFS entries."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, "/Users/wangzhen/study/gc-psov3/tools/dolphin-re")
from prs import decompress  # noqa: E402


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def decoded(resource: dict, archives: dict[str, bytes]) -> tuple[bytes, bytes]:
    archive = archives[resource["archive"]]
    assert sha(archive) == resource["archiveSha256"]
    index = resource["entry"]
    off, size = struct.unpack_from("<II", archive, 8 + index * 8)
    assert (off, size) == (resource["offset"], resource["bytes"])
    compressed = archive[off:off + size]
    assert sha(compressed) == resource["sha256"]
    return compressed, decompress(compressed)


def xvm_report(data: bytes) -> dict:
    info = {"length": len(data), "sha256": sha(data), "header": data[:16].hex(),
            "tailHex": data[-32:].hex()}
    if len(data) < 64 or data[:4] != b"XVMH":
        return info | {"error": "not an XVMH container"}
    body_size, count = struct.unpack_from("<II", data, 4)
    info.update(headerBodySize=body_size, declaredCount=count)
    off = body_size + 8
    entries = []
    for index in range(count):
        if off + 64 > len(data) or data[off:off + 4] != b"XVRT":
            info["error"] = f"missing complete XVRT header {index} at {off}"
            break
        body, flags, fmt, tid, width, height, payload = struct.unpack_from("<4I2HI", data, off + 4)
        end = off + 8 + body
        pad_start = off + 64 + payload
        entries.append({"index": index, "offset": off, "end": end,
                        "startAligned64": off % 64 == 0,
                        "endAligned64": end % 64 == 0,
                        "bodySize": body, "payloadSize": payload,
                        "format": fmt, "textureId": tid, "width": width, "height": height,
                        "paddingBytes": max(0, end - pad_start),
                        "paddingHex": data[pad_start:end].hex() if end >= pad_start and end <= len(data) else None,
                        "boundsValid": end <= len(data) and pad_start <= end})
        off = end
    info["entries"] = entries
    info["trailingHex"] = data[off:].hex() if off <= len(data) else None
    return info


def main() -> None:
    selected = json.loads((ROOT / "supplemental-jobs.json").read_text())["candidates"]
    excluded_input = json.loads((HERE / "excluded-input.json").read_text())
    assert excluded_input["schema"] == "destiny-supplemental-original-exclusions-v1"
    excluded = excluded_input["items"]
    lookup = {row["code"]: row for row in selected}
    archives = {name: (ROOT / "resources" / "originals" / name).read_bytes()
                for name in ("ItemModelEp4.afs", "ItemTextureEp4.afs")}
    rows = []
    for row in excluded:
        candidate = lookup[row["code"]]
        model_compressed, model = decoded(candidate["model"], archives)
        try:
            texture_compressed, texture = decoded(candidate["texture"], archives)
            texture_info = xvm_report(texture)
        except IndexError as error:
            texture_info = {"decompressionError": f"{type(error).__name__}: {error}"}
            texture_compressed = b""
        rows.append({"name": row["name"], "code": row["code"],
                     "previousReason": row["reason"],
                     "model": {"slot": candidate["model"]["entry"],
                               "compressedSha256": sha(model_compressed),
                               "decodedLength": len(model), "decodedSha256": sha(model),
                               "headerHex": model[:16].hex()},
                     "texture": {"slot": candidate["texture"]["entry"],
                                 "compressedSha256": sha(texture_compressed),
                                 **texture_info}})
    (HERE / "excluded-structure.json").write_text(json.dumps({
        "schema": "destiny-supplemental-excluded-structure-v1", "items": rows,
    }, indent=2) + "\n")
    for row in rows:
        t = row["texture"]
        print(row["name"], "m", row["model"]["slot"], "t", t["slot"],
              "entries", [(x["offset"], x["end"], x["startAligned64"], x["endAligned64"],
                            x["paddingBytes"], x["boundsValid"]) for x in t.get("entries", [])],
              "trailing", t.get("trailingHex"))


if __name__ == "__main__":
    main()
