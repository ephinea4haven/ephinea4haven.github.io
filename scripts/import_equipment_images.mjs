// Offline import only. Normal builds consume the checked-in manifest and WebP files.
// Usage: node scripts/import_equipment_images.mjs /path/to/PSOBB-Haven /path/to/extracted/data.gsl
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { selectHdImages } from './item_catalog_hd.mjs';
import { slug } from './item_catalog_model.mjs';

const [client, gsl] = process.argv.slice(2);
assert(client && gsl, 'Supply the reference BB client and its extracted data.gsl directory');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const destiny = 'artifacts/destiny';
const out = 'assets/img/items/equipment';
fs.mkdirSync(`${out}/thumbs`, { recursive: true });
const records = read('content/item-catalog/wiki.json').records.filter(r => ['Frame', 'Barrier'].includes(r.fields.type));
const gallery = selectHdImages(read('content/item-catalog/hd-gallery.json'));
const wikiImages = read('content/item-catalog/images.json');
const referenceFile = '../bb-psov4/ref/custom_item_assets/reference/vanilla-item-model-texture.tsv';
const [header, ...lines] = fs.readFileSync(referenceFile, 'utf8').trimEnd().split('\n');
const fields = header.split('\t');
const referenceItems = new Map(lines.map(line => {
  const values = line.split('\t');
  assert.equal(values.length, fields.length);
  const item = Object.fromEntries(fields.map((field, i) => [field, values[i]]));
  return [item.item_code, item];
}));
const entries = {};
function convert(input, output, width) {
  execFileSync('cwebp', ['-quiet', '-q', '85', '-m', '6', '-resize', String(width), '0', input, '-o', output]);
}
function add(record, input, kind, origin, evidence, original = null) {
  const id = slug(record.title), thumbnail = `/${out}/thumbs/${id}.webp`;
  const image = original || `/${out}/${id}.webp`;
  // The character illustration is small source art; preserve its native scale.
  if (!original) convert(input, image.slice(1), kind === 'illustration' ? 112 : 800);
  convert(input, thumbnail.slice(1), kind === 'illustration' ? 112 : 256);
  entries[record.fields.hex.toUpperCase()] = { title: record.title, kind, origin, path: image, thumbnail,
    sha256: hash(image.slice(1)), thumbnailSha256: hash(thumbnail.slice(1)),
    evidence: { ...evidence, input, inputSha256: hash(input) } };
}
for (const record of records) {
  const file = gallery.get(slug(record.title));
  if (file) add(record, `assets/img/items/hd/${file}`, 'screenshot', 'gallery',
    { manifest: 'content/item-catalog/hd-gallery.json' }, `/assets/img/items/hd/${file}`);
}
const effectManifests = [`${destiny}/resources/completeness/armor-effects/render-manifest.json`,
  'artifacts/armor-renders/render-manifest.json'];
for (const manifest of effectManifests) for (const effect of read(manifest).items) {
  const record = records.find(r => r.fields.hex.toUpperCase() === effect.code);
  assert(record && record.title.toUpperCase() === effect.name && effect.visualQa === 'passed');
  for (const role of ['particle_data', 'texture_data', 'stock_client']) {
    const dependency = effect.dependencies.find(d => d.role === role);
    const reference = role === 'stock_client' ? path.join(client, 'Psobb.exe') : path.join(gsl, path.basename(dependency.path));
    assert.equal(hash(reference), dependency.sha256, `${effect.name}: ${role} differs from reference BB`);
  }
  const input = effect.image.path;
  assert.equal(hash(input), effect.image.sha256);
  assert.equal(effect.transparentBackground, true);
  assert(['normal', 'additive'].includes(effect.displayBlend));
  add(record, input, 'effect', 'effect-render', { manifest,
    runtimeVerified: false, transparentBackground: true,
    dependencies: effect.dependencies.filter(d => ['particle_data', 'texture_data', 'stock_client', 'renderer', 'render_sidecar', 'simulator', 'sprite_renderer'].includes(d.role))
      .map(d => ({ role: d.role, file: path.basename(d.path), sha256: d.sha256 })) });
  entries[effect.code].blend = effect.displayBlend;
}
// Stealth changes the character's opacity, rather than emitting separate particles.
// Use existing transparent character art for an explicitly labelled CSS illustration.
add(records.find(r => r.fields.hex.toUpperCase() === '010157'), 'assets/img/class/FOnewearl.png',
  'illustration', 'effect-illustration', { method: 'Existing character art displayed at 35% opacity; illustrative, not a runtime render.' });
