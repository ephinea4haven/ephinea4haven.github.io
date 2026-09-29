"""Check the Ill Gill Reaper's asymmetric XVM sampling against raw XJ UVs."""

from __future__ import annotations

import sys
from pathlib import Path


SIBLINGS = Path(__file__).resolve().parents[4].parent
sys.path.insert(0, str(SIBLINGS / "bb-psov4"))
sys.path.insert(0, str(SIBLINGS / "pso-assets/tools"))
sys.path.insert(0, str(SIBLINGS / "pso-assets/ref/pso-blender/pso_blender"))
from tools.psomodel.codec import read_model  # noqa: E402
from xvm_inspect import parse_xvm  # noqa: E402
from dxt import dxt3_decompress  # noqa: E402


def sample(pixels, width, height, uv):
    u, v = uv
    x = int((u % 1) * width) % width
    y = int((v % 1) * height) % height
    offset = (y * width + x) * 4
    return tuple(round(value, 3) for value in pixels[offset:offset + 4])


def main():
    source = SIBLINGS / "bb-psov4/ref/custom_item_assets/ill_gill_reaper/source"
    model = read_model((source / "model/ItemModelEp4_446.xj").read_bytes())
    data = (source / "texture/ItemTextureEp4_539.xvm").read_bytes()
    entries = parse_xvm(data).entries
    candidates = []
    for node in model.walk():
        for primitive in node.primitives:
            slot = primitive.material.texture_index
            if slot is None:
                continue
            entry = entries[slot]
            assert entry.format == 7
            payload = bytearray(data[entry.offset + 64:entry.offset + 64 + entry.data_size])
            pixels = dxt3_decompress(payload, entry.width, entry.height)
            for vertex in primitive.vertices:
                if vertex.uv is None:
                    continue
                raw = sample(pixels, entry.width, entry.height, vertex.uv)
                flipped = sample(pixels, entry.width, entry.height, (vertex.uv[0], 1 - vertex.uv[1]))
                difference = sum(abs(raw[channel] - flipped[channel]) for channel in range(3))
                candidates.append((difference, slot, vertex.uv, raw, flipped))
    difference, slot, uv, raw, flipped = max(candidates)
    assert difference > 0.1, "Texture is too symmetric to verify UV orientation"

    importer = (SIBLINGS / "pso-assets/ref/pso-blender/pso_blender/xj.py").read_text()
    renderer = (Path(__file__).resolve().parent / "render_textured.py").read_text()
    assert "img.pixels = xvr.data" in importer
    assert "uv_attribute.uv[loop.index].vector[1] = uvs[loop.vertex_index][1]" in importer
    assert "image.pixels.foreach_set(pixels)" in renderer
    assert "uv_layer.data[loop_index].uv = (u, v)" in renderer
    print(f"slot {slot}, raw UV {tuple(round(value, 4) for value in uv)}")
    print(f"raw pixel {raw}; V-flipped pixel {flipped}; RGB difference {difference:.3f}")
    print("Renderer and pso-blender importer both use raw decoded pixels and raw UVs")


if __name__ == "__main__":
    main()
