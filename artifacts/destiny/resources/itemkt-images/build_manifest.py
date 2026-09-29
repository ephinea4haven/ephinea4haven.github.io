#!/usr/bin/env python3
"""Index and summarize archive-order ItemKT PNGs from dump_item_textures.py."""

import hashlib
import importlib.util
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
RESOURCES = HERE.parent
DECODER = Path("/Users/wangzhen/study/gc-psov3/tools/dolphin-re/dump_item_textures.py")
ENTRY_RE = re.compile(r"^entry_(\d{4})_off([0-9a-f]{8})_size([0-9a-f]{8})_block(\d{2})_\d+x\d+_fmt[0-9a-f]{2}\.png$")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_parser():
    spec = importlib.util.spec_from_file_location("dump_item_textures", DECODER)
    module = importlib.util.module_from_spec(spec)
    import sys

    sys.path.insert(0, str(DECODER.parent))
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.parse_afs


def make_contact_sheet(archive: str, images: list[tuple[int, Path]]) -> str:
    columns, cell_width, cell_height = 12, 108, 116
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#20242a")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for position, (entry_index, path) in enumerate(images):
        x = position % columns * cell_width
        y = position // columns * cell_height
        with Image.open(path) as opened:
            thumb = opened.convert("RGBA")
            thumb.thumbnail((100, 94), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", thumb.size, "#343a42")
        tile.alpha_composite(thumb)
        sheet.paste(tile.convert("RGB"), (x + (cell_width - thumb.width) // 2, y + 2))
        draw.text((x + 5, y + 98), f"{entry_index:04d}", fill="white", font=font)
    output = HERE / f"{archive}-contact-sheet.png"
    sheet.save(output, optimize=True)
    return output.name


def main() -> None:
    parse_afs = load_parser()
    inventory = json.loads((RESOURCES / "inventory.json").read_text())
    expected_hashes = {item["copy"]: item["sha256"] for item in inventory["files"] if item["copy"]}
    result = {"schema": "destiny-itemkt-archive-images-v1", "decoder": str(DECODER), "archives": {}}
    for archive in ("ItemKT", "ItemKTep4"):
        source = RESOURCES / "originals" / f"{archive}.afs"
        data = source.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected_hashes[str(source.relative_to(RESOURCES))]:
            raise ValueError(f"source hash does not match inventory: {source}")
        entries = parse_afs(data)
        image_dir = HERE / archive
        by_entry: dict[int, list[Path]] = {}
        for path in sorted(image_dir.glob("*.png")):
            match = ENTRY_RE.fullmatch(path.name)
            if match is None:
                raise ValueError(f"unexpected image filename: {path}")
            index, offset, size, _block = (int(value, 16 if n in (1, 2) else 10) for n, value in enumerate(match.groups()))
            entry = entries[index]
            if (entry.offset, entry.size) != (offset, size):
                raise ValueError(f"entry metadata disagrees for {path}")
            by_entry.setdefault(index, []).append(path)

        rows = []
        contact_images = []
        for entry in entries:
            files = by_entry.get(entry.index, [])
            pngs = []
            for path in files:
                with Image.open(path) as image:
                    image.verify()
                with Image.open(path) as image:
                    dimensions = [image.width, image.height]
                pngs.append({"path": str(path.relative_to(HERE)), "sha256": sha256(path), "dimensions": dimensions})
                contact_images.append((entry.index, path))
            blob = data[entry.offset : entry.offset + entry.size]
            rows.append(
                {
                    "entry": entry.index,
                    "offset": entry.offset,
                    "size": entry.size,
                    "entry_sha256": hashlib.sha256(blob).hexdigest(),
                    "name": entry.name,
                    "decode_status": "decoded" if pngs else "unsupported_by_existing_decoder",
                    "entry_head_hex": blob[:16].hex() if not pngs else None,
                    "images": pngs,
                }
            )
        sheet = make_contact_sheet(archive, contact_images)
        result["archives"][archive] = {
            "source": str(source.relative_to(RESOURCES)),
            "sha256": hashlib.sha256(data).hexdigest(),
            "entry_count": len(entries),
            "decoded_entry_count": sum(bool(row["images"]) for row in rows),
            "image_count": len(contact_images),
            "contact_sheet": sheet,
            "contact_sheet_sha256": sha256(HERE / sheet),
            "entries": rows,
        }
    (HERE / "manifest.json").write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
