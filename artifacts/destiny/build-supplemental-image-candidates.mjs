import { createHash } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const imageDirectory = join(root, 'dropcharts', 'destiny', 'images');
const auditPath = join(root, 'missing-image-audit.json');
const manifestPath = join(root, 'resources', 'itemkt-images', 'manifest.json');
const jobsPath = join(root, 'resources', 'model-previews', 'jobs.json');
const audit = JSON.parse(await readFile(auditPath));
const itemKt = JSON.parse(await readFile(manifestPath));
const oldJobs = JSON.parse(await readFile(jobsPath));
const pmt = JSON.parse(await readFile(join(root, 'pmt', 'records.json')));
const pmtByCode = new Map(pmt.records.map((record) => [record.code, record]));
const noDataHash = 'e015d11321193c7f4db1f01342ac49a066ac5ba9ea80569d12f481fd4d75c2f8';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const archives = {};
for (const archive of ['ItemModelEp4', 'ItemTextureEp4']) {
  const bytes = await readFile(join(root, 'resources', 'originals', `${archive}.afs`));
  assert(hash(bytes) === audit.archiveInventory[archive].sha256, `${archive}: audit archive changed`);
  archives[archive] = bytes;
}

function afsResource(archive, index) {
  const bytes = archives[archive];
  const count = bytes.readUInt32LE(4);
  if (!Number.isInteger(index) || index < 0 || index >= count) return null;
  const offset = bytes.readUInt32LE(8 + 8 * index);
  const size = bytes.readUInt32LE(12 + 8 * index);
  if (offset <= 0 || size <= 0 || offset + size > bytes.length) return null;
  return { archive: `${archive}.afs`, archiveSha256: hash(bytes), entry: index,
    offset, bytes: size, sha256: hash(bytes.subarray(offset, offset + size)) };
}

const variants = [];
for (const group of audit.sameNameVariants) {
  const shared = group.allCandidatesExactModelTextureEquivalent;
  if (shared) {
    assert(group.codes.every((code) => code.itemKtImageSha256 === group.codes[0].itemKtImageSha256),
      `${group.name}: model-equivalent codes have different ItemKT images`);
  }
  const codeImages = [];
  let sharedFilename = null;
  for (const code of group.codes) {
    const image = code.itemKtEntry == null ? null
      : itemKt.archives.ItemKTep4.entries[code.itemKtEntry]?.images?.[0] ?? null;
    let filename = null;
    if (image && image.sha256 !== noDataHash) {
      const bytes = await readFile(join(root, 'resources', 'itemkt-images', image.path));
      assert(hash(bytes) === image.sha256, `${group.name}/${code.code}: source image hash mismatch`);
      filename = shared && sharedFilename ? sharedFilename
        : `${code.code}_${String(code.itemKtEntry).padStart(4, '0')}.png`;
      if (!shared || !sharedFilename)
        await copyFile(join(root, 'resources', 'itemkt-images', image.path), join(imageDirectory, filename));
      if (shared) sharedFilename = filename;
    }
    codeImages.push({
      code: code.code, pmtId: code.pmtId, itemKtEntry: code.itemKtEntry,
      image: filename, imageSha256: filename ? image.sha256 : null,
      modelEntrySha256: code.modelEntrySha256,
      textureEntrySha256: code.textureEntrySha256,
      matchedWebsiteRows: code.websiteRows.filter((row) =>
        row.comparison.checked >= 5 && row.comparison.conflicts === 0).map((row) => row.id),
    });
  }
  variants.push({
    name: group.name,
    presentation: shared && codeImages[0].image ? 'shared_exact_appearance'
      : 'show_code_variants',
    sharedImage: shared && codeImages[0].image ? codeImages[0].image : null,
    evidence: 'Exact model and texture AFS entry SHA-256 equality; ItemKT decoded PNG SHA-256 equality is checked separately. Website row matches use at least five exact PMT numeric fields.',
    codes: codeImages,
  });
}
const variantManifest = {
  schema: 'destiny-supplemental-same-name-images-v1',
  sources: { audit: 'missing-image-audit.json', itemKt: 'resources/itemkt-images/manifest.json' },
  groups: variants,
};
await writeFile(join(root, 'supplemental-variants.json'), `${JSON.stringify(variantManifest, null, 2)}\n`);

