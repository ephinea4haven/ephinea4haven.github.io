#!/usr/bin/env python3
"""Extract the pinned final Episode III online/disc card catalog locally.

Binary layout: newserv Episode3/DataIndexes.hh and DataIndexes.cc. Inputs are
read-only; CI consumes the committed snapshot, not these external resources.
"""
from __future__ import annotations

import argparse
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import tempfile

try:
    from .pso_archives import prs_decompress
except ImportError:
    from pso_archives import prs_decompress

ROOT = Path(__file__).resolve().parents[1]
INPUTS = {
    "disc": ("files/PsoCardDataTbl_Base.prs", "d0e5c2fb5cd4dcb2739a7846275051550ac011c31e18860da1a258375e9fe9a3"),
    "online": ("system/ep3/card-definitions.mnr", "ea4f6e70e7f54eb2e3b457fb760b2fab34664f2601a94207a21b70a700bc8ee4"),
    "en": ("files/TextCardE.bin", "1ecd7cf481a9d69d1d5dbd27a0e59730a57e90985cb382e745547d649200efa1"),
    "ja": ("files/TextCardJ.bin", "22ad0b8e9528a422b80f7a7b3044747a287ae2282a188bd2494e862c1ed6cf0d"),
    "artwork": ("files/cardtex_full.afs", "265e4fe7f7f100890ee482741df674a7770e106f7d4157bc574d18962873ad22"),
}
TYPES = ("HUNTERS_SC", "ARKZ_SC", "ITEM", "CREATURE", "ACTION", "ASSIST")
CLASSES = dict(zip(
    (0, 1, 2, 10, 11, 12, 13, 21, 23, 24, 25, 26, 30, 31, 32, 33, 34, 35, 36, 40),
    ("HU_SC", "RA_SC", "FO_SC", "NATIVE_CREATURE", "A_BEAST_CREATURE",
     "MACHINE_CREATURE", "DARK_CREATURE", "GUARD_ITEM", "MAG_ITEM", "SWORD_ITEM",
     "GUN_ITEM", "CANE_ITEM", "ATTACK_ACTION", "DEFENSE_ACTION", "TECH",
     "PHOTON_BLAST", "CONNECT_ONLY_ATTACK_ACTION", "BOSS_ATTACK_ACTION", "BOSS_TECH", "ASSIST"),
))
RANKS = ("N1", "R1", "S", "E", "N2", "N3", "N4", "R2", "R3", "R4", "SS", "D1", "D2", "D3")
TARGETS = ("NONE", "SINGLE_RANGE", "MULTI_RANGE", "SELF", "TEAM", "EVERYONE",
           "MULTI_RANGE_ALLIES", "ALL_ALLIES", "ALL", "OWN_FCS")
GAPS = {85, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 150, 155, 159,
        168, 169, 175, 176, 181, 189, 190, 191, 194, 200, 201, 205, 206, 211,
        215, 227, 288, 327, 329, 349, 557, 671, 672, 673, 676}
DIFF_IDS = {1, 24, 57, 74, 96, 98, 108, 118, 124, 151, 157, 158, 166, 171, 185,
            212, 239, 242, 246, 247, 269, 271, 274, 275, 278, 282, 287, 301, 333,
            339, 340, 341, 342, 357, 365, 384, 386, 391, 402, 424, 444, 446, 449,
            457, 469, 473, 480, 481, 500, 502, 504, 521, 522, 532, 540, 556,
            560, 561, 583, 602, 633, 660, 686, 695, 704, 710}
EFFECT_IDS = {74, 239, 365, 481, 686, 695, 704, 710}
UNKNOWN_IDS = {71, 72, *range(74, 84), *range(682, 694)}
BOSS_ACTION_IDS = {84, *range(677, 682), *range(694, 700)}
# Cheat-only player boss SCs: newserv unavailable_sc_card_defs CASTOR_USR/POLLUX_USR.
PLAYER_BOSS_SC_IDS = {702, 703}


def checked_bytes(path: Path, expected: str) -> bytes:
    """Reject modified or wrong-version inputs before parsing or writing output."""
    data = path.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise ValueError(f"SHA-256 mismatch: {path}: expected {expected}, got {actual}")
    return data


