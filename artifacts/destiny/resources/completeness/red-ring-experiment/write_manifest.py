"""Bind four unmodified client-resource previews to their exact source bytes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
MODEL = ROOT / "resources/model-previews/assets"
SUPPLEMENTAL = ROOT / "resources/supplemental-render/assets"
ARCHIVES = Path("/Users/wangzhen/study/bb-psov4/ref/destiny_psobb_assets/original/data")


def record(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    return {"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


items = [
    ("RED RING", "010227", "source_matched", MODEL, 354, 378, "red-ring-source.png"),
    ("ANTI-DARK RING", "010273", "unitxt_unique_multi_parameter_agree", SUPPLEMENTAL, 372, 396, "anti-dark-ring-source.png"),
    ("ANTI-LIGHT RING", "01027B", "unitxt_unique_multi_parameter_agree", SUPPLEMENTAL, 371, 395, "anti-light-ring-source.png"),
    ("MOLTEN RING", "0102A9", "unitxt_unique_multi_parameter_agree", SUPPLEMENTAL, 354, 474, "molten-ring-source.png"),
]

manifest = {
    "schema": "destiny-ring-source-render-v1",
    "scope": "static_source_material_preview",
    "note": "Source opaque faces and additive layers are retained without inferred alpha; runtime appearance is unverified.",
    "render": {"size": 800, "samples": 32, "renderer": record(ROOT / "resources/model-previews/render_textured.py")},
    "archives": {
        "model": record(ARCHIVES / "ItemModelEp4.afs"),
        "texture": record(ARCHIVES / "ItemTextureEp4.afs"),
    },
    "items": [
        {
            "name": name,
            "code": code,
            "nameEvidence": evidence,
            "runtimeVerified": False,
            "modelSlot": model_slot,
            "textureSlot": texture_slot,
            "modelPrs": record(asset_dir / f"model_{model_slot:03d}.prs"),
            "model": record(asset_dir / f"model_{model_slot:03d}.xj"),
            "texturePrs": record(asset_dir / f"texture_{texture_slot:03d}.prs"),
            "texture": record(asset_dir / f"texture_{texture_slot:03d}.xvm"),
            "image": record(HERE / output),
            "visualQA": "passed",
            "visualQANote": "Four source-material PNGs reviewed on 2026-09-29: complete geometry, transparent canvas, source opaque caps retained; Anti-Dark is bright white. Approval binds the image SHA-256 in this entry and does not assert game runtime appearance.",
        }
        for name, code, evidence, asset_dir, model_slot, texture_slot, output in items
    ],
}

(HERE / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
