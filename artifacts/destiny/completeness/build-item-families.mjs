import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const destiny = join(directory, '..');
const files = {
  catalog: 'catalog.json', database: 'database.json', names: 'resources/item-names.json',
  pmt: 'pmt/records.json',
};
const loaded = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => {
  const path = join(destiny, file);
  const bytes = await readFile(path);
  return [key, { data: JSON.parse(bytes), file: relative(directory, path),
    sha256: createHash('sha256').update(bytes).digest('hex') }];
})));
const { catalog, database, names, pmt } = Object.fromEntries(
  Object.entries(loaded).map(([key, item]) => [key, item.data]));
const allowed = new Set(['weapon', 'armor', 'shield', 'unit', 'mag', 'tool']);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const key = (name) => name.trim().toLowerCase();
const append = (map, name, value) => map.set(name, [...(map.get(name) ?? []), value]);
const dbByName = new Map();
const confirmedByName = new Map();
const rawByName = new Map();
const pmtByCode = new Map(pmt.records.map((item) => [item.code, item]));
for (const item of database.items) append(dbByName, key(item.name), item);
for (const item of names.items) {
  const record = pmtByCode.get(item.code);
  assert(record?.family === item.family && record.pmt_id === item.pmt_id,
    `${item.code}: PMT/name family or ID mismatch`);
  if (item.name_status === 'source_matched' && item.names?.en)
    append(confirmedByName, key(item.names.en), item);
  if (item.mapping_candidate?.unitxt_text)
    append(rawByName, key(item.mapping_candidate.unitxt_text), item);
}
const items = catalog.dropItems.map((drop) => {
  const name = drop.name;
  const db = dbByName.get(key(name)) ?? [];
  const confirmed = confirmedByName.get(key(name)) ?? [];
  const raw = rawByName.get(key(name)) ?? [];
  const classes = (values) => [...new Set(values.map((item) => item.family))].sort();
  const dbFamilies = classes(db);
  const confirmedFamilies = classes(confirmed);
  const rawFamilies = classes(raw);
  let family = 'unknown';
  let tier = 'unresolved';
  if (dbFamilies.length === 1) {
    family = dbFamilies[0];
    tier = 'website_database_category';
  } else if (!db.length && confirmedFamilies.length === 1) {
    family = confirmedFamilies[0];
    tier = 'verified_client_name_category';
  } else if (!db.length && !confirmed.length && rawFamilies.length === 1) {
    family = rawFamilies[0];
    tier = 'unitxt_candidate_category';
  }
  assert(family === 'unknown' || allowed.has(family), `${name}: unsupported family ${family}`);
  return {
    name,
    family,
    evidence: {
      tier,
      websiteRows: db.map((item) => ({ id: item.id, family: item.family })),
      confirmedClientCodes: confirmed.map((item) => ({ code: item.code, family: item.family,
        pmtId: item.pmt_id, nameIndex: item.name_index })),
      unitxtCandidateCodes: raw.map((item) => ({ code: item.code, family: item.family,
        pmtId: item.pmt_id, rule: item.mapping_candidate.rule,
        index: item.mapping_candidate.index, nameStatus: item.name_status })),
      note: tier === 'unitxt_candidate_category'
        ? 'Unique family among raw Unitxt text matches; code-to-name identity is not independently verified.'
        : tier === 'unresolved' ? 'No unique family in captured website rows or client text evidence.' : null,
    },
  };
});
assert(items.length === 517 && new Set(items.map((item) => item.name)).size === 517,
  'Expected one family assessment for every distinct Destiny drop name');
const counts = (values) => Object.fromEntries([...new Set(values)].sort().map((value) =>
  [value, values.filter((item) => item === value).length]));
const output = {
  schema: 'destiny-drop-item-families-v1',
  sources: Object.fromEntries(Object.entries(loaded).map(([key, item]) =>
    [key, { file: item.file, sha256: item.sha256 }])),
  matchingRule: 'Trim ends and lowercase English name only; never fold punctuation or infer a family from the apparent meaning of a name. Multiple website rows may establish a category if all share that category; they do not establish a unique item code.',
  counts: { total: items.length, families: counts(items.map((item) => item.family)),
    evidenceTiers: counts(items.map((item) => item.evidence.tier)) },
  items,
};
await writeFile(join(directory, 'item-families.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.counts));
