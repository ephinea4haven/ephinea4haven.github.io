"""Render recovered client models without changing the shared renderer."""

import os
import subprocess
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
SHARED = HERE.parents[1] / "model-previews" / "render_textured.py"
BLENDER = Path("/Applications/Blender.app/Contents/MacOS/Blender")
JOBS = (
    ("judgement-blade", HERE / "render_relocated.py", "model_409.xj", "texture_479.xvm"),
    ("ma85-fury", HERE / "render_relocated.py", "model_416.xj", "texture_488.xvm"),
    ("last-emperor", SHARED, "model_258.xj", "texture_519_counted.xvm"),
    ("twin-cyclone", SHARED, "model_415.xj", "texture_487_counted.xvm"),
)

for name, script, model, texture in JOBS:
    output = HERE / f"{name}-candidate.png"
    environment = os.environ.copy()
    environment["BLENDER_GPU_BACKEND"] = "OPENGL"
    subprocess.run([
        str(BLENDER), "-b", "--python-exit-code", "1", "--python", str(script), "--",
        str(HERE / "assets" / model), str(HERE / "assets" / texture), str(output),
        "--size", "800", "--samples", "32",
    ], env=environment, check=True)
    image = Image.open(output).convert("RGBA")
    background = Image.new("RGBA", image.size, (26, 26, 46, 255))
    background.alpha_composite(image)
    background.convert("RGB").save(HERE / f"{name}-site.png")
    print(name, output)