def decode_japanese(data: bytes) -> str:
    """Strict cp932 with newserv/iconv's two used punctuation mappings.

    Every source character is independently checked against newserv's underlying
    SHIFT_JIS converter at extraction time. Sega F040-F064 are not present in
    these pinned inputs; reject those rather than accepting cp932 private use.
    """
    text = data.decode("cp932").replace("～", "〜").replace("－", "−")
    if any(ch == "\ufffd" or 0xE000 <= ord(ch) <= 0xF8FF for ch in text):
        raise ValueError("Unverified or replacement character in Japanese text")
    return text


def verify_japanese(strings: list[bytes]) -> dict:
    """Compare each used code with the SHIFT_JIS backend in newserv Text.cc."""
    codes = set()
    for data in strings:
        pos = 0
        while pos < len(data):
            size = 2 if 0x81 <= data[pos] <= 0x9F or 0xE0 <= data[pos] <= 0xFC else 1
            codes.add(data[pos:pos + size])
            pos += size
    # NUL separates codes without altering their interpretation by iconv.
    ordered = sorted(codes)
    converted = subprocess.run(
        ["iconv", "-f", "SHIFT_JIS", "-t", "UTF-8"],
        input=b"\0".join(ordered), capture_output=True, check=True,
    ).stdout.decode("utf-8").split("\0")
    expected = [decode_japanese(code) for code in ordered]
    if converted != expected:
        raise ValueError("Japanese decoding differs from newserv's SHIFT_JIS backend")
    return {"uniqueCodes": len(codes), "replacementCharacters": 0,
            "cp932Corrections": {"8160": "U+301C", "817c": "U+2212"}}


def decode_stat(code: int) -> dict:
    """Keep the operator kind and magnitude; null means the 999 unknown value."""
    kind, value = divmod(code, 1000)
    if kind > 4:
        raise ValueError(f"Invalid stat code: {code}")
    return {"kind": ("blank", "value", "plus", "minus", "equals")[kind],
            "value": None if value == 999 else (0 if kind == 0 else value)}


def decode_range(rows: tuple[int, ...]) -> dict:
    """Resolve fixed ranges and preserve the whole-field distinction."""
    fixed = 0 if rows == (0xFFFFF,) * 6 else (rows[4] >> 8) & 15
    if fixed:
        presets = {
            1: (0, 0, 0, 0x100, 0, 0), 2: (0, 0, 0, 0x1110, 0, 0),
            3: (0, 0x100, 0x100, 0x100, 0, 0),
            4: (0, 0, 0, 0x1110, 0x1010, 0x1110),
            5: (0, 0, 0x100, 0x100, 0, 0), 6: (0xFFFFF,) * 6,
            7: (0, 0, 0x100, 0x1110, 0x1010, 0x1110),
            8: (0, 0, 0, 0x1110, 0x1110, 0x1110), 9: (0,) * 6,
        }
        if fixed not in presets:
            raise ValueError(f"Invalid fixed range: {fixed}")
        rows = presets[fixed]
    return {"entireField": rows == (0xFFFFF,) * 6,
            "grid": [[bool((row >> shift) & 15) for shift in (16, 12, 8, 4, 0)] for row in rows]}


def cstring(data: bytes, encoding: str = "latin1") -> str:
    """Decode a fixed-length, NUL-terminated field."""
    value = data.split(b"\0", 1)[0]
    return decode_japanese(value) if encoding == "ja" else value.decode(encoding)


def table_records(data: bytes) -> list[bytes]:
    """Use the REL footer's root ArrayRef, not a hardcoded record count."""
    if len(data) < 32:
        raise ValueError("Truncated REL footer")
    root = struct.unpack_from(">I", data, len(data) - 16)[0]
    if root + 8 > len(data) - 32:
        raise ValueError("REL root out of bounds")
    offset, count = struct.unpack_from(">II", data, root)
    if offset + count * 0x128 > root:
        raise ValueError("Card array out of bounds")
    records = [data[p:p + 0x128] for p in range(offset, offset + count * 0x128, 0x128)]
    return [record for record in records if record[0x44] < 0x80]


