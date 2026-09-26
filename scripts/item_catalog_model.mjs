import { templates } from './item_catalog_wiki.mjs';
import { parseFragment } from 'parse5';

export const TYPES = {
  Saber: ['weapon', '光剑'], Sword: ['weapon', '大剑'], Dagger: ['weapon', '双匕首'], Partisan: ['weapon', '长刀'],
  Slicer: ['weapon', '投刃'], 'Double Saber': ['weapon', '双头剑'], Claw: ['weapon', '爪'], Katana: ['weapon', '日本刀'],
  'Twin Sword': ['weapon', '双剑'], Fist: ['weapon', '拳套'], Handgun: ['weapon', '光枪'], Rifle: ['weapon', '步枪'],
  Mechgun: ['weapon', '机枪'], Shot: ['weapon', '霰弹枪'], Launcher: ['weapon', '光子炮'], Bazooka: ['weapon', '火箭炮'],
  Cane: ['weapon', '短杖'], Rod: ['weapon', '长杖'], Wand: ['weapon', '魔杖'], Card: ['weapon', '卡片'],
  Frame: ['armor', '铠甲'], Barrier: ['shield', '盾牌'], Unit: ['unit', '插件'], Mag: ['mag', '玛古'],
  Consumable: ['tool', '消耗品'], Grinder: ['tool', '打磨石'], Material: ['tool', '能力药'],
  'Enemy part': ['tool', '敌人部件'], Amplifier: ['tool', '增幅器'], 'Combination Item': ['tool', '合成道具'],
  Tool: ['tool', '其他道具'], 'Music Disk': ['tool', '音乐光盘'], 'Event Item': ['tool', '活动道具'],
  Photon: ['tool', '光子道具'], 'Weapon heart': ['tool', '武器外观'], 'Ring paint': ['tool', '戒指染色'],
  'Ring plating': ['tool', '戒指外观'], 'Mag Cell': ['tool', '玛古进化道具'], Disk: ['tool', '魔法光盘'],
};
const templateWords = {
  TypeA: 'Viridia / Skyly / Purplenum / Redria / Yellowboze',
  TypeB: 'Greenill / Bluefull / Pinkal / Oran / Whitill',
  Type1: 'Viridia / Bluefull / Redria / Whitill', Type2: 'Greenill / Purplenum / Oran', Type3: 'Skyly / Pinkal / Yellowboze',
  f: '女性', F: '女性', m: '男性', M: '男性', Invinc: '无敌', SD: 'Shifta + Deband', RestaMag: 'Resta',
};
export function clean(value = '', notes = false) {
  let text = String(value).replace(/<!--[\s\S]*?-->/g, '');
  const calls = templates(text);
  for (let i = calls.length - 1; i >= 0; i--) {
    const t = calls[i];
    // Process top-level calls recursively, preserving Note conditions when displaying facts.
    if (calls.some(other => other.start < t.start && other.end > t.end)) continue;
    const f = t.fields;
    let replacement;
    if (t.name.toLowerCase() === 'note') replacement = clean(f[2] || '', notes) + (notes && f[1] && !/with Max Grind/i.test(f[1]) ? ` (${clean(f[1])})` : '');
    else if (['Sword', 'Gun', 'Cane', 'Frame', 'Shield', 'Unit', 'Mag', 'Tool'].includes(t.name)) replacement = clean(f[3] || f[2] || f[1] || '', notes);
    else replacement = templateWords[t.name] || clean(f[1] || t.name, notes);
    text = text.slice(0, t.start) + replacement + text.slice(t.end);
  }
  text = text.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target)
    .replace(/<br\s*\/?\s*>/gi, ' / ').replace(/'{2,}/g, '');
  const fragment = parseFragment(text);
  const content = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(content).join('');
  return content(fragment).replace(/\s+/g, ' ').trim();
}
export function range(value) {
  const match = /^(-?\d+(?:\.\d+)?)(?:\s*[-–]\s*(-?\d+(?:\.\d+)?))?$/.exec(clean(value));
  return match ? [+match[1], +(match[2] ?? match[1])] : null;
}
export function slug(title) {
  return title.toLowerCase().replaceAll('*', '-variant').replaceAll('+', '-plus').replaceAll("'", '').replaceAll('&', 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function typeOf(value) {
  const text = clean(value).split(';')[0];
  const type = Object.keys(TYPES).find(k => k.toLowerCase() === text.toLowerCase());
  if (!type) throw new Error(`Unknown item type: ${value}`);
  return type;
}
export function isCommonWeapon(code) {
  if (!/^00[0-9a-f]{4}$/i.test(code || '')) return false;
  const family = parseInt(code.slice(2, 4), 16);
  const tier = parseInt(code.slice(4), 16);
  return family >= 1 && family <= 12 && tier < (family <= 9 ? 5 : 4);
}
export function magTrigger(trigger, base) {
  if (!trigger || trigger === '-') return '无';
  const name = { invinc: '无敌', resta: 'Resta', sd: 'Shifta + Deband', reverser: 'Reverser（PSOBB 不启用死亡触发）' }[trigger.replace(/[+-]$/, '')];
  if (!name) throw new Error(`Unknown Mag trigger: ${trigger}`);
  if (trigger === 'reverser') return name;
  const rate = trigger.endsWith('+') ? `${base}–${Number(base) + 35}%` : trigger.endsWith('-') ? '0–35%' : `${base}%`;
  return `${name} · ${rate}${/[+-]$/.test(trigger) ? '（随同步率变化）' : ''}`;
}
