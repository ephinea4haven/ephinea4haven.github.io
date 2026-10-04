"""Render original shield block bursts as fixed-frame, body-free previews.

The shield helper calls 0050BD5C with flag 4 (one-shot emitter). Each record
provides eight particle slots and initial/repeat delays. Type-0 particles reuse
our audited simulator; group 18 additionally follows the stock type-2
constructor/update/render path (0051145C / 0051095C / 00511004).
Positions are centered without a player model. Evidence records source hashes,
seed, frame and limitations. These are effects, not persistent equipped models.
"""
from pathlib import Path
import hashlib
import json
import math
from types import SimpleNamespace
import struct
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HELPERS = ROOT / 'artifacts/destiny/resources/completeness/armor-effects'
sys.path.insert(0, str(HELPERS))
import simulate_particles as simulation
import extract_effect_textures as textures
import render_particle_preview as preview
import numpy as np
from PIL import Image
import pefile


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    source = Path('/tmp/haven-equipment-gsl')
    out = ROOT / 'artifacts/shield-renders'
    resources = {name: (source / name).read_bytes() for name in
                 ('itemshieldentry.dat', 'particleentry.dat', 'effect_nt.xvm')}
    for name, data in resources.items():
        if data != (ROOT / 'artifacts/destiny/resources/gsl-extracted' / name).read_bytes():
            raise ValueError(f'Source helper resource differs: {name}')
    executable = textures.STOCK_CLIENT.read_bytes()
    pe = pefile.PE(data=executable)
    xvm = resources['effect_nt.xvm']
    texture_entries = textures.parse_xvm(xvm).entries
    inventory = json.loads((out / 'inventory.json').read_text())
    groups = sorted({i['blockEffect'] for i in inventory if i['path'] == 'block-effect'})
    for group in groups:
        block = struct.unpack_from('<11i', resources['itemshieldentry.dat'], group * 44)
        ids = [i for i in block[:8] if i >= 0]
        assert ids and block[8] == 0 and block[9] >= 0 and block[10] > 0
        sample = 5 if group == 6 else 3
        rng = simulation.ClientRandom(0x51BB)
        sprites = []
        for cycle in range(block[10]):
            born = cycle * (block[9] + 1)
            if born >= sample:
                continue
            for particle_id in ids:
                record = resources['particleentry.dat'][particle_id * 152:(particle_id + 1) * 152]
                particle_type = struct.unpack_from('<I', record, 16)[0]
                if particle_type == 0:
                    effect = simulation.read_effect(particle_id)
                else:
                    # The sole type-2 member in these shields: geffect04.
                    assert particle_id == 0x1B7 and particle_type == 2
                    import simulate_type1 as fields
                    effect = {'index': particle_id}
                    for n, name in enumerate(fields.FIELDS):
                        effect[name] = struct.unpack_from('<I' if n in fields.INTEGER_FIELDS else '<f', record, 16 + n * 4)[0]
                index, entry = next((i, e) for i, e in enumerate(texture_entries) if e.texture_id == effect['texture_id'])
                offset = pe.get_offset_from_rva(textures.METADATA_VA - pe.OPTIONAL_HEADER.ImageBase + index * 40)
                flags, _, renderer_index, frames, _, width, height, color, _, kind = struct.unpack_from('<IIIIIffIII', executable, offset)
                assert flags == 1 and renderer_index == index and color == 0xFFFFFFFF and kind in (3, 4) and frames in (1, 16)
                renderer = {'type': kind, 'frames': frames, 'spriteHalfSize': [width, height], 'blend': {'src': 'SRCALPHA', 'dst': 'ONE'}}
                texture = Image.frombytes('RGBA', (entry.width, entry.height), textures.rgba_pixels(xvm, entry))
                assert effect['creat'] == 0
                for _ in range(max(1, math.trunc(effect['number']))):
                    age_frames = sample - born
                    if particle_type == 0:
                        particle = simulation.spawn(effect, (0, 0, 0), rng, born, frames)
                        alive = True
                        for _ in range(age_frames):
                            alive = simulation.advance(particle, effect, frames)
                            if not alive:
                                break
                        if not alive:
                            continue
                        result = {'x': particle.x, 'y': particle.y, 'z': particle.z,
                                  'scale': particle.scale, 'rgba': simulation.color(particle, effect, flags),
                                  'angle': particle.angle, 'uvFrame': particle.frame}
                    else:
                        # 0051145C constructor and 0051095C update: move toward
                        # the burst origin, with an accelerating lerp factor.
                        position = np.array([(rng.unit() - 0.5) * effect[k] for k in ('x_variation', 'y_variation', 'z_variation')])
                        scale = effect['scale_x'] + rng.unit() * effect['scale_y']
                        lifetime = math.trunc(effect['duration'] + rng.unit() * effect['appear'])
                        speed = effect['vacume'] + rng.unit() * effect['speed_x']
                        if age_frames >= lifetime:
                            continue
                        for _ in range(age_frames):
                            speed *= effect['gamma']
                            velocity = -position * speed
                            position += velocity
                            scale *= effect['scale_z']
                        length = float(np.linalg.norm(velocity))
                        if length == 0:
                            continue
                        age = age_frames / lifetime
                        pitch = math.radians(preview.CAMERA_PITCH_DEGREES)
                        angle = math.atan2(-(velocity[1] * math.cos(pitch) - velocity[2] * math.sin(pitch)), velocity[0])
                        result = dict(zip(('x', 'y', 'z'), map(float, position)))
                        result.update(scale=scale, scaleX=effect['radius'] * length, scaleY=effect['opt1'] * length,
                                      rgba=simulation.color(SimpleNamespace(age=age), effect, flags),
                                      angle=math.trunc(angle * 65536 / math.tau), uvFrame=0)
                    if frames == 16:
                        frame = result['uvFrame']
                        tw, th = entry.width // 4, entry.height // 4
                        col, row = frame % 4, frame // 4
                        sprite_texture = texture.crop((col * tw, row * th, (col + 1) * tw, (row + 1) * th))
                    else:
                        sprite_texture = texture
                    sprites.append((result, renderer, sprite_texture))
        assert sprites, f'No visible particles for block effect {group}'
        bounds_renderer = {'type': 4, 'spriteHalfSize': [max(r['spriteHalfSize'][n] for _, r, _ in sprites) for n in (0, 1)]}
        camera = preview.choose_camera([p for p, _, _ in sprites], bounds_renderer)
        canvas = np.zeros((preview.FRAME_SIZE, preview.FRAME_SIZE, 4), dtype=np.float32)
        for particle, renderer, texture in sprites:
            preview.draw_sprite(canvas, texture, particle, renderer, camera)
        image = out / f'block-effect-{group}.png'
        Image.fromarray(preview.encode_rgba(canvas, True)).save(image)
        evidence = {'kind': 'block-effect', 'blockEffect': group, 'particleIds': ids,
                    'sourceHashes': {n: sha(d) for n, d in resources.items()},
                    'clientSha256': sha(executable), 'rendererSha256': sha(Path(__file__).read_bytes()),
                    'pngSha256': sha(image.read_bytes()), 'transparentBackground': True,
                    'runtimeVerified': False, 'frame': sample, 'seed': 0x51BB,
                    'emitterFrames': [n * (block[9] + 1) for n in range(block[10])],
                    'camera': camera,
                    'limitations': 'Offline fixed-frame block burst; no player model, bone pose or global RNG replay. Not a persistent equipped model.'}
        image.with_suffix('.json').write_text(json.dumps(evidence, indent=2) + '\n')
        print(image)



if __name__ == '__main__':
    main()
