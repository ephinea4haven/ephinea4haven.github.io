import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { switchCases } from './monster_catalog_model.mjs';
import { cellDrops, findDropRow, generateMonsterCatalog, readDropData } from './generate_monster_catalog.mjs';
execFileSync(process.execPath,['scripts/generate_item_catalog.mjs']);
const {index,details,metadata}=generateMonsterCatalog();
const authorityPath=process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json';
const dropData=readDropData(path.join(path.dirname(authorityPath),'bb/data/en.js')).data;
test('regenerating a reduced monster catalog removes retired detail assets',()=>{
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'monster-catalog-update-'));
  try {
    fs.cpSync('content/monster-catalog',path.join(fixture,'content/monster-catalog'),{recursive:true});
    fs.mkdirSync(path.join(fixture,'src/app/generated/item-catalog'),{recursive:true});
    fs.copyFileSync('src/app/generated/item-catalog/index.json',path.join(fixture,'src/app/generated/item-catalog/index.json'));
    const generate=()=>execFileSync(process.execPath,[path.resolve('scripts/generate_monster_catalog.mjs')],{
      cwd:fixture,env:{...process.env,DROPTABLE_I18N_AUTHORITY:path.resolve(authorityPath)},
    });
    generate();
    const retired=path.join(fixture,'assets/data/monsters/booma.json');
    assert.ok(fs.existsSync(retired));
    const snapshotFile=path.join(fixture,'content/monster-catalog/wiki.json');
    const snapshot=JSON.parse(fs.readFileSync(snapshotFile,'utf8'));
    snapshot.records=snapshot.records.filter(record=>record.id!=='booma');
    fs.writeFileSync(snapshotFile,JSON.stringify(snapshot));
    generate();
    assert.ok(!fs.existsSync(retired),'removed monster detail must not remain in the published asset tree');
    const index=JSON.parse(fs.readFileSync(path.join(fixture,'src/app/generated/monster-catalog/index.json'),'utf8'));
    assert.deepEqual(fs.readdirSync(path.join(fixture,'assets/data/monsters')).sort(),index.map(m=>`${m.id}.json`).sort());
  } finally {fs.rmSync(fixture,{recursive:true,force:true});}
});

test('all 158 stat contexts preserve episode, mode, difficulty and absent phases',()=>{
  assert.equal(index.length,160);
  assert.equal(details['booma'].stats['n-on'][0],92);
  assert.equal(details['booma'].stats['n-off'][0],60);
  assert.equal(details['booma'].stats['u-on'][0],2334);
  assert.notEqual(details['hildebear-e1'].stats['n-on'][0],details['hildebear-e2'].stats['n-on'][0]);
  assert.equal(details['dark-falz-form-3'].stats['n-on'],undefined);
  assert.equal(details['bulk'].stats['n-on'],undefined);
  assert.equal(Object.values(details).reduce((n,d)=>n+Object.keys(d.stats).length,0),1262);
});
test('all ten colors and every drop cell come from droptable, including independent multi drops',()=>{
  assert.deepEqual(metadata.sections.map(s=>s.name),dropData.sectionIds);
  assert.deepEqual(metadata.sections.map(s=>s.color),dropData.sectionColors);
  for(const [difficulty,key] of Object.entries({Normal:'n',Hard:'h','Very Hard':'vh',Ultimate:'u'})) {
    for(const [episode,rows] of Object.entries(dropData.data[difficulty].monsters)) {
      for(const row of rows) assert.ok(index.some(m=>`Episode ${m.episode}`===episode&&details[m.id].drops[key]?.name===row.name),`${difficulty} ${episode} ${row.name}`);
    }
  }
  for(const record of index) for(const [diff,name] of Object.entries({n:'Normal',h:'Hard',vh:'Very Hard',u:'Ultimate'})){
    const row=details[record.id].drops[diff];if(!row)continue;
    const source=dropData.data[name].monsters[`Episode ${record.episode}`].find(r=>r.name===row.name);
    assert.ok(source,record.id);
    assert.deepEqual(row.cells.map(c=>c.map(i=>({item:i.en,rate:i.rate}))),source.drops.map(c=>cellDrops(c).map(i=>({item:i.item,rate:i.rate}))));
  }
  assert.deepEqual(cellDrops({items:[{item:'A',rate:'1/2'},{item:'B',rate:'1/4'}]}),[{item:'A',rate:'1/2'},{item:'B',rate:'1/4'}]);
  const synthetic=structuredClone(dropData);synthetic.data.Normal.monsters['Episode 1'][0].drops[0]={item:'Changed upstream',rate:'1/999'};
  assert.equal(findDropRow(synthetic,{key:'Booma',episode:1},'Normal').drops[0].item,'Changed upstream');
});
test('drop-table aliases resolve; boss parts do not invent independent rewards',()=>{
  for(const [key,episode] of [['Gillchic (E1)',1],['St Rappy',2],['Hallo Rappy',2],['Saint-Milion (Phase 1)',4]]) assert.ok(findDropRow(dropData,{key,episode},'Normal'),key);
  assert.equal(details['vol-opt-form-2'].dropScope,'boss');
  assert.deepEqual(details['bee-r-e1'].drops,{});
  assert.ok(details['bulk'].drops.u);
  assert.ok(details['death-gunner'].drops.u);
});
test('fixed damage and unknown entries preserve contextual facts, captions and provenance',()=>{
  const bringer=details['chaos-bringer'].tables.find(t=>t.context.join('/')==='Ultimate/Normal');
  assert.deepEqual(bringer.rows.find(r=>r[0]==='Shot'),['Shot','700 or 1400']);
  const blank=details['merillia'].tables.find(t=>t.context.join('/')==='Ultimate/Normal');
  assert.equal(blank.rows[1][1],'');
  assert.equal(details['ill-gill'].tables.length,2);
  assert.ok(details['kondrieu-phase-1'].tables.every(t=>t.axis==='difficulty'));
  assert.ok(details['chaos-sorcerer-e1'].tables.filter(t=>t.section==='Megid levels').every(t=>t.axis==='mode'));
  assert.ok(details['vol-opt-form-2'].tables.some(t=>t.section==='Prison'&&t.rows.some(r=>r.includes('1480 (Multi)'))));
  for(const d of Object.values(details)){
    assert.ok(d.revision>0&&d.source.startsWith('https://wiki.pioneer2.net/w/'));
    assert.ok(Buffer.byteLength(JSON.stringify(d))<32000,d.id);
    for(const t of d.tables) assert.ok(!t.caption.includes('Monsters that ignore technique boosts'));
    for(const t of d.tables) assert.ok(t.headings.length && t.headings.at(-1)===t.section,`${d.id}: missing source hierarchy`);
  }
});
test('prose-only difficulty restrictions and boss phase context remain explicit',()=>{
  const pages=['Chaos Sorcerer','Hildeblue','Poison Lily','Nar Lily','Deldepth','Zol Gibbon'];
  const records=JSON.parse(fs.readFileSync('content/monster-catalog/wiki.json','utf8')).records;
  for(const record of records.filter(record=>pages.includes(record.page))) {
    for(const table of details[record.id].tables.filter(t=>/Megid level/i.test(t.section))) assert.deepEqual(table.difficulties,['Ultimate'],record.id);
  }
  assert.ok(details['del-lily'].tables.filter(t=>/Megid level/i.test(t.section)).every(t=>t.difficulties.length===0));
  for(const id of ['olga-flow-form-1','olga-flow-form-2','gael','giel']) {
    const tables=details[id].tables;
    assert.ok(tables.every(t=>t.headings[0]==='Behavior/Mechanics (Second phase)'));
    assert.deepEqual(tables.find(t=>t.caption==='Divine Punishment damage threshold').rows.at(-1),['Ultimate','750','1280']);
    assert.equal(details[id].sourceTitle,'Olga Flow');
  }
});
test('switch extraction rejects ambiguous numerical cases and preserves grouped aliases',()=>{
  assert.deepEqual(switchCases('{{#switch: {{{1|}}}\n| A\n| B = 12\n| 0\n}}'),{A:'12',B:'12'});
  assert.throws(()=>switchCases('| A = 1\n| A = 2'),/Duplicate/);
  assert.deepEqual(switchCases('| A = first\n| A = second',true),{});
});
test('names match authority and referenced assets exist',()=>{
  const names=JSON.parse(fs.readFileSync(authorityPath,'utf8')).monsters;
  assert.equal(index.find(m=>m.id==='booma').names.zh,names.Booma.zh);
  assert.equal(index.find(m=>m.id==='booma').ultimateNames.ja,names.Bartle.ja);
  for(const m of index) for(const image of [m.image,m.ultimateImage]) if(image) assert.ok(fs.existsSync(image.slice(1)),image);
});

