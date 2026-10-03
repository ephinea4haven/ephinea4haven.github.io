// Encode visually reviewed local renders. This writes site files, not a remote deployment.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { slug } from './item_catalog_model.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const entries = {};
const records = read('content/item-catalog/wiki.json').records;
const directory = 'assets/img/items/models';
fs.mkdirSync(`${directory}/thumbs`, { recursive: true });
for (const id of ['mechgun', 'assault', 'repeater', 'gatling', 'vulcan', 'es-mechgun', 'typeme-mechgun']) {
  const input = `artifacts/mechgun-renders/${id}.png`;
  const evidence = read(`artifacts/mechgun-renders/${id}.json`);
  const record = records.find(record => record.fields.hex?.toUpperCase() === evidence.code);
  assert(record && record.fields.type === 'Mechgun');
  assert.equal(slug(record.title), id, 'Model code and catalog identity must agree');
  assert.equal(hash(input), evidence.pngSha256);
  assert.equal(evidence.recipe.instances, 2);
  assert.equal(evidence.rendererSha256, hash('scripts/render_mechgun_models.py'));
  const path = `/${directory}/${id}.webp`, thumbnail = `/${directory}/thumbs/${id}.webp`;
  for (const [output, width] of [[path, 1024], [thumbnail, 256]]) {
    execFileSync('cwebp', ['-quiet', '-q', '90', '-m', '6', '-resize', String(width), '0', input, '-o', output.slice(1)]);
  }
  entries[evidence.code] = { id, title: record.title, kind: 'model', origin: 'model-render',
    path, thumbnail, sha256: hash(path.slice(1)), thumbnailSha256: hash(thumbnail.slice(1)), evidence };
}
fs.writeFileSync('content/item-catalog/model-images.json', JSON.stringify({ entries }, null, 2) + '\n');
console.log(`Imported ${Object.keys(entries).length} paired Mechgun previews.`);
