"""Extract local BB resources and resolved texture slots for direct Blender rendering."""
import hashlib
import json
import struct
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path[:0] = ['/Users/wangzhen/study/pso-assets/tools', '/Users/wangzhen/study/pso-assets/ref/pso-blender/pso_blender']
from xvm_inspect import parse_xvm
from dxt import dxt1_decompress, dxt3_decompress
from PIL import Image
from pso_archives import gsl_files, bml_entries

ROOT = Path(__file__).resolve().parents[1]
CLIENT = Path('/Applications/EphineaPSO.app/Contents/SharedSupport/prefix/drive_c/EphineaPSO/data')
OUT = ROOT / 'artifacts/npc-models'


def decode_textures(data, prefix):
    if data[:4] == b'XVRT':
        data = b'XVMH' + struct.pack('<II', 56, 1) + bytes(52) + data
    result = []
    for i, texture in enumerate(parse_xvm(data).entries):
        assert texture.format in (6, 7, 8), texture.format
        start = texture.offset + 64
        decoder = dxt1_decompress if texture.format == 6 else dxt3_decompress
        pixels = decoder(bytearray(data[start:start + texture.data_size]), texture.width, texture.height)
        rgba = bytes(max(0, min(255, round(v * 255))) for v in pixels)
        filename = f'{prefix}-{i}.png'
        Image.frombytes('RGBA', (texture.width, texture.height), rgba).save(OUT / filename)
        result.append(filename)
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = json.loads((ROOT/'content/npc-models.json').read_text())['jobs']
    hashes = {}
    archives = {}
    gsl = gsl_files(CLIENT/'data.gsl')
    templates = (CLIENT/'npcplayerchar.dat').read_bytes()
    (OUT/'npcplayerchar.dat').write_bytes(templates)
    hashes['npcplayerchar.dat'] = hashlib.sha256(templates).hexdigest()
    hashes['data.gsl'] = hashlib.sha256((CLIENT/'data.gsl').read_bytes()).hexdigest()
    for job in jobs:
        if 'template' in job:
            record = templates[job['template']*112:(job['template']+1)*112]
            assert record[:16].split(b'\0')[0].decode() == job['template_name']
            assert record[49] == job['class'] and record[48] == job['section_id']
            assert list(struct.unpack_from('<2f',record,72)) == job['proportions']
            fields = ['costume', 'skin', 'face', 'head', 'hair', 'hair_red', 'hair_green', 'hair_blue']
            assert dict(zip(fields, struct.unpack_from('<8H', record, 56))) == job['appearance']
        for part in job['parts']:
            if 'bml' in part:
                name, model, texture = bml_entries(gsl[part['bml']])[part['entry']]
                assert texture is not None
                hashes[f"data.gsl/{part['bml']}/{name}"] = hashlib.sha256(model).hexdigest()
                hashes[f"data.gsl/{part['bml']}/textures"] = hashlib.sha256(texture).hexdigest()
                (OUT/part['model']).write_bytes(model)
                part['textures'] = decode_textures(texture, job['id']+'-texture')
            else:
                model = (CLIENT/part['model']).read_bytes()
                hashes[part['model']] = hashlib.sha256(model).hexdigest()
                (OUT/part['model']).write_bytes(model)
                name = part['archive']
                if name not in archives:
                    archives[name] = (CLIENT/name).read_bytes()
                    hashes[name] = hashlib.sha256(archives[name]).hexdigest()
                archive = archives[name]
                assert archive[:4] == b'AFS\0'
                count = struct.unpack_from('<I', archive, 4)[0]
                textures = []
                for index in part['slots']:
                    if index is None:
                        textures.append(None)
                        continue
                    assert index < count
                    offset, size = struct.unpack_from('<II', archive, 8+index*8)
                    assert offset+size <= len(archive)
                    decoded = decode_textures(archive[offset:offset+size], f'{name}-{index}')
                    assert len(decoded) == 1
                    textures.append(decoded[0])
                part['textures'] = textures
    (OUT/'source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
    (OUT/'render-jobs.json').write_text(json.dumps(jobs,indent=2)+'\n')
    print(f'Extracted {len(jobs)} verified local NPC configurations')


if __name__ == '__main__':
    main()
