import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { clean, range, slug, typeOf, TYPES, magTrigger, isCommonWeapon } from './item_catalog_model.mjs';
import { collectMagTriggers, magCellRules } from './item_catalog_mag.mjs';
import { selectHdImages } from './item_catalog_hd.mjs';
import { createLocalizedText } from './localized_text.mjs';
import { MESSAGES as CATALOG_MESSAGES } from '../src/app/item-catalog/catalog-messages.ts';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const snapshot = read('content/item-catalog/wiki.json');
const images = read('content/item-catalog/images.json');
// TypeM weapons whose Wiki file was never uploaded use an image derived from the game's ItemKT texture.
const itemKtImages = read('content/item-catalog/itemkt-images.json');
const hdImages = selectHdImages(read('content/item-catalog/hd-gallery.json'));
for (const file of new Set(hdImages.values())) {
  if (!fs.existsSync(`assets/img/items/hd/${file}`)) throw new Error(`Missing HD image: ${file}`);
}
// Mag details use original-model renders, keyed by exact item title; a Mag sharing another's model reuses its render.
const magManifest = read('assets/img/mag/default/manifest.json');
const magRenderNames = new Map([...magManifest.models.map(model => [model.name, model.name]), ...Object.entries(magManifest.aliases)]);
const magRenders = new Set(magRenderNames.keys());
for (const name of new Set(magRenderNames.values())) {
  if (!fs.existsSync(`assets/img/mag/default/${name}.webp`)) throw new Error(`Missing Mag render: ${name}`);
  if (!fs.existsSync(`assets/img/mag/thumbs/${name}.webp`)) throw new Error(`Missing Mag thumbnail: ${name}`);
}
// List rows and item cards show a Mag's render thumbnail (scripts/make_mag_thumbnails.py); other items show their detail image.
const thumbnails = new Map();
const notes = read('content/item-catalog/notes.json');
const { text, join, same, localized } = createLocalizedText();
const corrections = read('content/item-catalog/corrections.json');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('assets/js/i18n/items_i18n.js', 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync('assets/js/mag-evolution.js', 'utf8'), sandbox);
const magData = sandbox.window.MAG_EVOLUTION;
vm.runInNewContext(fs.readFileSync('assets/js/mag-sim-data.js', 'utf8'), sandbox);
const magCells = sandbox.window.MAG_SIM.magCells;
const verifiedTriggers = collectMagTriggers(magData);
const names = new Map(Object.values(sandbox.window.ITEMS_I18N).map(x => [x.en, x]));
const aliases = {
  "S-Berill's Hands No. 0": "S-BERILL'S HANDS #0", "S-Berill's Hands No. 1": "S-BERILL'S HANDS #1",
  'Rappy (Mag)': 'Rappy', "Dragon's Claw (tool)": "Dragon's Claw", 'Present (Christmas)': 'Present',
};
function identity(title) {
  if (names.has(title)) return title;
  if (aliases[title]) {
    if (!names.has(aliases[title])) throw new Error(`Missing canonical alias: ${title}`);
    return aliases[title];
  }
  const matches = [...names.keys()].filter(k => k.normalize('NFKC').toLowerCase() === title.normalize('NFKC').toLowerCase());
  return matches.length === 1 ? matches[0] : title;
}
const display = title => names.get(identity(clean(title)))?.zh || clean(title);
/** An item's authoritative name in each language (Japanese falls back to English). */
const itemName = title => {
  const entry = names.get(identity(clean(title)));
  const en = entry?.en || clean(title);
  return { zh: entry?.zh || en, en, ja: entry?.ja || en };
};
/** Catalog vocabulary (types, colors) shared with the catalog UI's dictionary. */
const vocabulary = zh => {
  const entry = CATALOG_MESSAGES[zh];
  if (!entry) throw new Error(`Untranslated catalog term: ${zh}`);
  return { zh, en: entry[0], ja: entry[1] };
};
/** Authored notes are { zh, en, ja }; {item:English name} placeholders take authoritative names. */
const note = (value, context) => localized(language => {
  if (typeof value?.[language] !== 'string') throw new Error(`${context}: missing ${language} note text`);
  return value[language].replace(/\{item:([^}]+)\}/g, (_, title) => {
    if (!names.has(identity(title))) throw new Error(`${context}: unknown item in note: ${title}`);
    return itemName(title)[language];
  });
});
function toolUses(title) {
  const raw = snapshot.indexes.Tools.rows.find(r => r[1].toLowerCase() === title.toLowerCase())?.[2];
  if (!raw) return [];
  return raw.split(/<br\s*\/?\s*>/i).flatMap(line => {
    const value = clean(line);
    let m;
    if ((m = /^Makes (.+)$/.exec(value))) return [text('items.makes', { item: itemName(m[1]) })];
    if ((m = /^Combines with (.+) to (?:make|create) (.+)$/.exec(value))) return [text('items.combines', { with: itemName(m[1]), result: itemName(m[2]) })];
    if ((m = /^Gives certain weapons the appearance of (.+)$/.exec(value))) return [text('items.givesSkin', { skin: itemName(m[1]) })];
    if ((m = /^Adds (\d+) (base|max) (\w+)$/.exec(value))) return [text(m[2] === 'max' ? 'items.addsMax' : 'items.addsBase', { amount: m[1], stat: m[3] })];
    if ((m = /^Adds (\d+) grind value to weapons$/.exec(value))) return [text('items.addsGrind', { amount: m[1] })];
    return [];
  });
}
// Evolution conditions compare stats ("POW ≥ DEX"); only "highest" and "Others" are words.
const magCondition = condition => {
  const highest = /^(\w+) 最大$/.exec(condition);
  if (highest) return text('items.magHighest', { stat: highest[1] });
  return condition.includes('Others') ? localized(language => condition.replace('Others', text('items.magOthers')[language])) : same(condition);
};
const magConditions = conditions => join(conditions.map(magCondition), 'items.magOr');
function evolutionRules(title) {
  const rules = [];
  for (const [job, stages] of Object.entries(magData.classes)) {
    if (stages.stage1.name === title) rules.push(text('items.magStage1', { job }));
    for (const mag of stages.stage2) if (mag.name === title) rules.push(text('items.magStage2', { from: itemName(mag.from), conditions: magConditions(mag.cond) }));
    for (const group of ['A', 'B']) for (const mag of stages.stage3[group]) if (mag.name === title) {
      rules.push(text('items.magStage3', { job, ids: magData.meta.idGroups[group].join(' / '), conditions: magConditions(mag.cond) }));
    }
    for (const mag of stages.stage3.special || []) if (mag.name === title) rules.push(text('items.magStage3Special', { conditions: magConditions(mag.cond) }));
  }
  if (rules.length) rules.push(text('items.magStage4Excluded'));
  return rules;
}
const statLabels = { ATP: 'ATP · 攻击力', ATA: 'ATA · 命中力', DFP: 'DFP · 防御力', EVP: 'EVP · 回避力', MST: 'MST · 精神力', LCK: 'LCK · 运气', HP: 'HP', TP: 'TP', EFR: 'EFR · 火抗性', EIC: 'EIC · 冰抗性', ETH: 'ETH · 雷抗性', EDK: 'EDK · 暗抗性', ELT: 'ELT · 光抗性' };
// Wiki acquisition entries: generic sources are translated; shops, quests and deals keep
// their in-game English names; Wiki section headings are not sources.
const acquisitionSources = {
  'enemy drops': 'items.sourceEnemyDrops', 'common drops': 'items.sourceCommonDrops', 'box drops': 'items.sourceBoxDrops',
  'area drops': 'items.sourceAreaDrops', 'enemy parts': 'items.sourceEnemyParts',
  'quest reward': 'items.sourceQuestReward', 'quest rewards': 'items.sourceQuestReward', events: 'items.sourceEvents', event: 'items.sourceEvents',
  evolution: 'items.sourceEvolution', combination: 'items.sourceCombination', combinations: 'items.sourceCombination',
  'challenge mode': 'items.sourceChallengeMode', 'wandering tekker': 'items.sourceTekker', paganini: 'items.sourcePaganini',
  'item present': 'items.sourceItemPresent', 'item ticket': 'items.sourceItemTicket', unsealing: 'items.sourceUnsealing',
  'character creation': 'items.sourceCharacterCreation', shop: 'items.sourceShop', 'tools shop': 'items.sourceToolShop', team: 'items.sourceTeam', 'sandbox mode': 'items.sourceSandbox',
};
const acquisitionNames = new Set(["Black Paper's Dangerous Deal", "Black Paper's Dangerous Deal 2", 'Anniversary Badge Shop', 'The Forge', 'The Egg Shop',
  "Claire's Deal", "Claire's Deal 5", "Rappy's Holiday", 'To The Deepest Blue MA4 Venue', 'To The Deepest Blue -MA4 Venue-', "Gallon's Shop", 'Shopping District', 'Mag Cell']);
