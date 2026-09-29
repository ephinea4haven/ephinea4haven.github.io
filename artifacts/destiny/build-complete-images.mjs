import {createHash} from 'node:crypto';
import {readFile, writeFile, copyFile} from 'node:fs/promises';
import {dirname, join, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const images = join(root, 'dropcharts/destiny/images');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (value, message) => {if (!value) throw new Error(message);};
const mapping = await json(join(images, 'mapping.json'));
const manifest = await json(join(images, 'manifest.json'));
const families = await json(join(root, 'completeness/item-families.json'));
const categories = await json(join(root, 'resources/category-previews/manifest.json'));
const approved = await json(join(root, 'completeness/approved-images.json'));
const names = new Set(families.items.map(item => item.name));
assert(names.size === 517 && families.items.length === 517, 'Expected complete, unique drop-name inventory');
for (const previous of [...(manifest.categoryPreviews || []), ...(manifest.additionalArtwork || []), ...(manifest.effectPreviews || [])]) {
  if (mapping[previous.name] === previous.image) delete mapping[previous.name];
}
manifest.categoryPreviews = [];
manifest.additionalArtwork = [];
manifest.effectPreviews = [];
for (const entry of approved.entries) {
  assert(entry.kind === 'model_candidate' && entry.source?.model && entry.source?.texture,
    `${entry.name}: only client model renders are allowed as additional artwork`);
  assert(names.has(entry.name) && entry.visualQa === 'passed', 'Unreviewed or unknown additional artwork');
  assert(!mapping[entry.name], `${entry.name}: additional artwork would replace an existing preview`);
  for (const resource of [entry.source.model, entry.source.texture]) {
    const archive = await readFile(join(root, 'resources/originals', basename(resource.archive)));
    assert(hash(archive) === resource.archiveSha256, `${entry.name}: client archive changed`);
    const slot = resource.slot ?? resource.entry;
    assert(Number.isInteger(slot) && slot >= 0 && slot < archive.readUInt32LE(4),
      `${entry.name}: invalid client resource slot`);
    const offset = archive.readUInt32LE(8 + slot * 8);
    const size = archive.readUInt32LE(12 + slot * 8);
    assert(size > 0 && offset + size <= archive.length &&
      hash(archive.subarray(offset, offset + size)) === resource.compressedSha256,
      `${entry.name}: client resource bytes changed`);
  }
  const bytes = await readFile(join(root, entry.path));
  assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
    `${entry.name}: model render must be a PNG`);
  assert(hash(bytes) === entry.imageSha256, `${entry.name}: reviewed image changed`);
  const file = basename(entry.path);
  await copyFile(join(root, entry.path), join(images, file));
  mapping[entry.name] = file;
  manifest.additionalArtwork.push({...entry, image: file});
}
const effects = await json(join(root, 'resources/completeness/armor-effects/render-manifest.json'));
for (const entry of effects.items) {
  assert(entry.scope === 'offline_equipment_effect_preview' && entry.runtimeVerified === false,
    `${entry.name}: equipment effect scope must be explicit`);
  assert(names.has(entry.name) && entry.visualQa === 'passed', 'Unreviewed or unknown equipment effect');
  assert(!mapping[entry.name], `${entry.name}: equipment effect would replace an existing preview`);
  const roles = new Set(entry.dependencies.map(resource => resource.role));
  for (const role of ['particle_data', 'texture_data', 'stock_client', 'simulator', 'renderer', 'simulation']) {
    assert(roles.has(role), `${entry.name}: missing effect provenance ${role}`);
  }
  for (const resource of entry.dependencies) {
    assert(hash(await readFile(resource.path)) === resource.sha256, `${entry.name}: effect source changed: ${resource.role}`);
  }
  const bytes = await readFile(entry.image.path);
  assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && hash(bytes) === entry.image.sha256,
    `${entry.name}: reviewed effect render changed`);
  const file = basename(entry.image.path);
  await copyFile(entry.image.path, join(images, file));
  mapping[entry.name] = file;
  manifest.effectPreviews.push({...entry, image: file, imageSha256: entry.image.sha256});
}
const byFamily = new Map(categories.entries.map(entry => [entry.family, entry]));
const variantNames = new Set((manifest.variants || []).filter(group => group.codes.some(code => code.image)).map(group => group.name));
for (const item of families.items) {
  if (mapping[item.name] || variantNames.has(item.name)) continue;
  const category = byFamily.get(item.family);
  assert(category && category.visualQa === 'passed', `${item.name}: no reviewed category image for ${item.family}`);
  const bytes = await readFile(join(root, 'resources/category-previews', category.image));
  assert(hash(bytes) === category.imageSha256, `${item.family}: category image changed after QA`);
  const file = basename(category.image);
  await copyFile(join(root, 'resources/category-previews', category.image), join(images, file));
  mapping[item.name] = file;
  manifest.categoryPreviews.push({name: item.name, family: item.family, image: file,
    imageSha256: category.imageSha256, categoryEvidence: item.evidence,
    source: category, representation: 'shared_client_pickup_model', individualAppearance: false});
}
assert([...names].every(name => mapping[name] || variantNames.has(name)), 'Incomplete visual coverage');
assert(Object.keys(mapping).every(name => names.has(name)), 'Unknown name in image mapping');
manifest.counts.mapped = Object.keys(mapping).length;
manifest.counts.categoryImages = manifest.categoryPreviews.length;
manifest.counts.additionalArtwork = manifest.additionalArtwork.length;
manifest.counts.effectPreviews = manifest.effectPreviews.length;
manifest.counts.individualMapped = Object.keys(mapping).length - manifest.categoryPreviews.length;
manifest.counts.variantOnly = [...variantNames].filter(name => !mapping[name]).length;
manifest.counts.visualCoverage = manifest.counts.mapped + manifest.counts.variantOnly;
manifest.sources.categoryPreviews = 'resources/category-previews/manifest.json';
manifest.sources.itemFamilies = 'completeness/item-families.json';
await writeFile(join(images, 'mapping.json'), JSON.stringify(mapping, null, 2) + '\n');
await writeFile(join(images, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.counts));