def parse_card(record: bytes) -> dict:
    """Read every named gameplay field, including fields only used in diffs."""
    if len(record) != 0x128:
        raise ValueError("Invalid CardDefinition size")
    effects = []
    for offset in (0xC7, 0xE7, 0x107):
        effect = record[offset:offset + 32]
        effects.append({"effectNum": effect[0], "type": effect[1],
                        "expr": cstring(effect[2:17]), "when": effect[17],
                        "arg1": cstring(effect[18:22]), "arg2": cstring(effect[22:26]),
                        "arg3": cstring(effect[26:30]), "applyCriterion": effect[30],
                        "nameIndex": effect[31]})
    result = {
        "id": struct.unpack_from(">I", record)[0],
        "jp_name": cstring(record[4:68], "ja"), "en_name": cstring(record[160:180]),
        "type": TYPES[record[68]], "self_cost": record[69], "ally_cost": record[70],
        "left_colors": list(record[88:96]), "right_colors": list(record[96:104]),
        "top_colors": list(record[104:112]),
        "range": decode_range(struct.unpack_from(">6I", record, 112)),
        "target_mode": TARGETS[record[140]], "assist_turns": record[141],
        "cannot_move": record[142], "cannot_attack": record[143],
        "cannot_drop": record[145], "usable_criterion": record[146],
        "rank": RANKS[record[147] - 1], "class": CLASSES[struct.unpack_from(">H", record, 150)[0]],
        "assist_ai_params": struct.unpack_from(">H", record, 152)[0],
        "drop_rates": list(struct.unpack_from(">HH", record, 156)), "effects": effects,
    }
    for name, offset in zip(("hp", "ap", "tp", "mv"), (72, 76, 80, 84)):
        result[name] = decode_stat(struct.unpack_from(">H", record, offset)[0])
    return result


def read_text_records(data: bytes) -> dict[int, list[bytes]]:
    """Read aligned records and reject unterminated pages and duplicate IDs."""
    records = {}
    pos = 0
    while pos < len(data):
        end = data.index(0, pos)
        raw_id = data[pos:end]
        pos = end + 1
        if not raw_id or raw_id[0] == 0xFF:
            break
        card_id = int(raw_id.strip())
        if card_id in records:
            raise ValueError(f"Duplicate text ID: {card_id}")
        pages = []
        while True:
            end = data.index(0, pos)
            page = data[pos:end]
            pos = end + 1
            if not page:
                break
            pages.append(page)
        records[card_id] = pages
        pos = (pos + 0x3FF) & ~0x3FF
    return records


def clean_text(text: str) -> str:
    """Remove layout controls, retaining gender and applicability symbols."""
    text = re.sub(r"\tC.", "", text).replace("(Continue)", "")
    for code, symbol in {"M": "♂", "F": "♀", "O": "○", "X": "×", "I": "∞"}.items():
        text = text.replace("\t" + code, symbol)
    return text


def join_lines(lines: list[str], language: str) -> str:
    """Join prose wraps, retaining applicability rows and labelled list entries."""
    result = ""
    previous_row = False
    paragraph_break = False
    for raw in lines:
        line = raw.strip()
        if not line:
            paragraph_break = bool(result)
            continue
        row = bool(re.fullmatch(r"[^:：]+[:：]\s*[○〇×]", line))
        # Dice outcomes and numeric example equations start entries; their
        # following hard-wrapped explanation still belongs to the same entry.
        entry = bool(re.match(r"^[0-9０-９][^:：=＝]*[:：=＝]", line))
        if result:
            if paragraph_break:
                result += "\n\n"
            elif row or previous_row or entry:
                result += "\n"
            elif language == "en" and not result.endswith("-"):
                result += " "
        result += line
        previous_row = row
        paragraph_break = False
    return result


def tag_start(line: str) -> tuple[str, str] | None:
    """Recognize language-specific tag controls before stripping colours."""
    if line.startswith("\tC6"):
        return "status", clean_text(line).strip("■ ")
    cleaned = clean_text(line)
    for prefix, kind in (("\tS", "ability"), ("\tD", "note"), ("・", "note")):
        if cleaned.startswith(prefix):
            return kind, cleaned[len(prefix):].strip()
    return None


