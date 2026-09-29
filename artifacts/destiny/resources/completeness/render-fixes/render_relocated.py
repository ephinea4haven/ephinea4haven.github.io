"""Render source-valid XJ roots when their optional POF0 table contains bad entries.

The XJ node/mesh reader still bounds-checks every pointer it actually follows.
Only the extra POF0 relocation-target audit is bypassed for this candidate.
"""

from __future__ import annotations

import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
RESOURCES = HERE.parents[1]
sys.path.insert(0, str(RESOURCES / "model-previews"))
sys.path.insert(0, str(RESOURCES.parents[3] / "bb-psov4"))
import render_textured as renderer  # noqa: E402
from model_adapters import read_xj  # noqa: E402
from tools.psomodel import iff, njtl  # noqa: E402


def read_model_without_pof0_audit(data: bytes):
    chunks = iff.parse(data)
    model_chunks = [chunk for chunk in chunks if chunk.kind == "NJCM"]
    texture_chunks = [chunk for chunk in chunks if chunk.kind == "NJTL"]
    if len(model_chunks) != 1 or len(texture_chunks) != 1:
        raise ValueError("Expected exactly one source NJCM and one NJTL")
    names = njtl.read(data[texture_chunks[0].body_start:texture_chunks[0].body_end], "<")
    body = data[model_chunks[0].body_start:model_chunks[0].body_end]
    model = read_xj(body, names)
    print(f"Source XJ graph parsed despite POF0 anomaly: {model.summary()}", flush=True)
    return model


renderer.read_model = read_model_without_pof0_audit
renderer.main()
