"""Extract exact source bytes for remaining Destiny model-preview diagnostics."""

from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
RESOURCES = HERE.parents[1]
DESTINY = RESOURCES.parent
sys.path.insert(0, str(RESOURCES / "supplemental-render"))
from inspect_excluded import decoded  # noqa: E402

selected = {"JUDGEMENT BLADE", "LAST EMPEROR", "M&A85 FURY", "TWIN CYCLONE"}
records = [row for row in json.loads((DESTINY / "supplemental-jobs.json").read_text())["candidates"]
           if row["name"] in selected]
archives = {name: (RESOURCES / "originals" / name).read_bytes()
            for name in ("ItemModelEp4.afs", "ItemTextureEp4.afs")}
assets = HERE / "assets"
assets.mkdir(exist_ok=True)
report = []
for row in records:
    found = {"name": row["name"], "code": row["code"], "source": {}}
    for kind in ("model", "texture"):
        resource = row[kind]
        archive = archives[resource["archive"]]
        off, size = struct.unpack_from("<II", archive, 8 + 8 * resource["entry"])
        assert (off, size) == (resource["offset"], resource["bytes"])
        compressed = archive[off:off + size]
        assert hashlib.sha256(compressed).hexdigest() == resource["sha256"]
        compressed_path = assets / f"{kind}_{resource['entry']:03d}.prs"
        compressed_path.write_bytes(compressed)
        details = {"archive": resource["archive"], "archiveSha256": resource["archiveSha256"],
                   "slot": resource["entry"], "compressedSha256": resource["sha256"],
                   "compressedBytes": size}
        try:
            _, body = decoded(resource, archives)
        except Exception as error:
            details["decodeError"] = f"{type(error).__name__}: {error}"
        else:
            path = assets / f"{kind}_{resource['entry']:03d}.{ 'xj' if kind == 'model' else 'xvm'}"
            path.write_bytes(body)
            details["decodedSha256"] = hashlib.sha256(body).hexdigest()
            details["decodedBytes"] = len(body)
        found["source"][kind] = details
    report.append(found)
(HERE / "source-manifest.json").write_text(json.dumps({"items": report}, indent=2) + "\n")
print([(row["name"], row["source"]["model"].get("decodedBytes"),
        row["source"]["texture"].get("decodedBytes")) for row in report])