const notSources = new Set(['trivia', 'usage', 'drop locations']);
const acquisitionSource = value => {
  const key = acquisitionSources[value.toLowerCase()];
  if (key) return text(key);
  if (acquisitionNames.has(value)) return same(value);
  throw new Error(`Unclassified acquisition source: ${value}`);
};
const records = [...snapshot.records, {
  title: 'disk', revision: 0, fields: { type: 'Disk', stack: '1', class: '110011001111' },
  tables: [], drops: [], related: [], acquisition: ['Tools Shop', 'Enemy drops', 'Box drops'],
  excerpts: [], source: 'https://wiki.pioneer2.net/w/Techniques',
}];
const itemIds = new Map(records.map(r => [r.title, slug(r.title)]));
for (const id of hdImages.keys()) {
  if (![...itemIds.values()].includes(id)) throw new Error(`Unknown HD item: ${id}`);
}
const recordByTitle = new Map(records.map(r => [r.title, r]));
const link = title => {
  const id = itemIds.get(title);
  if (!id) throw new Error(`Weapon heart references an uncatalogued item: ${title}`);
  return { item: title, id };
};
// Cosmetic items change appearance only. Weapon heart compatibility comes from each heart page and
// must agree with the Weapon hearts list page; ring paints and platings always target the Red Ring.
const heartIndex = snapshot.indexes['Weapon hearts'];
// Weapon series the Wiki lists on their own pages are browsed as their own list group; items keep their weapon type.
const seriesGroups = new Map(Object.entries({ 'ES weapons': 'ES 武器', 'TypeM weapons': 'TypeM 武器' })
  .flatMap(([page, group]) => snapshot.indexes[page].rows.map(row => [clean(row[1]), group])));
