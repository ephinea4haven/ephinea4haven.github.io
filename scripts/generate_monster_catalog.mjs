import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { slug } from './monster_catalog_model.mjs';

export const readJson = file => JSON.parse(fs.readFileSync(file,'utf8'));
export function readDropData(file) {
  const source = fs.readFileSync(file,'utf8');
  const match = /window\.DROP_DATA_EN\s*=\s*(\{[\s\S]*\});\s*$/.exec(source);
  if (!match) throw new Error(`Invalid droptable source: ${file}`);
  return {data:JSON.parse(match[1]), sha256:createHash('sha256').update(source).digest('hex')};
}
const aliases = {'Gillchic':'Gilchic','Gillchich':'Gilchich','Dal Ra Lie':'Dal Ral Lie','Hallo Rappy':'Halo Rappy','St Rappy':'St. Rappy','Saint-Milion':'Saint Million'};
const baseName = value => value.replace(/ \([^)]*\)/g,'');
export function findDropRow(data, record, difficulty) {
  const base = baseName(record.key);
  const name = (aliases[base] || base).toLowerCase();
  const rows = data.data[difficulty]?.monsters?.[`Episode ${record.episode}`];
  if (!rows) throw new Error(`Missing drop context: ${difficulty} EP${record.episode}`);
  return rows.find(row => row.name.split('/').some(n => n.toLowerCase() === name)) || null;
}
export function cellDrops(cell) {
  const values = cell.items ?? [cell];
  if (!Array.isArray(values) || values.some(v => typeof v.item !== 'string' || typeof v.rate !== 'string')) throw new Error('Invalid drop cell');
  return values.filter(v => v.item);
}
export function contextualTables(tables,conditions=[]) {
  return tables.map(table => ({...table, difficulties:conditions.find(rule=>rule.anchor===table.anchor)?.difficulties || [], axis: table.context.length >= 2 ? 'difficulty-mode'
    : table.context.length === 0 ? 'all'
    : tables.some(other => other.anchor === table.anchor && other.context.length === 1 && ['Hard','Very Hard','Ultimate'].includes(other.context[0])) ? 'difficulty' : 'mode'}));
}
export function generateMonsterCatalog() {
  const snapshot = readJson('content/monster-catalog/wiki.json');
  const images = readJson('content/monster-catalog/images.json');
  const names = readJson('content/monster-catalog/names.json');
  const hd = readJson('content/monster-catalog/hd-gallery.json').assignments;
  // Model renders (scripts/render_monster_models.py) bind each appearance to a portrait file.
  const renderBindings = readJson('content/monster-catalog/model-renders.json').bindings;
  const renderFiles = readJson('assets/img/monsters/render/manifest.json');
  const renderPath = label => {
    if (!renderFiles[label] || !fs.existsSync(`assets/img/monsters/render/${renderFiles[label].file}`)) throw new Error(`Missing monster render: ${label}`);
    return `/assets/img/monsters/render/${renderFiles[label].file}`;
  };
  const notes = readJson('content/monster-catalog/notes.json');
  // Behaviour notes are authored in every site language.
  for (const [page, entries] of Object.entries(notes)) for (const entry of entries) {
    for (const language of ['zh', 'en', 'ja']) if (typeof entry[language] !== 'string' || !entry[language].trim()) throw new Error(`Monster note for ${page} lacks ${language} text`);
  }
  const mechanics = readJson('content/monster-catalog/mechanics.json');
  const conditions = readJson('content/monster-catalog/mechanic-conditions.json');
  for(const condition of conditions) {
    const article=mechanics.find(page=>page.title===condition.page);
    if(!article || article.revision!==condition.revision || !article.tables.some(table=>table.anchor===condition.anchor)) throw new Error(`Review outdated mechanic condition: ${condition.page} #${condition.anchor}`);
  }
  const authorityPath = process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json';
  const authority = readJson(authorityPath);
  const dropFile = path.join(path.dirname(authorityPath),'bb/data/en.js');
  const drops = readDropData(dropFile);
  const catalog = readJson('src/app/generated/item-catalog/index.json');
  const itemIds = new Map(catalog.map(row => [row[1],row[0]]));
  const difficulties = {n:'Normal',h:'Hard',vh:'Very Hard',u:'Ultimate'};
  const localize = (en, wikiJa='') => {
    const base = baseName(en);
    const identity = names[base] ? base : Object.keys(names).find(n => n.toLowerCase() === base.toLowerCase()) || aliases[base];
    const entry = names[identity];
    const suffix = en.slice(base.length).replace(/ \(E[12]\)/,'');
    return {en:en.replace(/ \(E[12]\)/,''), zh:entry ? entry.zh+suffix : en.replace(/ \(E[12]\)/,''), ja:entry?.ja ? entry.ja+suffix : wikiJa.replace(/ \(E[12]\)/,'') || en.replace(/ \(E[12]\)/,'')};
  };
  const imageFor = name => images[name] || images[name.replace(' (E2)',' (E1)')] || images[baseName(name)] || null;
  const rare = new Set(['Al Rappy','Hildeblue','Nar Lily','Pouilly Slime','Love Rappy','Egg Rappy','Hallo Rappy','St Rappy','Del Rappy','Pazuzu','Merissa AA','Dorphon Eclair','Kondrieu']);
  const bosses = new Set(['Dragon','De Rol Le','Vol Opt','Dark Falz','Barba Ray','Gol Dragon','Gal Gryphon','Olga Flow','Saint-Milion','Shambertin','Kondrieu']);
  const index = [], details = {};
  // These droppable enemies are absent from the Wiki full-stat table. Preserve
  // their identities and drops without borrowing another enemy's numeric stats.
  const records = [...snapshot.records, ...[
    {key:'Bulk',page:'Bulclaw',attribute:'Dark',areas:['Ruins']},
    {key:'Death Gunner',page:'Dark Gunner',attribute:'Dark',areas:['Ruins 2','Ruins 3']},
  ].map(r => ({...r,id:slug(r.key),episode:1,ultimate:r.key,ja:'',ultimateJa:'',stats:{}}))];
  for (const record of records) {
    const article = mechanics.find(m => m.title === record.page);
    if (!article) throw new Error(`Missing article provenance: ${record.page}`);
    const image = imageFor(record.key), ultimateImage = imageFor(record.ultimate);
    const part = /\((?!E[12]\)|Crater\)|Desert\))/.test(record.key) || /^(Bee |Gee |Darvant|Pig Ray|Ul Ray|Gael$|Giel$|Epsigard|Spinner)/.test(record.key);
    const boss = bosses.has(baseName(record.key));
    const summary = {
      id:record.id, names:localize(record.key,record.ja), ultimateNames:localize(record.ultimate,record.ultimateJa),
      episode:record.episode, areas:record.areas, attribute:record.attribute,
      rare:rare.has(baseName(record.key)), boss, part,
      image:image?.path || null, ultimateImage:ultimateImage?.path || null,
      // List rows show the model-render thumbnail when one exists; details keep the Wiki image as a source.
      thumbnail:renderBindings[record.id] ? `/assets/img/monsters/render/thumbs/${renderFiles[renderBindings[record.id].normal].file}` : null,
      ultimateThumbnail:renderBindings[record.id] ? `/assets/img/monsters/render/thumbs/${renderFiles[renderBindings[record.id].ultimate].file}` : null,
      values:Object.fromEntries(Object.entries(record.stats).map(([context,stats]) => [context,[stats[0],stats[13]]])),
    };
    index.push(summary);
    const dropRows = {};
    for (const [key,difficulty] of Object.entries(difficulties)) {
      const row = !part || boss ? findDropRow(drops.data,record,difficulty) : null;
      if (!row) continue;
      if (row.drops.length !== drops.data.sectionIds.length) throw new Error(`Section ID mismatch: ${row.name}`);
      dropRows[key] = {name:row.name,dar:row.dropRate ?? null,cells:row.drops.map(cell => cellDrops(cell).map(drop => ({
        en:drop.item, zh:authority.items[drop.item]?.zh || drop.item, ja:authority.items[drop.item]?.ja || drop.item,
        rate:drop.rate, id:itemIds.get(drop.item) || null,
      })))};
    }
    details[record.id] = {
      id:record.id, stats:record.stats, notes:notes[record.page] || [], tables:contextualTables(article.tables,conditions.filter(rule=>rule.page===record.page)),
      drops:dropRows, dropScope:boss && part ? 'boss' : 'enemy',
      source:`https://wiki.pioneer2.net/w/${encodeURIComponent(record.page.replaceAll(' ','_'))}`,
      sourceTitle:record.page,
      revision:article.revision, checkedAt:snapshot.checkedAt,
      imageSource:image?.page || null, ultimateImageSource:ultimateImage?.page || null,
      hdImage:hd[record.id]?.normal || null, ultimateHdImage:hd[record.id]?.ultimate || null,
      renderImage:renderBindings[record.id] ? renderPath(renderBindings[record.id].normal) : null,
      ultimateRenderImage:renderBindings[record.id] ? renderPath(renderBindings[record.id].ultimate) : null,
      // Extra poses of the same appearance, offered as further portrait sources.
      renderAlternates:(renderBindings[record.id]?.alternates || []).map(alternate => ({image:renderPath(alternate.render),label:alternate.label})),
    };
  }
  for (const id of Object.keys(renderBindings)) if (!details[id]) throw new Error(`Monster render bound to an unknown entry: ${id}`);
  const metadata = {checkedAt:snapshot.checkedAt,statKeys:snapshot.statKeys,sections:drops.data.sectionIds.map((name,i)=>({name,color:drops.data.sectionColors[i]})),dropSource:'https://github.com/warmonipa/dropcharts/blob/master/bb/data/en.js',dropSha256:drops.sha256};
  fs.mkdirSync('src/app/generated/monster-catalog',{recursive:true});
  fs.rmSync('assets/data/monsters',{recursive:true,force:true});
  fs.mkdirSync('assets/data/monsters',{recursive:true});
  for (const [name,data] of Object.entries({index,'details.server':details,metadata})) fs.writeFileSync(`src/app/generated/monster-catalog/${name}.json`,JSON.stringify(data));
  const detailHash=createHash('sha256');
  for (const [id,data] of Object.entries(details).sort(([a],[b])=>a.localeCompare(b))) {
    const json=JSON.stringify(data);
    fs.writeFileSync(`assets/data/monsters/${id}.json`,json);
    detailHash.update(`${id}\n${json}\n`);
  }
  // Bundled with the catalog so any detail change busts cached monster JSON.
  fs.writeFileSync('src/app/generated/monster-catalog/version.json',JSON.stringify({details:detailHash.digest('hex').slice(0,12)}));
  console.log(`Generated ${index.length} monster pages from Wiki facts and droptable ${drops.sha256.slice(0,12)}.`);
  return {index,details,metadata};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) generateMonsterCatalog();
