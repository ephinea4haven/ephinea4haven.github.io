import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { clean, range, slug, typeOf, TYPES, magTrigger, isCommonWeapon } from './item_catalog_model.mjs';
import { collectMagTriggers, magCellRules } from './item_catalog_mag.mjs';
import { selectHdImages } from './item_catalog_hd.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const snapshot = read('content/item-catalog/wiki.json');
const images = read('content/item-catalog/images.json');
const hdImages = selectHdImages(read('content/item-catalog/hd-gallery.json'));
for (const file of new Set(hdImages.values())) {
  if (!fs.existsSync(`assets/img/items/hd/${file}`)) throw new Error(`Missing HD image: ${file}`);
}
const notes = read('content/item-catalog/notes.json');
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
function toolUses(title) {
  const raw = snapshot.indexes.Tools.rows.find(r => r[1].toLowerCase() === title.toLowerCase())?.[2];
  if (!raw) return [];
  return raw.split(/<br\s*\/?\s*>/i).flatMap(line => {
    const value = clean(line);
    let m;
    if ((m = /^Makes (.+)$/.exec(value))) return [`可交给蒙塔古博士制成 ${display(m[1])}；需满足相关任务条件。`];
    if ((m = /^Combines with (.+) to (?:make|create) (.+)$/.exec(value))) return [`与 ${display(m[1])} 合成为 ${display(m[2])}。使用前还需满足对应的等级、职业与磨数条件。`];
    if ((m = /^Gives certain weapons the appearance of (.+)$/.exec(value))) return [`对适用武器使用后，外观变为 ${display(m[1])}，武器原有的参数不变。`];
    if ((m = /^Adds (\d+) (base|max) (\w+)$/.exec(value))) return [`使用后增加 ${m[1]} ${m[3]}${m[2] === 'max' ? '上限' : '基础值'}。`];
    if ((m = /^Adds (\d+) grind value to weapons$/.exec(value))) return [`增加当前装备武器 ${m[1]} 磨数。`];
    return [];
  });
}
function evolutionRules(title) {
  const rules = [];
  for (const [job, stages] of Object.entries(magData.classes)) {
    if (stages.stage1.name === title) rules.push(`等级 10，由 ${job} 职业喂养进化。`);
    for (const mag of stages.stage2) if (mag.name === title) rules.push(`等级 35，由 ${display(mag.from)} 进化：${mag.cond.join(' 或 ')}。`);
    for (const group of ['A', 'B']) for (const mag of stages.stage3[group]) if (mag.name === title) {
      rules.push(`等级 50 及之后每 5 级；${job} 职业，Section ID：${magData.meta.idGroups[group].join(' / ')}；${mag.cond.join(' 或 ')}。`);
    }
    for (const mag of stages.stage3.special || []) if (mag.name === title) rules.push(`等级 50 及之后每 5 级；FO 职业，DEF ≥ 45；${mag.cond.join(' 或 ').replace('Others', '其他属性')}。`);
  }
  if (rules.length) rules.push('第三阶段进化规则不适用于已经进入第四阶段的玛古。');
  return rules;
}
const statLabels = { ATP: 'ATP · 攻击力', ATA: 'ATA · 命中力', DFP: 'DFP · 防御力', EVP: 'EVP · 回避力', MST: 'MST · 精神力', LCK: 'LCK · 运气', HP: 'HP', TP: 'TP', EFR: 'EFR · 火抗性', EIC: 'EIC · 冰抗性', ETH: 'ETH · 雷抗性', EDK: 'EDK · 暗抗性', ELT: 'ELT · 光抗性' };
const acquisitionLabels = { 'enemy drops': '怪物掉落', 'common drops': '普通掉落', 'box drops': '箱子掉落', 'quest reward': '任务奖励', 'quest rewards': '任务奖励', 'events': '活动限定', event: '活动限定', evolution: '进化', combination: '合成', combinations: '合成', 'challenge mode': '挑战模式', 'wandering tekker': '科伦抽奖', paganini: 'Paganini 兑换', 'item present': 'Item Present 兑换' };
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
const EVENTS = { 'Christmas event': '圣诞活动' };
function cosmeticRules(entry) {
  const ring = display('Red Ring');
  const redPaint = display('Red Paint');
  if (entry.kind === 'heart') {
    const rules = [
      '先装备适用武器，再在道具栏使用本道具；适用武器见下方列表。',
      `使用后武器磨数会被重置。武器名称后会加上 *，道具说明中显示“Skin: ${entry.skin.item}”。`,
      `可以用 ${display('Neutralizer')} 将武器恢复为原本外观，但已使用的武器之心不会返还。`,
    ];
    const filtered = entry.targets.filter(w => filterWeapons.includes(w.item)).map(w => display(w.item));
    if (filtered.length) rules.push(`${filtered.join(' / ')} 若同时带有外观和 ${display('Divine Filter')} 或 ${display('Lock-on Filter')}，第一次使用 ${display('Neutralizer')} 只移除滤镜效果，第二次才移除外观。`);
    if (entry.photonFilter) rules.push(`${entry.photonFilter.weapons.map(w => display(w.item)).join(' / ')} 应用 ${display(entry.skin.item)} 外观后，可以使用 ${display('Photon Filter')} 改变颜色：初始为${entry.photonFilter.color}，每次使用消耗一个 ${display('Photon Filter')}，按固定顺序切换到下一种颜色。其他组合使用无效。`);
    return rules;
  }
  if (entry.reverts) return [`对已染色或已更换外观的 ${ring}* 使用，恢复为原版 ${ring}。之前使用的涂料或镀层不会返还。`];
  const common = `性能与普通 ${ring} 完全相同。可以用 ${redPaint} 恢复原版外观，但已使用的道具不会返还。`;
  return entry.kind === 'paint'
    ? [`装备 ${ring}（原版或已染色）后在道具栏使用，戒指颜色变为${entry.color}。`, `使用后名称后会加上 *。${common}`]
    : [`装备 ${ring} 后在道具栏使用，外观变为 ${display(entry.skin.item)}。`, `使用后名称后会加上 *，道具说明中显示“Skin: ${entry.skin.item}”。${common}`];
}
function cosmeticAvailability(entry) {
  if (!entry || entry.kind === 'heart') return null;
  const sources = [];
  if (entry.event) {
    if (!EVENTS[entry.event.event]) throw new Error(`Untranslated cosmetic event: ${entry.item.item}: ${entry.event.event}`);
    sources.push(`${EVENTS[entry.event.event]}期间开启 ${display(entry.event.via.item)} 时有较低几率获得。`);
  }
  if (entry.shop) sources.push(`在任务 ${entry.shop.quest} 中用 ${entry.shop.price} 个 ${display(entry.shop.currency.item)} 购买。`);
  if (entry.trade.length) sources.push('只能在任务 The Forge 中向 Montague 交换获得，所需道具见下方列表。');
  return sources.join('') || null;
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
  const effects = [...(notes[title]?.effects || []), ...toolUses(title), ...(cosmetic ? cosmeticRules(cosmetic) : []), ...magCellRules(magCells[title], display, magData.meta.idGroups)];
  const addStat = (label, value) => { if (value !== undefined && value !== '') stats.push({ label, value: String(value) }); };
  const atp = range(f.ATP);
  const grind = /^\d+$/.test(f.grind || '') ? +f.grind : null;
  const commonWeapon = category === 'weapon' && isCommonWeapon(code);
  if (category === 'weapon') {
    addStat('最大磨数', grind === null ? '来源未标注' : `+${grind}`);
    if (atp && grind !== null) addStat('最大磨数下 ATP', [...new Set(atp.map(n => n + grind * 2))].join('–'));
    addStat('特殊攻击', commonWeapon ? '可变' : /^See page$/i.test(f.special || '') ? '独有特殊攻击 · 见使用说明' : clean(f.special, true).replace(/^None$/, '无').replace(/^Varies$/, '可变'));
    if (commonWeapon) effects.push('特殊攻击由具体掉落或商店生成的道具决定，不是固定效果。');
    addStat('普通攻击目标数', clean(f.targets).replace(/^Varies$/, '随攻击方式变化') || '来源未标注');
    addStat('连段', record.noCombo ? '不可连段' : '可以连段');
    for (const [key, label] of Object.entries({ hdist: '水平距离', vdist: '垂直距离', hangle: '水平角度', vangle: '垂直角度', special_hdist: '特殊攻击水平距离', special_vdist: '特殊攻击垂直距离', special_hangle: '特殊攻击水平角度', special_vangle: '特殊攻击垂直角度' })) {
      if (f[key] !== undefined) addStat(label, clean(f[key], true) + (key.includes('angle') ? '°' : ''));
    }
    if (record.noCombo) effects.push('这件武器不能进行连段攻击。');
    if (record.tables.some(t => t.template === 'AddSpecial')) effects.push('ES 武器可在挑战模式取得，并通过 Paganini 追加特殊攻击；可选种类及费用见来源页面。');
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
    if (f.conditions && f.evo === '4' && !f.cell) effects.push('自然第四阶段进化从等级 100 开始，之后每 10 级检查一次；必须仍是可继续进化的第三阶段玛古。');
    if (f.cell) effects.push(`进化所用道具：${display(f.cell)}。具体等级、职业和属性条件见获取来源。`);
    effects.push('玛古的 DEF / POW / DEX / MIND 由培养决定；外观形态不代表固定配点。低 HP 触发还要求单帧损失超过最大 HP 的 20%，并降至 10% 以下。');
  }
  if (f.stack) addStat('堆叠上限', f.stack);
  for (const periodic of record.periodic || []) effects.push(`${periodic.moving ? '装备后移动时，' : '装备时，'}每 ${periodic.seconds} 秒${periodic.amount < 0 ? '消耗' : '恢复'} ${Math.abs(periodic.amount)} ${periodic.stat}。`);
  if (record.attackSpeed) effects.push(`攻击速度提高 ${record.attackSpeed}%。攻击速度加成不叠加，仅生效最高值。`);
  if (record.techniqueLevels) effects.push(`已学魔法等级提高 ${record.techniqueLevels} 级，不超过职业的魔法等级上限。`);
  if (title.startsWith('Cure/')) effects.push(`装备时免疫${{Confuse:'混乱', Freeze:'冰冻', Paralysis:'麻痹', Poison:'中毒', Shock:'感电', Slow:'缓慢'}[title.split('/')[1]]}。`);
  if (type === 'Grinder') effects.push('提升当前装备武器的磨数，每 1 磨数增加 2 ATP，不能超过武器磨数上限。');
  if (type === 'Material') effects.push('用于提升角色能力。使用次数受职业与能力药种类的上限约束。');
  if (type === 'Music Disk') effects.push('使用后更换当前区域的背景音乐，同区域玩家也会听到。属于一次性道具，使用者离开区域后恢复原有背景音乐。');
  if (type === 'Disk') effects.push('魔法光盘按魔法种类和等级区分，学习时检查基础 MST 与职业限制。大多数魔法最高等级为 30；Anti 最高为 7，Ryuker 与 Reverser 无等级变化。机器人不能学习魔法。');
  const boosts = record.tables.filter(t => t.template === 'TechBoostRow').map(t => ({ label: identity(clean(t[1])), value: clean(t[2], true).replace(/Damage/gi, '伤害').replace(/Range/gi, '范围') }));
  const sets = record.tables.filter(t => t.template === 'SetEffectRow').map(t => ({ item: clean(t[2]), id: itemIds.get(clean(t[2])) || null, effect: clean(t.effect || '', true) }));
  const skins = record.tables.filter(t => t.template === 'ReskinsRow').map(t => ({ item: clean(t[1]), id: itemIds.get(clean(t[1])) || null, code: clean(t[2]) }));
  const imageName = clean(f.image).replaceAll('_', ' ');
  // Paints and platings use the Wiki screenshot of the ring after use; Red Paint restores the original Red Ring.
  const appearanceName = record.cosmetic ? (record.cosmetic.appearance || '') : '';
  const image = images[imageName] || images[imageName[0]?.toUpperCase() + imageName.slice(1)]
    || images[appearanceName] || (cosmetic?.reverts ? images[clean(recordByTitle.get('Red Ring').fields.image).replaceAll('_', ' ')] : undefined);
  const source = record.source || `https://wiki.pioneer2.net/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
  const acquisition = record.acquisition.map(a => acquisitionLabels[a.toLowerCase()] || a);
  if (commonWeapon) acquisition.push('武器商店（随角色等级刷新）');
  const availability = notes[title]?.availability || cosmeticAvailability(cosmetic) || (status === 'obsolete' ? '已停用的历史道具，现已无法获取或使用。' : status === 'unavailable' ? '当前无法在 Ephinea 获取。' : acquisition.length ? `来源页面列出的获取途径：${[...new Set(acquisition)].join('、')}。` : '具体获取条件请查阅来源页面与掉落表。');
  const summary = notes[title]?.summary || `${subtype}${isEquipment ? '装备' : ''}。${status === 'obsolete' ? '历史活动条目。' : status === 'unavailable' ? '当前无法获取。' : ''}`;
  const drops = record.drops.map(d => ({ kind: d.kind, sectionId: clean(d.id) || '来源未标注', difficulty: { N: 'Normal', H: 'Hard', VH: 'Very Hard', U: 'Ultimate' }[d.diff] || clean(d.diff), location: clean(d.location), area: clean(d.area), rate: clean(d.rate) || '普通掉落' }));
  const feedId = record.tables.find(t => t.template === 'MagFeedTable')?.[1];
  const feedTable = feedId === undefined ? null : sandbox.window.MAG_SIM.feedTables[feedId];
  if (feedId !== undefined && !feedTable) throw new Error(`Unknown feeding table: ${title}: ${feedId}`);
  const feeding = feedTable ? Object.entries(feedTable).map(([item, values]) => ({ item, values })) : [];
  const detail = { id, en, title, type, subtype, category, code, rarity, mask, status, requirement, stats, summary, effects: [...new Set(effects)], boosts, sets, skins, cosmetic, cosmetics: cosmeticsByTarget.get(title) || [], feeding, drops, availability, source, revision: record.revision, checkedAt: record.checkedAt || snapshot.checkedAt, excerpts: record.excerpts, image: image?.path || null, imageSource: image?.source || null, imagePage: image?.page || null, related: record.related.map(t => itemIds.get(t)).filter(x => x && x !== id).slice(0, 6) };
  if (details[id]) throw new Error(`Duplicate item slug: ${id}`);
  detail.hdImage = hdImages.has(id) ? `/assets/img/items/hd/${hdImages.get(id)}` : null;
  details[id] = detail;
  // Compact tuples keep the searchable index small; detailed data is loaded per item.
  index.push([id, en, type, rarity, mask, requirement, stats.slice(0, 2).map(s => [s.label, s.value]), image?.path || null, code, status, title === en ? '' : title, atp?.[1] ?? null, names.get(en)?.ja ? '' : clean(f.jp)]);
}
index.sort((a, b) => (a[8] || 'FFFFFF').localeCompare(b[8] || 'FFFFFF') || a[0].localeCompare(b[0]));
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
fs.writeFileSync('src/app/generated/item-catalog/cosmetics.json', JSON.stringify(cosmeticsOverview));
const detailHash = createHash('sha256');
for (const [id, detail] of Object.entries(details).sort(([a], [b]) => a.localeCompare(b))) {
  const json = JSON.stringify(detail);
  fs.writeFileSync(`assets/data/items/${id}.json`, json);
  detailHash.update(`${id}\n${json}\n`);
}
// The bundled version changes whenever any detail file changes, so browsers never reuse stale detail JSON.
fs.writeFileSync('src/app/generated/item-catalog/version.json', JSON.stringify({ details: detailHash.digest('hex').slice(0, 12) }));
const report = { checkedAt: snapshot.checkedAt, items: index.length, categories: Object.fromEntries(['weapon','armor','shield','unit','mag','tool'].map(c => [c,Object.values(details).filter(d=>d.category===c).length])), withImages: index.filter(x => x[7]).length, unresolvedNames: unresolved, unknownCodes };
fs.writeFileSync('content/item-catalog/coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Generated ${index.length} item pages; ${report.withImages} with images. Index: ${fs.statSync('src/app/generated/item-catalog/index.json').size} bytes.`);
