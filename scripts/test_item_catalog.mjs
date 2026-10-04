import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { clean, range, slug, magTrigger } from './item_catalog_model.mjs';
import { templates } from './item_catalog_wiki.mjs';
import { extractMechanics } from './item_catalog_mechanics.mjs';
import { itemNameTier } from '../src/app/item-catalog/item-name-tier.ts';
import { equipmentImage } from './item_catalog_images.mjs';
import vm from 'node:vm';
import { MESSAGES, catalogText, catalogValue } from '../src/app/item-catalog/catalog-messages.ts';
import { COSMETICS_MESSAGES } from '../src/app/item-catalog/cosmetics-messages.ts';

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

test('lists use equipment and Mag thumbnails while details retain full-size images', () => {
  const index = read('src/app/generated/item-catalog/index.json');
  const equipment = read('content/item-catalog/equipment-images.json');
  const models = {...read('content/item-catalog/model-images.json').entries,
    ...read('content/item-catalog/shield-images.json').entries};
  assert.equal(items.filter(item => item.hdSource === 'gallery').length, 415);
  // Every Mag with a model has a render (79 models + 4 variants sharing a model); Stealth has no model.
  assert.equal(items.filter(item => item.hdSource === 'model-render').length, 83);
  assert.deepEqual(items.filter(item => item.category === 'mag' && !item.hdImage).map(item => item.id), ['stealth']);
  assert.equal(items.filter(item => item.hdImage).length, 498);
  assert.equal(index.filter(row => row[7]).length, 835);
  assert.equal(details.saber.hdImage, '/assets/img/items/hd/items/saber.webp');
  assert.equal(details['typess-swords'].hdImage, '/assets/img/items/hd/items/typess-swords.webp');
  assert.equal(details['typegu-mechgun'].hdImage, '/assets/img/items/hd/items/typegu-mechgun.webp');
  assert.equal(details['dress-plate'].image, '/assets/img/items/equipment/dress-plate.webp');
  assert.equal(details['dress-plate'].hdImage, '/assets/img/items/hd/items/dress-plate.webp');
  assert.equal(details['agito-1975'].hdImage, null);
  assert.equal(details['typebl-blade'].hdImage, null);
  assert.equal(details.saber.hdSource, 'gallery');
  assert.equal(details.mag.hdImage, '/assets/img/mag/default/Mag.webp');
  assert.equal(details.varuna.hdSource, 'model-render');
  assert.equal(details['chu-chu'].hdImage, '/assets/img/mag/default/Chu Chu.webp');
  assert.equal(details['mag-variant'].hdImage, details.mag.hdImage);
  // Artifact uploads reject * in paths, so Present*'s images use a safe file name.
  assert.equal(details['present-variant'].hdImage, '/assets/img/mag/default/Present-star.webp');
  for (const item of items) {
    assert.equal(item.hdSource === 'model-render', item.category === 'mag' && !!item.hdImage, item.id);
  }
  for (const row of index) {
    const detail = details[row[0]];
    const preview = models[detail.code] || (detail.cosmetic?.reverts ? models[details['red-ring'].code] : null) || equipment.entries[detail.code];
    const thumbnail = preview && (preview.kind === 'effect' || preview.kind === 'illustration' || preview.origin === 'gallery' || detail.imageOrigin === 'model-render') ? preview.thumbnail : detail.image;
    assert.equal(row[7], detail.hdSource === 'model-render' ? detail.hdImage.replace('/default/', '/thumbs/') : thumbnail, row[0]);
    assert.ok(!JSON.stringify(row).includes('/items/hd/'), row[0]);
  }
  for (const item of items.filter(item => item.hdSource === 'model-render')) {
    const thumbnail = fs.readFileSync(item.hdImage.slice(1).replace('/default/', '/thumbs/'));
    assert.equal(thumbnail.toString('ascii', 8, 12), 'WEBP', item.id);
    assert.ok(thumbnail.length < 20_000, item.id);
  }
  for (const item of items.filter(item => item.hdImage)) {
    const image = fs.readFileSync(item.hdImage.slice(1));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF', item.id);
    assert.equal(image.toString('ascii', 8, 12), 'WEBP', item.id);
    assert.ok(image.length < 250_000, item.id);
  }
});

