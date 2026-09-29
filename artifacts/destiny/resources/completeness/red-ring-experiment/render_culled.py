"""Test a one-sided XJ rendering hypothesis.

This experiment leaves the shared renderer unchanged. The XJ parser does not
decode a source cull flag: its `double_sided=False` is the IR default, so this
image is not a verified client render and must not be published as one.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "model-previews"))

import render_textured as base  # noqa: E402


original_make_material = base.make_material


def make_material(index, primitive, images):
    material = original_make_material(index, primitive, images)
    if primitive.material.double_sided:
        return material
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    output = nodes.get("Material Output")
    old_surface = output.inputs["Surface"].links[0].from_socket
    geometry = nodes.new("ShaderNodeNewGeometry")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    cull = nodes.new("ShaderNodeMixShader")
    links.new(geometry.outputs["Backfacing"], cull.inputs[0])
    links.new(old_surface, cull.inputs[1])
    links.new(transparent.outputs[0], cull.inputs[2])
    links.new(cull.outputs[0], output.inputs["Surface"])
    return material


base.make_material = make_material
base.main()
