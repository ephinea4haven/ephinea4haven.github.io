"""Inspect directly parsed Destiny model chunks without POF0 target assumptions."""

import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT.parents[3] / "bb-psov4"))
sys.path.insert(0, str(ROOT / "supplemental-render"))
sys.path.insert(0, str(ROOT / "model-previews"))
from tools.psomodel import iff, xj, pof0  # noqa: E402
from inspect_excluded import decoded  # noqa: E402
from model_adapters import read_xj  # noqa: E402

records = json.loads((ROOT.parent / "supplemental-jobs.json").read_text())["candidates"]
archives = {name: (ROOT / "originals" / name).read_bytes()
            for name in ("ItemModelEp4.afs", "ItemTextureEp4.afs")}

for slot in (409, 416):
    record = next(item for item in records if item["model"]["entry"] == slot)
    _, data = decoded(record["model"], archives)
    chunks = iff.parse(data)
    print(slot, [(chunk.kind, chunk.body_size) for chunk in chunks])
    for chunk in chunks:
        if chunk.kind != "NJCM":
            continue
        body = data[chunk.body_start:chunk.body_end]
        owner = chunks.index(chunk)
        relocation = chunks[owner + 1]
        assert relocation.kind == "POF0"
        bad = [(off, struct.unpack_from("<I", body, off)[0])
               for off in pof0.decode(data[relocation.body_start:relocation.body_end])
               if struct.unpack_from("<I", body, off)[0] >= len(body)]
        print("  out-of-body POF0 entries", [(hex(off), hex(value)) for off, value in bad])
        vertex_spans = []
        index_spans = []
        state_spans = []
        node_offset = 0
        while True:
            mesh_offset = struct.unpack_from("<I", body, node_offset + 4)[0]
            if mesh_offset:
                vb_ptr, vb_count = struct.unpack_from("<II", body, mesh_offset + 4)
                for index in range(vb_count):
                    base = vb_ptr + index * xj.VB_CONTAINER_SIZE
                    ptr, size, count = struct.unpack_from("<III", body, base + 4)
                    vertex_spans.append((ptr, ptr + size * count))
                for container_ptr, container_count in (
                    struct.unpack_from("<II", body, mesh_offset + 12),
                    struct.unpack_from("<II", body, mesh_offset + 20),
                ):
                    for index in range(container_count):
                        base = container_ptr + index * xj.IB_CONTAINER_SIZE
                        state_ptr, state_count, indices_ptr, indices_count = struct.unpack_from("<4I", body, base)
                        state_spans.append((state_ptr, state_ptr + state_count * xj.STATE_SIZE))
                        index_spans.append((indices_ptr, indices_ptr + indices_count * 2))
            node_offset = struct.unpack_from("<I", body, node_offset + 48)[0]
            if not node_offset:
                break
        print("  bad entries inside source vertex bytes",
              [(hex(off), any(start <= off < end for start, end in vertex_spans))
               for off, _ in bad])
        print("  bad entries inside index/state bytes",
              [(hex(off), any(start <= off < end for start, end in index_spans),
                any(start <= off < end for start, end in state_spans)) for off, _ in bad])
        print("  XJ signature", xj.looks_like(body))
        try:
            model = xj.read(body, [])
            print("  direct XJ", model.summary())
        except Exception as error:
            print("  direct XJ error", type(error).__name__, str(error))
        try:
            model = read_xj(body, [])
            print("  root-sibling XJ", model.summary())
        except Exception as error:
            print("  root-sibling XJ error", type(error).__name__, str(error))
