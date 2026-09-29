"""Bind reviewed recovered previews to exact sources and renderer binaries."""

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DESTINY = HERE.parents[2]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source = {row["name"]: row for row in json.loads((HERE / "source-manifest.json").read_text())["items"]}
review = {
    "JUDGEMENT BLADE": ("judgement-blade-candidate.png", "pending", "Three complete source XJ root meshes; optional POF0 entries incorrectly point into vertex data. The local adapter checks every traversed model pointer."),
    "M&A85 FURY": ("ma85-fury-candidate.png", "passed", "Source XJ root forest parses fully; optional POF0 table mislabels two index-buffer fields as pointers. Local adapter bounds-checks every traversed graph pointer."),
    "LAST EMPEROR": ("last-emperor-candidate.png", "passed", "Two declared XVRT chunks are complete; only ffff outside them is excluded for the strict renderer, consistent with pso-blender's count-based reader."),
    "TWIN CYCLONE": ("twin-cyclone-candidate.png", "pending", "Source PRS ends without stop opcode after the one declared XVM/XVRT chunk is complete; no image bytes were synthesized."),
}
entries = []
for name, (filename, qa, reason) in review.items():
    image = HERE / filename
    row = source[name]
    entry = {
        "name": name,
        "code": row["code"],
        "path": str(image.relative_to(DESTINY)),
        "imageSha256": digest(image),
        "visualQa": qa,
        "kind": "model_candidate",
        "note": reason,
        "source": row["source"],
        "runtimeVerified": False,
        "renderScriptSha256": digest(DESTINY / "resources" / "model-previews" / "render_textured.py"),
        "renderAdapterSha256": digest(DESTINY / "resources" / "model-previews" / "model_adapters.py"),
    }
    if name in {"M&A85 FURY", "JUDGEMENT BLADE"}:
        entry["localRendererSha256"] = digest(HERE / "render_relocated.py")
        entry["structureAudit"] = "resources/completeness/render-fixes/inspect_models.py"
    elif name == "LAST EMPEROR":
        entry["textureAudit"] = "resources/completeness/render-fixes/last-emperor-xvm-audit.json"
    else:
        entry["textureAudit"] = "resources/completeness/render-fixes/twin-xvm-audit.json"
    entries.append(entry)

(HERE / "manifest.json").write_text(json.dumps({
    "schema": "destiny-recovered-model-previews-v1",
    "visualQaAuthority": "Root agent reviewed the composited site-background images for passed entries; pending entries are not approved for site mapping.",
    "entries": entries,
}, indent=2) + "\n")
print([(entry["name"], entry["visualQa"], entry["imageSha256"][:16]) for entry in entries])