const oldByPair = new Map(oldJobs.jobs.map((job) => [`${job.item}\0${job.code}`, job]));
const candidates = [];
const excluded = [];
for (const item of audit.items) {
  const proposed = [];
  if (item.candidateCode && item.render.status === 'slots_in_range_unverified_payload' &&
    ['source_matched', 'unitxt_unique_multi_parameter_agree'].includes(item.evidenceStatus)) {
    proposed.push({ code: item.candidateCode, evidenceTier: item.evidenceStatus,
      checkedParameters: item.parameterComparison?.checked ?? item.catalog.parameterComparison?.checkedFields ?? null,
      modelSlot: item.render.model, textureSlot: item.render.texture });
  }
  if (item.parameterOnlyCandidates.length === 1) {
    const candidate = item.parameterOnlyCandidates[0];
    const record = pmtByCode.get(candidate.code);
    if (record && ['weapon', 'shield'].includes(record.family)) {
      proposed.push({ code: candidate.code, evidenceTier: 'website_parameter_unique_no_name',
        checkedParameters: candidate.checked,
        modelSlot: record.type + (record.family === 'shield' ? 354 : 0),
        textureSlot: record.skin + (record.family === 'shield' ? 378 : 0) });
    } else excluded.push({ name: item.name, code: candidate.code,
      evidenceTier: 'website_parameter_unique_no_name', reason: 'unsupported_family' });
  }
  for (const candidate of proposed) {
    const model = afsResource('ItemModelEp4', candidate.modelSlot);
    const texture = afsResource('ItemTextureEp4', candidate.textureSlot);
    if (!model || !texture) {
      excluded.push({ name: item.name, code: candidate.code, evidenceTier: candidate.evidenceTier,
        reason: !model ? 'model_slot_out_of_range_or_empty' : 'texture_slot_out_of_range_or_empty',
        modelSlot: candidate.modelSlot, textureSlot: candidate.textureSlot });
      continue;
    }
    const old = oldByPair.get(`${item.name}\0${candidate.code}`);
    candidates.push({
      name: item.name, code: candidate.code, websiteRowIds: item.websiteCandidates.map((row) => row.id),
      evidenceTier: candidate.evidenceTier,
      checkedParameters: candidate.checkedParameters,
      parameterConflicts: item.parameterComparison?.checks.filter((check) => !check.agrees) ?? [],
      runtimeVerified: false,
      previousVisualQa: old?.visual_qa ?? null,
      previousVisualQaReason: old?.visual_qa_reason ?? null,
      model, texture,
      output: `${candidate.code}_model.png`,
    });
  }
}
candidates.sort((a, b) => a.name.localeCompare(b.name, 'en'));
const jobs = {
  schema: 'destiny-supplemental-model-candidates-v1',
  sources: { audit: 'missing-image-audit.json', previousJobs: 'resources/model-previews/jobs.json' },
  method: 'In-range, nonempty AFS model/texture pairs only. Name and parameter evidence tiers are retained; bytes have not yet been PRS-decoded or visually checked. No candidate is a confirmed runtime name.',
  count: candidates.length,
  counts: {
    new: candidates.filter((candidate) => !candidate.previousVisualQa).length,
    previousRejected: candidates.filter((candidate) => candidate.previousVisualQa === 'rejected').length,
    excluded: excluded.length,
  },
  candidates,
  excluded,
};
await writeFile(join(root, 'supplemental-jobs.json'), `${JSON.stringify(jobs, null, 2)}\n`);
console.log(JSON.stringify({ variantGroups: variants.length,
  sharedAppearance: variants.filter((group) => group.presentation === 'shared_exact_appearance').length,
  jobCandidates: candidates.length,
  byTier: Object.fromEntries([...new Set(candidates.map((item) => item.evidenceTier))].map((tier) =>
    [tier, candidates.filter((item) => item.evidenceTier === tier).length])) }));
