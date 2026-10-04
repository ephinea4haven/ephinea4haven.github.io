"""Render complete Dark Falz assemblies from the original BB archive in Blender.

Uses source bind poses or exact wait-frame-zero keys, not a runtime replay.
Run Blender with --python-exit-code 1 --python scripts/render_dark_falz_models.py.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'artifacts/destiny/resources/model-previews'))
import render_npc_models as meshes
import render_textured as textures
from pso_archives import bml_entries, gsl_files, pack_xvm
from pso_motion_frame import apply_frame_zero

OUT = ROOT / 'artifacts/dark-falz-renders'
CLIENT = Path('/Applications/EphineaPSO.app/Contents/SharedSupport/prefix/drive_c/EphineaPSO/data')
CONFIG = ROOT / 'content/monster-catalog/model-renders.json'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def material_factory(images):
    def material(name, primitive):
        source = primitive.material
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = nodes.get('Principled BSDF')
        bsdf.inputs['Roughness'].default_value = .7
        bsdf.inputs['Emission Strength'].default_value = .5
        if source.texture_index is None:
            bsdf.inputs['Base Color'].default_value = tuple(v / 255 for v in source.diffuse)
            return mat
        assert 0 <= source.texture_index < len(images)
        image = nodes.new('ShaderNodeTexImage')
        image.image = images[source.texture_index]
        if source.native_states.get('nj', {}).get('environment'):
            geometry = nodes.new('ShaderNodeNewGeometry')
            camera = nodes.new('ShaderNodeVectorTransform')
            camera.vector_type = 'NORMAL'
            camera.convert_from, camera.convert_to = 'WORLD', 'CAMERA'
            links.new(geometry.outputs['Normal'], camera.inputs[0])
            scale = nodes.new('ShaderNodeVectorMath'); scale.operation = 'MULTIPLY'
            scale.inputs[1].default_value = (.5, -.5, 0)
            links.new(camera.outputs[0], scale.inputs[0])
            bias = nodes.new('ShaderNodeVectorMath'); bias.operation = 'ADD'
            bias.inputs[1].default_value = (.5, .5, 0)
            links.new(scale.outputs[0], bias.inputs[0])
            links.new(bias.outputs[0], image.inputs['Vector'])
        else:
            assert all(v.uv is not None for v in primitive.vertices), name
        links.new(image.outputs['Color'], bsdf.inputs['Base Color'])
        links.new(image.outputs['Color'], bsdf.inputs['Emission Color'])
        if source.use_alpha:
            links.new(image.outputs['Alpha'], bsdf.inputs['Alpha'])
        return mat
    return material


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ephinea-data', type=Path, default=CLIENT)
    parser.add_argument('labels', nargs='*')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    OUT.mkdir(parents=True, exist_ok=True)
    loose = args.ephinea_data / 'darkfalz_dat.bml'
    archive = loose.read_bytes() if loose.exists() else gsl_files(args.ephinea_data / 'data.gsl')['darkfalz_dat.bml']
    entries = {name: (body, texture) for name, body, texture in bml_entries(archive)}
    renders = json.loads(CONFIG.read_text())['renders']
    selected = set(args.labels) if args.labels else None
    known = {label for label, job in renders.items() if job.get('renderer') == 'blender-dark-falz'}
    if selected and selected - known:
        raise ValueError(f'Unknown Dark Falz render: {selected - known}')
    for label, job in renders.items():
        if job.get('renderer') != 'blender-dark-falz' or selected is not None and label not in selected:
            continue
        assert job['archive'] == 'darkfalz_dat.bml'
        parts = [job, *job['parts']]
        bpy.ops.wm.read_factory_settings(use_empty=True)
        evidence = []
        for component in parts:
            part = component['model']
            body, texture = entries[part + '.nj']
            assert texture, part
            path = OUT / (part + '.xvm')
            path.write_bytes(pack_xvm(texture))
            images = textures.decode_textures(path)
            motion_name = component.get('motion')
            posed_body = body
            if motion_name:
                posed_body = apply_frame_zero(body, entries[motion_name + '.njm'][0])
            primitives = meshes.weighted_model(posed_body)
            obj = meshes.model_object(part, primitives, material_factory(images))
            evidence.append({'model': part, 'modelSha256': digest(body),
                             'motion': motion_name, 'frame': 0 if motion_name else None,
                             'motionSha256': digest(entries[motion_name + '.njm'][0]) if motion_name else None,
                             'textureSha256': digest(path.read_bytes()),
                             'triangles': len(obj.data.polygons), 'bones': len(meshes.BONES),
                             'environmentPrimitives': sum(p.material.native_states['nj']['environment'] for p, _ in primitives)})
        points = [obj.matrix_world @ v.co for obj in bpy.context.scene.objects if obj.type == 'MESH' for v in obj.data.vertices]
        low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
        high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
        center, size = (low + high) / 2, max(high - low)
        scene = bpy.context.scene
        scene.render.engine = 'CYCLES'; scene.cycles.samples = 64
        scene.render.resolution_x = scene.render.resolution_y = 1024
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.film_transparent = True
        scene.view_settings.view_transform = 'Standard'
        scene.world = bpy.data.worlds.new('World'); scene.world.color = (.8, .8, .8)
        camera = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
        scene.collection.objects.link(camera); scene.camera = camera
        camera.location = center + Vector((.6, -3, .65)) * size
        camera.rotation_euler = (center-camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.type = 'ORTHO'; camera.data.clip_end = size * 100
        bpy.context.view_layer.update()
        projected = [camera.matrix_world.inverted() @ p for p in points]
        midpoint = Vector(tuple((max(p[i] for p in projected) + min(p[i] for p in projected)) / 2 for i in (0, 1)) + (0,))
        camera.location += camera.matrix_world.to_3x3() @ midpoint
        camera.data.ortho_scale = max(max(p[i] for p in projected)-min(p[i] for p in projected) for i in (0, 1)) * 1.15
        for name, direction, strength in [('Key', (-.6, -1, .8), 2.8), ('Fill', (.8, -.6, -.3), .7)]:
            light = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN'))
            scene.collection.objects.link(light); light.data.energy = strength
            light.rotation_euler = (-Vector(direction)).to_track_quat('-Z', 'Y').to_euler()
        output = OUT / (label + '.png'); scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        record = {'archive': 'darkfalz_dat.bml', 'archiveSha256': digest(archive), 'parts': evidence,
                  'pose': 'exact source wait frame zero' if label == 'DarkFalzForm3' else 'source bind transforms',
                  'runtimeVerified': False,
                  'rendererSha256': digest(Path(__file__).read_bytes()),
                  'meshParserSha256': digest(Path(meshes.__file__).read_bytes()),
                  'motionParserSha256': digest((ROOT / 'scripts/pso_motion_frame.py').read_bytes()),
                  'recipe': job, 'camera': list(camera.location), 'orthoScale': camera.data.ortho_scale,
                  'imageSha256': digest(output.read_bytes())}
        output.with_suffix('.json').write_text(json.dumps(record, indent=2) + '\n')


if __name__ == '__main__':
    main()