test('all sixteen technique merges use their own reviewed model in lists and details', () => {
  const models = read('content/item-catalog/shield-images.json').entries;
  const merges = items.filter(item => item.category === 'shield' && item.id.endsWith('-merge'));
  assert.equal(merges.length, 16);
  for (const item of merges) {
    const model = models[item.code];
    assert.equal(model.id, item.id);
    assert.equal(item.imageKind, 'model', item.id);
    assert.equal(item.image, model.path, item.id);
    assert.equal(model.evidence.model.ephineaEntryMatches, true);
    assert.equal(model.evidence.texture.ephineaEntryMatches, true);
    for (const [file, checksum] of [[model.path, model.sha256], [model.thumbnail, model.thumbnailSha256]]) {
      assert.equal(createHash('sha256').update(fs.readFileSync(file.slice(1))).digest('hex'), checksum);
    }
  }
  assert.ok(details['foie-merge'].hdImage, 'Existing HD alternative remains available');
});

test('all shields have checksummed model or block-effect previews with exact identities', () => {
  const manifest = read('content/item-catalog/shield-images.json').entries;
  const shields = items.filter(item => item.category === 'shield');
  assert.equal(Object.keys(manifest).length, 107);
  assert.equal(shields.filter(item => item.imageKind === 'model').length, 65);
  assert.equal(shields.filter(item => item.imageKind === 'effect').length, 42);
  for (const item of shields) {
    const entry = manifest[item.code];
    assert.equal(entry.id, item.id);
    assert.equal(entry.title, item.title);
    assert.equal(item.image, entry.path);
    assert.equal(item.imageKind, entry.kind);
    assert.equal(entry.evidence.runtimeVerified, false);
    if (entry.kind === 'effect') {
      assert.equal(item.imageOrigin, 'block-effect-render');
      assert.ok(entry.evidence.particleIds.length);
      assert.equal(entry.evidence.transparentBackground, true);
    } else {
      assert.equal(entry.evidence.model.ephineaEntryMatches, true);
      assert.equal(entry.evidence.texture.ephineaEntryMatches, true);
    }
    for (const [file, checksum] of [[entry.path, entry.sha256], [entry.thumbnail, entry.thumbnailSha256]]) {
      const data = fs.readFileSync(file.slice(1));
      assert.equal(createHash('sha256').update(data).digest('hex'), checksum);
      assert.equal(data.toString('ascii', 8, 12), 'WEBP');
    }
  }
});

test('equipment previews cover every armor, shield and unit with honest image kinds', () => {
  const manifest = read('content/item-catalog/equipment-images.json');
  const index = read('src/app/generated/item-catalog/index.json');
  const scoped = items.filter(item => ['armor', 'shield', 'unit'].includes(item.category));
  assert.equal(scoped.length, 295);
  for (const item of scoped) {
    assert.ok(item.image, item.id);
    assert.notEqual(item.image, '/assets/img/items/no-image.webp');
    const row = index.find(row => row[0] === item.id);
    assert.equal(row[15], item.imageKind);
    if (item.imageKind === 'box') {
      assert.equal(item.image, manifest.boxes[item.rarity >= 9 ? 'red' : 'blue'].path, item.id);
    }
  }
  assert.equal(details.frame.image, manifest.boxes.blue.path);
  assert.equal(details['hunter-field'].image, manifest.boxes.red.path); // 9★, low equip level
  assert.equal(details['celestial-armor'].image, manifest.boxes.blue.path); // 8★, high equip level
  for (const id of ['red-barrier', 'blue-barrier', 'yellow-barrier', 'assist-barrier', 'recovery-barrier']) {
    assert.equal(details[id].imageKind, 'effect');
    assert.equal(details[id].imageOrigin, 'block-effect-render');
    assert.equal(details[id].imageBlend, 'additive');
  }
  assert.equal(details['god-power'].image, manifest.boxes.red.path);
  assert.equal(details.addslot.image, manifest.boxes.red.path);
  assert.equal(details.addslot.imageKind, 'box');
  assert.equal(details.addslot.rarity, null); // A rare-tool illustration does not invent a star count.
  assert.equal(details['aura-field'].imageKind, 'effect');
  assert.equal(details['secure-feet'].imageKind, 'model');
  assert.equal(details['red-ring'].imageKind, 'model');
  assert.equal(details['stealth-suit'].imageKind, 'illustration');
  assert.equal(details['stealth-suit'].imageOrigin, 'effect-illustration');
  assert.equal(details['stealth-suit'].imageBlend, 'normal');
  assert.notEqual(details['stealth-suit'].image, details['stealth-suit'].hdImage);
  for (const entry of Object.values(manifest.entries)) {
    if (entry.kind === 'effect') {
      assert.equal(entry.evidence.transparentBackground, true, entry.title);
      assert.equal(entry.blend, entry.title === 'Smoking Plate' ? 'normal' : 'additive', entry.title);
    }
    const item = items.find(item => item.code && manifest.entries[item.code] === entry);
    assert.ok(item && item.title === entry.title, entry.title);
    for (const [file, expected] of [[entry.path, entry.sha256], [entry.thumbnail, entry.thumbnailSha256]]) {
      const bytes = fs.readFileSync(file.slice(1));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      if (file === entry.thumbnail) assert.ok(bytes.length < 25_000, file);
    }
  }
  for (const item of items) for (const related of item.relatedItems) {
    const row = index.find(row => row[0] === related.id);
    assert.equal(related.image, row[7], related.id);
    assert.equal(related.imageKind, row[15], related.id);
    assert.equal(related.imageBlend, row[16], related.id);
  }
  for (const id of ['dress-plate', 'wedding-dress', 'love-heart', 'sweetheart']) {
    assert.equal(details[id].imageKind, 'effect', id);
    assert.equal(details[id].imageBlend, 'additive', id);
  }
});