const models = read(`${destiny}/dropcharts/destiny/images/manifest.json`).modelPreviews;
for (const model of models.filter(m => m.family === 'shield')) {
  const record = records.find(r => r.fields.hex.toUpperCase() === model.code);
  assert(record && record.title.toUpperCase() === model.name.toUpperCase());
  if (entries[model.code]) continue;
  const wikiName = (record.fields.image || '').replaceAll('_', ' ');
  if (wikiImages[wikiName] || wikiImages[wikiName[0]?.toUpperCase() + wikiName.slice(1)]) continue;
  assert(model.visualQa === 'passed' && model.resourceVerified);
  const reference = referenceItems.get(model.code);
  assert(reference && Number(reference.model) === model.modelSlot && Number(reference.texture) === model.textureSlot,
    `${model.name}: selector differs from reference BB item`);
  for (const [kind, slot, expected] of [['Model', model.modelSlot, model.modelEntrySha256], ['Texture', model.textureSlot, model.textureEntrySha256]]) {
    const archive = fs.readFileSync(path.join(client, `data/Item${kind}Ep4.afs`));
    assert.equal(archive.toString('ascii', 0, 3), 'AFS');
    assert(slot < archive.readUInt32LE(4));
    const offset = archive.readUInt32LE(8 + slot * 8), size = archive.readUInt32LE(12 + slot * 8);
    assert(size > 0 && offset + size <= archive.length);
    assert.equal(createHash('sha256').update(archive.subarray(offset, offset + size)).digest('hex'), expected);
  }
  const input = `${destiny}/dropcharts/destiny/images/${model.image}`;
  assert.equal(hash(input), model.imageSha256);
  add(record, input, 'model', 'model-render', { manifest: `${destiny}/dropcharts/destiny/images/manifest.json`,
    modelSlot: model.modelSlot, textureSlot: model.textureSlot,
    modelEntrySha256: model.modelEntrySha256, textureEntrySha256: model.textureEntrySha256,
    reference: { file: referenceFile, sha256: hash(referenceFile), item: reference }, runtimeVerified: false });
}
const categories = read(`${destiny}/resources/category-previews/manifest.json`);
const boxes = {};
for (const [color, state] of [['blue', 1], ['red', 4]]) {
  const source = categories.entries.find(e => e.baseState === state);
  assert.equal(source.visualQa, 'passed');
  const input = `${destiny}/resources/category-previews/${source.image}`;
  assert.equal(hash(input), source.imageSha256);
  const image = `/${out}/box-${color}.webp`;
  convert(input, image.slice(1), 400);
  boxes[color] = { path: image, kind: 'box', origin: 'pickup-box', sha256: hash(image.slice(1)),
    evidence: { input, inputSha256: hash(input), ...source.sourceEvidence } };
}
const toolBoxes = {
  '030F00': { color: 'red', title: 'AddSlot', source: 'https://wiki.pioneer2.net/w/AddSlot',
    reason: 'Verified rare tool; shared category illustration, not individual artwork.' },
};
fs.writeFileSync('content/item-catalog/equipment-images.json', JSON.stringify({ entries, boxes, toolBoxes }, null, 2) + '\n');
const usedFiles = new Set([...Object.values(entries).flatMap(e => [e.path.slice(1), e.thumbnail.slice(1)]),
  ...Object.values(boxes).map(e => e.path.slice(1))]);
for (const directory of [out, `${out}/thumbs`]) {
  for (const file of fs.readdirSync(directory)) {
    const full = `${directory}/${file}`;
    if (file.endsWith('.webp') && !usedFiles.has(full)) fs.unlinkSync(full);
  }
}
console.log(`Imported ${Object.keys(entries).length} equipment previews and two category boxes.`);
