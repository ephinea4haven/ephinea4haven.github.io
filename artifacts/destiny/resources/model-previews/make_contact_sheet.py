"""Make a labeled QA sheet from rendered jobs, including rejected placeholders."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
CELL_W, CELL_H = 300, 320
IMAGE_SIDE = 270


def font(size: int):
    for name in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def lines(draw, text, max_width, selected_font):
    result = []
    current = ""
    for word in text.split():
        trial = (current + " " + word).strip()
        if current and draw.textbbox((0, 0), trial, font=selected_font)[2] > max_width:
            result.append(current)
            current = word
        else:
            current = trial
    if current:
        result.append(current)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jobs", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--site-background", action="store_true", help="composite images on the site's dark image background")
    args = parser.parse_args()
    jobs = json.loads(args.jobs.read_text(encoding="utf-8"))["jobs"]
    columns = 5
    rows = math.ceil(len(jobs) / columns)
    heading = 55
    sheet = Image.new("RGB", (columns * CELL_W, rows * CELL_H + heading), "#20242b")
    draw = ImageDraw.Draw(sheet)
    title_font, label_font, note_font = font(24), font(17), font(14)
    rejected = sum(job["visual_qa"] == "rejected" for job in jobs)
    draw.text((18, 13), f"Destiny model previews | {len(jobs) - rejected} approved | {rejected} rejected", fill="white", font=title_font)

    for index, job in enumerate(jobs):
        x = index % columns * CELL_W
        y = index // columns * CELL_H + heading
        draw.rectangle((x + 3, y + 3, x + CELL_W - 3, y + CELL_H - 3), fill="#2d323a", outline="#545d69")
        image_x = x + (CELL_W - IMAGE_SIDE) // 2
        image_y = y + 9
        tile = Image.new("RGB", (IMAGE_SIDE, IMAGE_SIDE), "#1a1a2e" if args.site_background else "#b5b8bc")
        tile_draw = ImageDraw.Draw(tile)
        if not args.site_background:
            for cy in range(0, IMAGE_SIDE, 20):
                for cx in range(0, IMAGE_SIDE, 20):
                    if (cx // 20 + cy // 20) % 2:
                        tile_draw.rectangle((cx, cy, cx + 19, cy + 19), fill="#d6d8db")

        if job["visual_qa"] == "rejected":
            tile_draw.rectangle((0, 0, IMAGE_SIDE - 1, IMAGE_SIDE - 1), outline="#aa5c5c", width=3)
            tile_draw.text((12, 12), "REJECTED", fill="#ffaaaa" if args.site_background else "#8c1d1d", font=label_font)
            reason = job.get("visual_qa_reason", "Render rejected")
            for line_index, line in enumerate(lines(tile_draw, reason, IMAGE_SIDE - 24, note_font)[:9]):
                tile_draw.text((12, 43 + line_index * 22), line, fill="white" if args.site_background else "#232323", font=note_font)
        else:
            source = (HERE / job["output"]).resolve()
            if not source.is_file():
                raise FileNotFoundError(f"Missing render for {job['item']}: {source}")
            image = Image.open(source).convert("RGBA")
            bounds = image.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"Empty alpha for {job['item']}")
            image = image.crop(bounds)
            image.thumbnail((IMAGE_SIDE - 20, IMAGE_SIDE - 20), Image.Resampling.LANCZOS)
            tile.paste(image, ((IMAGE_SIDE - image.width) // 2, (IMAGE_SIDE - image.height) // 2), image)
        sheet.paste(tile, (image_x, image_y))
        label = job["item"]
        for line_index, line in enumerate(lines(draw, label, CELL_W - 20, label_font)[:2]):
            draw.text((x + 10, y + 284 + line_index * 20), line, fill="white", font=label_font)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output)
    print(f"Saved {args.output}: {len(jobs) - rejected} approved, {rejected} rejected")


if __name__ == "__main__":
    main()