if (!heartIndex) throw new Error('Missing Weapon hearts index');
const PHOTON_COLORS = { Blue: '蓝色', Yellow: '黄色', Green: '绿色', White: '白色' };
const colorOf = value => {
  if (!PHOTON_COLORS[value]) throw new Error(`Unknown Photon Filter color: ${value}`);
  return PHOTON_COLORS[value];
};
// A paint's color is named exactly as in its authoritative item name, e.g. 漆黑色涂料 -> 漆黑色.
const paintColor = title => {
  const name = display(title);
  if (!/^.+色涂料$/.test(name)) throw new Error(`Paint name does not state its color: ${title}: ${name}`);
  return name.replace(/涂料$/, '');
};
const filterWeapons = ['Heaven Punisher', 'Mille Marteaux'];
const toolRow = title => clean(snapshot.indexes.Tools.rows.find(r => r[1] === title)?.[2]);
const cosmeticByTitle = new Map();
for (const row of heartIndex.rows) {
  const title = clean(row[1]);
  const record = recordByTitle.get(title);
  if (!record?.compatible) throw new Error(`Weapon heart without compatibility: ${title}`);
  if ([...record.compatible].sort().join('|') !== [...row.compatible].sort().join('|')) throw new Error(`Weapon heart compatibility differs from the list page: ${title}`);
  const skin = toolRow(title).replace(/^Gives certain weapons the appearance of /, '');
  const filter = heartIndex.photonFilter.find(f => f.heart === title) || null;
  cosmeticByTitle.set(title, {
    kind: 'heart', item: link(title), targets: record.compatible.map(link), skin: link(skin), color: null,
    photonFilter: filter ? { color: colorOf(filter.color), weapons: filter.weapons.map(link) } : null,
    trade: [], shop: null, event: null, freeQuests: [],
  });
}
for (const record of records.filter(r => r.cosmetic)) {
  const kind = typeOf(record.fields.type) === 'Ring plating' ? 'plating' : 'paint';
  const description = toolRow(record.title);
  const skin = kind === 'plating' ? description.replace(/^Gives Red Ring the appearance of /, '') : null;
  const reverts = /^Reverts any painted/.test(description);
  const color = kind === 'paint' && !reverts ? paintColor(record.title) : null;
  if (kind === 'plating' && skin === description) throw new Error(`Unrecognized plating: ${record.title}`);
  if (kind === 'paint' && !reverts && !/^Turns Red Ring /.test(description)) throw new Error(`Unrecognized paint: ${record.title}`);
  const { trade, shop, event, freeQuests } = record.cosmetic;
  cosmeticByTitle.set(record.title, {
    kind, item: link(record.title), targets: [link('Red Ring')], skin: skin ? link(skin) : null, color, reverts, photonFilter: null,
    trade: trade.map(t => ({ ...link(t.item), quantity: t.quantity })),
    shop: shop ? { quest: shop.quest, price: shop.price, currency: link(shop.currency) } : null,
    event: event ? { event: event.event, via: link(event.via) } : null,
    freeQuests,
  });
}
const cosmeticsByTarget = new Map();
for (const entry of cosmeticByTitle.values()) {
  if (entry.reverts) continue;
  for (const target of entry.targets) {
    cosmeticsByTarget.set(target.item, [...(cosmeticsByTarget.get(target.item) || []), { item: entry.item, kind: entry.kind, skin: entry.skin, color: entry.color }]);
  }
}
const EVENTS = { 'Christmas event': 'items.eventChristmas' };
const weaponList = weapons => join(weapons.map(w => itemName(w.item)), 'items.weaponSeparator');
function cosmeticRules(entry) {
  const ring = itemName('Red Ring');
  const neutralizer = itemName('Neutralizer');
  if (entry.kind === 'heart') {
    const rules = [
      text('items.heartUse'),
      text('items.heartReset', { skin: entry.skin.item }),
      text('items.heartNeutralizer', { neutralizer }),
    ];
    const filtered = entry.targets.filter(w => filterWeapons.includes(w.item));
    if (filtered.length) rules.push(text('items.heartFilterOrder', { weapons: weaponList(filtered), divine: itemName('Divine Filter'), lockon: itemName('Lock-on Filter'), neutralizer }));
    if (entry.photonFilter) rules.push(text('items.heartPhotonFilter', { weapons: weaponList(entry.photonFilter.weapons), skin: itemName(entry.skin.item), filter: itemName('Photon Filter'), color: vocabulary(entry.photonFilter.color) }));
    return rules;
  }
  if (entry.reverts) return [text('items.ringRevert', { ring })];
  const common = text('items.ringCommon', { ring, redPaint: itemName('Red Paint') });
  return entry.kind === 'paint'
    ? [text('items.paintUse', { ring, color: vocabulary(entry.color) }), text('items.paintName', { common })]
    : [text('items.platingUse', { ring, skin: itemName(entry.skin.item) }), text('items.platingName', { skin: entry.skin.item, common })];
}
function cosmeticAvailability(entry) {
  if (!entry || entry.kind === 'heart') return null;
  const sources = [];
  if (entry.event) {
    if (!EVENTS[entry.event.event]) throw new Error(`Untranslated cosmetic event: ${entry.item.item}: ${entry.event.event}`);
    sources.push(text('items.cosmeticEvent', { event: text(EVENTS[entry.event.event]), via: itemName(entry.event.via.item) }));
  }
  if (entry.shop) sources.push(text('items.cosmeticShop', { quest: entry.shop.quest, price: entry.shop.price, currency: itemName(entry.shop.currency.item) }));
  if (entry.trade.length) sources.push(text('items.cosmeticForge'));
  return sources.length ? join(sources, 'items.sentenceSeparator') : null;
}
const details = {};
const index = [];
const unresolved = [];
const unknownCodes = [];
for (const record of records) {
  const f = { ...record.fields, ...corrections[record.title]?.fields };
  const title = record.title;
  const id = itemIds.get(title);
  const en = identity(title);
  if (!names.has(en)) unresolved.push(title);
  const type = typeOf(f.type);
  const [category, subtype] = TYPES[type];
  const isEquipment = ['weapon', 'armor', 'shield', 'unit', 'mag'].includes(category);
  const mask = f.class || (category === 'mag' ? '111111111111' : '');
  if (mask && !/^[01]{12}$/.test(mask)) throw new Error(`Invalid class mask: ${title}: ${mask}`);
  const rarity = /^\d+$/.test(f.stars || '') ? +f.stars : null;
  const code = /^[a-f0-9]{6}$/i.test(f.hex || '') ? f.hex.toUpperCase() : null;
  if (!code) unknownCodes.push({ title, sourceValue: f.hex || null });
  const status = record.obsolete ? 'obsolete' : record.unavailable || magCells[title]?.unobtainable ? 'unavailable' : 'listed';
  const requirement = clean(f.requirement).replace(/^Level (\d+)$/, '等级 $1').replace(/^None$/, '无额外要求')
    || (category === 'unit' ? '铠甲的空插件槽' : category === 'mag' ? '无职业限制' : isEquipment ? '来源未标注' : '从道具栏使用');
  const stats = Object.entries(statLabels).filter(([key]) => f[key] !== undefined && f[key] !== '')
    .map(([key, label]) => ({ label, value: clean(f[key], true).replace(/(\d)-(\d)/g, '$1–$2') }));
  if (category === 'armor' || category === 'shield') stats.sort((a, b) => Number(!/^(DFP|EVP)/.test(a.label)) - Number(!/^(DFP|EVP)/.test(b.label)));
  stats.unshift(...(notes[title]?.extraStats || []));
  if (record.attackSpeed) stats.unshift({label: '攻击速度', value: `+${record.attackSpeed}%`});
  for (const periodic of record.periodic || []) stats.push({label: `${periodic.stat} ${periodic.amount < 0 ? '消耗' : '回复'}`, value: `${Math.abs(periodic.amount)} / ${periodic.seconds} 秒${periodic.moving ? '（移动时）' : ''}`});
  if (record.techniqueLevels) stats.unshift({label: '魔法等级', value: `+${record.techniqueLevels}`});
  const cosmetic = cosmeticByTitle.get(title) || null;
  const effects = [...(notes[title]?.effects || []).map(effect => note(effect, title)), ...toolUses(title), ...(cosmetic ? cosmeticRules(cosmetic) : []), ...magCellRules(magCells[title], { text, join, itemName }, magData.meta.idGroups)];
  const addStat = (label, value) => { if (value !== undefined && value !== '') stats.push({ label, value: String(value) }); };
  const atp = range(f.ATP);
  const grind = /^\d+$/.test(f.grind || '') ? +f.grind : null;
  const commonWeapon = category === 'weapon' && isCommonWeapon(code);
  if (category === 'weapon') {
    addStat('最大磨数', grind === null ? '来源未标注' : `+${grind}`);
    if (atp && grind !== null) addStat('最大磨数下 ATP', [...new Set(atp.map(n => n + grind * 2))].join('–'));
    addStat('特殊攻击', commonWeapon ? '可变' : /^See page$/i.test(f.special || '') ? '独有特殊攻击 · 见使用说明' : clean(f.special, true).replace(/^None$/, '无').replace(/^Varies$/, '可变'));
    if (commonWeapon) effects.push(text('items.variableSpecial'));
    addStat('普通攻击目标数', clean(f.targets).replace(/^Varies$/, '随攻击方式变化') || '来源未标注');
    addStat('连段', record.noCombo ? '不可连段' : '可以连段');
    for (const [key, label] of Object.entries({ hdist: '水平距离', vdist: '垂直距离', hangle: '水平角度', vangle: '垂直角度', special_hdist: '特殊攻击水平距离', special_vdist: '特殊攻击垂直距离', special_hangle: '特殊攻击水平角度', special_vangle: '特殊攻击垂直角度' })) {
      if (f[key] !== undefined) addStat(label, clean(f[key], true) + (key.includes('angle') ? '°' : ''));
    }
    if (record.noCombo) effects.push(text('items.noCombo'));
    if (record.tables.some(t => t.template === 'AddSpecial')) effects.push(text('items.esWeapon'));
  }
  if (category === 'mag') {
    effects.push(...evolutionRules(title));
    addStat('进化阶段', f.evo === '0' ? '初始形态' : f.evo ? `第 ${f.evo} 阶段` : '来源未标注');
    addStat('习得 Photon Blast', clean(f.pb) || '不新增 PB');
    for (const [key, label, event] of [['triggerpb', 'PB 达到 100', '100PB'], ['triggerhp', '低 HP 触发', '10%HP'], ['triggerboss', '进入 Boss 房间', 'BOSS']]) {
      const triggers = verifiedTriggers.get(title);
      const trigger = triggers?.[event];
      addStat(label, triggers ? trigger ? `${magData.meta.effects[trigger.effect]} · ${trigger.rate}${/[-–]/.test(trigger.rate) ? '（随同步率变化）' : ''}` : '无' : magTrigger(f[key], f.triggerrate || '0'));
    }
    addStat('死亡触发', 'PSOBB 不启用死亡触发');
    const feed = record.tables.find(t => t.template === 'MagFeedTable');
    if (feed) addStat('喂养表', `Table ${feed[1]}`);
    if (f.conditions) addStat('进化条件', clean(f.conditions, true));
    if (f.conditions && f.evo === '4' && !f.cell) effects.push(text('items.magNaturalStage4'));
    if (f.cell) effects.push(text('items.magCell', { cell: itemName(f.cell) }));
    effects.push(text('items.magStats'));
  }
  if (f.stack) addStat('堆叠上限', f.stack);
  for (const periodic of record.periodic || []) {
    const key = `items.periodic${periodic.amount < 0 ? 'Drain' : 'Recover'}${periodic.moving ? 'Moving' : ''}`;
    effects.push(text(key, { seconds: periodic.seconds, amount: Math.abs(periodic.amount), stat: periodic.stat }));
  }
  if (record.attackSpeed) effects.push(text('items.attackSpeed', { percent: record.attackSpeed }));
  if (record.techniqueLevels) effects.push(text('items.techniqueLevels', { levels: record.techniqueLevels }));
  if (title.startsWith('Cure/')) effects.push(text('items.cureImmunity', { status: text(`items.status${title.split('/')[1]}`) }));
  if (type === 'Grinder') effects.push(text('items.grinder'));
  if (type === 'Material') effects.push(text('items.material'));
  if (type === 'Music Disk') effects.push(text('items.musicDisk'));
  if (type === 'Disk') effects.push(text('items.disk'));
  const boosts = record.tables.filter(t => t.template === 'TechBoostRow').map(t => ({ label: identity(clean(t[1])), value: clean(t[2], true).replace(/Damage/gi, '伤害').replace(/Range/gi, '范围') }));
  const sets = record.tables.filter(t => t.template === 'SetEffectRow').map(t => ({ item: clean(t[2]), id: itemIds.get(clean(t[2])) || null, effect: clean(t.effect || '', true) }));
  const skins = record.tables.filter(t => t.template === 'ReskinsRow').map(t => ({ item: clean(t[1]), id: itemIds.get(clean(t[1])) || null, code: clean(t[2]) }));
  const imageName = clean(f.image).replaceAll('_', ' ');
  // Paints and platings use the Wiki screenshot of the ring after use; Red Paint restores the original Red Ring.
  const appearanceName = record.cosmetic ? (record.cosmetic.appearance || '') : '';
  const wikiImage = images[imageName] || images[imageName[0]?.toUpperCase() + imageName.slice(1)]
    || images[appearanceName] || (cosmetic?.reverts ? images[clean(recordByTitle.get('Red Ring').fields.image).replaceAll('_', ' ')] : undefined);
  const image = wikiImage || itemKtImages[title];
  const source = record.source || `https://wiki.pioneer2.net/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
  const acquisition = record.acquisition.filter(a => !notSources.has(a.toLowerCase())).map(acquisitionSource);
  if (commonWeapon) acquisition.push(text('items.weaponShop'));
  const distinctSources = [...new Map(acquisition.map(source => [source.zh, source])).values()];
  const availability = notes[title]?.availability ? note(notes[title].availability, title) : cosmeticAvailability(cosmetic)
    || text(status === 'obsolete' ? 'items.obsolete' : status === 'unavailable' ? 'items.unavailable' : distinctSources.length ? 'items.sources' : 'items.checkSources',
      { sources: join(distinctSources, 'items.sourceSeparator') });
  const summaryStatus = status === 'obsolete' ? ['items.summaryObsolete'] : status === 'unavailable' ? ['items.summaryUnavailable'] : [];
  const summary = notes[title]?.summary ? note(notes[title].summary, title)
    : join([text(isEquipment ? 'items.summaryEquipment' : 'items.summaryItem', { subtype: vocabulary(subtype) }), ...summaryStatus.map(key => text(key))], 'items.sentenceSeparator');
  const drops = record.drops.map(d => ({ kind: d.kind, sectionId: clean(d.id) || '来源未标注', difficulty: { N: 'Normal', H: 'Hard', VH: 'Very Hard', U: 'Ultimate' }[d.diff] || clean(d.diff), location: clean(d.location), area: clean(d.area), rate: clean(d.rate) || '普通掉落' }));
  const feedId = record.tables.find(t => t.template === 'MagFeedTable')?.[1];
  const feedTable = feedId === undefined ? null : sandbox.window.MAG_SIM.feedTables[feedId];
  if (feedId !== undefined && !feedTable) throw new Error(`Unknown feeding table: ${title}: ${feedId}`);
  const feeding = feedTable ? Object.entries(feedTable).map(([item, values]) => ({ item, values })) : [];
  const detail = { id, en, title, type, subtype, category, code, rarity, mask, status, requirement, stats, summary, effects: [...new Map(effects.map(effect => [effect.zh, effect])).values()], boosts, sets, skins, cosmetic, cosmetics: cosmeticsByTarget.get(title) || [], feeding, drops, availability, source, revision: record.revision, checkedAt: record.checkedAt || snapshot.checkedAt, excerpts: record.excerpts, image: image?.path || null, imageOrigin: wikiImage ? 'wiki' : image ? 'itemkt' : null, imageSource: image?.source || null, imagePage: image?.page || null, related: record.related.map(t => itemIds.get(t)).filter(x => x && x !== id).slice(0, 6) };
  if (details[id]) throw new Error(`Duplicate item slug: ${id}`);
  const magRender = category === 'mag' && magRenders.has(title);
  if (magRender && hdImages.has(id)) throw new Error(`Mag has both a render and an HD gallery image: ${title}`);
  detail.hdImage = magRender ? `/assets/img/mag/default/${magRenderNames.get(title)}.webp` : hdImages.has(id) ? `/assets/img/items/hd/${hdImages.get(id)}` : null;
  detail.hdSource = magRender ? 'model-render' : hdImages.has(id) ? 'gallery' : null;
  detail.zh = names.get(en)?.zh || en;
  const ja = names.get(en)?.ja || clean(f.jp);
  if (ja) detail.ja = ja;
  detail.atpMax = atp?.[1] ?? null;
  if (magRender) magRenders.delete(title);
  details[id] = detail;
  thumbnails.set(id, magRender ? `/assets/img/mag/thumbs/${magRenderNames.get(title)}.webp` : detail.image);
  // Compact tuples keep the searchable index small; detailed data is loaded per item.
  index.push([id, en, type, rarity, mask, requirement, stats.slice(0, 2).map(s => [s.label, s.value]), thumbnails.get(id), code, status, title === en ? '' : title, atp?.[1] ?? null, detail.ja || '', detail.zh, seriesGroups.get(title) || '']);
}
if (magRenders.size) throw new Error(`Mag renders without a catalog Mag: ${[...magRenders].join(', ')}`);
for (const title of seriesGroups.keys()) if (!recordByTitle.has(title)) throw new Error(`Series item without a catalog record: ${title}`);
index.sort((a, b) => (a[8] || 'FFFFFF').localeCompare(b[8] || 'FFFFFF') || a[0].localeCompare(b[0]));
// Each page ships only the item data it shows: a detail page carries its related
// items and the localized names it references, so no page but the list needs the
// whole index or the full name table.
const card = id => { const d = details[id]; return { id, en: d.en, zh: d.zh, ...(d.ja ? { ja: d.ja } : {}), image: thumbnails.get(id) }; };
const itemByName = new Map();
for (const [id] of index) for (const key of [details[id].en, details[id].title]) if (!itemByName.has(key)) itemByName.set(key, details[id]);
const localizedName = text => {
  const entry = itemByName.get(text) || names.get(text);
  return entry ? { en: entry.en, zh: entry.zh || entry.en, ...(entry.ja ? { ja: entry.ja } : {}) } : null;
};
for (const detail of Object.values(details)) {
  const texts = [
    detail.cosmetic?.item.item, detail.cosmetic?.skin?.item, ...(detail.cosmetic?.targets ?? []).map(t => t.item),
    ...(detail.cosmetic?.photonFilter?.weapons ?? []).map(w => w.item), ...(detail.cosmetic?.trade ?? []).map(t => t.item),
    ...detail.cosmetics.flatMap(option => [option.item.item, option.skin?.item]),
    ...detail.sets.map(set => set.item), ...detail.skins.map(skin => skin.item),
    ...detail.feeding.map(feed => feed.item), ...detail.boosts.map(boost => boost.label),
  ].filter(Boolean);
  detail.names = Object.fromEntries([...new Set(texts)].map(text => [text, localizedName(text)]).filter(([, entry]) => entry));
  detail.relatedItems = detail.related.map(card);
}
fs.mkdirSync('src/app/generated/item-catalog', { recursive: true });
fs.rmSync('assets/data/items', { recursive: true, force: true });
fs.mkdirSync('assets/data/items', { recursive: true });
fs.writeFileSync('src/app/generated/item-catalog/index.json', JSON.stringify(index));
fs.writeFileSync('src/app/generated/item-catalog/details.server.json', JSON.stringify(details));
fs.writeFileSync('src/app/generated/item-catalog/types.json', JSON.stringify(TYPES));
// The overview groups hearts like the Wiki list: by the shared type of their compatible weapons.
// Only non-empty facts are emitted; the overview ships inside its route bundle.
const compact = row => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null && value !== false && !(Array.isArray(value) && !value.length)));
const overviewRow = entry => compact({
  item: entry.item.id, skin: entry.skin?.id ?? null, color: entry.color, reverts: !!entry.reverts,
  targets: entry.kind === 'heart' ? entry.targets.map(t => t.id) : null,
  photonFilter: entry.photonFilter ? { color: entry.photonFilter.color, weapons: entry.photonFilter.weapons.map(w => w.id) } : null,
  trade: entry.trade.map(t => [t.id, t.quantity]),
  shop: entry.shop ? { quest: entry.shop.quest, price: entry.shop.price, currency: entry.shop.currency.id } : null,
  event: entry.event ? { event: entry.event.event, via: entry.event.via.id } : null,
  freeQuests: entry.freeQuests,
  drops: details[entry.item.id].drops.map(d => [d.sectionId, d.difficulty, d.location, d.rate, ...(d.kind === 'box' ? ['box'] : [])]),
});
const entries = [...cosmeticByTitle.values()];
const cosmeticsOverview = {
  sources: { weaponHearts: heartIndex.revision, redRing: recordByTitle.get('Red Ring').revision },
  hearts: entries.filter(e => e.kind === 'heart').map(entry => {
    const types = [...new Set(entry.targets.map(w => details[w.id].type))];
    return { ...overviewRow(entry), group: types.length === 1 ? types[0] : 'Multiple' };
  }),
  paints: entries.filter(e => e.kind === 'paint').sort((a, b) => Number(!!b.reverts) - Number(!!a.reverts) || a.item.item.localeCompare(b.item.item, 'en')).map(overviewRow),
  platings: entries.filter(e => e.kind === 'plating').sort((a, b) => a.item.item.localeCompare(b.item.item, 'en')).map(overviewRow),
};
const cosmeticIds = new Set(['red-ring', 'red-paint', 'neutralizer', 'photon-filter']);
for (const row of [...cosmeticsOverview.hearts, ...cosmeticsOverview.paints, ...cosmeticsOverview.platings]) {
  for (const id of [row.item, row.skin, ...(row.targets ?? []), ...(row.photonFilter?.weapons ?? []), ...(row.trade ?? []).map(([id]) => id), row.shop?.currency, row.event?.via]) if (id) cosmeticIds.add(id);
}
cosmeticsOverview.items = Object.fromEntries([...cosmeticIds].sort().map(id => [id, card(id)]));
fs.writeFileSync('src/app/generated/item-catalog/cosmetics.json', JSON.stringify(cosmeticsOverview));
const detailHash = createHash('sha256');
for (const [id, detail] of Object.entries(details).sort(([a], [b]) => a.localeCompare(b))) {
  const json = JSON.stringify(detail);
  fs.writeFileSync(`assets/data/items/${id}.json`, json);
  detailHash.update(`${id}\n${json}\n`);
}
// The bundled version changes whenever any detail file changes, so browsers never reuse stale detail JSON.
// The searchable index is fetched as data by the item list, not bundled into its script.
const indexJson = JSON.stringify(index);
fs.writeFileSync('assets/data/item-index.json', indexJson);
const indexHash = createHash('sha256').update(indexJson).digest('hex').slice(0, 12);
fs.writeFileSync('src/app/generated/item-catalog/version.json', JSON.stringify({ details: detailHash.digest('hex').slice(0, 12), index: indexHash }));
const report = { checkedAt: snapshot.checkedAt, items: index.length, categories: Object.fromEntries(['weapon','armor','shield','unit','mag','tool'].map(c => [c,Object.values(details).filter(d=>d.category===c).length])), withImages: index.filter(x => x[7]).length, unresolvedNames: unresolved, unknownCodes };
fs.writeFileSync('content/item-catalog/coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Generated ${index.length} item pages; ${report.withImages} with images. Index: ${fs.statSync('src/app/generated/item-catalog/index.json').size} bytes.`);