test('equipment selection respects effects, screenshots, models and the 8/9-star boundary', () => {
  const blue = { path: 'blue', kind: 'box' }, red = { path: 'red', kind: 'box' };
  const preview = { path: 'effect', kind: 'effect' };
  const manifest = { boxes: { blue, red }, entries: { '010131': preview }, toolBoxes: { '030F00': {color: 'red'} } };
  const item = { category: 'armor', code: '010131', rarity: 11, wikiImage: { path: 'wiki' } };
  assert.equal(equipmentImage(item, manifest), preview);
  preview.kind = 'model';
  assert.equal(equipmentImage(item, manifest).path, 'wiki');
  assert.equal(equipmentImage({ ...item, wikiImage: null }, manifest), preview);
  for (const category of ['armor', 'shield', 'unit']) {
    for (const [rarity, expected] of [[0, blue], [8, blue], [9, red], [12, red]]) {
      assert.equal(equipmentImage({ category, code: 'unmapped', rarity }, manifest), expected);
    }
  }
  assert.equal(equipmentImage({ ...item, category: 'unit' }, manifest), red);
  assert.equal(equipmentImage({ ...item, category: 'weapon' }, manifest), null);
  assert.equal(equipmentImage({category:'tool', code:'030F00', rarity:null}, manifest), red);
  assert.equal(equipmentImage({category:'tool', code:'unmapped', rarity:null}, manifest), null);
  assert.throws(() => equipmentImage({ category: 'armor', code: 'unknown', rarity: null }, manifest), /Missing equipment rarity/);
});

