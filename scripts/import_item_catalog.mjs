// Import a MediaWiki action=query revision export; no network is needed to build the site.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { templates, pageSource } from './item_catalog_wiki.mjs';
import { clean } from './item_catalog_model.mjs';
import { extractMechanics } from './item_catalog_mechanics.mjs';

const args = process.argv.slice(2);
const merge = args[0] === '--merge';
const [pagesFile, imagesFile] = merge ? args.slice(1) : args;
if (!pagesFile || !imagesFile) throw new Error('Usage: node scripts/import_item_catalog.mjs [--merge] pages.json image-bytes.json');
const pages = JSON.parse(fs.readFileSync(pagesFile));
const images = JSON.parse(fs.readFileSync(imagesFile));
const checkedAt = new Date().toISOString().slice(0, 10);
const out = 'content/item-catalog';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync('assets/img/items/wiki', { recursive: true });
// --merge refreshes only the exported pages and keeps every other snapshot record unchanged.
const previous = merge ? JSON.parse(fs.readFileSync(`${out}/wiki.json`, 'utf8')) : null;
const imageIndex = merge ? JSON.parse(fs.readFileSync(`${out}/images.json`, 'utf8')) : {};
for (const image of images) {
  const bytes = Buffer.from(image.base64, 'base64');
  if (createHash('sha1').update(bytes).digest('hex') !== image.sha1) throw new Error(`Image checksum: ${image.title}`);
  // A derived image is a still PNG frame of an animated Wiki original; `derivedFrom` records that original.
  const derived = image.derivedFrom;
  if (derived && (!/^[0-9a-f]{40}$/.test(derived.sha1) || !Number.isInteger(derived.frame))) throw new Error(`Invalid derived image: ${image.title}`);
  const filename = `${image.sha1.slice(0, 16)}${derived ? '.png' : path.extname(new URL(image.url).pathname)}`;
  fs.writeFileSync(`assets/img/items/wiki/${filename}`, bytes);
  imageIndex[image.title.slice(5)] = {
    path: `/assets/img/items/wiki/${filename}`, source: image.url, page: image.descriptionurl,
    sha1: image.sha1, width: image.width, height: image.height, ...(derived ? { derivedFrom: derived } : {}),
  };
}
const records = [];
const indexes = {};
const rowNames = /^(?:WeaponTableRow|FrameTableRow|BarrierTableRow|UnitTableRow|ToolTableRow)/;
const selected = new Set(['TechBoostRow', 'SetEffectRow', 'ReskinsRow', 'MagFeedTable', 'AddSpecial', 'EnemyWeaponHit', 'SpecialCommon']);
const comboPage = pages['List of weapons which cannot combo'];
if (!merge && !comboPage) throw new Error('A full import requires List of weapons which cannot combo');
const noCombo = new Set(templates(pageSource(comboPage))
  .filter(t => ['Sword', 'Gun', 'Cane'].includes(t.name)).map(t => t.fields[2] || t.fields[1]));
