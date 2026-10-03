"""Render paired Mechguns from local BB assets; run with Blender --python-exit-code 1.

Uses the workstation's existing XJ/texture renderer. Outputs scratch PNGs and
source/assembly evidence; normal site builds do not need Blender or game data.
"""

import csv
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "artifacts/destiny/resources/model-previews"))
import render_textured as renderer
from tools.psoarc.prs import decompress

OUT = ROOT / "artifacts/mechgun-renders"
CLIENT = ROOT.parent / "PSOBB-Haven/data"
PMT = ROOT.parent / "newserv/tools/param_dumps_ephinea/ItemPMT.prs"
REFERENCE = ROOT.parent / "bb-psov4/ref/custom_item_assets/reference/vanilla-item-model-texture.tsv"
ITEMS = {
    "000800": "mechgun", "000801": "assault", "000802": "repeater",
    "000803": "gatling", "000804": "vulcan", "007700": "es-mechgun",
    "00EA00": "typeme-mechgun",
}
# The stored weapon has Z up and its barrel along -Y. The existing loader first
# converts PSO Y up to Blender Z up; undo that attachment basis for this display.
DISPLAY_BASIS = Matrix(((0, 0, 1, 0), (-1, 0, 0, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
ASSEMBLY = [
    {"location": [-1.3, 0, 1.6], "rotationZ": 0.05},
    {"location": [1.3, -0.3, -1.6], "rotationZ": 0.50},
]


def sha(data):
    """Hash a source or output without modifying it."""
    return hashlib.sha256(data).hexdigest()


def extract(kind):
    """Extract and validate the shared slot against the installed Ephinea client."""
    archive_path = CLIENT / f"Item{kind}Ep4.afs"
    archive = archive_path.read_bytes()
    if archive[:4] != b"AFS\0" or struct.unpack_from("<I", archive, 4)[0] <= 7:
        raise ValueError(f"Invalid AFS: {archive_path}")
    offset, size = struct.unpack_from("<II", archive, 8 + 7 * 8)
    if size == 0 or offset + size > len(archive):
        raise ValueError(f"Invalid slot 7: {archive_path}")
    compressed = archive[offset:offset + size]
    ephinea = Path("/Applications/EphineaPSO.app/Contents/SharedSupport/prefix/drive_c/EphineaPSO/data")
    other = (ephinea / archive_path.name).read_bytes()
    other_offset, other_size = struct.unpack_from("<II", other, 8 + 7 * 8)
    if compressed != other[other_offset:other_offset + other_size]:
        raise ValueError(f"Ephinea slot differs from reference: {kind}")
    data = decompress(compressed)
    target = OUT / f"mechgun.{kind.lower()}"
    target.write_bytes(data)
    return target, {
        "archive": str(archive_path.relative_to(ROOT.parent)), "slot": 7,
        "archiveSha256": sha(archive), "entrySha256": sha(compressed),
        "decodedSha256": sha(data), "ephineaEntryMatches": True,
    }


def make_pair(model_path, texture_path, photon):
    """Assemble two complete instances, retaining the body's inherited material."""
    model = renderer.read_model(model_path.read_bytes())
    if len(model.roots) != 1 or len(model.root.primitives) != 2 or len(model.root.children) != 2:
        raise ValueError("Unexpected Mechgun model layout")
    # XJ's second body strip inherits texture 0 from the preceding strip.
    first, second = model.root.primitives
    if first.material.texture_index != 0 or second.material.native_states["xj"]:
        raise ValueError("Unexpected Mechgun material state")
    second.material.texture_index = 0
    obj = renderer.build_object(model, renderer.decode_textures(texture_path))
    obj.data.transform(DISPLAY_BASIS)
    points = [v.co for v in obj.data.vertices]
    center = Vector(tuple((min(v[i] for v in points) + max(v[i] for v in points)) / 2 for i in range(3)))
    obj.data.transform(Matrix.Translation(-center))
    # The last child is the untextured photon rail. Use the PMT's bright phase;
    # this is an offline static preview, not a reproduction of the client pulse.
    rail = obj.data.materials[-1]
    nodes = rail.node_tree.nodes
    nodes.clear()
    emission = nodes.new("ShaderNodeEmission")
    alpha, red, green, blue = photon["UnknownA2"]
    # PMT channels are display colors; Blender shader inputs are scene linear.
    linear = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
                   for c in (red, green, blue))
    emission.inputs["Color"].default_value = (*linear, alpha)
    emission.inputs["Strength"].default_value = 1
    output = nodes.new("ShaderNodeOutputMaterial")
    rail.node_tree.links.new(emission.outputs[0], output.inputs["Surface"])
    pair = [obj, obj.copy()]
    bpy.context.collection.objects.link(pair[1])
    for index, (gun, placement) in enumerate(zip(pair, ASSEMBLY, strict=True)):
        gun.name = f"mechgun-{index + 1}"
        gun.location = placement["location"]
        gun.rotation_euler.z = placement["rotationZ"]
    bpy.context.view_layer.update()
    return pair


def render_pair(pair, output):
    """Frame both complete guns in the catalog's 4:3 aspect ratio."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    camera = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
    bpy.context.collection.objects.link(camera)
    camera.location = (0, -18, 8)
    renderer.aim(camera, Vector((0, 0, 0)))
    camera.data.type = "ORTHO"
    scene.camera = camera
    bpy.context.view_layer.update()
    corners = [camera.matrix_world.inverted() @ gun.matrix_world @ Vector(corner)
               for gun in pair for corner in gun.bound_box]
    width = max(p.x for p in corners) - min(p.x for p in corners)
    height = max(p.y for p in corners) - min(p.y for p in corners)
    center = Vector(((min(p.x for p in corners) + max(p.x for p in corners)) / 2,
                     (min(p.y for p in corners) + max(p.y for p in corners)) / 2, 0))
    camera.location += camera.rotation_euler.to_matrix() @ center
    camera.data.ortho_scale = max(width, height * 4 / 3) * 1.10
    for index, (location, energy) in enumerate([((-4, -6, 8), 2.8), ((4, -2, 3), 0.7)]):
        light = bpy.data.objects.new(f"light-{index}", bpy.data.lights.new(f"light-{index}", "SUN"))
        bpy.context.collection.objects.link(light)
        light.location = location
        light.data.energy = energy
        light.data.angle = 0.5
        renderer.aim(light, Vector())
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return {"instances": len(pair), "trianglesPerInstance": len(pair[0].data.polygons),
            "placement": ASSEMBLY, "camera": list(camera.location),
            "cameraRotation": list(camera.rotation_euler), "orthoScale": camera.data.ortho_scale,
            "size": [1024, 768], "samples": 64, "photonPhase": "UnknownA2"}


def main():
    """Render selected IDs, retaining auditable sources and assembly settings."""
    selected = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(ITEMS.values())
    if not selected or set(selected) - set(ITEMS.values()):
        raise ValueError("Select known Mechgun IDs")
    OUT.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(ROOT.parent / "newserv/build/newserv"), "decode-item-parameter-table",
                    str(PMT), str(OUT / "pmt.json"), "--bb"], check=True)
    pmt = json.loads((OUT / "pmt.json").read_text())
    with REFERENCE.open() as source:
        reference = {r["item_code"]: r for r in csv.DictReader(source, delimiter="\t")}
    model_path, model_evidence = extract("Model")
    texture_path, texture_evidence = extract("Texture")
    for code, item_id in ITEMS.items():
        if item_id not in selected:
            continue
        params = pmt["Items"][code]
        if (params["Type"], params["Skin"], params["WeaponKind"]) != (7, 7, 8):
            raise ValueError(f"Not a verified Mechgun: {code}")
        if (reference[code]["model"], reference[code]["texture"]) != ("7", "7"):
            raise ValueError(f"Reference slots disagree: {code}")
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete(use_global=False)
        photon = pmt["PhotonColors"][params["Photon"]]
        pair = make_pair(model_path, texture_path, photon)
        output = OUT / f"{item_id}.png"
        recipe = render_pair(pair, output)
        evidence = {"code": code, "model": model_evidence, "texture": texture_evidence,
                    "pmt": {"path": str(PMT.relative_to(ROOT.parent)), "sha256": sha(PMT.read_bytes()),
                            "photonIndex": params["Photon"], "photon": photon},
                    "recipe": recipe, "runtimeVerified": False,
                    "rendererSha256": sha(Path(__file__).read_bytes()),
                    "meshRendererSha256": sha(Path(renderer.__file__).read_bytes()),
                    "pngSha256": sha(output.read_bytes())}
        (OUT / f"{item_id}.json").write_text(json.dumps(evidence, indent=2) + "\n")


if __name__ == "__main__":
    main()
