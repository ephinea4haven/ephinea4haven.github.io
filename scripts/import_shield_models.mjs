// Import the reviewed shield renders; keep unreviewed drafts outside site assets.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inventory = read('artifacts/shield-renders/inventory.json');
const entries = {};
const directory = 'assets/img/items/shields';
fs.mkdirSync(`${directory}/thumbs`, { recursive: true });
const reviewed = inventory.filter(item => item.path === 'equipped-model');
assert.equal(reviewed.length, 65);
for (const item of reviewed) {
  const input = `artifacts/shield-renders/${item.id}.png`;
  const evidence = read(`artifacts/shield-renders/${item.id}.json`);
  assert.equal(evidence.code, item.code);
  assert.equal(evidence.path, 'equipped-model');
  assert.equal(hash(input), evidence.pngSha256);
  assert.equal(evidence.rendererSha256, hash('scripts/render_shield_models.py'));
  assert.equal(evidence.model.ephineaEntryMatches, true);
  assert.equal(evidence.texture.ephineaEntryMatches, true);
  const path = `/${directory}/${item.id}.webp`;
  const thumbnail = `/${directory}/thumbs/${item.id}.webp`;
  for (const [output, width] of [[path, 900], [thumbnail, 256]]) {
    execFileSync('cwebp', ['-quiet', '-q', '90', '-m', '6', '-resize', String(width), '0', input, '-o', output.slice(1)]);
  }
  entries[item.code] = {id: item.id, title: item.title, kind: 'model', origin: 'model-render',
    path, thumbnail, sha256: hash(path.slice(1)), thumbnailSha256: hash(thumbnail.slice(1)), evidence};
}
const barriers = inventory.filter(item => item.path === 'block-effect');
assert.equal(barriers.length, 42);
for (const group of new Set(barriers.map(item => item.blockEffect))) {
  const burstInput = `artifacts/shield-renders/block-effect-${group}.png`;
  const burstEvidence = read(`artifacts/shield-renders/block-effect-${group}.json`);
  assert.equal(hash(burstInput), burstEvidence.pngSha256);
  assert.equal(burstEvidence.rendererSha256, hash('scripts/render_shield_effects.py'));
  const burstPath = `/${directory}/block-effect-${group}.webp`;
  const burstThumbnail = `/${directory}/thumbs/block-effect-${group}.webp`;
  for (const [output, width] of [[burstPath, 800], [burstThumbnail, 256]]) {
    execFileSync('cwebp', ['-quiet', '-q', '90', '-m', '6', '-resize', String(width), '0', burstInput, '-o', output.slice(1)]);
  }
  for (const item of barriers.filter(item => item.blockEffect === group)) {
    assert.equal(item.blockEffect, burstEvidence.blockEffect);
    entries[item.code] = {id: item.id, title: item.title, kind: 'effect', origin: 'block-effect-render',
      blend: 'additive', path: burstPath, thumbnail: burstThumbnail,
      sha256: hash(burstPath.slice(1)), thumbnailSha256: hash(burstThumbnail.slice(1)), evidence: burstEvidence};
  }
}
fs.writeFileSync('content/item-catalog/shield-images.json', JSON.stringify({entries}, null, 2) + '\n');
const selected = new Set(Object.values(entries).flatMap(item => [item.path.slice(1), item.thumbnail.slice(1)]));
for (const file of fs.readdirSync(directory, {recursive: true})) {
  const path = `${directory}/${file}`;
  if (file.endsWith('.webp') && !selected.has(path)) fs.unlinkSync(path);
}
console.log(`Imported ${reviewed.length} shield models and ${barriers.length} block-effect bindings.`);
