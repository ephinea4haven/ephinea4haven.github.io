"""Normalize validated compact XVM chunks for the strict preview renderer.

Only chunk alignment and 1-2 zero tail bytes change. Texture headers, pixel
payloads and their order are verified byte-for-byte after normalization.
"""

from __future__ import annotations

import json
from pathlib import Path
import struct
import sys

from inspect_excluded import HERE, ROOT, decoded, sha

sys.path.insert(0, "/Users/wangzhen/study/pso-assets/tools")
from xvm_inspect import parse_xvm  # noqa: E402

OUT = HERE / "normalized"


def normalize(source: bytes) -> tuple[bytes, list[dict], bytes]:
    if len(source) < 64 or source[:4] != b"XVMH":
        raise ValueError("missing XVMH header")
    header_size, count = struct.unpack_from("<II", source, 4)
    if header_size != 56 or not 1 <= count <= 16:
        raise ValueError("unexpected XVMH header size or texture count")
    chunks = []
    metadata = []
    pos = 64
    for index in range(count):
        if pos + 64 > len(source) or source[pos:pos + 4] != b"XVRT":
            raise ValueError(f"missing complete XVRT {index} at {pos}")
        body, flags, fmt, tid, width, height, payload_size = struct.unpack_from(
            "<4I2HI", source, pos + 4
        )
        end = pos + 8 + body
        payload_end = pos + 64 + payload_size
        if body < 56 + payload_size or end > len(source):
            raise ValueError(f"XVRT {index} body/payload out of bounds")
        if any(source[payload_end:end]):
            raise ValueError(f"XVRT {index} has nonzero internal padding")
        if fmt not in (6, 7, 8) or width == 0 or height == 0:
            raise ValueError(f"XVRT {index} unsupported format/dimension")
        base_size = width * height // 2 if fmt == 6 else width * height
        if payload_size < base_size:
            raise ValueError(f"XVRT {index} texture payload smaller than base level")
        pixel_data = source[pos + 64:payload_end]
        zero_padding = (-64 - len(pixel_data)) % 64
        new_body = 56 + len(pixel_data) + zero_padding
        new_header = bytearray(source[pos:pos + 64])
        struct.pack_into("<I", new_header, 4, new_body)
        chunks.append(bytes(new_header) + pixel_data + bytes(zero_padding))
        metadata.append({"index": index, "originalOffset": pos,
                         "originalEnd": end, "originalBodySize": body,
                         "normalizedBodySize": new_body,
                         "payloadSize": payload_size, "payloadSha256": sha(pixel_data),
                         "format": fmt, "width": width, "height": height,
                         "addedAlignmentZeros": zero_padding})
        pos = end
    tail = source[pos:]
    if len(tail) > 2 or any(tail):
        raise ValueError(f"nonzero or >2-byte trailer: {tail.hex()}")
    output = source[:64] + b"".join(chunks)
    parsed = parse_xvm(output)
    if len(parsed.entries) != count:
        raise AssertionError("normalized XVM texture count changed")
    for row, entry in zip(metadata, parsed.entries, strict=True):
        payload = output[entry.offset + 64:entry.offset + 64 + entry.data_size]
        if sha(payload) != row["payloadSha256"]:
            raise AssertionError(f"XVRT {row['index']} payload changed")
    return output, metadata, tail


def main() -> None:
    candidates = {row["code"]: row for row in json.loads(
        (ROOT / "supplemental-jobs.json").read_text()
    )["candidates"]}
    excluded_input = json.loads((HERE / "excluded-input.json").read_text())
    assert excluded_input["schema"] == "destiny-supplemental-original-exclusions-v1"
    excluded = excluded_input["items"]
    archives = {name: (ROOT / "resources" / "originals" / name).read_bytes()
                for name in ("ItemModelEp4.afs", "ItemTextureEp4.afs")}
    OUT.mkdir(exist_ok=True)
    recovered = []
    rejected = []
    for old in excluded:
        candidate = candidates[old["code"]]
        try:
            compressed, source = decoded(candidate["texture"], archives)
            output, chunks, tail = normalize(source)
            # Model-side failures cannot be recovered by normalizing textures.
            if "NJCM pointer" in old["reason"]:
                raise ValueError("model parse failure remains")
        except (ValueError, IndexError) as error:
            rejected.append({"name": old["name"], "code": old["code"],
                             "previousReason": old["reason"], "reason": str(error)})
            continue
        path = OUT / f"texture_{candidate['texture']['entry']:03d}.xvm"
        path.write_bytes(output)
        recovered.append({"name": old["name"], "code": old["code"],
                          "modelSlot": candidate["model"]["entry"],
                          "textureSlot": candidate["texture"]["entry"],
                          "sourceCompressedSha256": sha(compressed),
                          "sourceDecodedSha256": sha(source),
                          "normalizedSha256": sha(output),
                          "normalizedPath": str(path.relative_to(HERE)),
                          "removedZeroTrailerHex": tail.hex(),
                          "chunks": chunks})
    report = {"schema": "destiny-supplemental-xvm-normalization-v1",
              "source": "Destiny ItemTextureEp4.afs; exact compressed slot hashes from supplemental-jobs.json",
              "method": "Parse bounded XVMH/XVRT IFF chunks; preserve all texture metadata and pixel payload bytes; append only zero alignment bytes inside XVRT chunks and discard at most two all-zero terminal bytes; verify result with xvm_inspect.parse_xvm.",
              "recovered": recovered, "rejected": rejected}
    (HERE / "normalization-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print({"recovered": len(recovered), "rejected": len(rejected),
           "names": [row["name"] for row in recovered]})


if __name__ == "__main__":
    main()
