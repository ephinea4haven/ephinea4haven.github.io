"""Render shared pickup boxes with enough margin for their rotated corners."""

import sys
from pathlib import Path

import bpy

PREVIEW = Path(__file__).resolve().parent.parent / "model-previews"
sys.path.insert(0, str(PREVIEW))
import render_textured as base  # noqa: E402


base_render = base.render


def render_with_margin(obj, output, size, samples):
    base_render(obj, output, size, samples)
    bpy.context.scene.camera.data.ortho_scale *= 1.55
    bpy.ops.render.render(write_still=True)
    base.preserve_additive_on_transparent(output)


base.render = render_with_margin
base.main()
