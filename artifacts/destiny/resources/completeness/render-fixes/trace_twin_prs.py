"""Diagnose Twin Cyclone's source PRS end state without synthesizing bytes."""

from __future__ import annotations

import hashlib
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
src = (HERE / "assets" / "texture_487.prs").read_bytes()
dest = bytearray()
src_pos = 0
cur = src[src_pos]
src_pos += 1
bit_pos = 9
operations = 0

try:
    while True:
        bit_pos -= 1
        if bit_pos == 0:
            cur = src[src_pos]
            src_pos += 1
            bit_pos = 8
        flag = cur & 1
        cur >>= 1
        if flag == 1:
            dest.append(src[src_pos])
            src_pos += 1
            operations += 1
            continue
        bit_pos -= 1
        if bit_pos == 0:
            cur = src[src_pos]
            src_pos += 1
            bit_pos = 8
        flag = cur & 1
        cur >>= 1
        if flag == 1:
            b0 = src[src_pos]
            src_pos += 1
            b1 = src[src_pos]
            src_pos += 1
            raw_off = (b1 << 8) | b0
            if raw_off == 0:
                print("PRS stop opcode at", src_pos, "output", len(dest))
                break
            copy_len = b0 & 7
            copy_off = ((raw_off >> 3) | 0xFFFFE000) - 0x100000000
            if copy_len == 0:
                copy_len = src[src_pos] + 1
                src_pos += 1
            else:
                copy_len += 2
        else:
            size = 0
            for _ in range(2):
                bit_pos -= 1
                if bit_pos == 0:
                    cur = src[src_pos]
                    src_pos += 1
                    bit_pos = 8
                f = cur & 1
                cur >>= 1
                size = (size << 1) | f
            copy_off = (src[src_pos] | 0xFFFFFF00) - 0x100000000
            src_pos += 1
            copy_len = size + 2
        copy_src = len(dest) + copy_off
        for _ in range(copy_len):
            dest.append(dest[copy_src])
            copy_src += 1
        operations += 1
except IndexError:
    print("PRS input exhausted without explicit stop opcode at", src_pos, "of", len(src),
          "output", len(dest), "operations", operations)

print("output header", dest[:16].hex(), "sha256", hashlib.sha256(dest).hexdigest())
if len(dest) >= 64 and dest[:4] == b"XVMH":
    body, count = struct.unpack_from("<II", dest, 4)
    offset = 8 + body
    print("XVM declared", count, "header body", body)
    for index in range(count):
        if offset + 64 > len(dest):
            print("missing complete XVRT header", index, "at", offset)
            break
        if dest[offset:offset + 4] != b"XVRT":
            print("bad XVRT magic", index, "at", offset, dest[offset:offset + 4].hex())
            break
        size, _, fmt, texture_id, width, height, payload = struct.unpack_from("<4I2HI", dest, offset + 4)
        end = offset + 8 + size
        print("XVRT", index, "at", offset, "end", end, "format", fmt,
              "size", (width, height), "payload", payload, "complete", end <= len(dest))
        offset = end
    print("container available", len(dest), "declared end", offset)
