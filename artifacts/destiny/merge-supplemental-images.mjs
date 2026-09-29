import { createHash } from 'node:crypto';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const images = join(root, 'dropcharts/destiny/images');
const renders = join(root, 'resources/supplemental-render');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const mapping = await json(join(images, 'mapping.json'));
const manifest = await json(join(images, 'manifest.json'));
const variants = await json(join(root, 'supplemental-variants.json'));
const jobs = await json(join(renders, 'jobs.json'));
const results = await json(join(renders, 'render-results.json'));
const qa = await json(join(renders, 'visual-qa.json'));
assert(sha(await readFile(join(renders, 'jobs.json'))) === results.sources.jobsSha256, 'Render jobs changed since this batch');
assert(sha(await readFile(join(root, 'resources/model-previews/render_textured.py'))) === results.sources.rendererSha256, 'Renderer changed since this batch');
assert(sha(await readFile(join(root, 'resources/model-previews/model_adapters.py'))) === results.sources.modelAdapterSha256, 'Model adapter changed since this batch');
const resultByCode = new Map(results.results.map(item => [item.code, item]));
const qaByCode = new Map(qa.items.map(item => [item.code, item]));
// Rerunning is deterministic, including removal of no-longer-approved previews.
for (const item of manifest.modelPreviews.filter(item => item.supplemental)) delete mapping[item.name];
manifest.modelPreviews = manifest.modelPreviews.filter(item => !item.supplemental);
manifest.sharedAppearance = [];
const pmt = await json(join(root, 'pmt/records.json'));
const pmtByCode = new Map(pmt.records.map(item => [item.code, item]));
const modelArchive = await readFile(join(root, 'resources/originals/ItemModelEp4.afs'));
const textureArchive = await readFile(join(root, 'resources/originals/ItemTextureEp4.afs'));
function entryHash(archive, slot) {
  assert(Number.isInteger(slot) && slot >= 0 && slot < archive.readUInt32LE(4), 'Invalid AFS slot');
  const offset = archive.readUInt32LE(8 + slot * 8), size = archive.readUInt32LE(12 + slot * 8);
  assert(size > 0 && offset + size <= archive.length, 'Invalid AFS entry');
  return sha(archive.subarray(offset, offset + size));
}
for (const group of variants.groups) {
  if (group.presentation !== 'shared_exact_appearance') continue;
  const bytes = await readFile(join(images, group.sharedImage));
  assert(group.codes.every(code => code.imageSha256 === sha(bytes)), `${group.name}: shared image mismatch`);
  assert(new Set(group.codes.map(code => code.modelEntrySha256)).size === 1 &&
    new Set(group.codes.map(code => code.textureEntrySha256)).size === 1, `${group.name}: distinct model variants`);
  for (const code of group.codes) {
    const record = pmtByCode.get(code.code);
    assert(record?.family === 'weapon' && record.pmt_id === code.pmtId, `${group.name}: code mismatch`);
    assert(entryHash(modelArchive, record.type) === code.modelEntrySha256 && entryHash(textureArchive, record.skin) === code.textureEntrySha256, `${group.name}: shared source slot mismatch`);
  }
  mapping[group.name] = group.sharedImage;
  manifest.sharedAppearance.push(group);
}
for (const job of jobs.jobs) {
  const review = qaByCode.get(job.code);
  if (review?.status !== 'passed') continue;
  // This unqualified drop name has two distinct model variants.
  if (job.name === "NEI'S CLAW") continue;
  const result = resultByCode.get(job.code);
  assert(result?.returnCode === 0 && job.resourceVerified, `${job.name}: unverified render`);
  const bytes = await readFile(join(renders, job.output));
  assert(sha(bytes) === result.imageSha256 && sha(bytes) === review.imageSha256, `${job.name}: image changed after QA`);
  for (const evidence of [job.modelEvidence, job.textureEvidence]) {
    assert(sha(await readFile(join(renders, evidence.decodedPath))) === evidence.decodedSha256, `${job.name}: decoded asset changed`);
    assert(sha(await readFile(join(root, 'resources/originals', evidence.archive))) === evidence.archiveSha256, `${job.name}: source archive changed`);
    assert(sha(await readFile(join(renders, evidence.compressedPath))) === evidence.compressedSha256, `${job.name}: PRS source changed`);
  }
  assert(!mapping[job.name], `${job.name}: duplicate image association`);
  const filename = basename(job.output);
  await copyFile(join(renders, job.output), join(images, filename));
  mapping[job.name] = filename;
  manifest.modelPreviews.push({name: job.name, dropNames: [job.name], code: job.code,
    image: filename, imageSha256: sha(bytes), supplemental: true,
    sourceStatus: job.evidenceTier, checkedParameters: job.checkedParameters,
    modelEvidence: job.modelEvidence, textureEvidence: job.textureEvidence,
    primaryModelOnly: job.primaryModelOnly === true, renderProvenance: results.sources, visualQa: 'passed', runtimeVerified: false});
}
manifest.variants = variants.groups.filter(group => group.presentation !== 'shared_exact_appearance');
const baseJobs = await json(join(root, 'resources/model-previews/jobs.json'));
manifest.counts.modelPreviewJobs = baseJobs.jobs.length + jobs.jobs.length;
manifest.counts.modelPreviewRejectedVisualQa = baseJobs.jobs.filter(job => job.visual_qa === 'rejected').length + qa.items.filter(item => item.status === 'rejected').length;
manifest.counts.modelPreviewPendingVisualQa = baseJobs.jobs.filter(job => job.visual_qa === 'pending').length + jobs.jobs.filter(job => !qaByCode.has(job.code)).length;
manifest.counts.supplementalDecodeBlocked = jobs.excluded.length;
const variantDirectory = join(renders, 'variants/nei-claw-000D02');
const variant = await json(join(variantDirectory, 'manifest.json'));
assert(variant.visualQa === 'passed' && variant.variantOnly && !variant.unqualifiedDropMapping, 'Variant approval missing');
const variantBytes = await readFile(join(variantDirectory, variant.image));
assert(sha(variantBytes) === variant.imageSha256, 'Variant PNG changed after review');
for (const resource of variant.sources.resources) {
  const archive = await readFile(join(root, resource.archive));
  assert(sha(archive) === resource.archiveSha256 && entryHash(archive, resource.entry) === resource.prsSha256, 'Variant source mismatch');
  assert(sha(await readFile(join(variantDirectory, resource.decoded))) === resource.decodedSha256, 'Variant decoded asset mismatch');
}
const variantCode = manifest.variants.find(group => group.name === variant.name)?.codes.find(code => code.code === variant.code);
assert(variantCode && !mapping[variant.name], 'Variant name must remain unqualified');
await copyFile(join(variantDirectory, variant.image), join(images, variant.image));
Object.assign(variantCode, {image: variant.image, imageSha256: variant.imageSha256, modelPreview: variant});
manifest.counts.mapped = Object.keys(mapping).length;
manifest.counts.mappedModelPreview = manifest.modelPreviews.length;
manifest.counts.mappedSharedAppearance = manifest.sharedAppearance.length;
manifest.sources.supplementalJobs = 'resources/supplemental-render/jobs.json';
manifest.sources.supplementalVisualQa = 'resources/supplemental-render/visual-qa.json';
await writeFile(join(images, 'mapping.json'), JSON.stringify(mapping, null, 2) + '\n');
await writeFile(join(images, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.counts));
