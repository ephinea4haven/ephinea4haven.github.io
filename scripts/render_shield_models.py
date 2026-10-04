"""Render catalog shields from verified BB resources with the workstation SOP.

Run in Blender with --python-exit-code 1, optionally followed by -- item-id ... .
Shields without an equipped model are recorded for the separate block-effect path.
"""

import csv
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "artifacts/destiny/resources/model-previews"))
import render_textured as renderer
from tools.psoarc.prs import decompress

OUT = ROOT / "artifacts/shield-renders"
CLIENT = ROOT.parent / "PSOBB-Haven/data"
EPHINEA = Path("/Applications/EphineaPSO.app/Contents/SharedSupport/prefix/drive_c/EphineaPSO/data")
PMT = ROOT.parent / "newserv/tools/param_dumps_ephinea/ItemPMT.prs"
REFERENCE = ROOT.parent / "bb-psov4/ref/custom_item_assets/reference/vanilla-item-model-texture.tsv"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def member(archive, slot):
    if archive[:4] != b"AFS\0" or not 0 <= slot < struct.unpack_from("<I", archive, 4)[0]:
        raise ValueError(f"Invalid AFS slot: {slot}")
    offset, size = struct.unpack_from("<II", archive, 8 + slot * 8)
    if not size or offset + size > len(archive):
        raise ValueError(f"Invalid AFS member: {slot}")
    return archive[offset:offset + size]


def extract(kind, slot, archives):
    archive, installed = archives[kind]
    compressed = member(archive, slot)
    if compressed != member(installed, slot):
        raise ValueError(f"Installed Ephinea differs: {kind} slot {slot}")
    decoded = decompress(compressed)
    output = OUT / f"{kind.lower()}-{slot}.bin"
    output.write_bytes(decoded)
    return output, {"archive": f"PSOBB-Haven/data/Item{kind}Ep4.afs", "slot": slot,
                    "archiveSha256": sha(archive), "entrySha256": sha(compressed),
                    "decodedSha256": sha(decoded), "ephineaEntryMatches": True}


