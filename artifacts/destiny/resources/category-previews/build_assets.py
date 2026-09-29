"""Extract real Destiny ground-pickup box XJ/XVM assets from item.bml."""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import struct
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STUDY = ROOT.parents[2]
sys.path[:0] = [str(STUDY / "bb-psov4"), str(STUDY / "bb-psov4/tools"),
                str(STUDY / "pso-assets/tools"),
                str(ROOT / "resources/model-previews")]
from psoarc.prs import decompress  # noqa: E402
from xvm_inspect import parse_xvm  # noqa: E402
from model_adapters import read_model  # noqa: E402

SOURCE = ROOT / "resources/originals/item.bml"
SOURCE_SHA = "195aad4d282ce5569aecb9e6639cf8daaa6730b4ff9add637709c43677c96a1e"
ASSETS = HERE / "assets"


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def entries(data: bytes) -> list[dict]:
    count = struct.unpack_from("<I", data, 4)[0]
    assert count == 35
    pos = (0x40 + count * 0x40 + 0x7FF) & ~0x7FF
    result = []
    for index in range(count):
        base = 0x40 + index * 0x40
        name = data[base:base + 32].split(b"\0")[0].decode("ascii")
        model_size, decoded_size, texture_size, texture_decoded_size = struct.unpack_from(
            "<I4xIII", data, base + 32
        )
        model = data[pos:pos + model_size]
        assert len(model) == model_size
        pos = (pos + model_size + 31) & ~31
        texture = data[pos:pos + texture_size]
        assert len(texture) == texture_size
        pos = (pos + texture_size + 31) & ~31
        result.append({"index": index, "name": name, "model": model,
                       "modelDecodedSize": decoded_size, "texture": texture,
                       "textureDecodedSize": texture_decoded_size})
    # This client BML omits the last five alignment bytes. The declared final
    # PRS stream itself is complete and its decoded size is checked below.
    assert pos - len(data) == 5
    return result


def normalize_xvm(source: bytes) -> tuple[bytes, list[dict]]:
    assert source[:4] == b"XVMH" and struct.unpack_from("<I", source, 4)[0] == 56
    count = struct.unpack_from("<I", source, 8)[0]
    assert count == 40
    pos = 64
    output = bytearray(source[:64])
    evidence = []
    for index in range(count):
        assert source[pos:pos + 4] == b"XVRT"
        body, flags, fmt, tex_id, width, height, data_size = struct.unpack_from(
            "<4I2HI", source, pos + 4
        )
        end = pos + 8 + body
        payload_end = pos + 64 + data_size
        assert fmt in (6, 7, 8) and width and height
        assert 56 + data_size <= body and end <= len(source)
        assert not any(source[payload_end:end])
        payload = source[pos + 64:payload_end]
        header = bytearray(source[pos:pos + 64])
        added = (-len(payload)) % 64
        struct.pack_into("<I", header, 4, 56 + len(payload) + added)
        output.extend(header)
        output.extend(payload)
        output.extend(bytes(added))
        evidence.append({"index": index, "textureId": tex_id, "format": fmt,
                         "width": width, "height": height,
                         "payloadSha256": digest(payload), "addedZeros": added})
        pos = end
    assert pos == len(source)
    normalized = bytes(output)
    parsed = parse_xvm(normalized)
    assert len(parsed.entries) == count
    for evidence_entry, parsed_entry in zip(evidence, parsed.entries, strict=True):
        payload = normalized[parsed_entry.offset + 64:parsed_entry.offset + 64 + parsed_entry.data_size]
        assert digest(payload) == evidence_entry["payloadSha256"]
    return normalized, evidence


def main() -> None:
    data = SOURCE.read_bytes()
    assert digest(data) == SOURCE_SHA
    source_entries = entries(data)
    ASSETS.mkdir(parents=True, exist_ok=True)
    shared = source_entries[0]
    texture_decoded = decompress(shared["texture"])
    assert len(texture_decoded) == shared["textureDecodedSize"]
    texture, chunk_evidence = normalize_xvm(texture_decoded)
    (ASSETS / "shared-textures.xvm").write_bytes(texture)
    models = []
    for index in range(2, 7):
        source_entry = source_entries[index]
        model_bytes = decompress(source_entry["model"])
        assert len(model_bytes) == source_entry["modelDecodedSize"]
        parsed = read_model(model_bytes)
        assert parsed.source_format == "xj" and parsed.roots
        path = ASSETS / f"box-state-{index - 2}.xj"
        path.write_bytes(model_bytes)
        models.append({"state": index - 2, "bmlEntry": index,
                       "bmlName": source_entry["name"],
                       "sourcePrsSha256": digest(source_entry["model"]),
                       "decodedSha256": digest(model_bytes),
                       "model": str(path.relative_to(HERE)),
                       "primitiveCount": sum(len(root.primitives) for root in parsed.roots),
                       "textureIndices": sorted({primitive.material.texture_index
                                                 for root in parsed.roots
                                                 for primitive in root.primitives
                                                 if primitive.material.texture_index is not None})})
    inventory = {"schema": "destiny-ground-box-assets-v1",
                 "source": {"file": "../originals/item.bml", "sha256": SOURCE_SHA,
                            "entryCount": len(source_entries)},
                 "sharedTexture": {"bmlEntry": 0, "sourcePrsSha256": digest(shared["texture"]),
                                   "sourceDecodedSha256": digest(texture_decoded),
                                   "normalizedSha256": digest(texture),
                                   "path": "assets/shared-textures.xvm", "textures": 40,
                                   "chunks": chunk_evidence},
                 "models": models}
    (HERE / "assets-manifest.json").write_text(json.dumps(inventory, indent=2) + "\n")
    print({"models": len(models), "textures": len(chunk_evidence)})


if __name__ == "__main__":
    main()
