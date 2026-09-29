"""Extract client particle textures selected by verified armor effect paths."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import sys

from PIL import Image
import pefile

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
SIBLINGS = ROOT.parents[2]
sys.path.insert(0, str(SIBLINGS / "pso-assets/tools"))
sys.path.insert(0, str(SIBLINGS / "pso-assets/ref/pso-blender/pso_blender"))

from dxt import dxt1_decompress, dxt3_decompress  # noqa: E402
from xvm_inspect import parse_xvm  # noqa: E402

PARTICLES = ROOT / "resources/gsl-extracted/particleentry.dat"
TEXTURES = ROOT / "resources/gsl-extracted/effect_nt.xvm"
STOCK_CLIENT = SIBLINGS / "PSOBB-Haven/Psobb.exe"
METADATA_VA = 0xA101C0
ARMORS = (
    ("FLAME GARMENT", "01012E", 0x22, "flame-garment"),
    ("LUMINOUS FIELD", "01012B", 0x11B, "luminous-field"),
    ("AURA FIELD", "010131", 0xE1, "aura-field"),
    ("GUARD WAVE", "010129", 0xE0, "guard-wave"),
    ("DF FIELD", "01012A", 0x32, "df-field"),
    ("BRIGHTNESS CIRCLE", "010130", 0xB0, "brightness-circle"),
    ("ELECTRO FRAME", "010132", 0x106, "electro-frame"),
    ("SACRED CLOTH", "010133", 0x192, "sacred-cloth"),
    ("SMOKING PLATE", "010134", 0x1BC, "smoking-plate"),
    ("WEDDING DRESS", "01013E", 0x192, "wedding-dress"),
    ("DRESS PLATE", "010144", 0x1BE, "dress-plate"),
    ("LOVE HEART", "01012D", 0x1BE, "love-heart"),
    ("SWEETHEART", "010145", 0x1BE, "sweetheart"),
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rgba_pixels(data: bytes, entry) -> bytes:
    payload = data[entry.offset + 64:entry.offset + 64 + entry.data_size]
    decode = dxt1_decompress if entry.format == 6 else dxt3_decompress
    values = decode(payload, entry.width, entry.height)
    if entry.format == 7:  # DXT2 stores premultiplied RGB.
        for offset in range(0, len(values), 4):
            alpha = values[offset + 3]
            if alpha > 0:
                for channel in range(3):
                    values[offset + channel] = min(1.0, values[offset + channel] / alpha)
    return bytes(max(0, min(255, round(value * 255))) for value in values)


def main() -> None:
    particle_data = PARTICLES.read_bytes()
    texture_data = TEXTURES.read_bytes()
    assert len(particle_data) == 512 * 152
    entries = parse_xvm(texture_data).entries
    stock_client = pefile.PE(str(STOCK_CLIENT))
    stock_data = STOCK_CLIENT.read_bytes()
    # ArmorFrameParticleEffectInit's 0x3E branch reads this particle/cycle pair.
    wedding_offset = stock_client.get_offset_from_rva(0x92D1A4 - stock_client.OPTIONAL_HEADER.ImageBase)
    assert struct.unpack_from("<II", stock_data, wedding_offset) == (0x192, 2)
    by_id = {entry.texture_id: (index, entry) for index, entry in enumerate(entries)}
    assert len(by_id) == len(entries)
    manifest = {
        "schema": "destiny-armor-effect-texture-v1",
        "scope": "source_particle_texture_only",
        "note": "These PNGs are decoded particle textures, not a reconstructed runtime effect or item appearance. No inferred alpha, geometry, pose or timing was added.",
        "particleSource": {"path": str(PARTICLES), "bytes": len(particle_data), "sha256": sha256(particle_data)},
        "textureSource": {"path": str(TEXTURES), "bytes": len(texture_data), "sha256": sha256(texture_data)},
        "metadataSource": {"path": str(STOCK_CLIENT), "sha256": sha256(stock_data), "virtualAddress": hex(METADATA_VA), "recordBytes": 40, "scope": "stock-client renderer metadata, not Destiny executable proof"},
        "items": [],
    }
    for name, code, particle_id, stem in ARMORS:
        record = particle_data[particle_id * 152:(particle_id + 1) * 152]
        texture_id = struct.unpack_from("<i", record, 20)[0]
        index, entry = by_id[texture_id]
        metadata_offset = stock_client.get_offset_from_rva(METADATA_VA - stock_client.OPTIONAL_HEADER.ImageBase + index * 40)
        flags, _xvm_pointer, renderer_index, frame_count, uv_pointer, width, height, color, _xvm_index, renderer_type = struct.unpack_from("<IIIIIffIII", stock_data, metadata_offset)
        assert flags == (2 if name == "SMOKING PLATE" else 1) and renderer_index == index and color == 0xFFFFFFFF
        expected = {
            "FLAME GARMENT": (3, 16, 16.0),
            "LUMINOUS FIELD": (3, 1, 16.0),
            "AURA FIELD": (4, 1, 16.0),
            "GUARD WAVE": (3, 1, 32.0),
            "DF FIELD": (4, 1, 16.0),
            "BRIGHTNESS CIRCLE": (3, 1, 16.0),
            "ELECTRO FRAME": (4, 16, 16.0),
            "SACRED CLOTH": (4, 1, 16.0),
            "SMOKING PLATE": (3, 16, 16.0),
            "WEDDING DRESS": (4, 1, 16.0),
            "DRESS PLATE": (3, 1, 16.0),
            "LOVE HEART": (3, 1, 16.0),
            "SWEETHEART": (3, 1, 16.0),
        }
        assert (renderer_type, frame_count, width) == expected[name] and width == height
        assert entry.format in (6, 7, 8)
        image = Image.frombytes("RGBA", (entry.width, entry.height), rgba_pixels(texture_data, entry))
        output = HERE / f"{stem}-texture.png"
        image.save(output)
        manifest["items"].append({
            "name": name,
            "code": code,
            "particleId": particle_id,
            "particleName": record[:16].split(b"\0", 1)[0].decode("ascii"),
            "particleType": struct.unpack_from("<i", record, 16)[0],
            "emitterMode": "burst" if particle_id == 0x1BE else "continuous",
            "textureId": texture_id,
            "xvmIndex": index,
            "xvmFormat": entry.format,
            "dimensions": [entry.width, entry.height],
            "stockRenderer": {"type": renderer_type, "frames": frame_count, "spriteHalfSize": [width, height], "uvPointer": hex(uv_pointer), "blend": {"src": "SRCALPHA", "dst": "INVSRCALPHA" if flags == 2 else "ONE"}, "cameraFacing": True},
            "particleRecordSha256": sha256(record),
            "texturePayloadSha256": sha256(texture_data[entry.offset + 64:entry.offset + 64 + entry.data_size]),
            "image": {"path": str(output), "sha256": sha256(output.read_bytes())},
        })
    (HERE / "texture-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
