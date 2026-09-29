"""Render an XJ or NJ model with its paired XVM textures in Blender.

Run with Blender in background mode, passing arguments after ``--``. This
uses the established bb-psov4 model reader and pso-assets XVM/DXT decoders.
"""

from __future__ import annotations

import argparse
from array import array
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

sys.dont_write_bytecode = True
siblings = Path(__file__).resolve().parents[4].parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(siblings / "bb-psov4"))
sys.path.insert(0, str(siblings / "pso-assets/tools"))
sys.path.insert(0, str(siblings / "pso-assets/ref/pso-blender/pso_blender"))
from model_adapters import read_model  # noqa: E402
from xvm_inspect import parse_xvm  # noqa: E402
from dxt import dxt1_decompress, dxt3_decompress  # noqa: E402


AXIS = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
BAMS = 2 * math.pi / 65536


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path, help="decompressed XJ or NJ model")
    parser.add_argument("texture", type=Path, help="paired decompressed XVM")
    parser.add_argument("output", type=Path, help="transparent PNG destination")
    parser.add_argument("--size", type=int, default=800)
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--primary-model-only", action="store_true", help="exclude secondary effect NJCM chunks")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])


def local_matrix(node):
    flags = node.eval_flags
    translation = Matrix.Translation(Vector((0, 0, 0) if flags & 1 else node.position))
    angles = tuple(0 if flags & 2 else angle * BAMS for angle in node.rotation)
    rotation = Euler(angles, "ZXY" if flags & 32 else "XYZ").to_matrix().to_4x4()
    scale = Matrix.Diagonal(Vector((1, 1, 1, 1) if flags & 4 else (*node.scale, 1)))
    return translation @ rotation @ scale


def decode_textures(path):
    data = path.read_bytes()
    entries = parse_xvm(data).entries
    images = []
    for index, entry in enumerate(entries):
        if entry.format not in (6, 7, 8):
            raise ValueError(f"Unsupported XVM texture format {entry.format} at slot {index}")
        payload = bytearray(data[entry.offset + 64:entry.offset + 64 + entry.data_size])
        decode = dxt1_decompress if entry.format == 6 else dxt3_decompress
        pixels = decode(payload, entry.width, entry.height)
        if entry.format == 7:  # DXT2 stores premultiplied RGB; Blender expects straight alpha.
            for offset in range(0, len(pixels), 4):
                alpha = pixels[offset + 3]
                if alpha > 0:
                    for channel in range(3):
                        pixels[offset + channel] = min(1.0, pixels[offset + channel] / alpha)
        image = bpy.data.images.new(f"texture-{index}", entry.width, entry.height, alpha=True)
        image.pixels.foreach_set(pixels)
        image.pack()
        images.append(image)
    return images


