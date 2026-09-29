"""Local read-only adapters for Destiny model layouts unsupported by psomodel."""

from __future__ import annotations

from tools.psomodel import xj, codec, njtl, gj, nj
from tools.psomodel.binary import Reader
from tools.psomodel.errors import FormatError
from tools.psomodel.ir import Model, Node


_original_xj_read = xj.read


def _read_xj_with_root_siblings(body: bytes, texture_names: list[str]) -> Model:
    """Read the complete NJCM node forest, including root-level next links.

    The upstream parser already follows child sibling chains, but rejects a
    nonzero sibling pointer on the root. Destiny's Skyfall and Stormrender
    store additional visible roots through precisely that pointer.
    """
    reader = Reader(body, "<")
    visited: set[int] = set()

    def node_at(offset: int) -> Node:
        if offset in visited:
            raise FormatError(f"cycle or duplicate XJ node pointer at {offset:#x}")
        visited.add(offset)
        reader.require(offset, xj.NODE_SIZE, "XJ node")
        mesh = reader.u32(offset + 4)
        child = reader.u32(offset + 44)
        node = Node(
            eval_flags=reader.u32(offset),
            position=reader.unpack("3f", offset + 8),
            rotation=reader.unpack("3i", offset + 20),
            scale=reader.unpack("3f", offset + 32),
            primitives=xj._read_mesh(reader, mesh) if mesh else [],
        )
        if child:
            node.children = chain_at(child)
        return node

    def chain_at(offset: int) -> list[Node]:
        result = []
        while offset:
            result.append(node_at(offset))
            offset = reader.u32(offset + 48)
        return result

    root = node_at(0)
    siblings = chain_at(reader.u32(48)) if reader.u32(48) else []
    return Model(
        root,
        texture_names,
        "xj",
        additional_roots=siblings,
        additional_texture_names=[texture_names.copy() for _ in siblings],
    )


def read_xj(body: bytes, texture_names: list[str]) -> Model:
    try:
        return _original_xj_read(body, texture_names)
    except FormatError as exc:
        if str(exc) != "root XJ node unexpectedly has a sibling":
            raise
        return _read_xj_with_root_siblings(body, texture_names)


def read_model(data: bytes) -> Model:
    """Read all container models and preserve each XJ root-sibling chain."""
    parts = codec._parts(data)
    parsed = []
    for model_chunk, texture_chunk in zip(parts.model_chunks, parts.texture_chunks, strict=True):
        names = (
            njtl.read(data[texture_chunk.body_start:texture_chunk.body_end], parts.model_endian)
            if texture_chunk else []
        )
        body = data[model_chunk.body_start:model_chunk.body_end]
        if parts.model_format is codec.ModelFormat.XJ:
            parsed.append(read_xj(body, names))
        elif parts.model_format is codec.ModelFormat.GJ:
            parsed.append(gj.read(body, names))
        else:
            parsed.append(nj.read(body, names, parts.model_endian))
    first = parsed[0]
    first.additional_roots = first.additional_roots + [
        root for item in parsed[1:] for root in item.roots
    ]
    first.additional_texture_names = first.additional_texture_names + [
        names for item in parsed[1:] for names in item.texture_lists
    ]
    first.warnings.extend(warning for item in parsed[1:] for warning in item.warnings)
    return first
