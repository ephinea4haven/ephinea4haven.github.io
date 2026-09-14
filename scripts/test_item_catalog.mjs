import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { clean, range, slug, magTrigger } from './item_catalog_model.mjs';
import { templates } from './item_catalog_wiki.mjs';
import { extractMechanics } from './item_catalog_mechanics.mjs';
import vm from 'node:vm';

test('balanced templates preserve repeated fields, nesting and numeric conditions', () => {
  assert.equal(clean('{{DEF}} + {{DEX}} / {{DEF}} + {{POW}}'), 'DEF + DEX / DEF + POW');
  assert.equal(clean('{{Note|660 with Max Grind|{{Note|conditional|160}}}}', true), '160 (conditional)');
  assert.deepEqual(range('{{Note|650 with Max Grind|150}}'), [150,150]);
  assert.deepEqual(range('-30--10'), [-30,-10]);
  assert.equal(range('Depends on kills'), null);
  assert.equal(templates('{{Item|ATP={{Note|range|40-55}}|special=[[Berserk|Berserk]]}}')[0].fields.ATP, '{{Note|range|40-55}}');
  assert.notEqual(slug('Mother Garb'), slug('Mother Garb+'));
  assert.notEqual(slug('Kalki'), slug('Kalki*'));
  assert.equal(magTrigger('invinc-', '50'), '无敌 · 0–35%（随同步率变化）');
  assert.equal(magTrigger('sd+', '50'), 'Shifta + Deband · 50–85%（随同步率变化）');
  assert.equal(clean('<!-- note -->{{Note|conditional|12}}', true), '12 (conditional)');
  const commented = '<!-- {{ignored}} -->{{Item|ATP=12}}';
  const parsed = templates(commented);
  assert.equal(parsed.length, 1);
  assert.equal(commented.slice(parsed[0].start, parsed[0].end), '{{Item|ATP=12}}');
  assert.equal(clean('[[File:example.png|thumb|right|caption]]Visible facts.'), 'Visible facts.');
});

test('mechanics extraction distinguishes drain from regeneration and accepts linked stats', () => {
  assert.deepEqual(extractMechanics('HP is drained while moving at a rate of 1 HP every 5 seconds.', 'Partisan').periodic,
    [{stat:'HP', amount:-1, seconds:5, moving:true}]);
  assert.deepEqual(extractMechanics('It restores 1 [[Stats#HP|HP]] every 8 seconds.', 'Unit').periodic,
    [{stat:'HP', amount:1, seconds:8, moving:false}]);
  assert.equal(extractMechanics('A rate of 1 HP every 5 seconds.', 'Unit').periodic, undefined);
  assert.equal(extractMechanics('It increases physical attack speed by 5%.', 'Unit').attackSpeed, 5);
  assert.equal(extractMechanics("It increases the level of a character’s [[techniques]] by three.", 'Unit').techniqueLevels, 3);
});