def make_material(index, primitive, images):
    texture_index = primitive.material.texture_index
    environment = any(state[:2] == (7, 1) for state in primitive.material.native_states.get("xj", []))
    if texture_index is not None:
        if not 0 <= texture_index < len(images):
            raise ValueError(f"Primitive {index} references missing XVM texture: {texture_index}")
        if environment and any(vertex.normal is None for vertex in primitive.vertices):
            raise ValueError(f"Primitive {index} requests camera-space normals but has missing normals")
        if not environment and any(vertex.uv is None for vertex in primitive.vertices):
            raise ValueError(f"Primitive {index} has no complete UV mapping")
    material = bpy.data.materials.new(f"material-{index}-texture-{texture_index}")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Roughness"].default_value = 0.65
    vertex_color = material.node_tree.nodes.new("ShaderNodeAttribute")
    vertex_color.attribute_name = "vertex_color"
    color = vertex_color.outputs["Color"]
    if texture_index is not None:
        image_node = material.node_tree.nodes.new("ShaderNodeTexImage")
        image_node.image = images[texture_index]
        image_node.interpolation = "Linear"
        if environment:
            source_normal = material.node_tree.nodes.new("ShaderNodeAttribute")
            source_normal.attribute_name = "source_normal"
            camera_normal = material.node_tree.nodes.new("ShaderNodeVectorTransform")
            camera_normal.vector_type = "NORMAL"
            camera_normal.convert_from = "WORLD"
            camera_normal.convert_to = "CAMERA"
            material.node_tree.links.new(source_normal.outputs["Vector"], camera_normal.inputs["Vector"])
            scale = material.node_tree.nodes.new("ShaderNodeVectorMath")
            scale.operation = "MULTIPLY"
            scale.inputs[1].default_value = (0.5, -0.5, 0.0)
            material.node_tree.links.new(camera_normal.outputs["Vector"], scale.inputs[0])
            bias = material.node_tree.nodes.new("ShaderNodeVectorMath")
            bias.operation = "ADD"
            bias.inputs[1].default_value = (0.5, 0.5, 0.0)
            material.node_tree.links.new(scale.outputs[0], bias.inputs[0])
            material.node_tree.links.new(bias.outputs[0], image_node.inputs["Vector"])
        color_mix = material.node_tree.nodes.new("ShaderNodeVectorMath")
        color_mix.operation = "MULTIPLY"
        material.node_tree.links.new(image_node.outputs["Color"], color_mix.inputs[0])
        material.node_tree.links.new(color, color_mix.inputs[1])
        color = color_mix.outputs[0]
    if primitive.material.diffuse[:3] != (255, 255, 255):
        diffuse = material.node_tree.nodes.new("ShaderNodeRGB")
        diffuse.outputs[0].default_value = tuple(channel / 255 for channel in primitive.material.diffuse)
        diffuse_mix = material.node_tree.nodes.new("ShaderNodeVectorMath")
        diffuse_mix.operation = "MULTIPLY"
        material.node_tree.links.new(color, diffuse_mix.inputs[0])
        material.node_tree.links.new(diffuse.outputs[0], diffuse_mix.inputs[1])
        color = diffuse_mix.outputs[0]
    material.node_tree.links.new(color, principled.inputs["Base Color"])
    material.node_tree.links.new(color, principled.inputs["Emission Color"])
    principled.inputs["Emission Strength"].default_value = 0.35
    additive_blend = (primitive.material.source_blend, primitive.material.destination_blend) == (4, 1)
    if primitive.material.use_alpha or additive_blend:
        alpha = vertex_color.outputs["Alpha"]
        if texture_index is not None:
            alpha_mix = material.node_tree.nodes.new("ShaderNodeMath")
            alpha_mix.operation = "MULTIPLY"
            material.node_tree.links.new(alpha, alpha_mix.inputs[0])
            material.node_tree.links.new(image_node.outputs["Alpha"], alpha_mix.inputs[1])
            alpha = alpha_mix.outputs[0]
        if primitive.material.use_alpha:
            material.node_tree.links.new(alpha, principled.inputs["Alpha"])
        if additive_blend:
            # PSO's blend indices 4/1 mean SRCALPHA/ONE. Preserve the
            # surface behind an additive overlay instead of occluding it.
            emission = material.node_tree.nodes.new("ShaderNodeEmission")
            material.node_tree.links.new(color, emission.inputs["Color"])
            material.node_tree.links.new(alpha, emission.inputs["Strength"])
            transparent = material.node_tree.nodes.new("ShaderNodeBsdfTransparent")
            additive = material.node_tree.nodes.new("ShaderNodeAddShader")
            material.node_tree.links.new(transparent.outputs[0], additive.inputs[0])
            material.node_tree.links.new(emission.outputs[0], additive.inputs[1])
            output = material.node_tree.nodes.get("Material Output")
            material.node_tree.links.new(additive.outputs[0], output.inputs["Surface"])
    return material


