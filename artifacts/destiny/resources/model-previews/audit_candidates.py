#!/usr/bin/env python3
"""Find unresolved Destiny weapon-name candidates supported by website stats."""

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def load(path: Path):
    data = path.read_bytes()
    return json.loads(data), {"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(data).hexdigest()}


def compare(website: dict, pmt: dict) -> list[dict] | None:
    fields = website["fields"]
    params = pmt["parameters"]
    atp = re.fullmatch(r"\s*(\d+)\s*-\s*(\d+)\s*", fields.get("ATP", ""))
    required = re.fullmatch(r"\s*(ATP|MST|ATA)\s+(\d+)\s*", fields.get("Required", ""))
    numeric = [fields.get(key, "").strip() for key in ("ATA", "MST", "Grind")]
    if not atp or not required or any(not re.fullmatch(r"\+?\d+" if index == 2 else r"\d+", value) for index, value in enumerate(numeric)):
        return None
    actual = {
        "ATP min": params["atpmin"],
        "ATP max": params["atpmax"],
        "ATA": params["ata"] & 0xFF,
        "MST": params["mst"],
        "Grind": params["maxgrind"] & 0xFF,
        f"Required {required[1]}": params[f"{required[1].lower()}req"],
    }
    expected = dict(zip(("ATP min", "ATP max", "ATA", "MST", "Grind", f"Required {required[1]}"),
                        (int(atp[1]), int(atp[2]), *(int(value) for value in numeric), int(required[2]))))
    checks = [{"field": field, "website": expected[field], "pmt": actual[field]} for field in expected]
    return checks if all(check["website"] == check["pmt"] for check in checks) else None


def main() -> None:
    website, website_source = load(ROOT / "database.json")
    records, pmt_source = load(ROOT / "pmt" / "records.json")
    names, names_source = load(ROOT / "resources" / "item-names.json")
    by_name: dict[str, list[dict]] = defaultdict(list)
    for item in website["items"]:
        if item["family"] == "weapon":
            by_name[item["name"].strip().casefold()].append(item)
    pmt_by_code = {item["code"]: item for item in records["records"]}
    unresolved = [item for item in names["items"] if item["family"] == "weapon" and item["name_status"] == "unresolved"]
    candidate_counts = Counter(item["mapping_candidate"]["unitxt_text"].strip().casefold() for item in unresolved if item["mapping_candidate"]["unitxt_text"])
    matches = []
    for item in unresolved:
        candidate = item["mapping_candidate"]["unitxt_text"]
        if not candidate:
            continue
        key = candidate.strip().casefold()
        db_items = by_name.get(key, [])
        if candidate_counts[key] != 1 or len(db_items) != 1:
            continue
        checks = compare(db_items[0], pmt_by_code[item["code"]])
        if checks is None or len(checks) < 6:
            continue
        matches.append({
            "name": candidate,
            "code": item["code"],
            "pmt_id": item["pmt_id"],
            "database_id": db_items[0]["id"],
            "candidate_index": item["mapping_candidate"]["index"],
            "checked_parameters": checks,
            "status": "website_parameter_correlated_candidate",
        })
    output = {
        "schema": "destiny-unresolved-weapon-name-candidates-v1",
        "sources": {"database": website_source, "pmt": pmt_source, "names": names_source},
        "method": "Unique exact case-insensitive name in website and unresolved Unitxt candidate; six numeric weapon parameters match exactly.",
        "runtime_verified": False,
        "count": len(matches),
        "matches": sorted(matches, key=lambda item: item["name"].casefold()),
    }
    (HERE / "name-candidates.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
