// Import a MediaWiki action=query revision export; no network is needed to build the site.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { templates, pageSource } from './item_catalog_wiki.mjs';
import { clean } from './item_catalog_model.mjs';
import { extractMechanics } from './item_catalog_mechanics.mjs';

const [pagesFile, imagesFile] = process.argv.slice(2);
if (!pagesFile || !imagesFile) throw new Error('Usage: node scripts/import_item_catalog.mjs pages.json image-bytes.json');
const pages = JSON.parse(fs.readFileSync(pagesFile));
const images = JSON.parse(fs.readFileSync(imagesFile));
const checkedAt = new Date().toISOString().slice(0, 10);
const out = 'content/item-catalog';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync('assets/img/items/wiki', { recursive: true });
const imageIndex = {};
for (const image of images) {
  const bytes = Buffer.from(image.base64, 'base64');
  if (createHash('sha1').update(bytes).digest('hex') !== image.sha1) throw new Error(`Image checksum: ${image.title}`);
  const filename = `${image.sha1.slice(0, 16)}${path.extname(new URL(image.url).pathname)}`;
  fs.writeFileSync(`assets/img/items/wiki/${filename}`, bytes);
  imageIndex[image.title.slice(5)] = {
    path: `/assets/img/items/wiki/${filename}`, source: image.url, page: image.descriptionurl,
    sha1: image.sha1, width: image.width, height: image.height,
  };
}
const records = [];
const indexes = {};
const rowNames = /^(?:WeaponTableRow|FrameTableRow|BarrierTableRow|UnitTableRow|ToolTableRow)/;
const selected = new Set(['TechBoostRow', 'SetEffectRow', 'ReskinsRow', 'MagFeedTable', 'AddSpecial', 'EnemyWeaponHit', 'SpecialCommon']);
const noCombo = new Set(templates(pageSource(pages['List of weapons which cannot combo']))
  .filter(t => ['Sword', 'Gun', 'Cane'].includes(t.name)).map(t => t.fields[2] || t.fields[1]));
for (const page of Object.values(pages)) {
  if (page.ns !== 0) continue;
  const source = pageSource(page);
  const calls = templates(source);
  const item = calls.find(t => t.name.toLowerCase() === 'item');
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
  const sentences = mechanics.split(/\n\s*\n/).filter(p => !/^\s*(?:[{:|=!]|<)/.test(p))
    .map(p => clean(p, true)).flatMap(p => p.split(/(?<=[.!?])\s+(?=[A-Z])/u))
    .map(p => p.trim()).filter(p => /special|increas|decreas|reduc|boost|effect|equipp|restor|consum|evolv|combin|cost|chance|cannot|kills|damage|immun/i.test(p));
  const excerpts = []; let words = 0;
  for (const sentence of sentences) {
    const count = sentence.split(/\s+/).length;
    if (words + count > 25) continue;
    excerpts.push(sentence); words += count;
  }
  records.push({
    title: page.title, revision: page.revisions[0].revid, timestamp: page.revisions[0].timestamp,
    fields, excerpts, tables: calls.filter(t => selected.has(t.name)).map(t => ({ template: t.name, ...t.fields })),
    acquisition: [...new Set(acquisition)], drops, related: [...new Set(related)],
    obsolete: calls.some(t => t.name === 'Obsolete'),
    unavailable: /(?:currently |remains? )unobtainable|not (?:currently )?obtainable on Ephinea/i.test(source),
    noCombo: noCombo.has(page.title),
    ...extractMechanics(mechanics, fields.type),
  });
}
records.sort((a, b) => a.title.localeCompare(b.title, 'en'));
fs.writeFileSync(`${out}/wiki.json`, JSON.stringify({ checkedAt, indexes, records }, null, 2) + '\n');
fs.writeFileSync(`${out}/images.json`, JSON.stringify(imageIndex, null, 2) + '\n');
console.log(`Imported ${records.length} items, ${Object.keys(indexes).length} index pages, ${images.length} verified images.`);
