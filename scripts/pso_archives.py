"""Read PSOBB client archives: PRS compression, the data.gsl directory and BML model bundles."""

from __future__ import annotations

import struct
from pathlib import Path


def prs_decompress(source: bytes) -> bytes:
    out = bytearray()
    position = bits = remaining = 0

    def bit() -> int:
        nonlocal position, bits, remaining
        if remaining == 0:
            bits, remaining = source[position], 8
            position += 1
        value = bits & 1
        bits >>= 1
        remaining -= 1
        return value

    while True:
        if bit():
            out.append(source[position])
            position += 1
            continue
        if bit():
            word = source[position] | source[position + 1] << 8
            position += 2
            if word == 0:
                return bytes(out)
            offset, size = (word >> 3) - 0x2000, word & 7
            if size:
                size += 2
            else:
                size = source[position] + 1
                position += 1
        else:
            size = (bit() << 1 | bit()) + 2
            offset = source[position] - 0x100
            position += 1
        for _ in range(size):
            out.append(out[offset])


def pack_xvm(data: bytes) -> bytes:
    """Rewrite an XVM with its XVRT chunks back to back.

    Some archives pad XVRT chunks to 32/64-byte boundaries without counting the padding in the
    chunk size, and sequential IFF readers then lose every texture after the first.
    """
    header_size = struct.unpack_from("<I", data, 4)[0]
    chunks = [data[:8 + header_size]]
    position = 8 + header_size
    while (position := data.find(b"XVRT", position)) != -1:
        size = struct.unpack_from("<I", data, position + 4)[0]
        chunks.append(data[position:position + 8 + size])
        position += 8 + size
    return b"".join(chunks)


def reorder_xvm(data: bytes, order: list[int]) -> bytes:
    """Rebuild a packed XVM whose texture i is the source's texture order[i]."""
    header_size = struct.unpack_from("<I", data, 4)[0]
    header, chunks, position = bytearray(data[:8 + header_size]), [], 8 + header_size
    while position < len(data):
        size = struct.unpack_from("<I", data, position + 4)[0]
        chunks.append(data[position:position + 8 + size])
        position += 8 + size
    struct.pack_into("<I", header, 8, len(order))
    return bytes(header) + b"".join(chunks[index] for index in order)


def gsl_files(path: Path) -> dict[str, bytes]:
    """A GSL is a table of 0x30-byte entries (name, offset in 2 KiB blocks, size) ending at an empty name."""
    data = path.read_bytes()
    files = {}
    for index in range(len(data) // 0x30):
        entry = data[index * 0x30:(index + 1) * 0x30]
        name = entry[:32].split(b"\0")[0]
        if not name:
            break
        offset, size = struct.unpack_from("<II", entry, 32)
        files[name.decode("ascii")] = data[offset * 0x800:offset * 0x800 + size]
    return files


def bml_entries(data: bytes) -> list[tuple[str, bytes, bytes | None]]:
    """Return (name, decompressed file, decompressed texture archive or None) for each BML entry."""
    align = lambda value, step: (value + step - 1) // step * step
    count = struct.unpack_from("<I", data, 4)[0]
    compressed, has_textures = data[8] == ord("P"), data[9]
    step = 0x20 if has_textures else 0x800
    offset = align(count * 0x40, 0x800)
    entries = []
    for index in range(count):
        header = 0x40 + index * 0x40
        name = data[header:header + 32].split(b"\0")[0].decode("ascii")
        size, _, _, texture_size = struct.unpack_from("<4I", data, header + 32)
        body = data[offset:offset + size]
        offset += align(size, step)
        textures = None
        if texture_size:
            textures = prs_decompress(data[offset:offset + texture_size])
            offset += align(texture_size, step)
        entries.append((name, prs_decompress(body) if compressed else body, textures))
    return entries
