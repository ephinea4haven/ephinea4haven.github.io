import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { clean, range, slug, magTrigger } from './item_catalog_model.mjs';
import { templates } from './item_catalog_wiki.mjs';

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
