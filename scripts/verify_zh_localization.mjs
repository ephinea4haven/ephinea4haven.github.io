import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (filename) => readFile(path.join(root, filename), 'utf8');

const [agents, standard, materialPlan, priceGuide, authoredContent] = await Promise.all([
  read('AGENTS.md'),
  read('docs/PSOBB_CHINESE_LOCALIZATION.md'),
  read('tools/materialplan.html'),
  read('src/app/price-guide/price-guide.component.ts'),
  Promise.all([
    'data/itempt.html',
    'data/itempmt.html',
    'data/bb_items.html',
    'data/equipment_technique_boosts.html',
    'data/price_guide.html',
    'guide/acronym.html',
    'guide/anguish.html',
    'guide/banners.html',
    'guide/class-guide.html',
    'guide/ep1ch.html',
    'guide/ep2ch.html',
    'guide/d3d.html',
    'index.html',
    'src/app/price-guide/price-guide.component.html',
    'tools/equipment.html',
    'tools/mechanics.html',
  ].map(read)).then((files) => files.join('\n')),
]);

assert.match(agents, /Treat PSOBB as the mandatory context for every translation/);
assert.match(agents, /\.\.\/droptable\/i18n_names\.json/);
assert.match(standard, /网站物品名称必须与掉落表对齐/);
assert.match(standard, /Photon Drop\s+→ 光子微晶PD/);

for (const expected of [
  '<title>能力药配点 | Ephinea PSOBB</title>',
  '<page-chrome title="能力药配点">',
  '通用（以最少插件达到属性上限）',
  '<th rowspan="2">玛古</th>',
  '<th>攻击力药</th>',
  '<th>运之药</th>',
]) assert.ok(materialPlan.includes(expected), `material plan is missing ${JSON.stringify(expected)}`);

for (const expected of [
  "'Photon Drops': '所需光子微晶（PD）'",
  "Techniques: '魔法光盘'",
  "'Techniques - Technique sets': '魔法光盘 - 职业套装价格'",
  "'Techniques - Individual techniques': '魔法光盘 - 单张价格'",
  "'Technique disks': '魔法光盘'",
  "'Special Rank': '特殊攻击等级'",
  "AB: 'A.Beast（变异兽）'",
  "N: 'Native（原生）'",
]) assert.ok(priceGuide.includes(expected), `price guide is missing ${JSON.stringify(expected)}`);

for (const expected of [
  '<strong>ATA</strong>：武器提供的命中力加成',
  '在使用相同武器时，RAmar 最容易让特殊攻击稳定命中',
]) assert.ok(authoredContent.includes(expected), `authored content is missing ${JSON.stringify(expected)}`);

const forbidden = [
  '材料方案',
  '光子水滴',
  '光子微滴',
  '光子球',
  '法术',
  '法术盘',
  '技能盘',
  '术法',
  '魔法书',
  '特殊等级',
  'Hit 命中阈值',
  '<strong>ATA</strong>：命中率加成',
];
for (const term of forbidden) {
  assert.ok(!authoredContent.includes(term), `legacy PSOBB translation remains: ${term}`);
}

console.log('PSOBB Chinese localization contract verified.');