def parse_text(pages: list[bytes], language: str) -> tuple[str, dict]:
    """Parse header continuations first; page markers control body continuation.

    A repeated heading need not match the header spelling in the original game.
    Such headings are retained as separate tags rather than silently renamed.
    """
    decoded = [decode_japanese(page) if language == "ja" else page.decode("latin1") for page in pages]
    marker = "(Continue)" if language == "en" else "（次ページへ）"
    header_pages = [decoded[0]]
    next_page = 1
    while marker in header_pages[-1]:
        header_pages.append(decoded[next_page])
        next_page += 1
    lines = "\n".join(header_pages).splitlines()
    separator = next(i for i, line in enumerate(lines) if line.startswith(("---", "\tB")))
    name = (" " if language == "en" else "").join(line.strip() for line in lines[:separator] if line.strip())
    header, tags = [], []
    for line in lines[separator + 1:]:
        if marker in line or not line.strip():
            continue
        start = tag_start(line)
        if start:
            kind, title = start
            tags.append({"kind": kind, "name": title, "body": ""})
        elif tags:
            tags[-1]["name"] = join_lines([tags[-1]["name"], clean_text(line)], language)
        elif line.startswith(" ") and header:
            header[-1] = join_lines([header[-1], clean_text(line)], language)
        else:
            header.append(clean_text(line).strip())
    active = None
    continuation = False
    body_buffers = {}
    for page in decoded[next_page:]:
        lines = page.splitlines()
        start = None if continuation else tag_start(lines[0])
        if start:
            kind, title = start
            consumed = 1
            # Only coloured/indented lines extend a heading; blank lines and
            # body prose terminate it. Do not consume the next tag.
            while consumed < len(lines):
                following = lines[consumed]
                if (not following.strip() or tag_start(following)
                        or not following.startswith((" ", "\tC"))):
                    break
                title = join_lines([title, clean_text(following)], language)
                consumed += 1
            active = next((tag for tag in tags if tag["kind"] == kind and tag["name"] == title), None)
            if active is None:
                active = {"kind": kind, "name": title, "body": ""}
                tags.append(active)
            body_lines = lines[consumed:]
        elif continuation or active is not None:
            if active is None:
                raise ValueError(f"Continuation without tag: {language} {name}")
            body_lines = lines
        else:
            # Photon Blast pages have an unmarked title in both languages.
            title = clean_text(lines[0]).strip()
            if not any(line.startswith(title) for line in header):
                raise ValueError(f"Unmarked explanation: {language} {name}: {title}")
            active = {"kind": "note", "name": title, "body": ""}
            tags.append(active)
            body_lines = lines[1:]
        body_lines = [clean_text(line).replace("\tS", "") for line in body_lines if marker not in line]
        body_buffers.setdefault(id(active), []).extend(body_lines)
        continuation = marker in page
    for tag in tags:
        tag["body"] = join_lines(body_buffers.get(id(tag), []), language)
    result = {"header": header, "tags": tags}
    if "\\t" in json.dumps(result, ensure_ascii=False):
        raise ValueError(f"Unparsed text control: {language} {name}")
    return name, result


def gameplay_diff(online: dict, disc: dict) -> list[dict]:
    """Exclude names and drop rates, not changed effect internals."""
    return [{"field": key, "online": value, "disc": disc[key]}
            for key, value in online.items()
            if key not in {"id", "jp_name", "en_name", "drop_rates"} and value != disc[key]]


def build_cards(online: list[bytes], disc: list[bytes], texts: dict) -> list[dict]:
    """Combine online values, disc Japanese names, and bilingual structured text."""
    if len(online) != len(disc):
        raise ValueError("Table lengths differ")
    cards = []
    for online_raw, disc_raw in zip(online, disc):
        current, original = parse_card(online_raw), parse_card(disc_raw)
        card_id = current["id"]
        if card_id != original["id"] or current["en_name"] != original["en_name"]:
            raise ValueError("Table ID/order/name mismatch")
        names, text = {}, {}
        for language in ("en", "ja"):
            names[language], text[language] = parse_text(texts[language][card_id], language)
        names["ja"] = original["jp_name"]
        card = {key: current[key] for key in ("id", "type", "class", "rank", "hp", "ap", "tp", "mv", "range")}
        card.update({"cost": {"self": current["self_cost"], "ally": current["ally_cost"]},
                     "targetMode": current["target_mode"], "assistTurns": current["assist_turns"],
                     "cannotMove": bool(current["cannot_move"]), "cannotAttack": bool(current["cannot_attack"]),
                     "names": names, "tableName": {"en": current["en_name"]}, "text": text,
                     "hidden": (current["type"] in TYPES[:2] and names["en"] == "???")
                     or current["class"] == "BOSS_ATTACK_ACTION" or card_id in PLAYER_BOSS_SC_IDS,
                     "diff": gameplay_diff(current, original)})
        cards.append(card)
    return cards


