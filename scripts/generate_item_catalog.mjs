import fs from 'node:fs';
import vm from 'node:vm';
import { clean, range, slug, typeOf, TYPES, magTrigger } from './item_catalog_model.mjs';
import { collectMagTriggers, magCellRules } from './item_catalog_mag.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const snapshot = read('content/item-catalog/wiki.json');
const images = read('content/item-catalog/images.json');
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
    if ((m = /^Gives certain weapons the appearance of (.+)$/.exec(value))) return [`为指定武器应用 ${display(m[1])} 的外观；适用型号见来源说明。`];
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
  if (record.regeneration) stats.unshift({label: `${record.regeneration.stat} 回复`, value: `${record.regeneration.amount} / ${record.regeneration.seconds} 秒`});
  if (record.techniqueLevels) stats.unshift({label: '魔法等级', value: `+${record.techniqueLevels}`});
  const effects = [...(notes[title]?.effects || []), ...toolUses(title), ...magCellRules(magCells[title], display, magData.meta.idGroups)];
  const addStat = (label, value) => { if (value !== undefined && value !== '') stats.push({ label, value: String(value) }); };
  const atp = range(f.ATP);
  const grind = /^\d+$/.test(f.grind || '') ? +f.grind : null;
  if (category === 'weapon') {
    addStat('最大磨数', grind === null ? '来源未标注' : `+${grind}`);
    if (atp && grind !== null) addStat('最大磨数下 ATP', [...new Set(atp.map(n => n + grind * 2))].join('–'));
    addStat('特殊攻击', /^See page$/i.test(f.special || '') ? '独有特殊攻击 · 见使用说明' : clean(f.special, true).replace(/^None$/, '无').replace(/^Varies$/, '可变'));
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
  if (record.regeneration) effects.push(`每 ${record.regeneration.seconds} 秒恢复 ${record.regeneration.amount} ${record.regeneration.stat}。`);
  if (record.attackSpeed) effects.push(`攻击速度提高 ${record.attackSpeed}%。攻击速度加成不叠加，仅生效最高值。`);
  if (record.techniqueLevels) effects.push(`已学魔法等级提高 ${record.techniqueLevels} 级，不超过职业的魔法等级上限。`);
  if (title.startsWith('Cure/')) effects.push(`装备时免疫${{Confuse:'混乱', Freeze:'冰冻', Paralysis:'麻痹', Poison:'中毒', Shock:'感电', Slow:'缓慢'}[title.split('/')[1]]}。`);
  if (type === 'Grinder') effects.push('提升当前装备武器的磨数，每 1 磨数增加 2 ATP，不能超过武器磨数上限。');
  if (type === 'Material') effects.push('用于提升角色能力。使用次数受职业与能力药种类的上限约束。');
  if (type === 'Music Disk') effects.push('使用后更换当前区域的背景音乐，同区域玩家也会听到。属于一次性道具，使用者离开区域后恢复原有背景音乐。');
  if (type === 'Disk') effects.push('魔法光盘按魔法种类和等级区分，学习时检查基础 MST 与职业限制。大多数魔法最高等级为 30；Anti 最高为 7，Ryuker 与 Reverser 无等级变化。机器人不能学习魔法。');
  const boosts = record.tables.filter(t => t.template === 'TechBoostRow').map(t => ({ label: display(t[1]), value: clean(t[2], true).replace(/Damage/gi, '伤害').replace(/Range/gi, '范围') }));
  const sets = record.tables.filter(t => t.template === 'SetEffectRow').map(t => ({ item: clean(t[2]), id: itemIds.get(clean(t[2])) || null, effect: clean(t.effect || '', true) }));
  const skins = record.tables.filter(t => t.template === 'ReskinsRow').map(t => ({ item: clean(t[1]), id: itemIds.get(clean(t[1])) || null, code: clean(t[2]) }));
  const imageName = clean(f.image).replaceAll('_', ' ');
  const image = images[imageName] || images[imageName[0]?.toUpperCase() + imageName.slice(1)];
  const source = record.source || `https://wiki.pioneer2.net/w/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
  const acquisition = record.acquisition.map(a => acquisitionLabels[a.toLowerCase()] || a);
  const availability = notes[title]?.availability || (status === 'obsolete' ? '已停用的历史道具，现已无法获取或使用。' : status === 'unavailable' ? '当前无法在 Ephinea 获取。' : acquisition.length ? `来源页面列出的获取途径：${[...new Set(acquisition)].join('、')}。` : '具体获取条件请查阅来源页面与掉落表。');
  const summary = notes[title]?.summary || `${subtype}${isEquipment ? '装备' : ''}。${status === 'obsolete' ? '历史活动条目。' : status === 'unavailable' ? '当前无法获取。' : ''}`;
  const drops = record.drops.map(d => ({ kind: d.kind, sectionId: clean(d.id) || '来源未标注', difficulty: { N: 'Normal', H: 'Hard', VH: 'Very Hard', U: 'Ultimate' }[d.diff] || clean(d.diff), location: clean(d.location), area: clean(d.area), rate: clean(d.rate) || '普通掉落' }));
  const detail = { id, en, title, type, subtype, category, code, rarity, mask, status, requirement, stats, summary, effects: [...new Set(effects)], boosts, sets, skins, drops, availability, source, revision: record.revision, checkedAt: snapshot.checkedAt, excerpts: record.excerpts, image: image?.path || null, imageSource: image?.source || null, imagePage: image?.page || null, related: record.related.map(t => itemIds.get(t)).filter(x => x && x !== id).slice(0, 6) };
  if (details[id]) throw new Error(`Duplicate item slug: ${id}`);
  details[id] = detail;
  // Compact tuples keep the searchable index small; detailed data is loaded per item.
  index.push([id, en, type, rarity, mask, requirement, stats.slice(0, 2).map(s => [s.label, s.value]), image?.path || null, code, status, title === en ? '' : title, atp?.[1] ?? null]);
}
index.sort((a, b) => (a[8] || 'FFFFFF').localeCompare(b[8] || 'FFFFFF') || a[0].localeCompare(b[0]));
fs.mkdirSync('src/app/generated/item-catalog', { recursive: true });
fs.rmSync('assets/data/items', { recursive: true, force: true });
fs.mkdirSync('assets/data/items', { recursive: true });
fs.writeFileSync('src/app/generated/item-catalog/index.json', JSON.stringify(index));
fs.writeFileSync('src/app/generated/item-catalog/details.server.json', JSON.stringify(details));
fs.writeFileSync('src/app/generated/item-catalog/types.json', JSON.stringify(TYPES));
for (const [id, detail] of Object.entries(details)) fs.writeFileSync(`assets/data/items/${id}.json`, JSON.stringify(detail));
const report = { checkedAt: snapshot.checkedAt, items: index.length, categories: Object.fromEntries(['weapon','armor','shield','unit','mag','tool'].map(c => [c,Object.values(details).filter(d=>d.category===c).length])), withImages: index.filter(x => x[7]).length, unresolvedNames: unresolved, unknownCodes };
fs.writeFileSync('content/item-catalog/coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Generated ${index.length} item pages; ${report.withImages} with images. Index: ${fs.statSync('src/app/generated/item-catalog/index.json').size} bytes.`);