const previousRecords = new Map((previous?.records || []).map(r => [r.title, r]));
// Item link templates take an optional color first: {{Tool|rare|Name|label}} or {{Tool|Name|label}}.
const equipmentName = t => /^(?:rare|common)$/i.test(t.fields[1] || '') ? t.fields[2] : t.fields[1];
const equipment = source => templates(source).filter(t => ['Sword', 'Gun', 'Cane'].includes(t.name)).map(equipmentName);
// The list page uses rowspans, so a heart row without its own compatibility cell shares the previous one.
function weaponHeartIndex(page) {
  const source = pageSource(page);
  const rows = [];
  const photonFilter = [];
  for (const table of source.match(/\{\|[\s\S]*?\n\|\}/g) || []) {
    const filterTable = /Photon Filter-compatible/.test(table);
    let shared = [];
    for (const row of table.replace(/\n\|\}$/, '').split(/\n\|-/).slice(1)) {
      const heart = templates(row).find(t => t.name === 'Tool' && /^Heart of /.test(equipmentName(t)));
      if (!heart) continue;
      const name = equipmentName(heart);
      const cells = row.split(/\n\|/).slice(1);
      if (filterTable) {
        photonFilter.push({ heart: name, weapons: equipment(cells[1] || ''), color: clean((cells[2] || '').split('|').pop()) });
        continue;
      }
      if (cells[1]) shared = equipment(cells[1]);
      rows.push({ template: 'WeaponHeartRow', 1: name, compatible: shared });
    }
  }
  if (!rows.length || !photonFilter.length) throw new Error('Weapon hearts tables were not recognized');
  return { revision: page.revisions[0].revid, rows, photonFilter };
}
// Ring paints and platings: the page's appearance screenshot plus the structured acquisition facts.
function ringCosmetic(title, source, availability) {
  const appearance = /\[\[File:([^|\]]+)/i.exec(source)?.[1].trim() || null;
  const trade = [...availability.matchAll(/^\|\s*(\{\{(?:Sword|Gun|Cane|Frame|Shield|Unit|Mag|Tool)\|[^\n]*?\}\})\s*\|\|[^\n|]*\|\s*(\d+)\s*$/gm)]
    .map(([, call, quantity]) => ({ item: equipmentName(templates(call)[0]), quantity: Number(quantity) }));
  const shop = /purchased from the \{\{Quest link\|([^}|]+)\}\} for (\d+) (\{\{Tool\|[^}]+\}\})/.exec(availability);
  const event = /(\{\{Tool\|[^}]+\}\}) during the \[\[([^\]|]+)/.exec(availability);
  const free = [...availability.matchAll(/\{\{Quest link\|([^}|]+)\}\}/g)].map(m => m[1]);
  const result = {
    appearance,
    trade,
    shop: shop ? { quest: shop[1], price: Number(shop[2]), currency: equipmentName(templates(shop[3])[0]) } : null,
    event: event ? { via: equipmentName(templates(event[1])[0]), event: event[2] } : null,
    freeQuests: /for free/i.test(availability) ? free : [],
  };
  if (!result.trade.length && !result.shop && !result.event && !result.freeQuests.length) throw new Error(`Unrecognized ring cosmetic availability: ${title}`);
  return result;
}
for (const page of Object.values(pages)) {
  if (page.ns !== 0) continue;
  const source = pageSource(page);
  const calls = templates(source);
  const item = calls.find(t => t.name.toLowerCase() === 'item');
  if (page.title === 'Weapon hearts') { indexes[page.title] = weaponHeartIndex(page); continue; }
  if (!item) {
    const rows = calls.filter(t => rowNames.test(t.name));
    if (page.title === 'Music disks') {
      for (const match of source.matchAll(/^\*\s*\[\[(Disk Vol\.[^\]]+)\]\]/gm)) rows.push({name: 'MusicDiskListRow', fields: {1: match[1]}});
    }
    if (rows.length) indexes[page.title] = { revision: page.revisions[0].revid, rows: rows.map(t => ({ template: t.name, ...t.fields })) };
    continue;
  }
  // Infobox facts and table rows only. Article prose and flavor descriptions are not republished.
  const { desc, ...fields } = item.fields;
  const acquisition = [];
  const drops = [];
  let kind = '';
  let state = {};
  for (const t of calls) {
    if (/^(DropTableHead|CommonDropTableHead|BoxDropTableHead)$/.test(t.name)) {
      kind = t.name === 'BoxDropTableHead' ? 'box' : 'enemy'; state = {};
    }
    if (/^(DropRow|CommonDropRow)$/.test(t.name) && kind) {
      for (const key of ['id', 'diff', 'area']) if (t.fields[key]) state[key] = t.fields[key];
      drops.push({ kind, ...state, location: t.fields[1] || '', rate: t.fields[2] || '' });
    }
  }
  const availability = source.match(/==\s*Availability\s*==([\s\S]*?)(?=\n==[^=]|$)/i)?.[1] || '';
  for (const match of availability.matchAll(/===\s*([^=\n]+?)\s*===/g)) acquisition.push(match[1]);
  const related = calls.filter(t => /^(Sword|Gun|Cane|Frame|Shield|Unit|Mag|Tool)$/.test(t.name))
    .map(t => t.fields[2] || t.fields[1]).filter(Boolean);
  const mechanics = source.slice(item.end).split(/\n==\s*(?:Availability|Trivia|Gallery|Reskins|The Forge)/i)[0];
  // Headings and tables can follow prose without a blank line; start a new paragraph at each so they are filtered.
  const sentences = mechanics.split(/\n\s*\n|\n(?=\s*(?:==|\{\|))/).filter(p => !/^\s*(?:[{:|=!]|<)/.test(p))
    .map(p => clean(p, true)).flatMap(p => p.split(/(?<=[.!?])\s+(?=[A-Z])/u))
    .map(p => p.trim()).filter(p => /special|increas|decreas|reduc|boost|effect|equipp|restor|consum|evolv|combin|cost|chance|cannot|kills|damage|immun/i.test(p));
  const excerpts = []; let words = 0;
  for (const sentence of sentences) {
    const count = sentence.split(/\s+/).length;
    if (words + count > 25) continue;
    excerpts.push(sentence); words += count;
  }
  const compatible = /^weapon heart$/i.test(clean(fields.type))
    ? equipment(source.match(/==\s*Compatible equipment\s*==([\s\S]*?)(?=\n==[^=]|$)/i)?.[1] || '') : [];
  if (/^weapon heart$/i.test(clean(fields.type)) && !compatible.length) throw new Error(`Weapon heart without compatible equipment: ${page.title}`);
  const cosmetic = /^ring (?:paint|plating)$/i.test(clean(fields.type)) ? ringCosmetic(page.title, source, availability) : null;
  records.push({
    title: page.title, revision: page.revisions[0].revid, timestamp: page.revisions[0].timestamp,
    ...(merge ? { checkedAt } : {}), ...(compatible.length ? { compatible } : {}), ...(cosmetic ? { cosmetic } : {}),
    fields, excerpts, tables: calls.filter(t => selected.has(t.name)).map(t => ({ template: t.name, ...t.fields })),
    acquisition: [...new Set(acquisition)], drops, related: [...new Set(related)],
    obsolete: calls.some(t => t.name === 'Obsolete'),
    unavailable: /(?:currently |remains? )unobtainable|not (?:currently )?obtainable on Ephinea/i.test(source),
    noCombo: comboPage ? noCombo.has(page.title) : previousRecords.get(page.title)?.noCombo ?? false,
    ...extractMechanics(mechanics, fields.type),
  });
}
if (merge) {
  for (const record of records) previousRecords.set(record.title, record);
  records.splice(0, records.length, ...previousRecords.values());
}
records.sort((a, b) => a.title.localeCompare(b.title, 'en'));
const snapshot = merge
  ? { checkedAt: previous.checkedAt, indexes: { ...previous.indexes, ...indexes }, records }
  : { checkedAt, indexes, records };
fs.writeFileSync(`${out}/wiki.json`, JSON.stringify(snapshot, null, 2) + '\n');
fs.writeFileSync(`${out}/images.json`, JSON.stringify(imageIndex, null, 2) + '\n');
console.log(`${merge ? 'Merged' : 'Imported'} ${records.length} items, ${Object.keys(indexes).length} index pages, ${images.length} verified images.`);
