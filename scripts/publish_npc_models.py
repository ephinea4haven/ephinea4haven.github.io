"""Encode inspected local renders and their provenance into the site's asset directory.

This only writes the local checkout; it does not publish or deploy the website.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'artifacts/npc-models'
DEST = ROOT/'assets/img/npc'


def main():
    jobs = json.loads((ROOT/'content/npc-models.json').read_text())['jobs']
    outputs = {}
    for job in jobs:
        name = job['id']
        with Image.open(WORK/f'{name}.png') as image:
            assert image.mode == 'RGBA' and image.size == (900, 900), name
            assert image.getchannel('A').getextrema() == (0, 255), name
            assert image.getchannel('A').getbbox(), name
            filename = f'{name}-model.webp'
            image.save(DEST/filename, quality=95, method=6)
        outputs[name] = {'file': filename, 'width': 900, 'height': 900,
                         'sha256': hashlib.sha256((DEST/filename).read_bytes()).hexdigest()}
    evidence = {
        'renderer': 'Blender 5.2.2 Cycles, 64 samples, Standard view transform, transparent film',
        'camera': {'projection': 'orthographic', 'direction': 'front, eye-level', 'square_pixels': True},
        'inputs': json.loads((WORK/'source-hashes.json').read_text()),
        'characters': {job['id']: job for job in jobs},
        'outputs': outputs,
        'quests': json.loads((ROOT/'content/npc-quest-evidence.json').read_text()),
        'limits': 'Resource previews with studio lighting and base poses, not in-engine quest screenshots. Coren is one tekker appearance example. Template proportions follow QEdit preview equations.',
    }
    (DEST/'model-renders.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2)+'\n')
    print(f'Encoded {len(outputs)} local model portraits and their provenance')


if __name__ == '__main__':
    main()
