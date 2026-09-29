"""Record client category-art evidence without assigning generic art to items."""

from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import struct

HERE = Path(__file__).resolve().parent
DESTINY = HERE.parents[1]
MISSING = DESTINY / "missing-image-audit.json"
BML = HERE.parent / "originals" / "item.bml"


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


def bml_entries(path: Path) -> list[dict]:
    data = path.read_bytes()
    count = struct.unpack_from("<I", data, 4)[0]
    assert 0 < count <= 35
    result = []
    for index in range(count):
        offset = 0x40 + index * 0x40
        name = data[offset:offset + 0x20].split(b"\0")[0].decode("ascii")
        size, _, decoded_size, gvm_size, decoded_gvm_size = struct.unpack_from(
            "<IIIII", data, offset + 0x20
        )
        result.append({
            "index": index,
            "name": name,
            "compressedBytes": size,
            "decodedBytes": decoded_size,
            "textureCompressedBytes": gvm_size,
            "textureDecodedBytes": decoded_gvm_size,
        })
    return result


def main() -> None:
    missing = json.loads(MISSING.read_text())
    rows = []
    for item in missing["items"]:
        candidates = item["nameCandidates"]
        family = candidates[0]["family"] if len(candidates) == 1 else None
        rows.append({
            "name": item["name"],
            "family": family,
            "uniqueCode": candidates[0]["code"] if len(candidates) == 1 else None,
            "categoryImage": None,
            "reason": "no_verified_item_or_category_image_from_inspected_assets",
        })
    counts = Counter(row["family"] or "ambiguous_or_none" for row in rows)
    sources = {}
    for name in ("f256_uniticon.prs", "infoicon.xvm", "itemmagedit.prs",
                 "texturejapanese.xvm", "ccconsole_j.xvm"):
        path = HERE / "sources" / name
        sources[name] = {"bytes": path.stat().st_size, "sha256": digest(path),
                         "origin": "data.gsl member" if name in {
                             "f256_uniticon.prs", "infoicon.xvm", "itemmagedit.prs"
                         } else "installed Destiny data directory"}
    output = {
        "schema": "destiny-category-image-audit-v1",
        "dataGslArchiveSha256": "043a6e96a04756ea9a373f2c9758d5ce7d1f90c6158b23b198e8f9942e74c229",
        "missingImageAudit": {"path": "../../missing-image-audit.json", "sha256": digest(MISSING)},
        "itemBml": {"path": "../originals/item.bml", "bytes": BML.stat().st_size,
                    "sha256": digest(BML), "entries": bml_entries(BML)},
        "inspectedExtractedResources": sources,
        "unavailableCompanionCandidate": {
            "application": "DestinyReader v0.9.15",
            "document": "/Users/wangzhen/study/bb-psov4/docs/destinyreader-static-analysis.md",
            "embeddedPaths": ["assets/icon0.png", "assets/icon1.png", "assets/icon3.png",
                              "assets/icon4.png", "assets/icon5.png", "assets/icon6.png",
                              "assets/icon_ca.png", "assets/icon_cp.png",
                              "assets/icon_cr.png", "assets/icon_cv.png"],
            "status": "documented_but_binary_and_images_not_locally_available",
            "note": "Reader overlay graphics are companion-app assets, not proven PSOBB client item images or category mappings.",
        },
        "finding": "The inspected UI atlases contain menu text, character creation, slot-saving graphics and multiplayer menu graphics; none contains identifiable tool, unit, armor, grinder or material item art. item.bml contains shared ground-pickup box models/textures, not per-item images. Client calls get_item_bml_data(item_state) then renders its NJCM/NJTL model/texture; no exact category-to-box mapping is established here.",
        "counts": {"missing": len(rows), "byUniqueCandidateFamily": dict(sorted(counts.items())),
                   "verifiedCategoryImages": 0},
        "items": rows,
    }
    (HERE / "audit.json").write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(output["counts"])


if __name__ == "__main__":
    main()
