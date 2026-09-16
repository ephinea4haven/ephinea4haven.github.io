import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const installer = path.resolve('scripts/install_hd_gallery.mjs');
const saber = fs.readFileSync('assets/img/items/hd/items/saber.webp');
const sword = fs.readFileSync('assets/img/items/hd/items/sword.webp');
const digest = data => ({ bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-gallery-install-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'prepared');
  const destination = path.join(root, 'assets/img/items/hd');
  const gallery = { assets: [
    { kind: 'item', file: 'items/saber.webp', itemIds: ['saber'] },
    { kind: 'item', file: 'items/sword.webp', itemIds: ['sword'] },
    { kind: 'color-variant', file: 'variants/saber.webp', itemIds: [], appearanceOf: ['saber'] },
  ] };
  fs.mkdirSync(path.join(root, 'content/item-catalog'), { recursive: true });
  fs.mkdirSync(path.join(source, 'items'), { recursive: true });
  fs.mkdirSync(path.join(source, 'variants'), { recursive: true });
  fs.mkdirSync(path.join(destination, 'items'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/item-catalog/hd-gallery.json'), JSON.stringify(gallery));
  fs.writeFileSync(path.join(source, 'items/saber.webp'), saber);
  fs.writeFileSync(path.join(source, 'items/sword.webp'), sword);
  fs.writeFileSync(path.join(source, 'variants/saber.webp'), saber);
  const prepared = { gallery, outputs: { 'items/saber.webp': digest(saber), 'items/sword.webp': digest(sword), 'variants/saber.webp': digest(saber) } };
  const save = () => fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify(prepared));
  save();
  fs.writeFileSync(path.join(destination, 'items/saber.webp'), 'previous saber');
  fs.writeFileSync(path.join(destination, 'items/retired.webp'), 'retired image');
  const run = () => spawnSync(process.execPath, [installer, source], { cwd: root, encoding: 'utf8' });
  return { source, destination, prepared, save, run };
}

test('valid install copies only selected images and retires obsolete outputs', t => {
  const { destination, run } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readFileSync(path.join(destination, 'items/saber.webp')), saber);
  assert.deepEqual(fs.readFileSync(path.join(destination, 'items/sword.webp')), sword);
  assert.ok(!fs.existsSync(path.join(destination, 'items/retired.webp')));
  assert.ok(!fs.existsSync(path.join(destination, 'variants/saber.webp')));
  assert.equal(run().status, 0, 'Repeated installation must be safe');
});

for (const problem of ['stale mapping', 'swapped image', 'truncated image', 'missing checksum', 'missing image']) {
  test(`installer rejects ${problem} before changing any installed file`, t => {
    const f = fixture(t);
    if (problem === 'stale mapping') f.prepared.gallery.assets[0].itemIds = ['wrong-item'];
    if (problem === 'missing checksum') delete f.prepared.outputs['items/sword.webp'];
    if (problem === 'swapped image') fs.writeFileSync(path.join(f.source, 'items/sword.webp'), saber);
    if (problem === 'truncated image') fs.writeFileSync(path.join(f.source, 'items/sword.webp'), sword.subarray(0, 12));
    if (problem === 'missing image') fs.unlinkSync(path.join(f.source, 'items/sword.webp'));
    f.save();
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Prepared gallery is out of date|Prepared image changed|ENOENT/);
    assert.equal(fs.readFileSync(path.join(f.destination, 'items/saber.webp'), 'utf8'), 'previous saber');
    assert.equal(fs.readFileSync(path.join(f.destination, 'items/retired.webp'), 'utf8'), 'retired image');
    assert.ok(!fs.existsSync(path.join(f.destination, 'items/sword.webp')));
  });
}
