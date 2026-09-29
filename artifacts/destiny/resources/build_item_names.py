#!/usr/bin/env python3
"""Join captured Destiny PMT records to the client's unmodified Unitxt strings."""

import hashlib
import json
import re
import subprocess
from collections import Counter
from pathlib import Path


HERE = Path(__file__).resolve().parent
PMT = HERE.parent / "pmt" / "records.json"
INVENTORY = HERE / "inventory.json"
NEW_SERV = Path("/Users/wangzhen/study/newserv/build/newserv")
OUTPUT = HERE / "item-names.json"
SOLYLIB = HERE / "originals" / "items_list.lua"
OFFSETS = {"tool": 0, "weapon": 0, "armor": -4, "shield": -4, "unit": -4, "mag": -48}
NAME_END = {"armor": 1164, "shield": 1164, "unit": 1164}


def decode_unitxt(path: Path) -> list[list[str]]:
    result = subprocess.run(
        [str(NEW_SERV), "decode-unicode-text-set", str(path), "-"],
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def solylib_base_names() -> dict[str, str]:
    # This installed addon has a generic base table followed by server-specific
    # branches. Only the base table is an independent code/name cross-check.
    base = SOLYLIB.read_text().split("    if server == 1 then", 1)[0]
    entries = re.findall(
        r"^\s*t\[\s*0x([0-9A-Fa-f]{6})\s*\]\s*=.*?--\s*(.*)$",
        base,
        flags=re.MULTILINE,
    )
    return {code.upper(): name.strip() for code, name in entries}


def main() -> None:
    pmt = json.loads(PMT.read_text())
    inventory = json.loads(INVENTORY.read_text())
    source = next(f for f in inventory["files"] if f["copy"] == "originals/unitxt_j.prs")
    unitxt_file = HERE / source["copy"]
    assert hashlib.sha256(unitxt_file.read_bytes()).hexdigest() == source["sha256"]
    assert pmt["source"]["sha256"] == next(
        f["sha256"] for f in inventory["files"] if f["copy"] == "originals/ItemPMT.prs"
    )
    solylib_source = next(f for f in inventory["files"] if f["copy"] == "originals/items_list.lua")
    assert hashlib.sha256(SOLYLIB.read_bytes()).hexdigest() == solylib_source["sha256"]

    groups = decode_unitxt(unitxt_file)
    assert len(groups) == 73 and len(groups[1]) == 1255
    names = groups[1]
    assert names[0] == "Monomate" and names[177] == "Saber"
    code_names = solylib_base_names()
    assert code_names["010100"] == "Frame" and code_names["020000"] == "Mag"

    rows = []
    coverage = Counter()
    by_family: dict[str, Counter] = {}
    for record in pmt["records"]:
        family = record["family"]
        item_id = record["pmt_id"]
        candidate_index = item_id + OFFSETS[family]
        candidate = names[candidate_index] if 0 <= candidate_index < len(names) else None
        source_listed_name = code_names.get(record["code"])
        if record["code"] == "000000" or item_id == 743:
            reason = "pmt_sentinel"
        elif family == "mag" and record["code"] == "025200" and item_id != 1301:
            reason = "mag_id_sequence_break"
        elif family in NAME_END and candidate_index > NAME_END[family]:
            reason = "outside_equipment_name_region"
        elif candidate is None:
            reason = "candidate_out_of_range"
        elif source_listed_name is None:
            reason = "no_independent_code_name"
        elif not source_listed_name or source_listed_name in {"????", "\\n"}:
            reason = "placeholder_source_name"
        elif source_listed_name != candidate:
            reason = "source_mismatch"
        else:
            reason = None
        status = "source_matched" if reason is None else "unresolved"
        coverage[status] += 1
        by_family.setdefault(family, Counter())[status] += 1
        rows.append(
            {
                "code": record["code"],
                "code_match": record["code_match"],
                "family": family,
                "pmt_id": item_id,
                "names": {"en": candidate} if reason is None else {},
                "name_status": status,
                "name_index": candidate_index if reason is None else None,
                "mapping_candidate": {
                    "rule": f"pmt_id{OFFSETS[family]:+d}",
                    "index": candidate_index,
                    "unitxt_text": candidate,
                    "solylib_base_comment": source_listed_name,
                },
                "unresolved_reason": reason,
            }
        )

    output = {
        "schema": "destiny-pmt-unitxt-names-v1",
        "sources": {
            "pmt": {"path": str(PMT.relative_to(HERE.parent)), "sha256": pmt["source"]["sha256"]},
            "en": {
                "path": source["copy"],
                "sha256": source["sha256"],
                "group": 1,
                "index": "per-item name_index, present only for source_matched rows",
                "group_length": len(names),
                "language_evidence": "English source strings include Monomate (ID 0) and Saber (ID 177).",
            },
            "code_name_cross_check": {
                "path": solylib_source["copy"],
                "sha256": solylib_source["sha256"],
                "scope": "generic base table comments before server-specific branches",
            },
        },
        "coverage": {
            "records": len(rows),
            "source_matched": coverage["source_matched"],
            "unresolved": coverage["unresolved"],
            "by_family": {k: dict(v) for k, v in sorted(by_family.items())},
            "unresolved_by_reason": dict(Counter(row["unresolved_reason"] for row in rows if row["unresolved_reason"])),
        },
        "items": rows,
    }
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