test('list banner highlights use exact BB identities and keep Hit conditions', () => {
  const highlights = read('content/item-catalog/banner-highlights.json');
  const hits = highlights.minimumUntekkedHit;
  assert.equal(Object.keys(hits).length, 98);
  const unsealed = Object.keys(highlights.topTierItems).filter(title => highlights.topTierItems[title] === 'unsealed');
  const crafted = Object.keys(highlights.topTierItems).filter(title => highlights.topTierItems[title] === 'crafted');
  assert.deepEqual(crafted, ['Dark Bridge', 'Dark Flow', 'Dark Meteor']);
  assert.equal(Object.keys(highlights.topTierItems).length, 7);
  assert.deepEqual(highlights.rareItems, ['AddSlot']);
  for (const title of crafted) {
    const record = read('content/item-catalog/wiki.json').records.find(record => record.title === title);
    assert.ok(record.acquisition.includes('Combination'));
    assert.ok(record.related.includes('Parasitic Gene "Flow"'));
    assert.equal(hits[title], undefined);
  }
  for (const title of ['Master Raven', 'Last Swan', 'Dual Bird', 'Guld Milla', 'Mille Marteaux', 'Baranz Launcher', 'Maser Beam', 'Power Maser']) {
    assert.equal(highlights.topTierItems[title], undefined, title);
    assert.equal(itemNameTier(items.find(item => item.title === title), highlights), 'rare', title);
  }
  for (const title of ['Sword', 'Shot', 'Rod', 'Double Cannon']) assert.equal(highlights.topTierItems[title], undefined);
  assert.deepEqual(unsealed, ['Adept', 'Excalibur', 'Proof of Sword-Saint', 'Tsumikiri J-Sword']);
  assert.deepEqual(unsealed, read('content/item-catalog/wiki.json').records
    .filter(record => record.acquisition.includes('Unsealing')).map(record => record.title).sort());
  for (const title of unsealed) {
    assert.equal(items.filter(item => item.title === title).length, 1, title);
    assert.equal(hits[title], undefined, 'Unsealed styling must not invent banner eligibility');
  }
  for (const [title, hit] of Object.entries(hits)) {
    assert.equal(items.filter(item => item.title === title).length, 1, title);
    assert.ok([0, 20, 30, 40, 50].includes(hit), title);
  }
  assert.equal(hits['Lavis Cannon'], 0);
  assert.equal(hits['Red Ring'], 0);
  assert.equal(hits['Galatine'], 20);
  assert.equal(hits['Frozen Shooter'], 30);
  assert.equal(hits['Spread Needle'], 40);
  assert.equal(hits['Red Sword'], 50);
  for (const title of ['Saber', 'Agito (1975)', 'Heart of Poumn', 'Technique Disk']) {
    assert.equal(hits[title], undefined, title);
  }
});

test('name tiers distinguish rarity from top-tier membership and use banners as auxiliary evidence', () => {
  const policy = read('content/item-catalog/banner-highlights.json');
  for (const item of items) {
    const top = policy.topTierItems[item.title] || policy.minimumUntekkedHit[item.title] === 0;
    if (top) assert.equal(itemNameTier(item, policy), 'top', item.title);
    else if (item.rarity >= 9) assert.equal(itemNameTier(item, policy), 'rare', item.title);
  }
  for (const record of read('content/item-catalog/wiki.json').records.filter(record => record.acquisition.some(kind => ['Combination', 'Enemy Parts'].includes(kind)))) {
    const item = items.find(item => item.title === record.title);
    assert.notEqual(itemNameTier(item, policy), 'common', item.title);
  }
  for (const [rarity, expected] of [[8, 'common'], [9, 'rare'], [12, 'rare'], [null, 'common']]) {
    assert.equal(itemNameTier({title:'Unlisted item', rarity}, policy), expected);
  }
  assert.equal(itemNameTier({title:'Galatine', rarity:null}, policy), 'rare');
  assert.equal(itemNameTier({title:'Lavis Cannon', rarity:null}, policy), 'top');
  assert.equal(itemNameTier(details.addslot, policy), 'rare');
  for (const id of ['sword', 'shot', 'rod']) assert.equal(itemNameTier(details[id], policy), 'common');
  for (const id of ['boomas-claw', 'double-cannon', 'maser-beam']) assert.equal(itemNameTier(details[id], policy), 'rare');
});

