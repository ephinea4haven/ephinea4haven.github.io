import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const destiny = join(directory, '..');
const files = {
  families: 'completeness/item-families.json',
  images: 'dropcharts/destiny/images/mapping.json',
  missing: 'missing-image-audit.json',
  pmt: 'pmt/records.json',
  baseJobs: 'resources/model-previews/jobs.json',
  supplementalJobs: 'resources/supplemental-render/jobs.json',
  supplementalVisualQa: 'resources/supplemental-render/visual-qa.json',
};
const loaded = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => {
  const path = join(destiny, file);
  const bytes = await readFile(path);
  return [key, { data: JSON.parse(bytes), file: relative(directory, path),
    sha256: createHash('sha256').update(bytes).digest('hex') }];
})));
const { families, images, missing, pmt, baseJobs, supplementalJobs, supplementalVisualQa } = Object.fromEntries(
  Object.entries(loaded).map(([key, item]) => [key, item.data]));
const previous = new Map([...baseJobs.jobs, ...supplementalJobs.jobs].map((item) =>
  [`${item.item ?? item.name}\0${item.code}`, item]));
const blocked = new Map(supplementalJobs.excluded.map((item) => [`${item.name}\0${item.code}`, item]));
const reviewed = new Map(supplementalVisualQa.items.map((item) => [item.code, item]));
const missingByName = new Map(missing.items.map((item) => [item.name, item]));
const pmtByCode = new Map(pmt.records.map((record) => [record.code, record]));
const rows = families.items.filter((item) => ['weapon', 'shield', 'armor'].includes(item.family) &&
  images[item.name] === undefined).map((item) => {
  const audit = missingByName.get(item.name);
  const code = item.name === 'BERSERK NEEDLE' ? '001208' : audit?.candidateCode ?? (audit?.parameterOnlyCandidates.length === 1
    ? audit.parameterOnlyCandidates[0].code : null);
  const record = code ? pmtByCode.get(code) : null;
  const priorJob = code ? previous.get(`${item.name}\0${code}`) : null;
  const resourceBlock = code ? blocked.get(`${item.name}\0${code}`) : null;
  const visualReview = code ? reviewed.get(code) : null;
  const modelSlot = record ? record.type + (item.family === 'shield' ? 354 : 0) : null;
  const textureSlot = record ? record.skin + (item.family === 'shield' ? 378 : 0) : null;
  const inRange = record && modelSlot < missing.archiveInventory.ItemModelEp4.entries &&
    textureSlot < missing.archiveInventory.ItemTextureEp4.entries;
  let resourceStatus = 'identity_unresolved';
  if (item.family === 'armor') resourceStatus = 'no_verified_individual_armor_image_route';
  else if (item.name === 'BERSERK NEEDLE') resourceStatus = 'parameter_special_candidate_pending_visual_qa';
  else if (resourceBlock) resourceStatus = 'model_or_texture_parse_blocked';
  else if (priorJob?.visual_qa === 'rejected' || visualReview?.status === 'rejected')
    resourceStatus = 'render_visual_qa_rejected';
  else if (item.name === "NEI'S CLAW") resourceStatus = 'multiple_distinct_code_variants';
  else if (record && !inRange) resourceStatus = 'model_or_texture_slot_out_of_range';
  else if (code && inRange)
    resourceStatus = 'individual_resource_candidate_not_verified';
  return {
    name: item.name,
    family: item.family,
    familyEvidenceTier: item.evidence.tier,
    candidateCode: code,
    identityEvidence: item.name === 'BERSERK NEEDLE'
      ? 'website_parameter_special_correlated' : audit?.evidenceStatus ?? null,
    websiteParameterOnlyCandidates: audit?.parameterOnlyCandidates ?? [],
    resourceStatus,
    sourceSelectors: record ? { pmtId: record.pmt_id, type: record.type, skin: record.skin,
      modelSlot, textureSlot } : null,
    priorVisualQa: visualReview?.status ?? priorJob?.visual_qa ?? null,
    blockedReason: resourceBlock?.reason ?? null,
    candidateImage: item.name === 'BERSERK NEEDLE'
      ? 'completeness/berserk-needle/001208_model.png' : null,
  };
});
const count = (field) => Object.fromEntries([...new Set(rows.map(field))].sort().map((value) =>
  [value, rows.filter((row) => field(row) === value).length]));
const output = {
  schema: 'destiny-missing-equipment-image-audit-v1',
  sources: Object.fromEntries(Object.entries(loaded).map(([key, item]) =>
    [key, { file: item.file, sha256: item.sha256 }])),
  note: 'Resource status describes inspected local evidence, not a claim that the game has no visual model. The candidate BERSERK NEEDLE image is not published pending visual QA.',
  counts: { equipmentWithoutMappedImage: rows.length, family: count((row) => row.family),
    resourceStatus: count((row) => row.resourceStatus) },
  items: rows,
};
await writeFile(join(directory, 'equipment-audit.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.counts));
