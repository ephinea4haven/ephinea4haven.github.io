"""Describe reviewed shared Destiny pickup-box previews by item family."""

from hashlib import sha256
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def main() -> None:
    assets = json.loads((HERE / "assets-manifest.json").read_text())
    assert [item["state"] for item in assets["models"]] == list(range(5))
    model_by_state = {item["state"]: item for item in assets["models"]}
    # Original BB client: group byte 0..4 -> box state [0,1,1,2,3].
    # Stars >= 9 override to state 4. Destiny BML supplies these same five
    # state model slots, but Destiny's executable selection table was not read.
    families = [
        ("weapon", 0, "Shared ground pickup model · weapon base category"),
        ("armor", 1, "Shared ground pickup model · armor base category"),
        ("shield", 1, "Shared ground pickup model · shield base category"),
        ("unit", 1, "Shared ground pickup model · unit base category"),
        ("mag", 1, "Shared ground pickup model · Mag base category"),
        ("tool", 2, "Shared ground pickup model · tool base category"),
        ("meseta", 3, "Shared ground pickup model · Meseta base category"),
        ("unknown", 4, "Shared ground pickup model · category unconfirmed"),
    ]
    entries = []
    for family, state, caption in families:
        image = f"box-state-{state}.png"
        path = HERE / image
        assert path.is_file()
        model = model_by_state[state]
        entries.append({
            "family": family,
            "image": image,
            "imageSha256": digest(path),
            "imageSize": [600, 600],
            "visualQa": "passed",
            "representation": "shared_ground_pickup_category",
            "caption": caption,
            "baseState": state,
            "selectionCondition": "illustrative_category_unconfirmed" if family == "unknown" else "nonrare_base_state",
            "categoryConfirmed": family != "unknown",
            "runtimeVerifiedForDestiny": False,
            "sourceEvidence": {
                "destinyBmlSha256": assets["source"]["sha256"],
                "bmlEntry": model["bmlEntry"],
                "bmlName": model["bmlName"],
                "modelDecodedSha256": model["decodedSha256"],
                "sharedTextureNormalizedSha256": assets["sharedTexture"]["normalizedSha256"],
                "engineRule": "original_bb_client_g_ItemStateTable_0092BB88" if family != "unknown" else "none_unknown_category",
            },
        })
    report = {
        "schema": "destiny-shared-ground-pickup-previews-v1",
        "source": {"destinyBml": "../originals/item.bml",
                   "destinyBmlSha256": assets["source"]["sha256"],
                   "assetsManifest": "assets-manifest.json",
                   "assetsManifestSha256": digest(HERE / "assets-manifest.json"),
                   "renderer": "../model-previews/render_textured.py",
                   "rendererSha256": digest(ROOT / "resources/model-previews/render_textured.py"),
                   "renderAdapter": "render_category.py",
                   "renderAdapterSha256": digest(HERE / "render_category.py")},
        "selectionEvidence": {
            "scope": "original Blue Burst client logic plus exact Destiny item.bml resource",
            "originalClientGhidraArchive": "/Users/wangzhen/study/original-psobb-client-source/ghidra_project/Psobb.exe.gzf",
            "originalClientGhidraArchiveSha256": "587d12dde345cb17092d41d458b97c6755c971b5a155d9c9b8fdb5ca8e49e6b1",
            "originalClientTableAddress": "0x0092BB88",
            "originalClientTableBytes": "00 01 01 02 03",
            "sourceFunctions": ["SetItemState_005c3e3c", "get_item_bml_data", "render_item_box", "is_rare_weapon"],
            "baseGroupToState": {"0": 0, "1": 1, "2": 1, "3": 2, "4": 3},
            "rareStarThreshold": 9,
            "rareOverrideState": 4,
            "destinyRuntimeSelectionVerified": False,
            "note": "These are real shared Destiny box model/texture previews. Family images illustrate the base nonrare state; rare items use the red override in the original client. Unknown-family entries use the red client box as an unclassified specimen only, without claiming that this is their actual runtime box.",
        },
        "rareOverride": {"image": "box-state-4.png", "imageSha256": digest(HERE / "box-state-4.png"),
                         "caption": "Shared ground pickup model · rare override (original BB rule)"},
        "entries": entries,
    }
    (HERE / "manifest.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print({"entries": len(entries), "uniqueImages": len({item["image"] for item in entries})})


if __name__ == "__main__":
    main()