test('HD artwork keeps episode copies separate and binds only the pictured boss forms',()=>{
  const gallery=JSON.parse(fs.readFileSync('content/monster-catalog/hd-gallery.json'));
  assert.equal(gallery.sources.length,171);
  assert.equal(gallery.assets.length,171);
  assert.equal(new Set(gallery.assets.map(a=>a.path)).size,171);
  for(const asset of gallery.assets) {
    const bytes=fs.readFileSync(asset.path.slice(1));
    assert.equal(bytes.length,asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  }
  for(const [id,assignment] of Object.entries(gallery.assignments)) {
    assert.ok(details[id],id);
    for(const file of Object.values(assignment)) assert.ok(gallery.assets.some(a=>a.path===file),file);
  }
  const galleryNames=JSON.parse(fs.readFileSync('content/monster-catalog/names.json'));
  for(const source of gallery.sources) {
    assert.ok(gallery.assets.some(a=>a.path===source.asset));
    const base=source.identity.replace(/ \(Form [123]\)$/,'');
    assert.equal(path.basename(source.source,'.png'),galleryNames[base].zh+source.identity.slice(base.length));
  }
  assert.notEqual(details['rag-rappy-e1'].hdImage,details['rag-rappy-e2'].hdImage);
  assert.match(details['rag-rappy-e1'].hdImage,/\/forest\//);
  assert.match(details['rag-rappy-e2'].hdImage,/\/temple\//);
  assert.notEqual(details.booma.hdImage,details.booma.ultimateHdImage);
  for(const id of ['vol-opt-form-1','vol-opt-pillar','epsigard']) assert.equal(details[id].hdImage,null,id);
  for(const id of ['vol-opt-form-2','dark-falz-form-1','dark-falz-form-2','dark-falz-form-3','olga-flow-form-1','olga-flow-form-2','death-gunner','dolmolm','epsilon']) assert.ok(details[id].hdImage,id);
  for(const monster of index) assert.equal('hdImage' in monster,false,'HD assets stay out of the list bundle');
});

test('behaviour notes are written in every site language',()=>{
  const han=/[㐀-鿿]/;
  for(const [id,detail] of Object.entries(details)) for(const note of detail.notes){
    for(const language of ['zh','en','ja']) assert.ok(typeof note[language]==='string' && note[language].trim(),`${id}: ${language}`);
    assert.doesNotMatch(note.en,han,`${id}: ${note.en}`);
  }
});
