import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const inputs = {
  catalog: 'catalog.json', database: 'database.json', names: 'resources/item-names.json',
  pmt: 'pmt/records.json', images: 'dropcharts/destiny/images/mapping.json',
};
const loaded = Object.fromEntries(await Promise.all(Object.entries(inputs).map(async ([key, filename]) => {
  const bytes = await readFile(join(root, filename));
  return [key, { value: JSON.parse(bytes), file: filename, sha256: createHash('sha256').update(bytes).digest('hex') }];
})));
const { catalog, database, names, pmt, images } = Object.fromEntries(
  Object.entries(loaded).map(([key, item]) => [key, item.value]));
const source = Object.fromEntries(Object.entries(loaded).map(([key, item]) =>
  [key, { file: item.file, sha256: item.sha256 }]));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function key(name) {
  return name.trim().toLowerCase();
}

function append(map, index, value) {
  const values = map.get(index) ?? [];
  values.push(value);
  map.set(index, values);
}

function number(value) {
  return typeof value === 'string' && /^\+?\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

function compare(website, record) {
  const fields = website.fields;
  const params = record.parameters;
  const checks = [];
  const add = (field, expected, actual, className = 'server_mutable') => {
    if (expected == null || actual == null) return;
    checks.push({ field, website: expected, pmt: actual, agrees: expected === actual, class: className });
  };
  if (record.family === 'weapon') {
    const atp = fields.ATP?.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (atp) {
      add('ATP min', Number(atp[1]), params.atpmin);
      add('ATP max', Number(atp[2]), params.atpmax);
    }
    add('ATA', number(fields.ATA), params.ata & 255);
    add('MST', number(fields.MST), params.mst);
    add('Grind', number(fields.Grind), params.maxgrind & 255);
    const required = fields.Required?.match(/^\s*(ATP|MST|ATA)\s+(\d+)\s*$/);
    if (required) add(`Required ${required[1]}`, Number(required[2]), params[`${required[1].toLowerCase()}req`]);
  } else if (record.family === 'armor' || record.family === 'shield') {
    add('min-DFP', number(fields['min-DFP']), params.dfp);
    add('max-DFP', number(fields['max-DFP']), params.dfp + (params.dfprange & 255));
    add('min-EVP', number(fields['min-EVP']), params.evp);
    add('max-EVP', number(fields['max-EVP']), params.evp + (params.evprange & 255));
    for (const field of ['EFR', 'ETH', 'EIC', 'EDK', 'ELT'])
      add(field, number(fields[field]), params[field.toLowerCase()] & 255);
    add('Required level', number(fields.Required?.match(/^\s*Level\s+(\d+)\s*$/i)?.[1] ?? null),
      params.requiredlevel);
  } else if (record.family === 'unit') {
    add('Stat Amount', number(fields['Stat Amount']), params.statamount);
  } else if (record.family === 'mag') {
    const chance = fields['Activation Chance']?.match(/^\s*(\d+)%\s*$/);
    if (chance) add('Activation Chance %', Number(chance[1]), params.activation & 255);
  }
  return {
    checked: checks.length,
    agrees: checks.filter((check) => check.agrees).length,
    conflicts: checks.filter((check) => !check.agrees).length,
    checks,
  };
}

const byCode = new Map(pmt.records.map((item) => [item.code, item]));
assert(byCode.size === pmt.records.length, 'PMT codes must be unique');
const dbByName = new Map();
const nameByName = new Map();
for (const item of database.items) append(dbByName, key(item.name), item);
for (const item of names.items) {
  const name = item.names?.en ?? item.mapping_candidate?.unitxt_text;
  if (name) append(nameByName, key(name), item);
}
const inventory = {};
const archiveBlobs = {};
for (const archive of ['ItemModelEp4', 'ItemTextureEp4']) {
  const bytes = await readFile(join(root, 'resources', 'originals', `${archive}.afs`));
  assert(bytes.toString('ascii', 0, 3) === 'AFS', `${archive}: invalid AFS header`);
  inventory[archive] = { entries: bytes.readUInt32LE(4), sha256: createHash('sha256').update(bytes).digest('hex') };
  archiveBlobs[archive] = bytes;
}
const imageManifest = JSON.parse(await readFile(join(root, 'resources', 'itemkt-images', 'manifest.json')));

function archiveEntryHash(archive, index) {
  const bytes = archiveBlobs[archive];
  if (index < 0 || index >= inventory[archive].entries) return null;
  const offset = bytes.readUInt32LE(8 + 8 * index);
  const size = bytes.readUInt32LE(12 + 8 * index);
  if (!offset || !size || offset + size > bytes.length) return null;
  return createHash('sha256').update(bytes.subarray(offset, offset + size)).digest('hex');
}

function modelSlots(record) {
  if (!['weapon', 'shield'].includes(record.family)) return { status: 'unsupported_family' };
  const model = record.type + (record.family === 'shield' ? 354 : 0);
  const texture = record.skin + (record.family === 'shield' ? 378 : 0);
  return {
    status: model < inventory.ItemModelEp4.entries && texture < inventory.ItemTextureEp4.entries
      ? 'slots_in_range_unverified_payload' : 'slot_out_of_range',
    model, texture,
  };
}

function evidenceStatus(catalogAssociation, nameItems, websiteItems, pair) {
  if (catalogAssociation.code) return 'source_matched';
  if (!pair) return 'unresolved';
  if (nameItems.length !== 1 || websiteItems.length !== 1) return 'ambiguous_name';
  if (pair.name_status === 'source_matched') return 'source_matched';
  const comparison = compare(websiteItems[0], byCode.get(pair.code));
  if (comparison.checked === 0) return 'unitxt_unique_name_only';
  if (comparison.conflicts === 0 && comparison.checked >= 4) return 'unitxt_unique_multi_parameter_agree';
  if (comparison.agrees >= 3) return 'unitxt_unique_mixed_parameters';
  return 'unitxt_unique_weak_or_conflicting';
}

const missing = catalog.dropItems.filter((item) => images[item.name] === undefined).map((item) => {
  const keyName = key(item.name);
  const db = dbByName.get(keyName) ?? [];
  const nameCandidates = nameByName.get(keyName) ?? [];
  const uniquePair = nameCandidates.length === 1 && db.length === 1 && nameCandidates[0].family === db[0].family
    ? nameCandidates[0] : null;
  const candidateCode = item.association.code ?? uniquePair?.code ?? null;
  const record = candidateCode ? byCode.get(candidateCode) : null;
  const comparison = uniquePair ? compare(db[0], byCode.get(uniquePair.code)) : null;
  const status = evidenceStatus(item.association, nameCandidates, db, uniquePair);
  const parameterOnlyCandidates = candidateCode || db.length !== 1 ? [] : pmt.records
    .filter((candidate) => candidate.family === db[0].family)
    .map((candidate) => ({ code: candidate.code, pmtId: candidate.pmt_id,
      comparison: compare(db[0], candidate) }))
    .filter((candidate) => candidate.comparison.checked >= 4 && candidate.comparison.conflicts === 0)
    .map((candidate) => ({ code: candidate.code, pmtId: candidate.pmtId,
      checked: candidate.comparison.checked }));
  return {
    name: item.name,
    occurrences: item.occurrences,
    catalog: item.association,
    websiteCandidates: db.map((row) => ({ id: row.id, family: row.family, name: row.name })),
    nameCandidates: nameCandidates.map((row) => ({
      code: row.code, family: row.family, pmtId: row.pmt_id, nameStatus: row.name_status,
      nameIndex: row.name_index, mappingCandidate: row.mapping_candidate,
      unresolvedReason: row.unresolved_reason ?? null,
    })),
    evidenceStatus: status,
    candidateCode,
    parameterComparison: comparison,
    parameterOnlyCandidates,
    render: record ? modelSlots(record) : { status: 'no_unique_code' },
  };
});

const variantNames = ["DB'S SABER", "FLOWEN'S SWORD", 'AGITO', "NEI'S CLAW", 'RAGE DE FEU'];
const variants = variantNames.map((name) => {
  const websiteRows = dbByName.get(key(name)) ?? [];
  const candidates = (nameByName.get(key(name)) ?? []).filter((item) => item.family === 'weapon');
  const codes = candidates.map((item) => {
    const record = byCode.get(item.code);
    const slots = modelSlots(record);
    const entry = record.pmt_id >= 177 && record.pmt_id <= 598 ? record.pmt_id - 95 : null;
    const icon = entry === null ? null : imageManifest.archives.ItemKTep4.entries[entry]?.images?.[0] ?? null;
    const checks = websiteRows.map((row) => ({ id: row.id, comparison: compare(row, record) }));
    return {
      code: item.code,
      nameStatus: item.name_status,
      pmtId: record.pmt_id,
      type: record.type,
      skin: record.skin,
      itemKtEntry: entry,
      itemKtImageSha256: icon?.sha256 ?? null,
      modelSlot: slots.model ?? null,
      textureSlot: slots.texture ?? null,
      modelEntrySha256: slots.status === 'slots_in_range_unverified_payload'
        ? archiveEntryHash('ItemModelEp4', slots.model) : null,
      textureEntrySha256: slots.status === 'slots_in_range_unverified_payload'
        ? archiveEntryHash('ItemTextureEp4', slots.texture) : null,
      websiteRows: checks,
    };
  });
  const appearances = new Map();
  for (const code of codes) {
    if (!code.modelEntrySha256 || !code.textureEntrySha256) continue;
    append(appearances, `${code.modelEntrySha256}:${code.textureEntrySha256}`, code.code);
  }
  return {
    name,
    websiteRowIds: websiteRows.map((row) => row.id),
    codes,
    exactModelTextureGroups: [...appearances.values()],
    allCandidatesExactModelTextureEquivalent: codes.length > 0 && appearances.size === 1 &&
      [...appearances.values()][0].length === codes.length,
  };
});
assert(missing.length === catalog.dropItems.length - Object.keys(images).length,
  'Every mapped name must belong to catalog drops');
const counts = (field) => Object.fromEntries([...new Set(missing.map(field))].sort().map((value) =>
  [value, missing.filter((item) => field(item) === value).length]));
const output = {
  schema: 'destiny-missing-image-audit-v1',
  sources: source,
  archiveInventory: inventory,
  method: 'Exact English trim/lowercase match only. Confirmed client names and raw Unitxt mapping candidates remain separate evidence tiers. A unique raw candidate plus website row and multiple matching PMT fields is a correlation, not proof of runtime identity. Parameter conflicts are preserved per field.',
  counts: {
    missing: missing.length,
    catalogStatus: counts((item) => item.catalog.status),
    evidenceStatus: counts((item) => item.evidenceStatus),
    renderStatus: counts((item) => item.render.status),
  },
  items: missing,
  sameNameVariants: variants,
};
await writeFile(join(root, 'missing-image-audit.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.counts));
