import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const destiny = join(directory, '..');
const inputFiles = {
  imageManifest: 'dropcharts/destiny/images/manifest.json',
  families: 'completeness/item-families.json',
  catalog: 'catalog.json',
  database: 'database.json',
  missingImageAudit: 'missing-image-audit.json',
  supplementalJobs: 'supplemental-jobs.json',
  supplementalVisualQa: 'resources/supplemental-render/visual-qa.json',
  modelPreviewJobs: 'resources/model-previews/jobs.json',
  pmt: 'pmt/records.json',
  modelArchive: 'resources/originals/ItemModelEp4.afs',
  textureArchive: 'resources/originals/ItemTextureEp4.afs',
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const loaded = Object.fromEntries(await Promise.all(Object.entries(inputFiles).map(async ([key, file]) => {
  const path = join(destiny, file);
  const bytes = await readFile(path);
  return [key, { file: relative(directory, path), bytes, sha256: sha256(bytes) }];
})));
const json = (key) => JSON.parse(loaded[key].bytes);
const manifest = json('imageManifest');
const families = json('families');
const catalog = json('catalog');
const database = json('database');
const oldAudit = json('missingImageAudit');
const supplemental = json('supplementalJobs');
const supplementalQa = json('supplementalVisualQa');
const baseJobs = json('modelPreviewJobs');
const pmt = json('pmt');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function archive(key) {
  const bytes = loaded[key].bytes;
  assert(bytes.toString('ascii', 0, 3) === 'AFS', `${key}: invalid AFS header`);
  const entries = bytes.readUInt32LE(4);
  assert(8 + 8 * entries <= bytes.length, `${key}: truncated entry directory`);
  return { bytes, entries };
}
const archives = { model: archive('modelArchive'), texture: archive('textureArchive') };
function slot(archiveKind, index) {
  const { bytes, entries } = archives[archiveKind];
  if (index < 0 || index >= entries) return { index, status: 'out_of_range' };
  const offset = bytes.readUInt32LE(8 + 8 * index);
  const size = bytes.readUInt32LE(12 + 8 * index);
  if (!offset || !size) return { index, status: 'empty', offset, size };
  assert(offset + size <= bytes.length, `${archiveKind} slot ${index}: invalid byte range`);
  return { index, status: 'present', offset, size,
    compressedSha256: sha256(bytes.subarray(offset, offset + size)) };
}

const familyByName = new Map(families.items.map((item) => [item.name, item]));
const catalogByName = new Map(catalog.dropItems.map((item) => [item.name, item]));
const auditByName = new Map(oldAudit.items.map((item) => [item.name, item]));
const pmtByCode = new Map(pmt.records.map((record) => [record.code, record]));
const key = (name) => name.trim().toLowerCase();
const databaseByName = new Map();
for (const row of database.items) {
  const rows = databaseByName.get(key(row.name)) ?? [];
  rows.push(row);
  databaseByName.set(key(row.name), rows);
}
const number = (value) => typeof value === 'string' && /^\+?\d+$/.test(value.trim())
  ? Number(value.trim()) : null;
function parameterMatch(website, record) {
  const fields = website.fields;
  const params = record.parameters;
  const checks = [];
  const add = (expected, actual) => {
    if (expected != null && actual != null) checks.push(expected === actual);
  };
  if (record.family === 'weapon') {
    const atp = fields.ATP?.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (atp) {
      add(Number(atp[1]), params.atpmin);
      add(Number(atp[2]), params.atpmax);
    }
    add(number(fields.ATA), params.ata & 255);
    add(number(fields.MST), params.mst);
    add(number(fields.Grind), params.maxgrind & 255);
    const required = fields.Required?.match(/^\s*(ATP|MST|ATA)\s+(\d+)\s*$/);
    if (required) add(Number(required[2]), params[`${required[1].toLowerCase()}req`]);
  } else if (record.family === 'armor' || record.family === 'shield') {
    add(number(fields['min-DFP']), params.dfp);
    add(number(fields['max-DFP']), params.dfp + (params.dfprange & 255));
    add(number(fields['min-EVP']), params.evp);
    add(number(fields['max-EVP']), params.evp + (params.evprange & 255));
    for (const field of ['EFR', 'ETH', 'EIC', 'EDK', 'ELT'])
      add(number(fields[field]), params[field.toLowerCase()] & 255);
    add(number(fields.Required?.match(/^\s*Level\s+(\d+)\s*$/i)?.[1] ?? null),
      params.requiredlevel);
  } else if (record.family === 'unit') {
    add(number(fields['Stat Amount']), params.statamount);
  }
  return checks.length >= 4 && checks.every(Boolean);
}
const excludedByName = new Map();
for (const item of supplemental.excluded) {
  const values = excludedByName.get(item.name) ?? [];
  values.push(item);
  excludedByName.set(item.name, values);
}
const supplementalQaByName = new Map(supplementalQa.items.map((item) => [item.name, item]));
const baseJobByName = new Map(baseJobs.jobs.flatMap((job) =>
  job.drop_names.map((name) => [name, job])));
const categoryItems = manifest.categoryPreviews;
assert(Array.isArray(categoryItems), 'Image manifest has no category previews');
assert(new Set(categoryItems.map((item) => item.name)).size === categoryItems.length,
  'Duplicate category preview name');

const items = categoryItems.map((category) => {
  const { name } = category;
  const family = familyByName.get(name);
  const drop = catalogByName.get(name);
  const previous = auditByName.get(name);
  assert(family && drop && family.family === category.family, `${name}: category/family mismatch`);
  const excluded = excludedByName.get(name) ?? [];
  const evidenceByCode = new Map();
  const addCode = (code, tier) => {
    if (!code) return;
    const tiers = evidenceByCode.get(code) ?? new Set();
    tiers.add(tier);
    evidenceByCode.set(code, tiers);
  };
  for (const candidate of family.evidence.confirmedClientCodes) addCode(candidate.code, 'confirmed_client_name');
  for (const candidate of family.evidence.unitxtCandidateCodes) addCode(candidate.code, 'unitxt_name_candidate');
  addCode(drop.association.code, 'catalog_association');
  const websiteRows = databaseByName.get(key(name)) ?? [];
  if (!drop.association.code && websiteRows.length === 1) {
    for (const record of pmt.records) {
      if (record.family === websiteRows[0].family && parameterMatch(websiteRows[0], record))
        addCode(record.code, 'website_parameter_match');
    }
  }
  for (const candidate of excluded) addCode(candidate.code, candidate.evidenceTier);
  const candidates = [...evidenceByCode].sort(([a], [b]) => a.localeCompare(b)).map(([code, tiers]) => {
    const record = pmtByCode.get(code);
    assert(record, `${name}: candidate ${code} absent from PMT`);
    const result = { code, evidenceTiers: [...tiers].sort(), family: record.family,
      pmtId: record.pmt_id };
    if (record.family === 'weapon' || record.family === 'shield') {
      const modelIndex = record.type + (record.family === 'shield' ? 354 : 0);
      const textureIndex = record.skin + (record.family === 'shield' ? 378 : 0);
      result.resource = { model: slot('model', modelIndex), texture: slot('texture', textureIndex) };
    }
    return result;
  });
  const qa = [supplementalQaByName.get(name), baseJobByName.get(name)].filter(Boolean)
    .filter((record) => record.status === 'rejected' || record.visual_qa === 'rejected')
    .map((record) => ({ status: 'rejected', reason: record.reason ?? record.visual_qa_reason }));
  const hasUnavailableResource = candidates.some((candidate) => candidate.resource &&
    (candidate.resource.model.status !== 'present' || candidate.resource.texture.status !== 'present'));
  let nextStepStatus;
  let nextStep;
  if (qa.some((record) => /ring effects|translucent ring/i.test(record.reason))) {
    nextStepStatus = 'effect_render_required';
    nextStep = 'Reproduce the client runtime transparency/effect, then render and visually review the ring.';
  } else if (hasUnavailableResource) {
    nextStepStatus = 'resource_slot_unavailable';
    nextStep = 'Locate a usable model and texture source for the candidate code before rendering.';
  } else if (family.family === 'unknown' ||
      (['weapon', 'shield'].includes(family.family) && !candidates.some((candidate) => candidate.resource))) {
    nextStepStatus = 'identity_unresolved';
    nextStep = 'Confirm the item family and code from independent client or runtime evidence.';
  } else if (['tool', 'unit', 'armor'].includes(family.family)) {
    nextStepStatus = 'no_itemkt_or_model_route';
    nextStep = 'Find an item-specific client visual source; the audited ItemKT and AFS model routes do not supply one.';
  } else {
    nextStepStatus = 'identity_unresolved';
    nextStep = 'Resolve item identity and visual provenance before replacing the shared category preview.';
  }
  return { name, family: family.family, familyEvidenceTier: family.evidence.tier,
    sharedCategoryImage: category.image, candidateCodes: candidates,
    previousRenderStatus: previous?.render.status ?? null,
    excludedCandidateReasons: excluded.map(({ code, reason }) => ({ code, reason })),
    rejectedPreviews: qa, nextStepStatus, nextStep };
});
const counts = (values) => Object.fromEntries([...new Set(values)].sort().map((value) =>
  [value, values.filter((item) => item === value).length]));
const statuses = counts(items.map((item) => item.nextStepStatus));
assert(Object.values(statuses).reduce((sum, value) => sum + value, 0) === categoryItems.length,
  'Next-step statuses do not cover every category preview');
const output = {
  schema: 'destiny-remaining-appearance-audit-v1',
  scope: 'Entries in the current image manifest categoryPreviews, regardless of image mapping presence.',
  caveat: 'A shared category preview does not establish that an item has no individual in-game appearance. Candidate names and parameter matches do not prove runtime identity.',
  sources: Object.fromEntries(Object.entries(loaded).map(([key, source]) =>
    [key, { file: source.file, sha256: source.sha256 }])),
  archiveBoundaries: {
    model: { entries: archives.model.entries, bytes: archives.model.bytes.length },
    texture: { entries: archives.texture.entries, bytes: archives.texture.bytes.length },
  },
  counts: { total: items.length, family: counts(items.map((item) => item.family)),
    nextStepStatus: statuses },
  items,
};
await writeFile(join(directory, 'remaining-appearance-audit.json'), `${JSON.stringify(output, null, 2)}\n`);

const names = (status) => items.filter((item) => item.nextStepStatus === status)
  .map((item) => item.name).join(', ');
const labels = {
  effect_render_required: '需要还原运行时特效',
  identity_unresolved: '需要确认道具身份',
  no_itemkt_or_model_route: '当前 ItemKT／模型路径无单件图',
  resource_slot_unavailable: '候选模型或纹理槽不可用',
};
const markdown = `# Destiny 道具独立外观缺口\n\n` +
  `按当前图库清单生成：${items.length} 个掉落名称仍使用共用类别图。这不表示道具在游戏中一定没有独立外观。\n\n` +
  `| 下一步 | 数量 |\n| --- | ---: |\n` +
  Object.entries(statuses).map(([status, count]) => `| ${labels[status] ?? status} | ${count} |`).join('\n') +
  `\n\n模型档案有 ${archives.model.entries} 个条目，纹理档案有 ${archives.texture.entries} 个条目。` +
  '逐项候选代码、槽位、可用性、哈希和拒绝原因见 `remaining-appearance-audit.json`。\n\n' +
  `## 需要还原运行时特效\n\n${names('effect_render_required')}\n\n` +
  `现有静态图被拒绝：不透明平面无法呈现戒指光效。\n\n` +
  `## 候选模型或纹理槽不可用\n\n${names('resource_slot_unavailable')}\n\n` +
  `其中部分代码仅由官网参数匹配得到，仍需确认道具身份。\n\n` +
  `## 需要确认道具身份\n\n${names('identity_unresolved')}\n\n` +
  `另外 ${statuses.no_itemkt_or_model_route ?? 0} 项属于工具、插件或防具；当前 ItemKT／模型路径没有单件图，` +
  `需要寻找其他可核验的图像来源。\n`;
await writeFile(join(directory, 'remaining-appearance-audit.md'), markdown);
console.log(JSON.stringify(output.counts));
