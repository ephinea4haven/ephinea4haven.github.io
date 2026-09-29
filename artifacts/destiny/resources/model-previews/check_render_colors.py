"""Catch the Blender color-attribute regression using two known colored models."""

from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
IMAGES = HERE / "../../dropcharts/destiny/images"
CASES = {
    "RUPIKA": IMAGES / "010289_model.png",
    "ILL GILL REAPER": IMAGES / "003E03_model.png",
}


def main():
    for name, path in CASES.items():
        with Image.open(path) as image:
            if image.mode != "RGBA":
                raise AssertionError(f"{name}: expected RGBA PNG")
            opaque = 0
            colored = 0
            for r, g, b, alpha in image.getdata():
                if alpha <= 128:
                    continue
                opaque += 1
                if max(r, g, b) - min(r, g, b) > 20:
                    colored += 1
        if opaque < 3000 or colored / opaque < 0.2:
            raise AssertionError(f"{name}: textured render lost its color ({colored}/{opaque} colored pixels)")
        print(f"{name}: {colored}/{opaque} opaque pixels visibly colored")


if __name__ == "__main__":
    main()