def render(model, texture, output):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    parsed = renderer.read_model(model.read_bytes())
    if parsed.warnings:
        raise ValueError(f"Model warnings require review: {parsed.warnings}")
    # The workstation XJ reader retains on-disk D3DCOLOR bytes (BGRA).
    # NJ's parser already normalizes its color words, so do not swap those.
    for node in parsed.walk():
        for primitive in node.primitives:
            if "xj" in primitive.material.native_states:
                primitive.vertices = [replace(v, color=(v.color[2], v.color[1], v.color[0], v.color[3]))
                                      if v.color else v for v in primitive.vertices]
    images = renderer.decode_textures(texture)
    obj = renderer.build_object(parsed, images)
    # The client draws environment overlays over the same triangles in a second
    # pass. Separate those coincident surfaces by a numerical epsilon so Cycles
    # transmits through the overlay to the base rather than skipping both hits.
    extent = max(obj.dimensions)
    environment_materials = {i for i, m in enumerate(obj.data.materials)
                             if any(n.type == "VECT_TRANSFORM" for n in m.node_tree.nodes)}
    shifted = set()
    normals = obj.data.attributes["source_normal"]
    for polygon in obj.data.polygons:
        if polygon.material_index not in environment_materials:
            continue
        for loop_index in polygon.loop_indices:
            vertex_index = obj.data.loops[loop_index].vertex_index
            if vertex_index not in shifted:
                obj.data.vertices[vertex_index].co += normals.data[loop_index].vector * extent * 0.0001
                shifted.add(vertex_index)
    # Give additive surfaces explicit coverage instead of manufacturing alpha
    # from a finished PNG (which also exposes RGB noise in transparent pixels).
    for material in obj.data.materials:
        tree = material.node_tree
        additive = next((n for n in tree.nodes if n.type == "ADD_SHADER"), None)
        if additive is None:
            continue
        emission = next(n for n in tree.nodes if n.type == "EMISSION")
        transparent = next(n for n in tree.nodes if n.type == "BSDF_TRANSPARENT")
        color = emission.inputs["Color"].links[0].from_socket
        alpha = emission.inputs["Strength"].links[0].from_socket
        channels = tree.nodes.new("ShaderNodeSeparateXYZ")
        tree.links.new(color, channels.inputs[0])
        maximum = channels.outputs[0]
        for channel in channels.outputs[1:]:
            node = tree.nodes.new("ShaderNodeMath")
            node.operation = "MAXIMUM"
            tree.links.new(maximum, node.inputs[0])
            tree.links.new(channel, node.inputs[1])
            maximum = node.outputs[0]
        inverse = tree.nodes.new("ShaderNodeMath")
        inverse.operation = "DIVIDE"
        inverse.inputs[0].default_value = 1
        tree.links.new(maximum, inverse.inputs[1])
        normalized = tree.nodes.new("ShaderNodeVectorMath")
        normalized.operation = "SCALE"
        tree.links.new(color, normalized.inputs[0])
        tree.links.new(inverse.outputs[0], normalized.inputs[3])
        coverage = tree.nodes.new("ShaderNodeMath")
        coverage.operation = "MULTIPLY"
        coverage.use_clamp = True
        tree.links.new(maximum, coverage.inputs[0])
        tree.links.new(alpha, coverage.inputs[1])
        tree.links.remove(emission.inputs["Strength"].links[0])
        emission.inputs["Strength"].default_value = 1
        tree.links.new(normalized.outputs[0], emission.inputs["Color"])
        mix = tree.nodes.new("ShaderNodeMixShader")
        tree.links.new(coverage.outputs[0], mix.inputs[0])
        tree.links.new(transparent.outputs[0], mix.inputs[1])
        tree.links.new(emission.outputs[0], mix.inputs[2])
        tree.links.new(mix.outputs[0], tree.nodes.get("Material Output").inputs["Surface"])
    # Cycles renders both sides by default. These original meshes have closed
    # fronts/backs; showing the far-facing cap exposes duplicate ring faces.
    for material in obj.data.materials:
        tree = material.node_tree
        output_node = tree.nodes.get("Material Output")
        surface = output_node.inputs["Surface"].links[0].from_socket
        geometry = tree.nodes.new("ShaderNodeNewGeometry")
        transparent = tree.nodes.new("ShaderNodeBsdfTransparent")
        facing = tree.nodes.new("ShaderNodeMixShader")
        tree.links.new(geometry.outputs["Backfacing"], facing.inputs[0])
        tree.links.new(surface, facing.inputs[1])
        tree.links.new(transparent.outputs[0], facing.inputs[2])
        tree.links.new(facing.outputs[0], output_node.inputs["Surface"])
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    low = Vector(tuple(min(p[i] for p in corners) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in corners) for i in range(3)))
    center, scale = (low + high) / 2, max(high - low)
    camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    bpy.context.collection.objects.link(camera)
    direction = (6, -2, 3)
    camera.location = center + Vector(direction) * scale
    renderer.aim(camera, center)
    camera.data.type = "ORTHO"
    camera.data.clip_end = scale * 100
    scene.camera = camera
    bpy.context.view_layer.update()
    projected = [camera.matrix_world.inverted() @ p for p in corners]
    camera.data.ortho_scale = max(max(p[i] for p in projected) - min(p[i] for p in projected)
                                 for i in (0, 1)) * 1.15
    for index, (direction, energy) in enumerate([((2, -4, 5), 2.8), ((-3, -1, 2), 0.7)]):
        light = bpy.data.objects.new(f"light-{index}", bpy.data.lights.new(f"light-{index}", "SUN"))
        bpy.context.collection.objects.link(light)
        light.location = center + Vector(direction) * scale
        light.data.energy, light.data.angle = energy, 0.5
        renderer.aim(light, center)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return {"size": [900, 900], "samples": 64, "roots": len(parsed.roots),
            "triangles": len(obj.data.polygons), "textures": len(images),
            "camera": list(bpy.context.scene.camera.location),
            "cameraRotation": list(bpy.context.scene.camera.rotation_euler),
            "orthoScale": bpy.context.scene.camera.data.ortho_scale,
            "environmentOverlaySeparation": extent * 0.0001,
            "pose": "source model transforms; no character or runtime animation"}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(ROOT.parent / "newserv/build/newserv"), "decode-item-parameter-table",
                    str(PMT), str(OUT / "pmt.json"), "--bb"], check=True)
    pmt = json.loads((OUT / "pmt.json").read_text())["Items"]
    catalog = json.loads((ROOT / "src/app/generated/item-catalog/details.server.json").read_text())
    shields = [item for item in catalog.values() if item["category"] == "shield"]
    selected = set(sys.argv[sys.argv.index("--") + 1:]) if "--" in sys.argv else {i["id"] for i in shields}
    if not selected or selected - {i["id"] for i in shields}:
        raise ValueError("Unknown shield selection")
    with REFERENCE.open() as source:
        references = {r["item_code"]: r for r in csv.DictReader(source, delimiter="\t")}
    archives = {kind: ((CLIENT / f"Item{kind}Ep4.afs").read_bytes(),
                       (EPHINEA / f"Item{kind}Ep4.afs").read_bytes()) for kind in ("Model", "Texture")}
    inventory = []
    for item in shields:
        code = item["code"]
        params = pmt[code]
        ref = references[code]
        model_slot = params["Type"] + 354 if params["Type"] != 65535 else -1
        texture_slot = params["Skin"] + 378 if params["Skin"] != 65535 else -1
        if (int(ref["model"]), int(ref["texture"])) != (model_slot, texture_slot):
            raise ValueError(f"Reference mapping differs: {code}")
        inventory.append({"id": item["id"], "code": code, "title": item["title"],
                          "modelSlot": model_slot, "textureSlot": texture_slot,
                          "blockEffect": params["BlockEffect"],
                          "path": "equipped-model" if model_slot >= 0 else "block-effect"})
    (OUT / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
    for item in inventory:
        if item["id"] not in selected or item["path"] != "equipped-model":
            continue
        model, model_evidence = extract("Model", item["modelSlot"], archives)
        texture, texture_evidence = extract("Texture", item["textureSlot"], archives)
        output = OUT / f"{item['id']}.png"
        recipe = render(model, texture, output)
        evidence = {**item, "model": model_evidence, "texture": texture_evidence,
                    "pmtSha256": sha(PMT.read_bytes()), "referenceSha256": sha(REFERENCE.read_bytes()),
                    "recipe": recipe, "runtimeVerified": False,
                    "rendererSha256": sha(Path(__file__).read_bytes()),
                    "meshRendererSha256": sha(Path(renderer.__file__).read_bytes()),
                    "pngSha256": sha(output.read_bytes())}
        (OUT / f"{item['id']}.json").write_text(json.dumps(evidence, indent=2) + "\n")
        print(f"Shield rendered: {item['id']}", flush=True)


if __name__ == "__main__":
    main()