execFileSync(process.execPath, ['scripts/generate_item_catalog.mjs']);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const details = read('src/app/generated/item-catalog/details.server.json');
const items = Object.values(details);
const coverage = read('content/item-catalog/coverage.json');
const snapshot = read('content/item-catalog/wiki.json');
const authority = read(process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json').items;

test('every inventory item has a unique route, exact authority identity or an explicit unresolved name', () => {
  assert.equal(items.length, 1044);
  assert.deepEqual(coverage.categories, { weapon:419, armor:88, shield:107, unit:100, mag:84, tool:246 });
  const known = new Set(items.map(i => i.title.toLowerCase()));
  const indexAliases = { "S-Berill's Hands #0": "S-Berill's Hands No. 0", "S-Berill's Hands #1": "S-Berill's Hands No. 1", Present: 'Present (Christmas)' };
  for (const [page, index] of Object.entries(snapshot.indexes)) for (const row of index.rows) {
    const title = clean(row[1]);
    assert.ok(known.has((indexAliases[title] || title).toLowerCase()), `${page}: omitted ${title}`);
  }
  const codes = new Set();
  for (const item of items) {
    assert.ok(authority[item.en] || coverage.unresolvedNames.includes(item.title), item.en);
    assert.match(item.source, /^https:\/\/wiki\.pioneer2\.net\//);
    assert.ok(item.rarity === null || Number.isInteger(item.rarity) && item.rarity >= 0 && item.rarity <= 12);
    if (item.code) { assert.ok(!codes.has(item.code), `${item.title}: duplicate code`); codes.add(item.code); }
    assert.ok(!JSON.stringify(item).includes('{{'), `${item.title}: unrendered template`);
    for (const related of item.related) assert.ok(details[related], `${item.title}: missing related item`);
    assert.ok(item.excerpts.join(' ').split(/\s+/).filter(Boolean).length <= 25, item.title);
    assert.deepEqual(read(`assets/data/items/${item.id}.json`), item);
  }
});

test('fields preserve PSOBB semantics instead of sample assumptions', () => {
  const stat = (id,label) => details[id].stats.find(s => s.label === label)?.value;
  assert.equal(stat('saber','最大磨数下 ATP'), '110–125');
  assert.equal(stat('dbs-saber','最大磨数下 ATP'), '288–338');
  assert.equal(stat('sword','普通攻击目标数'), '10');
  assert.equal(stat('sato','PB 达到 100'), '无敌 · 0–35%（随同步率变化）');
  assert.equal(details['star-song'].status, 'unavailable');
  assert.equal(details['1st-anniv-bronze-badge'].status, 'obsolete');
  assert.equal(details['neis-claw-replica'].en, "Nei's Claw (Replica)");
  assert.notEqual(details['neis-claw'].code, details['neis-claw-replica'].code);
  assert.ok(details['red-saber'].skins.length >= 4);
  assert.equal(details['psycho-wand'].boosts.length, 3);
  assert.equal(details['v101'].drops.find(d => d.sectionId === 'Greenill').rate, '1/2048');
  assert.ok(details['bana'].effects.some(e => e.includes('DEF ≥ 45')));
  assert.equal(stat('kama', 'PB 达到 100'), '无');
  assert.equal(details['seed-exchange-kit'].status, 'unavailable');
  assert.equal(stat('v502','即死特殊攻击成功率'), '×2');
  assert.equal(stat('v502','冰冻 / 感电 / 麻痹 / 混乱'), '×1.5');
  assert.ok(details['cell-of-mag-213'].effects.some(e => e.includes('Viridia / Skyly')));
});

test('downloaded illustrations match the recorded original checksums', () => {
  const images = read('content/item-catalog/images.json');
  assert.equal(Object.keys(images).length, 456);
  for (const image of Object.values(images)) {
    const bytes = fs.readFileSync('.' + image.path);
    assert.equal(createHash('sha1').update(bytes).digest('hex'), image.sha1);
    assert.equal(bytes.subarray(1,4).toString(), 'PNG');
  }
  for (const item of items) if (item.image) assert.ok(fs.existsSync('.' + item.image));
});

test('all 57 shop weapon models retain verified images and variable specials', () => {
  const expected = [];
  for (let family = 1; family <= 12; family++) for (let tier = 0; tier < (family <= 9 ? 5 : 4); tier++) {
    expected.push(`00${family.toString(16).padStart(2,'0')}${tier.toString(16).padStart(2,'0')}`.toUpperCase());
  }
  assert.equal(expected.length, 57);
  for (const code of expected) {
    const item = items.find(i => i.code === code);
    assert.ok(item, code);
    const record = snapshot.records.find(r => r.title === item.title);
    const images = read('content/item-catalog/images.json');
    const image = Object.entries(images).find(([name]) => name.toLowerCase() === record.fields.image.replaceAll('_',' ').toLowerCase())?.[1];
    assert.ok(image, item.title);
    assert.equal(item.image, image.path, item.title);
    assert.equal(item.stats.find(s => s.label === '特殊攻击')?.value, '可变', item.title);
    assert.match(item.availability, /武器商店/, item.title);
  }
  assert.equal(details['dbs-saber'].stats.find(s => s.label === '特殊攻击')?.value, '无');
});

test('all periodic and unit effect families retain direction, conditions and values', () => {
  const stat = (id,label) => details[id].stats.find(s => s.label === label)?.value;
  const drains = {'soul-eater':5,'soul-banish':3,'luminous-field':6,'parasite-wear-de-rol':11,'parasite-wear-nelgal':8,'parasite-wear-vajulla':8,'three-seals':6};
  for (const [id,seconds] of Object.entries(drains)) {
    assert.equal(stat(id,'HP 消耗'), `1 / ${seconds} 秒（移动时）`, id);
    assert.equal(stat(id,'HP 回复'), undefined, id);
    assert.ok(details[id].effects.some(e=>e.includes(`每 ${seconds} 秒消耗 1 HP`)), id);
  }
  for (const [id,speed] of Object.entries({'general-battle':5,'devil-battle':10,'god-battle':20,'heavenly-battle':40,v101:40})) assert.equal(stat(id,'攻击速度'), `+${speed}%`, id);
  for (const [id,level] of Object.entries({'wizard-technique':1,'devil-technique':2,'god-technique':3,'heavenly-technique':4})) assert.equal(stat(id,'魔法等级'), `+${level}`, id);
  for (const [id,label,seconds] of [['hp-restorate','HP 回复',14],['hp-generate','HP 回复',11],['hp-revival','HP 回复',8],['hp-resurrection','HP 回复',5],['tp-restorate','TP 回复',15],['tp-generate','TP 回复',13],['tp-revival','TP 回复',11],['tp-resurrection','TP 回复',9],['pb-amplifier','PB 回复',40],['pb-generate','PB 回复',35],['pb-create','PB 回复',23],['pb-increase','PB 回复',18],['revival-cuirass','HP 回复',5],['revival-garment','HP 回复',5],['red-ring','HP 回复',15],['red-ring','TP 回复',15],['gods-shield-kouryu','PB 回复',23]]) assert.equal(stat(id,label), `1 / ${seconds} 秒`, id);
  assert.ok(details['proof-of-sword-saint'].effects.some(e=>e.includes('ATA 增加 30')));
});

test('all Mag feeding tables exactly reuse maintained simulation values', () => {
  const sandbox = {window:{}};
  vm.runInNewContext(fs.readFileSync('assets/js/mag-sim-data.js','utf8'),sandbox);
  for (const item of items.filter(i=>i.category==='mag')) {
    const record = snapshot.records.find(r=>r.title===item.title);
    const key = record.tables.find(t=>t.template==='MagFeedTable')[1];
    assert.equal(item.feeding.length, 11, item.title);
    assert.deepEqual(Object.fromEntries(item.feeding.map(r=>[r.item,r.values])), JSON.parse(JSON.stringify(sandbox.window.MAG_SIM.feedTables[key])), item.title);
  }
});
