"""Check source evidence behind the six special Destiny model previews."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[4] / "bb-psov4"))
from model_adapters import read_model  # noqa: E402
from tools.psomodel.codec import _parts  # noqa: E402


def source(slot: int) -> bytes:
    return (HERE / "assets" / f"model_{slot:03d}.xj").read_bytes()


def second_chunk_digest(data: bytes) -> str:
    chunk = _parts(data).model_chunks[1]
    return hashlib.sha256(data[chunk.body_start:chunk.body_end]).hexdigest()


for slot, roots in ((422, 5), (432, 2)):
    model = read_model(source(slot))
    assert len(model.roots) == roots, (slot, model.summary())
    assert all(root.primitives for root in model.roots), (slot, model.summary())
    assert len(model.texture_lists) == roots, (slot, model.summary())

orotiagito = source(15)
gal_wind = source(194)
assert len(_parts(orotiagito).model_chunks) == len(_parts(gal_wind).model_chunks) == 2
assert second_chunk_digest(orotiagito) == second_chunk_digest(gal_wind)
assert second_chunk_digest(orotiagito).startswith("60414c72499df870")
assert read_model(orotiagito).root.primitives != read_model(gal_wind).root.primitives

for slot in (404, 354):
    model = read_model(source(slot))
    environment = [
        primitive
        for node in model.walk()
        for primitive in node.primitives
        if (7, 1, 0, 0) in primitive.material.native_states.get("xj", [])
    ]
    assert environment, slot
    assert all(vertex.normal is not None and vertex.uv is None
               for primitive in environment for vertex in primitive.vertices), slot

custom_barrier = read_model(source(380))
assert any(
    (primitive.material.source_blend, primitive.material.destination_blend) == (4, 1)
    for node in custom_barrier.walk() for primitive in node.primitives
)
print("Special model source evidence verified: root siblings, primary chunks, environment normals, additive blend")
