import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const categories = [
  { source: 'weapons', family: 'weapon', count: 490 },
  { source: 'armor', family: 'armor', count: 111 },
  { source: 'shields', family: 'shield', count: 207 },
  { source: 'units', family: 'unit', count: 132 },
  { source: 'mags', family: 'mag', count: 82 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nameKey(value) {
  // Do not fold punctuation, spacing inside a name, or alternate spellings.
  return value.trim().toLowerCase();
}

async function loadJson(path) {
  const bytes = await readFile(path);
  return {
    data: JSON.parse(bytes.toString('utf8')),
    source: {
      file: relative(directory, path),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
}

function append(map, key, value) {
  const entries = map.get(key) ?? [];
  entries.push(value);
  map.set(key, entries);
}

function strictInteger(value) {
  if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value.trim())) return null;
  return Number(value.trim());
}

function compareParameterFields(website, pmt) {
  const checks = [];
  const parameters = pmt.parameters;
  const family = pmt.family;
  const compare = (field, websiteValue, pmtValue) => {
    if (websiteValue === null || !Number.isFinite(pmtValue)) return;
    checks.push({ field, websiteValue, pmtValue, agrees: websiteValue === pmtValue });
  };
  const unsignedByte = (value) => value == null ? null : value & 0xff;

  if (family === 'weapon') {
    const atp = website.fields.ATP?.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (atp) {
      compare('ATP min', Number(atp[1]), parameters.atpmin);
      compare('ATP max', Number(atp[2]), parameters.atpmax);
    }
    compare('ATA', strictInteger(website.fields.ATA), unsignedByte(parameters.ata));
    compare('MST', strictInteger(website.fields.MST), parameters.mst);
    compare('Grind', strictInteger(website.fields.Grind), unsignedByte(parameters.maxgrind));
    const required = website.fields.Required?.match(/^\s*(ATP|MST|ATA)\s+(\d+)\s*$/);
    if (required) compare(`Required ${required[1]}`, Number(required[2]), parameters[`${required[1].toLowerCase()}req`]);
  } else if (family === 'armor' || family === 'shield') {
    compare('min-DFP', strictInteger(website.fields['min-DFP']), parameters.dfp);
    compare('max-DFP', strictInteger(website.fields['max-DFP']), parameters.dfp + unsignedByte(parameters.dfprange));
    compare('min-EVP', strictInteger(website.fields['min-EVP']), parameters.evp);
    compare('max-EVP', strictInteger(website.fields['max-EVP']), parameters.evp + unsignedByte(parameters.evprange));
    for (const field of ['EFR', 'ETH', 'EIC', 'EDK', 'ELT'])
      compare(field, strictInteger(website.fields[field]), unsignedByte(parameters[field.toLowerCase()]));
  } else if (family === 'unit') {
    compare('Stat Amount', strictInteger(website.fields['Stat Amount']), parameters.statamount);
  } else if (family === 'mag') {
    const chance = website.fields['Activation Chance']?.match(/^\s*(\d+)%\s*$/);
    if (chance) compare('Activation Chance %', Number(chance[1]), unsignedByte(parameters.activation));
  }
  return {
    status: checks.length === 0 ? 'not_comparable' : checks.every((check) => check.agrees) ? 'agree' : 'conflict',
    checkedFields: checks.length,
    conflicts: checks.filter((check) => !check.agrees),
  };
}

function candidateAssociation(pmtCandidates, databaseCandidates, pmtByCode, dbById) {
  const reasons = [];
  if (!pmtCandidates.length) reasons.push('missing_pmt_name');
  else if (pmtCandidates.length > 1) reasons.push('multiple_pmt_codes');
  if (!databaseCandidates.length) reasons.push('missing_website_record');
  else if (databaseCandidates.length > 1) reasons.push('multiple_website_records');
  if (!reasons.length && pmtCandidates[0].family !== databaseCandidates[0].family)
    reasons.push('category_mismatch');
  if (reasons.length) return { status: 'unresolved', reasons };

  const code = pmtCandidates[0].code;
  const databaseId = databaseCandidates[0].id;
  const parameterComparison = compareParameterFields(dbById.get(databaseId), pmtByCode.get(code));
  return {
    status: parameterComparison.status === 'conflict' ? 'parameter_conflict'
      : parameterComparison.status === 'agree' ? 'parameter_consistent' : 'name_only',
    code,
    databaseId,
    parameterComparison,
  };
}

async function main() {
  const databaseSources = [];
  const databaseItems = [];
  for (const category of categories) {
    // These .html files contain JSON saved from the database's rendered rows.
    const path = join(directory, 'source', `database-${category.source}-rows.html`);
    const { data, source } = await loadJson(path);
    assert(Array.isArray(data.rows) && data.rows.length === category.count,
      `${category.source}: expected ${category.count} saved rows`);
    assert(typeof data.url === 'string' && data.url.startsWith('https://playpso.net/database'),
      `${category.source}: invalid source URL`);
    databaseSources.push({ ...source, url: data.url, category: category.family, rows: data.rows.length, snapshots: data.snapshots?.length ?? null });
    data.rows.forEach((fields, index) => {
      assert(typeof fields.Name === 'string' && fields.Name.trim(), `${category.source} row ${index}: missing Name`);
      const id = `${category.family}:${String(index).padStart(3, '0')}`;
      databaseItems.push({ id, family: category.family, name: fields.Name, fields });
    });
  }
  const { data: namesData, source: namesSource } = await loadJson(join(directory, 'resources', 'item-names.json'));
  const { data: pmtData, source: pmtSource } = await loadJson(join(directory, 'pmt', 'records.json'));
  const { data: dropsData, source: dropsSource } = await loadJson(join(directory, 'drops.json'));
  const { data: inventory, source: inventorySource } = await loadJson(join(directory, 'resources', 'inventory.json'));
  assert(namesData.sources?.pmt?.sha256 === pmtData.source.sha256,
    'Item-name file and PMT records cite different source PMT captures');
  assert(Array.isArray(namesData.items) && Array.isArray(pmtData.records), 'Missing PMT/name records');
  assert(Array.isArray(dropsData.tables) && dropsData.tables.length === 12, 'Expected 12 parsed drop tables');
  const pmtInventory = inventory.files?.find((file) => file.copy === 'originals/ItemPMT.prs');
  const unitxtInventory = inventory.files?.find((file) => file.copy === 'originals/unitxt_j.prs');
  assert(pmtInventory?.sha256 === pmtData.source.sha256, 'Inventory/PMT capture hash mismatch');
  assert(unitxtInventory?.sha256 === namesData.sources?.en?.sha256, 'Inventory/English Unitxt hash mismatch');

  const pmtByCode = new Map(pmtData.records.map((record) => [record.code, record]));
  const dbById = new Map(databaseItems.map((item) => [item.id, item]));
  assert(pmtByCode.size === pmtData.records.length, 'PMT codes are not unique');
  const pmtByName = new Map();
  for (const item of namesData.items) {
    const record = pmtByCode.get(item.code);
    assert(record && record.family === item.family && record.pmt_id === item.pmt_id,
      `Name/PMT mismatch at code ${item.code}`);
    const name = item.names?.en;
    assert(item.name_status === 'source_matched' || item.name_status === 'unresolved',
      `Missing name verification status at code ${item.code}`);
    if (item.name_status === 'unresolved') {
      assert(!name, `Unresolved code ${item.code} unexpectedly has a confirmed English name`);
      continue;
    }
    assert(typeof name === 'string' && name.trim() && Number.isInteger(item.name_index),
      `Source-matched code ${item.code} lacks a confirmed English name/index`);
    append(pmtByName, nameKey(name), {
      code: item.code,
      codeMatch: record.code_match,
      family: item.family,
      pmtId: item.pmt_id,
      name,
      nameStatus: item.name_status,
      nameIndex: item.name_index,
      mappingRule: item.mapping_candidate?.rule ?? null,
    });
  }
  const dbByName = new Map();
  for (const item of databaseItems)
    append(dbByName, nameKey(item.name), { id: item.id, family: item.family, name: item.name });

  const dropCounts = new Map();
  for (const table of dropsData.tables) {
    for (const row of table.rows) {
      for (const drop of row.drops) {
        if (drop.noItem || !drop.item) continue;
        dropCounts.set(drop.item, (dropCounts.get(drop.item) ?? 0) + 1);
      }
    }
  }
  const dropItems = [...dropCounts].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, occurrences]) => {
    const key = nameKey(name);
    const pmtCandidates = pmtByName.get(key) ?? [];
    const databaseCandidates = dbByName.get(key) ?? [];
    return {
      name,
      occurrences,
      pmtCandidates,
      databaseCandidates,
      association: candidateAssociation(pmtCandidates, databaseCandidates, pmtByCode, dbById),
    };
  });
  const websiteAssociations = databaseItems.map((item) => {
    const key = nameKey(item.name);
    return {
      databaseId: item.id,
      name: item.name,
      family: item.family,
      association: candidateAssociation(pmtByName.get(key) ?? [], dbByName.get(key) ?? [], pmtByCode, dbById),
    };
  });
  const countStatuses = (entries) => Object.fromEntries(
    [...new Set(entries.map((entry) => entry.association.status))].sort().map(
      (status) => [status, entries.filter((entry) => entry.association.status === status).length],
    ),
  );
  const reasonCounts = {};
  for (const entry of dropItems)
    for (const reason of entry.association.reasons ?? [])
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  const conflicts = dropItems.filter((item) => item.association.status === 'parameter_conflict').map((item) => ({
    name: item.name,
    code: item.association.code,
    databaseId: item.association.databaseId,
    fields: item.association.parameterComparison.conflicts,
  }));
  const websiteConflicts = websiteAssociations.filter((item) => item.association.status === 'parameter_conflict').map((item) => ({
    name: item.name,
    code: item.association.code,
    databaseId: item.databaseId,
    fields: item.association.parameterComparison.conflicts,
  }));

  const database = {
    schema: 'destiny-website-database-v1',
    sources: databaseSources,
    categories: Object.fromEntries(categories.map((category) => [category.family, category.count])),
    items: databaseItems,
  };
  const catalog = {
    schema: 'destiny-catalog-candidates-v1',
    matchingRule: 'Trim ends and lowercase English names only; require exactly one PMT code and one website row with the same family. No punctuation, internal-space, alias, or stock-server normalization.',
    sources: { database: 'database.json', itemNames: namesSource, pmt: pmtSource, drops: dropsSource, inventory: inventorySource },
    dropItems,
    websiteAssociations,
  };
  const coverage = {
    schema: 'destiny-catalog-coverage-v1',
    sourceTiming: {
      pmtCaptureModifiedLocal: pmtInventory.modified_local,
      unitxtFileModifiedLocal: unitxtInventory.modified_local,
      websiteSnapshotDate: inventory.captured_on,
      note: 'The local English Unitxt file is older than the PMT capture; discrepancies alone do not establish when or why data changed.',
    },
    websiteRows: databaseItems.length,
    sourceMatchedPmtRecords: [...pmtByName.values()].reduce((sum, items) => sum + items.length, 0),
    unresolvedPmtNames: namesData.coverage.unresolved,
    distinctDropNames: dropItems.length,
    dropAssociationStatuses: countStatuses(dropItems),
    websiteAssociationStatuses: countStatuses(websiteAssociations),
    unresolvedDropReasons: reasonCounts,
    dropParameterConflicts: conflicts,
    websiteParameterConflicts: websiteConflicts,
    notes: [
      'Candidate codes are from the Destiny PMT and English names independently matched to installed-client Solylib code comments; other PMT names remain unresolved.',
      'An unresolved name remains unresolved even if one candidate looks plausible.',
      'Parameter conflicts preserve both the website value and the PMT value and do not assert which source is newer or correct.',
      'Website fields, including Description and Notes, remain unchanged in database.json.',
    ],
  };
  await writeFile(join(directory, 'database.json'), `${JSON.stringify(database, null, 2)}\n`);
  await writeFile(join(directory, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(join(directory, 'coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`);
  console.log(JSON.stringify({ websiteRows: coverage.websiteRows, sourceMatchedPmtRecords: coverage.sourceMatchedPmtRecords,
    distinctDropNames: coverage.distinctDropNames, dropAssociationStatuses: coverage.dropAssociationStatuses,
    unresolvedDropReasons: coverage.unresolvedDropReasons }));
}

await main();