test('catalog UI and structured stats have complete English and Japanese messages', () => {
  for (const [key, translations] of [...Object.entries(MESSAGES), ...Object.entries(COSMETICS_MESSAGES)]) {
    assert.equal(translations.length, 2, key);
    for (const text of translations) assert.ok(text.trim(), key);
    assert.equal(catalogText(key, 'zh'), key);
  }
  for (const file of fs.readdirSync('src/app/item-catalog').filter(f => /\.(html|ts)$/.test(f))) {
    const source = fs.readFileSync(`src/app/item-catalog/${file}`, 'utf8');
    for (const match of source.matchAll(/i18n\.t\('([^']+)'\)/g)) assert.ok(MESSAGES[match[1]], `${file}: ${match[1]}`);
    for (const match of source.matchAll(/copy\('([^']+)'\)/g)) assert.ok(COSMETICS_MESSAGES[match[1]], `${file}: ${match[1]}`);
  }
  for (const item of items) {
    for (const stat of item.stats) {
      if (/\p{Script=Han}/u.test(stat.label)) assert.ok(MESSAGES[stat.label], stat.label);
      assert.doesNotMatch(catalogValue(stat.value, 'en'), /\p{Script=Han}/u, `${item.id}: ${stat.value}`);
    }
    assert.doesNotMatch(catalogValue(item.requirement, 'en'), /\p{Script=Han}/u, item.id);
    for (const boost of item.boosts) assert.doesNotMatch(boost.label, /\p{Script=Han}/u, item.id);
  }
  assert.equal(catalogValue('1 / 5 秒（移动时）', 'en'), '1 / 5 sec (while moving)');
  assert.equal(catalogValue('无敌 · 0–35%（随同步率变化）', 'ja'), '無敵 · 0–35%（シンクロ率で変化）');
});

test('Japanese catalog names use exact authority or recorded Wiki evidence', () => {
  const index = read('src/app/generated/item-catalog/index.json');
  const records = new Map(snapshot.records.map(r => [r.title, r]));
  for (const row of index) {
    const [id,en] = row;
    // Column 12 is the Japanese name (authority first, then recorded Wiki evidence); column 13 the Chinese name.
    assert.equal(row[12], authority[en]?.ja || clean(records.get(details[id].title)?.fields.jp), id);
    assert.equal(row[13], authority[en]?.zh || en, id);
    assert.equal(details[id].ja ?? '', row[12], id);
    assert.equal(details[id].zh, row[13], id);
  }
  assert.equal(index.find(row => row[0] === 'saber')[12], 'セイバー');
  assert.equal(index.find(row => row[0] === 'monomate')[12], 'モノメイト');
  assert.equal(index.filter(row => row[12]).length, 817);
});

test('every inventory item has a unique route, exact authority identity or an explicit unresolved name', () => {
  assert.equal(items.length, 1045);
  assert.deepEqual(coverage.categories, { weapon:419, armor:88, shield:107, unit:100, mag:84, tool:247 });
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
  assert.ok(details['bana'].effects.some(e => e.zh.includes('DEF ≥ 45')));
  assert.equal(stat('kama', 'PB 达到 100'), '无');
  assert.equal(details['seed-exchange-kit'].status, 'unavailable');
  assert.equal(stat('v502','即死特殊攻击成功率'), '×2');
  assert.equal(stat('v502','冰冻 / 感电 / 麻痹 / 混乱'), '×1.5');
  assert.ok(details['cell-of-mag-213'].effects.some(e => e.zh.includes('Viridia / Skyly')));
});

test('downloaded illustrations match the recorded original checksums', () => {
  const images = read('content/item-catalog/images.json');
  assert.equal(Object.keys(images).length, 478);
  for (const image of Object.values(images)) {
    const bytes = fs.readFileSync('.' + image.path);
    assert.equal(createHash('sha1').update(bytes).digest('hex'), image.sha1);
    assert.equal(bytes.subarray(1,4).toString(), 'PNG');
  }
  for (const item of items) if (item.image) assert.ok(fs.existsSync('.' + item.image));
});

test('ES and TypeM weapons are listed as their own series and keep their weapon type', () => {
  const index = read('src/app/generated/item-catalog/index.json');
  const snapshot = read('content/item-catalog/wiki.json');
  for (const [page, group] of [['ES weapons', 'ES 武器'], ['TypeM weapons', 'TypeM 武器']]) {
    const titles = snapshot.indexes[page].rows.map(row => clean(row[1])).sort();
    const rows = index.filter(row => row[14] === group);
    assert.deepEqual(rows.map(row => details[row[0]].title).sort(), titles);
    assert.equal(rows.length, 30);
    for (const row of rows) assert.equal(details[row[0]].category, 'weapon', row[0]);
  }
  assert.equal(details['typeri-rifle'].type, 'Rifle');
  assert.equal(index.find(row => row[0] === 'typeri-rifle')[14], 'TypeM 武器');
  assert.equal(index.find(row => row[0] === 'saber')[14], '');
});

test('TypeM weapons without a Wiki file use checksummed ItemKT images', () => {
  const images = read('content/item-catalog/itemkt-images.json');
  assert.deepEqual(Object.keys(images).sort(), ['TypeRI/Rifle', 'TypeSH/Shot']);
  for (const [title, image] of Object.entries(images)) {
    const bytes = fs.readFileSync('.' + image.path);
    assert.equal(createHash('sha1').update(bytes).digest('hex'), image.sha1, title);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [image.width, image.height], title);
    const item = items.find(item => item.title === title);
    assert.equal(item.image, image.path, title);
    assert.equal(item.imageOrigin, 'itemkt', title);
    assert.equal(item.imagePage, null, title);
  }
  assert.equal(details['typeri-rifle'].hdImage, '/assets/img/items/hd/type/typeri-rifle.webp');
  assert.equal(details['typegu-hand'].imageOrigin, 'wiki');
  assert.equal(details['dress-plate'].imageOrigin, 'effect-render');
});

test('all seven paired Mechguns use model previews in details, lists and related cards', () => {
  const index = read('src/app/generated/item-catalog/index.json');
  const models = read('content/item-catalog/model-images.json').entries;
  assert.deepEqual(Object.keys(models).sort(), ['000800', '000801', '000802', '000803', '000804', '007700', '00EA00']);
  for (const id of ['mechgun', 'assault', 'repeater', 'gatling', 'vulcan', 'es-mechgun', 'typeme-mechgun']) {
    const item = details[id];
    assert.equal(item.imageKind, 'model', id);
    assert.equal(item.imageOrigin, 'model-render', id);
    assert.equal(item.image, `/assets/img/items/models/${id}.webp`, id);
    assert.equal(index.find(row => row[0] === id)[7], `/assets/img/items/models/thumbs/${id}.webp`, id);
    assert.equal(index.find(row => row[0] === id)[15], 'model', id);
    const model = models[item.code];
    assert.equal(model.evidence.recipe.instances, 2, id);
    assert.equal(model.evidence.model.ephineaEntryMatches, true, id);
    assert.equal(model.evidence.texture.ephineaEntryMatches, true, id);
    for (const [file, expected] of [[model.path, model.sha256], [model.thumbnail, model.thumbnailSha256]]) {
      const bytes = fs.readFileSync(file.slice(1));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', file);
      if (file === model.thumbnail) assert.ok(bytes.length < 20_000, file);
    }
  }
  assert.equal(details['typegu-mechgun'].imageOrigin, 'wiki');
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
    const model = read('content/item-catalog/model-images.json').entries[code];
    assert.equal(item.image, model?.path || image.path, item.title);
    assert.equal(item.stats.find(s => s.label === '特殊攻击')?.value, '可变', item.title);
    assert.match(item.availability.zh, /武器商店/, item.title);
  }
  assert.equal(details['dbs-saber'].stats.find(s => s.label === '特殊攻击')?.value, '无');
});

