#!/usr/bin/env python3
"""Import the original high-resolution Episode 1 challenge maps from PDFs."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EP1_AREAS = {
    "c1.pdf": (1, 2),
    "c2.pdf": (4, 5, 6, 7, 8),
    "c3.pdf": (9, 10, 11, 12, 13),
    "c4.pdf": (14, 15, 16, 17, 18),
    "c5.pdf": (20, 21, 22, 23, 24),
    "c6.pdf": (25, 26, 27, 28, 29),
    "c7.pdf": (31, 32, 33, 34, 35),
    "c8.pdf": (36, 37, 38, 39, 40),
    "c9.pdf": (41, 42, 43, 44, 45),
}


def import_ep1(source_directory: Path) -> None:
    """Extract each PDF's embedded map images without rendering or resampling."""
    executable = shutil.which("pdfimages")
    if executable is None:
        raise RuntimeError("pdfimages from Poppler is required")

    output_directory = ROOT / "assets/img/challenge/ep1/original"
    output_directory.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="challenge-source-") as temporary:
        temporary_root = Path(temporary)
        for pdf_name, area_numbers in EP1_AREAS.items():
            pdf_path = source_directory / pdf_name
            if not pdf_path.is_file():
                raise FileNotFoundError(pdf_path)
            prefix = temporary_root / pdf_path.stem
            subprocess.run(
                [executable, "-png", str(pdf_path), str(prefix)],
                check=True,
                capture_output=True,
                text=True,
            )
            extracted = sorted(temporary_root.glob(f"{pdf_path.stem}-*.png"))
            if len(extracted) != len(area_numbers):
                raise RuntimeError(
                    f"{pdf_name}: expected {len(area_numbers)} maps, found {len(extracted)}"
                )
            for source, area_number in zip(extracted, area_numbers, strict=True):
                shutil.copyfile(source, output_directory / f"area_{area_number:02d}.png")

    imported = sorted(output_directory.glob("area_*.png"))
    expected_count = sum(len(areas) for areas in EP1_AREAS.values())
    if len(imported) != expected_count:
        raise RuntimeError(f"expected {expected_count} imported maps, found {len(imported)}")
    print(f"Imported {len(imported)} original Episode 1 maps from PDF images.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "source_directory",
        type=Path,
        help="Directory containing c1.pdf through c9.pdf",
    )
    args = parser.parse_args()
    import_ep1(args.source_directory)


if __name__ == "__main__":
    main()