def build_object(model, images):
    vertices, uv, colors, normals, faces, face_materials, materials = [], [], [], [], [], [], []

    def visit(node, parent):
        world = parent @ local_matrix(node)
        if not node.eval_flags & 8:
            for primitive in node.primitives:
                base = len(vertices)
                material_index = len(materials)
                materials.append(make_material(material_index, primitive, images))
                vertices.extend(tuple(AXIS @ world @ Vector(v.position)) for v in primitive.vertices)
                uv.extend(v.uv or (0, 0) for v in primitive.vertices)
                colors.extend(v.color or (255, 255, 255, 255) for v in primitive.vertices)
                normal_matrix = (AXIS @ world).to_3x3().inverted().transposed()
                normals.extend(
                    normal_matrix @ Vector(v.normal) if v.normal else Vector((0, 0, 0))
                    for v in primitive.vertices
                )
                count = len(primitive.vertices)
                if primitive.topology == "triangle_strip":
                    triangles = [
                        (i - 2, i - 1, i) if (i % 2 == 0) != primitive.reversed else (i - 1, i - 2, i)
                        for i in range(2, count)
                    ]
                elif primitive.topology == "triangle_fan":
                    triangles = [(0, i - 1, i) for i in range(2, count)]
                elif primitive.topology == "triangles":
                    triangles = [(i, i + 1, i + 2) for i in range(0, count, 3)]
                else:
                    raise ValueError(f"Unsupported topology: {primitive.topology}")
                for triangle in triangles:
                    ids = tuple(base + i for i in triangle)
                    a, b, c = (Vector(vertices[i]) for i in ids)
                    if (b - a).cross(c - a).length < 1e-8:
                        continue
                    normal = sum((normals[i] for i in ids), Vector())
                    if normal.length and (b - a).cross(c - a).dot(normal) < 0:
                        ids = (ids[0], ids[2], ids[1])
                    faces.append(ids)
                    face_materials.append(material_index)
        if not node.eval_flags & 16:
            for child in node.children:
                visit(child, world)

    for root in model.roots:
        visit(root, Matrix.Identity(4))
    if not faces:
        raise ValueError("Model has no renderable triangles")
    mesh = bpy.data.meshes.new("item-mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("item", mesh)
    bpy.context.collection.objects.link(obj)
    for material in materials:
        mesh.materials.append(material)
    color_layer = mesh.color_attributes.new(name="vertex_color", type="FLOAT_COLOR", domain="CORNER")
    normal_layer = mesh.attributes.new(name="source_normal", type="FLOAT_VECTOR", domain="CORNER")
    for loop in mesh.loops:
        rgba = colors[loop.vertex_index]
        color_layer.data[loop.index].color = tuple(channel / 255 for channel in rgba)
        normal = normals[loop.vertex_index]
        normal_layer.data[loop.index].vector = normal.normalized() if normal.length else (0, 0, 0)
    mesh.color_attributes.active_color_index = 0
    uv_layer = mesh.uv_layers.new()
    for polygon, material_index in zip(mesh.polygons, face_materials):
        polygon.material_index = material_index
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            u, v = uv[mesh.loops[loop_index].vertex_index]
            uv_layer.data[loop_index].uv = (u, v)
    print(f"Textured mesh: {len(vertices)} vertices, {len(faces)} triangles, {len(materials)} materials", flush=True)
    return obj


def aim(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render(obj, output, size, samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.7, 0.7, 0.7, 1.0)
    background.inputs["Strength"].default_value = 1.0

    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector(tuple(min(point[i] for point in corners) for i in range(3)))
    high = Vector(tuple(max(point[i] for point in corners) for i in range(3)))
    center = (low + high) / 2
    extent = high - low
    scale = max(extent)
    if scale <= 0:
        raise ValueError("Model bounds are empty")

    for index, direction in enumerate(((2, -4, 5), (-3, -1, 2), (0, 4, 3))):
        light = bpy.data.lights.new(f"softbox-{index}", "AREA")
        light.energy = (700 if index == 0 else 350) * scale * scale / 9
        light.shape = "DISK"
        light.size = scale * 3
        light_obj = bpy.data.objects.new(light.name, light)
        bpy.context.collection.objects.link(light_obj)
        light_obj.location = center + Vector(direction) * scale
        aim(light_obj, center)

    camera_data = bpy.data.cameras.new("camera")
    camera = bpy.data.objects.new("camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = center + Vector((6, -2, 3)) * scale
    aim(camera, center)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = scale * 1.15
    camera_data.clip_end = scale * 100
    scene.camera = camera
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    preserve_additive_on_transparent(output)


def preserve_additive_on_transparent(output):
    """Encode additive light over black as visible straight-alpha PNG pixels.

    Cycles retains the RGB from Transparent+Emission, but writes alpha zero.
    Those pixels disappear in a browser. For each such pixel, choose the
    smallest alpha that keeps every straight RGB channel in range: max(RGB).
    This preserves the rendered color when composited over black.
    """
    image = bpy.data.images.load(str(output), check_existing=False)
    pixels = array("f", [0.0]) * (image.size[0] * image.size[1] * 4)
    image.pixels.foreach_get(pixels)
    repaired = 0
    for offset in range(0, len(pixels), 4):
        if pixels[offset + 3] != 0:
            continue
        red, green, blue = pixels[offset:offset + 3]
        alpha = min(1.0, max(red, green, blue))
        if alpha <= 0:
            continue
        pixels[offset] = red / alpha
        pixels[offset + 1] = green / alpha
        pixels[offset + 2] = blue / alpha
        pixels[offset + 3] = alpha
        repaired += 1
    if repaired:
        image.pixels.foreach_set(pixels)
        image.filepath_raw = str(output)
        image.file_format = "PNG"
        image.save()
    bpy.data.images.remove(image)
    print(f"Encoded {repaired} additive-light pixels for transparent PNG", flush=True)


def main():
    args = arguments()
    if args.size <= 0 or args.samples <= 0:
        raise ValueError("Size and samples must be positive")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    model = read_model(args.model.read_bytes())
    if model.source_format not in ("xj", "nj"):
        raise ValueError(f"Expected XJ or NJ model, got {model.source_format}")
    if args.primary_model_only:
        model.additional_roots = []
        model.additional_texture_names = []
    images = decode_textures(args.texture)
    obj = build_object(model, images)
    render(obj, args.output, args.size, args.samples)
    print(f"Rendered {args.output} with {len(images)} decoded XVM textures", flush=True)


if __name__ == "__main__":
    main()