def validate_catalog(cards: list[dict]) -> None:
    """Fail explicitly if a pinned, approved table fact changes."""
    ids = [card["id"] for card in cards]
    if len(ids) != 700 or set(ids) != set(range(1, 740)) - GAPS:
        raise ValueError("Spec 2.2 disagreement: card IDs/count")
    if {card["id"] for card in cards if card["diff"]} != DIFF_IDS:
        raise ValueError("Spec 2.2 disagreement: gameplay diff set")
    if {card["id"] for card in cards if any(d["field"] == "effects" for d in card["diff"])} != EFFECT_IDS:
        raise ValueError("Spec 2.2 disagreement: effect diff set")
    if {card["id"] for card in cards if card["hidden"]} != UNKNOWN_IDS | BOSS_ACTION_IDS | PLAYER_BOSS_SC_IDS:
        raise ValueError("Spec 4 disagreement: hidden set")


def texture_index(archive: bytes) -> dict:
    """Index embedded GVM names; AFS entry numbers alone are not card IDs."""
    if archive[:4] != b"AFS\0":
        raise ValueError("Invalid AFS magic")
    count = struct.unpack_from("<I", archive, 4)[0]
    if 8 + count * 8 > len(archive):
        raise ValueError("AFS table out of bounds")
    textures = {}
    for index in range(count):
        offset, size = struct.unpack_from("<II", archive, 8 + index * 8)
        if offset + size > len(archive):
            raise ValueError("AFS entry out of bounds")
        gvm = prs_decompress(archive[offset:offset + size])
        if gvm[:4] != b"GVMH" or struct.unpack_from(">HH", gvm, 8) != (15, 1):
            raise ValueError(f"Unexpected GVM header: entry {index}")
        name = cstring(gvm[14:42], "ascii")
        texture = 8 + struct.unpack_from("<I", gvm, 4)[0]
        if gvm[texture:texture + 4] != b"GVRT" or gvm[texture + 11] != 14:
            raise ValueError(f"Expected CMPR GVRT: entry {index}")
        dimensions = struct.unpack_from(">HH", gvm, texture + 12)
        if name in textures:
            raise ValueError(f"Duplicate texture: {name}")
        textures[name] = {"entry": index, "data": gvm, "size": dimensions,
                          "payload": gvm[texture + 16:]}
    return textures


