"""Expose Last Emperor's two complete XVRT chunks to the strict renderer.

The established pso-blender XVM reader consumes the declared XVR count and
does not interpret bytes after the last chunk. This adapter retains every
header and texture-payload byte and records the excluded terminal ffff.
"""

import hashlib
import json
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, "/Users/wangzhen/study/pso-assets/tools")
from xvm_inspect import parse_xvm  # noqa: E402

source = (HERE / "assets" / "texture_519.xvm").read_bytes()
assert source[:4] == b"XVMH"
header_size, count = struct.unpack_from("<II", source, 4)
assert (header_size, count) == (56, 2)
offset = header_size + 8
chunks = []
for index in range(count):
    assert source[offset:offset + 4] == b"XVRT"
    body = struct.unpack_from("<I", source, offset + 4)[0]
    end = offset + 8 + body
    assert end <= len(source)
    chunks.append({"index": index, "offset": offset, "end": end,
                   "sha256": hashlib.sha256(source[offset:end]).hexdigest()})
    offset = end
assert source[offset:] == b"\xff\xff", source[offset:].hex()
strict_input = source[:offset]
assert len(parse_xvm(strict_input).entries) == count
out = HERE / "assets" / "texture_519_counted.xvm"
out.write_bytes(strict_input)
(HERE / "last-emperor-xvm-audit.json").write_text(json.dumps({
    "sourceSha256": hashlib.sha256(source).hexdigest(),
    "strictInputSha256": hashlib.sha256(strict_input).hexdigest(),
    "declaredCount": count,
    "chunks": chunks,
    "trailerOutsideDeclaredChunks": "ffff",
    "interpretation": "pso-blender Xvm.read iterates xvr_count and ignores bytes after the last XVRT; no header or texture payload bytes changed",
}, indent=2) + "\n")
print(out, len(strict_input), "bytes; removed only terminal ffff")
