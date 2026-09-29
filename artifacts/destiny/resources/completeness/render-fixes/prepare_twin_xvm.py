"""Recover Twin Cyclone's complete XVM container from an unterminated PRS.

The source PRS ends without its optional stop opcode after producing all bytes of its sole
declared XVRT. No compressed or texture byte is guessed or appended.
"""

import hashlib
import json
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, "/Users/wangzhen/study/bb-psov4/tools")
sys.path.insert(0, "/Users/wangzhen/study/pso-assets/tools")
from psoarc.prs import decompress_with_meta  # noqa: E402
from xvm_inspect import parse_xvm  # noqa: E402

source = (HERE / "assets" / "texture_487.prs").read_bytes()
result = decompress_with_meta(source, allow_unterminated=True)
assert not result.terminated and result.stop_reason == "input_end"
body = result.data
assert body[:4] == b"XVMH"
header_size, count = struct.unpack_from("<II", body, 4)
assert (header_size, count) == (56, 1)
offset = header_size + 8
assert body[offset:offset + 4] == b"XVRT"
chunk_size = struct.unpack_from("<I", body, offset + 4)[0]
end = offset + 8 + chunk_size
assert end <= len(body)
complete = body[:end]
assert len(parse_xvm(complete).entries) == count
assert len(body) - end == 1
out = HERE / "assets" / "texture_487_counted.xvm"
out.write_bytes(complete)
(HERE / "twin-xvm-audit.json").write_text(json.dumps({
    "sourcePrsSha256": hashlib.sha256(source).hexdigest(),
    "sourcePrsBytes": len(source),
    "decodeStopReason": result.stop_reason,
    "sourceBytesConsumed": result.input_consumed,
    "completeOpcodePrefixBytes": len(body),
    "decodedPrefixSha256": hashlib.sha256(body).hexdigest(),
    "declaredXvrCount": count,
    "completeXvmBytes": end,
    "completeXvmSha256": hashlib.sha256(complete).hexdigest(),
    "postContainerBytes": body[end:].hex(),
    "interpretation": "The complete XVMH/XVRT declared container precedes the PRS input end without explicit stop opcode; no texture bytes were synthesized or changed",
}, indent=2) + "\n")
print(out, end, "complete XVM bytes from unterminated PRS")
