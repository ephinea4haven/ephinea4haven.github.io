"""Render the two omitted armor particle effects using verified client resources.

Reuses the workstation particle simulator; these are fixed-frame, body-free
previews, not an in-game capture. Normal builds need only imported WebP assets.
"""
from pathlib import Path
import hashlib
import json
import struct
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HELPERS = ROOT / 'artifacts/destiny/resources/completeness/armor-effects'
sys.path.insert(0, str(HELPERS))
import extract_effect_textures as textures
import simulate_particles as simulation
import render_particle_preview as preview
import numpy as np
import pefile
from PIL import Image

OUT = ROOT / 'artifacts/armor-renders'
ARMORS = [('CHU CHU FEVER', '01012C', 0x17D, 'chu-chu-fever', 2, 3, 1),
          ('VIRUS ARMOR: LAFUTERIA', '01012F', 0x6B, 'virus-armor-lafuteria', 1, 4, 16)]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    executable = textures.STOCK_CLIENT
    client = pefile.PE(str(executable))
    table = struct.unpack('<12I', client.get_data(0x92D1C4 - client.OPTIONAL_HEADER.ImageBase, 48))
    particle_data = textures.PARTICLES.read_bytes()
    xvm = textures.TEXTURES.read_bytes()
    entries = textures.parse_xvm(xvm).entries
    items = []
    for name, code, particle_id, stem, flags, kind, frames in ARMORS:
        assert table[int(code[-2:], 16) - 0x29] == particle_id
        effect = simulation.read_effect(particle_id)
        index, entry = next((i, e) for i, e in enumerate(entries) if e.texture_id == effect['texture_id'])
        metadata = struct.unpack('<IIIIIffIII', client.get_data(
            textures.METADATA_VA - client.OPTIONAL_HEADER.ImageBase + index * 40, 40))
        assert (metadata[0], metadata[2], metadata[3], metadata[5], metadata[6], metadata[7], metadata[9]) == (
            flags, index, frames, 16.0, 16.0, 0xFFFFFFFF, kind)
        result = simulation.simulate(effect, 0x51BB, 40, (0, 0, 0), frames, flags)
        assert result['particles']
        renderer = {'type': kind, 'frames': frames, 'spriteHalfSize': [16, 16],
                    'blend': {'src': 'SRCALPHA', 'dst': 'ONE' if flags == 1 else 'INVSRCALPHA'}}
        texture = Image.frombytes('RGBA', (entry.width, entry.height), textures.rgba_pixels(xvm, entry))
        camera = preview.choose_camera(result['particles'], renderer)
        canvas = np.zeros((preview.FRAME_SIZE, preview.FRAME_SIZE, 4), dtype=np.float32)
        for particle in result['particles']:
            frame = particle['uvFrame']
            assert 0 <= frame < frames
            if frames == 16:
                w, h = entry.width // 4, entry.height // 4
                col, row = frame % 4, frame // 4
                sprite = texture.crop((col * w, row * h, (col + 1) * w, (row + 1) * h))
            else:
                sprite = texture
            preview.draw_sprite(canvas, sprite, particle, renderer, camera)
        output = OUT / f'{stem}.png'
        Image.fromarray(preview.encode_rgba(canvas, flags == 1)).save(output)
        sidecar = output.with_suffix('.json')
        sidecar.write_text(json.dumps({
            'code': code, 'particleId': particle_id, 'particleName': effect['name'],
            'textureId': entry.texture_id, 'tableVA': '0x92D1C4',
            'selectorVA': '0x005E0FE8', 'renderer': renderer, 'camera': camera,
            'simulation': result, 'runtimeVerified': False,
        }, indent=2) + '\n')
        dependencies = [('particle_data', textures.PARTICLES), ('texture_data', textures.TEXTURES),
                        ('stock_client', executable), ('renderer', Path(__file__)),
                        ('render_sidecar', sidecar), ('simulator', Path(simulation.__file__)),
                        ('sprite_renderer', Path(preview.__file__))]
        items.append({'name': name, 'code': code, 'visualQa': 'pending',
                      'runtimeVerified': False, 'transparentBackground': True,
                      'displayBlend': 'additive' if flags == 1 else 'normal',
                      'image': {'path': str(output), 'sha256': sha(output)},
                      'dependencies': [{'role': role, 'path': str(path), 'sha256': sha(path)}
                                       for role, path in dependencies]})
        print(f'{name}: {len(result["particles"])} visible particles -> {output}', flush=True)
    (OUT / 'render-manifest.json').write_text(json.dumps({'items': items}, indent=2) + '\n')


if __name__ == '__main__':
    main()