def assemble_tiles(tiles: list):
    """Assemble four native 256px tiles, cropping only bottom padding."""
    from PIL import Image

    if len(tiles) != 4 or any(tile.size != (256, 256) for tile in tiles):
        raise ValueError("Large artwork requires four 256x256 tiles")
    image = Image.new("RGB", (512, 512))
    for index, tile in enumerate(tiles):
        image.paste(tile, ((index % 2) * 256, (index // 2) * 256))
    return image.crop((0, 0, 512, 399))


def build_artwork(archive: bytes, cards: list[dict], gvmdump: Path, output: Path) -> dict:
    """Decode with gvmdump and choose the largest actual artwork for each ID.

    C tiles use 64px logo placeholders where large art is absent. L_000 is
    the medium logo placeholder. Never emit those as a card illustration.
    """
    from PIL import Image

    textures = texture_index(archive)
    placeholder = textures["L_000"]["payload"]
    if len(textures) != 4986:
        raise ValueError("Spec 2.2 disagreement: artwork entry count")
    output.mkdir(parents=True, exist_ok=True)
    total = count = 0
    missing = []
    with tempfile.TemporaryDirectory(prefix="ep3-gvmdump-") as temporary:
        directory = Path(temporary)

        def decode(name: str):
            """Keep gvmdump output entirely inside temporary storage."""
            gvm = directory / f"{name}.gvm"
            gvm.write_bytes(textures[name]["data"])
            subprocess.run([str(gvmdump), str(gvm)], capture_output=True, check=True)
            with Image.open(str(gvm) + f"_{name}.gvr.bmp") as decoded:
                image = decoded.convert("RGB")
            for file in directory.iterdir():
                file.unlink()
            return image

        for card in cards:
            card_id = card["id"]
            tiles = [f"C_{card_id:03}_{index:02}" for index in range(4)]
            medium_name = f"L_{card_id:03}"
            tile_sizes = {textures[name]["size"] for name in tiles}
            if tile_sizes not in ({(256, 256)}, {(64, 64)}):
                raise ValueError(f"Mixed or unexpected tile sizes: {card_id}")
            has_large = tile_sizes == {(256, 256)}
            if not has_large and any(textures[name]["payload"] != textures["C_001_00"]["payload"] for name in tiles):
                raise ValueError(f"Unrecognized small large-art slot: {card_id}")
            has_medium = textures[medium_name]["payload"] != placeholder
            if not has_large and not has_medium:
                missing.append(card_id)
                continue
            large = assemble_tiles([decode(name) for name in tiles]) if has_large else None
            medium = decode(medium_name).crop((0, 0, 184, 144)) if has_medium else large.resize((184, 144), Image.Resampling.LANCZOS)
            sources = tiles if has_large else [medium_name]
            card["images"] = {}
            for variant, image, quality in (("medium", medium, 82), ("large", large, 78)):
                if image is None:
                    continue
                path = output / f"{card_id}-{variant}.webp"
                image.save(path, "WEBP", quality=quality, method=6)
                size = path.stat().st_size
                total += size
                count += 1
                used = [medium_name] if variant == "medium" and has_medium else sources
                card["images"][variant] = {
                    "path": f"/assets/img/ep3-cards/{path.name}", "width": image.width,
                    "height": image.height, "bytes": size,
                    "textures": used, "entries": [textures[name]["entry"] for name in used],
                }
    expected = {Path(image["path"]).name for card in cards for image in card.get("images", {}).values()}
    for path in output.glob("*.webp"):
        if path.name not in expected:
            path.unlink()
    return {"imageCount": count, "totalBytes": total, "missingCardIds": missing,
            "largeQuality": 78, "mediumQuality": 82, "method": 6,
            "nativeLargeCards": sum(card.get("images", {}).get("large", {}).get("width") == 512 for card in cards)}


def main() -> None:
    """Validate pinned inputs and write a reproducible, reviewable snapshot."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--psoep3-root", type=Path, required=True)
    parser.add_argument("--newserv-root", type=Path, required=True)
    parser.add_argument("--gvmdump", type=Path, required=True)
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--output", type=Path, default=ROOT / "content/ep3-card-catalog/cards.json")
    parser.add_argument("--image-dir", type=Path, default=ROOT / "assets/img/ep3-cards")
    args = parser.parse_args()
    inputs = {key: checked_bytes((args.newserv_root if key == "online" else args.psoep3_root) / path, sha)
              for key, (path, sha) in INPUTS.items()}
    disc, online = (table_records(prs_decompress(inputs[key])) for key in ("disc", "online"))
    texts = {language: read_text_records(inputs[language]) for language in ("en", "ja")}
    japanese = verify_japanese([page for pages in texts["ja"].values() for page in pages]
                              + [record[4:68].split(b"\0", 1)[0] for record in disc])
    cards = build_cards(online, disc, texts)
    validate_catalog(cards)
    artwork = build_artwork(inputs["artwork"], cards, args.gvmdump, args.image_dir)
    commit = subprocess.run(["git", "-C", str(args.newserv_root), "rev-parse", "HEAD"],
                            capture_output=True, text=True, check=True).stdout.strip()
    snapshot = {"metadata": {"generatedAt": args.date, "version": "GPSE8P", "stats": "online",
                             "newservCommit": commit, "onlineTableCommit": "e858b79b",
                             "inputs": {key: {"path": path, "sha256": sha} for key, (path, sha) in INPUTS.items()},
                             "japaneseDecoding": japanese, "artwork": artwork}, "cards": cards}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(cards)} cards to {args.output}")
    print(f"Artwork: {artwork}")


if __name__ == "__main__":
    main()