test('all periodic and unit effect families retain direction, conditions and values', () => {
  const stat = (id,label) => details[id].stats.find(s => s.label === label)?.value;
  const drains = {'soul-eater':5,'soul-banish':3,'luminous-field':6,'parasite-wear-de-rol':11,'parasite-wear-nelgal':8,'parasite-wear-vajulla':8,'three-seals':6};
  for (const [id,seconds] of Object.entries(drains)) {
    assert.equal(stat(id,'HP 消耗'), `1 / ${seconds} 秒（移动时）`, id);
    assert.equal(stat(id,'HP 回复'), undefined, id);
    assert.ok(details[id].effects.some(e => e.zh.includes(`每 ${seconds} 秒消耗 1 HP`)), id);
  }
  for (const [id,speed] of Object.entries({'general-battle':5,'devil-battle':10,'god-battle':20,'heavenly-battle':40,v101:40})) assert.equal(stat(id,'攻击速度'), `+${speed}%`, id);
  for (const [id,level] of Object.entries({'wizard-technique':1,'devil-technique':2,'god-technique':3,'heavenly-technique':4})) assert.equal(stat(id,'魔法等级'), `+${level}`, id);
  for (const [id,label,seconds] of [['hp-restorate','HP 回复',14],['hp-generate','HP 回复',11],['hp-revival','HP 回复',8],['hp-resurrection','HP 回复',5],['tp-restorate','TP 回复',15],['tp-generate','TP 回复',13],['tp-revival','TP 回复',11],['tp-resurrection','TP 回复',9],['pb-amplifier','PB 回复',40],['pb-generate','PB 回复',35],['pb-create','PB 回复',23],['pb-increase','PB 回复',18],['revival-cuirass','HP 回复',5],['revival-garment','HP 回复',5],['red-ring','HP 回复',15],['red-ring','TP 回复',15],['gods-shield-kouryu','PB 回复',23]]) assert.equal(stat(id,label), `1 / ${seconds} 秒`, id);
  assert.ok(details['proof-of-sword-saint'].effects.some(e => e.zh.includes('ATA 增加 30')));
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

test('cosmetic items carry verified targets, results, sources and reversal rules', () => {
  const overview = read('src/app/generated/item-catalog/cosmetics.json');
  const list = snapshot.indexes['Weapon hearts'];
  const ids = entries => entries.map(e => e.id);
  const hearts = items.filter(i => i.type === 'Weapon heart');
  assert.equal(hearts.length, 31);
  assert.equal(list.rows.length, 31);
  assert.deepEqual([overview.hearts.length, overview.paints.length, overview.platings.length], [31, 14, 9]);
  assert.equal(overview.sources.weaponHearts, list.revision);
  assert.equal(overview.sources.redRing, snapshot.records.find(r => r.title === 'Red Ring').revision);
  for (const item of hearts) {
    const row = list.rows.find(r => r[1] === item.title);
    assert.ok(row, item.title);
    assert.equal(item.cosmetic.kind, 'heart', item.title);
    assert.deepEqual([...item.cosmetic.targets.map(w => w.item)].sort(), [...row.compatible].sort(), item.title);
    for (const weapon of item.cosmetic.targets) {
      assert.equal(details[weapon.id].category, 'weapon', item.title);
      assert.ok(details[weapon.id].cosmetics.some(c => c.item.id === item.id && c.skin.id === item.cosmetic.skin.id), `${weapon.id} lists ${item.id}`);
    }
    assert.ok(item.effects.some(e => e.zh.includes('中和剂') && e.zh.includes('不会返还')), item.title);
    assert.ok(item.effects.some(e => e.zh.includes('磨数会被重置')), item.title);
    assert.ok(!item.effects.some(e => e.zh.includes('适用型号见来源说明')), item.title);
  }
  // Rows the list page leaves incomplete are resolved by each heart's own page.
  assert.deepEqual(ids(details['heart-of-blade-dance'].cosmetic.targets), ['daylight-scar']);
  assert.deepEqual(ids(details['heart-of-partisan-of-lightning'].cosmetic.targets), ['vivienne']);
  assert.deepEqual(ids(details['heart-of-samba-maracas'].cosmetic.targets), ['dual-bird', 'guld-milla', 'manda60-vise', 'mille-marteaux']);
  assert.equal(details['heart-of-soul-banish'].cosmetic.skin.id, 'soul-banish');
  assert.deepEqual(details['heart-of-flamberge'].cosmetic.photonFilter, { color: '蓝色', weapons: [{ item: 'Excalibur', id: 'excalibur' }] });
  assert.equal(details['heart-of-dbs-saber'].cosmetic.photonFilter, null);
  assert.equal(list.photonFilter.length, 7);
  assert.ok(details['heart-of-suppressed-gun'].effects.some(e => e.zh.includes('第一次使用') && e.zh.includes('第二次才移除外观')));
  assert.ok(!details['heart-of-flamberge'].effects.some(e => e.zh.includes('第一次使用')));
  assert.deepEqual(ids(details.excalibur.cosmetics.map(c => c.item)), ['heart-of-lollipop', 'heart-of-ancient-saber', 'heart-of-dbs-saber', 'heart-of-delsabers-buster', 'heart-of-flamberge']);
  assert.equal(details.saber.cosmetics.length, 0);
  assert.deepEqual(overview.hearts.map(h => h.group).filter((g, i, all) => all.indexOf(g) === i),
    ['Multiple', 'Saber', 'Sword', 'Dagger', 'Partisan', 'Slicer', 'Double Saber', 'Twin Sword', 'Handgun', 'Rifle', 'Mechgun', 'Rod', 'Wand']);

  // Ring paints and platings all target the Red Ring; Red Paint reverts either kind.
  const rings = items.filter(i => ['Ring paint', 'Ring plating'].includes(i.type));
  assert.equal(rings.length, 23);
  for (const item of rings) {
    assert.deepEqual(ids(item.cosmetic.targets), ['red-ring'], item.title);
    assert.ok(item.effects.some(e => e.zh.includes('红色手镯')), item.title);
    assert.ok(item.availability && !item.availability.zh.startsWith('来源页面列出'), item.title);
  }
  assert.equal(details['red-ring'].cosmetics.length, 22);
  assert.equal(details['blue-paint'].cosmetic.color, '蓝色');
  assert.equal(details['onyx-paint'].cosmetic.color, '漆黑色');
  for (const item of rings.filter(i => i.cosmetic.color)) assert.equal(`${item.cosmetic.color}涂料`, authority[item.en].zh, item.title);
  assert.match(details['blue-paint'].availability.zh, /圣诞活动期间开启 礼物/);
  assert.match(details['onyx-paint'].availability.zh, /99 个 周年纪念·白银徽章/);
  assert.ok(details['red-paint'].cosmetic.reverts);
  assert.match(details['red-paint'].availability.zh, /数量不限/);
  assert.equal(details['red-paint'].image, details['red-ring'].image);
  assert.equal(details['angel-plating'].cosmetic.skin.id, 'angel-ring');
  assert.deepEqual(details['deep-plating'].cosmetic.trade.map(t => [t.id, t.quantity]),
    [['flapjack-flapper', 2], ['belra-cannon', 10], ['bluefull-card', 1], ['dress-plate', 1], ['from-the-depths', 2], ['heavenly-resist', 2], ['v502', 1]]);
  for (const plating of overview.platings) assert.ok(plating.trade.length >= 5, plating.item);
  // Every paint and plating has a verified Wiki screenshot; two are still first frames of animated Wiki GIFs.
  assert.deepEqual(rings.filter(i => !i.image).map(i => i.id), []);
  const images = read('content/item-catalog/images.json');
  const derived = Object.entries(images).filter(([, image]) => image.derivedFrom).map(([name]) => name).sort();
  assert.deepEqual(derived, ['Delsaber set.gif', 'From The depth.gif']);
  for (const name of derived) assert.match(images[name].source, /\.gif$/);
  assert.equal(details.neutralizer.category, 'tool');
  assert.match(details.neutralizer.availability.zh, /The Forge/);
  assert.ok(details.neutralizer.effects.some(e => e.zh.includes('不会返还')));
});

test('detail text is written in every site language', () => {
  const han = /[㐀-鿿]/;
  for (const detail of Object.values(details)) {
    for (const text of [detail.summary, detail.availability, ...detail.effects, ...(detail.acquisitionGuide?.steps || [])]) {
      for (const language of ['zh', 'en', 'ja']) assert.ok(typeof text[language] === 'string' && text[language].trim(), `${detail.title}: ${language}`);
      assert.doesNotMatch(text.en, han, `${detail.title}: ${text.en}`);
    }
  }
});

test('quest reward guides retain prerequisites, mutually exclusive branches and the final handover', () => {
  const expected = { 'akikos-frying-pan': 4, 'soul-eater': 6, 'ragol-ring': 9 };
  assert.deepEqual(items.filter(i => i.acquisitionGuide).map(i => i.id).sort(), Object.keys(expected).sort());
  for (const [id, count] of Object.entries(expected)) {
    const guide = details[id].acquisitionGuide;
    assert.equal(guide.steps.length, count, id);
    assert.match(guide.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(guide.sources.length >= 2);
    for (const source of guide.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert.ok(source.label.trim());
    }
    for (const step of guide.steps) for (const lang of ['zh', 'en', 'ja']) {
      assert.ok(step[lang].trim());
      assert.doesNotMatch(step[lang], /\{item:|undefined/);
    }
  }
  const pan = details['akikos-frying-pan'].acquisitionGuide.steps;
  for (const quest of ['Secret Delivery', 'The Value of Money', 'Gran Squall', 'The Lost Bride', 'Claiming a Stake']) {
    assert.ok(pan.some(step => step.en.includes(quest)), quest);
  }
  assert.match(pan.at(-1).zh, /秋子婶婶的平底锅/);
  const soul = details['soul-eater'].acquisitionGuide.steps;
  const ring = details['ragol-ring'].acquisitionGuide.steps;
  assert.match(soul[1].en, /refuse to give Sue your name/);
  assert.match(ring[1].en, /give Sue your name/);
  assert.match(soul.at(-1).en, /Ruins 2.*third time/);
  assert.match(details['soul-eater'].availability.zh, /5 个周年纪念·青铜徽章/);
  assert.match(ring[7].en, /only the correct tower terminals/);
  assert.match(ring.at(-1).en, /Sue and Kireek.*first.*Elly/);
  assert.match(details['ragol-ring'].availability.en, /consumes the ring/);
});
