import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { PriceLocalizer } from '../src/app/price-guide/price-guide.messages.ts';

// CI runs business tests before Angular generation; use the committed authority
// snapshot, which is also the generator's input.
const dictionary = { window: {} };
vm.runInNewContext(readFileSync(new URL('../assets/js/i18n/items_i18n.js', import.meta.url), 'utf8'), dictionary);
const ITEM_TRANSLATIONS = Object.values(dictionary.window.ITEMS_I18N);

const localizer = new PriceLocalizer(ITEM_TRANSLATIONS);
const sandbox = {};
vm.runInNewContext(readFileSync(new URL('../assets/js/price_guide_data.js', import.meta.url), 'utf8'), sandbox);
const sections = JSON.parse(JSON.stringify(sandbox.PRICE_DATA));
const items = new Map(ITEM_TRANSLATIONS.map(item => [item.en.toLowerCase(), item]));
const referenceValues = [...new Set(sections.flatMap(s => s.data.flatMap(r => Object.values(r))).filter(v => v?.startsWith('See ')))];

test('reference identities remain whole, including case variants and unknown identities', () => {
  const cases = [
    ['See Sabers (Excalibur)', '参见：光剑（王者之剑）', '参照：セイバー（Excalibur）'],
    ['See Rare frames (Love Heart) & Combination items (Magic Rock "Heart Key")', '参见：稀有铠甲（爱心铠）及合成素材（魔石「心钥」）', '参照：レア鎧（ラブハート）・合成素材（Magic Rock "Heart Key"）'],
    ['See Stink Shield (below) & Combination items (De Rol Le Shell)', '参见：腥臭盾（见下方）及合成素材（迪·洛尔·雷之壳）', '参照：匂う盾（下記）・合成素材（デ・ロル・レの殻）'],
    ['See Magically Unknown Heart', '参见：Magically Unknown Heart', '参照：Magically Unknown Heart'],
  ];
  for (const [source, zh, ja] of cases) {
    assert.equal(localizer.text(source, 'zh'), zh);
    assert.equal(localizer.text(source, 'ja'), ja);
    assert.equal(localizer.text(source, 'en'), source);
  }
  assert.equal(referenceValues.length, 21);
  for (const source of referenceValues) for (const language of ['zh', 'ja']) {
    const output = localizer.text(source, language);
    assert.notEqual(output, source);
    // Independently check every referenced item against the generated authority.
    for (const [name, item] of items) {
      if (name === 'swords') continue; // A category here, not the ES item identity.
      if (!source.toLowerCase().includes(`(${name})`)) continue;
      const spelling = source.match(/\([^)]*\)/g).map(s => s.slice(1, -1)).find(s => s.toLowerCase() === name);
      assert.ok(output.includes(item[language] || spelling), `${language}: ${source} lost ${name}: ${output}`);
    }
    assert.doesNotMatch(output, /マグic|Love ハート|\bSee\b|\bbelow\b/);
  }
});

test('categories cannot bind to item identities and case collisions are not guessed', () => {
  assert.equal(localizer.cell('Swords', 'zh'), '大剑');
  assert.equal(localizer.secondaryName('Swords', 'zh'), '');
  assert.equal(localizer.cell('Swords', 'ja'), 'ソード');
  const collision = new PriceLocalizer([{ en: 'Hammer', zh: '普通锤' }, { en: 'HAMMER', zh: 'ES 锤' }]);
  assert.equal(collision.text('Hammer', 'zh'), '普通锤');
  assert.equal(collision.text('HAMMER', 'zh'), 'ES 锤');
  assert.equal(collision.text('hammer', 'zh'), 'hammer');
});

test('ordinary and compound cells use the same translations in both languages', () => {
  const cases = [
    ['Level 15', '等级 15', 'レベル15'],
    ['Basic', '常规配点', '標準'],
    ['Min/Max', '200 级满属性配点', 'レベル200の最大ステータス用'],
    ['Varies', '视具体要求而定', '条件による'],
    ['1 per 1000', '每 1000 次击杀 1 PD', '1000体につき1 PD'],
    ['Foie, Barta, Zonde', '火球术、冻气术、闪电术', 'フォイエ、バータ、ゾンデ'],
    ['Jellen (Lv. 21), Zalure (Lv. 21)', '降攻术（Lv. 21）、降防术（Lv. 21）', 'ジェルン（Lv21）、ザルア（Lv21）'],
  ];
  for (const [source, zh, ja] of cases) {
    assert.equal(localizer.text(source, 'zh'), zh);
    assert.equal(localizer.text(source, 'ja'), ja);
  }
  for (const section of sections) for (const row of section.data) for (const value of Object.values(row)) {
    if (!/^(?:\w+ Paint)(?: \w+ Paint)+$/.test(value)) continue;
    for (const lang of ['zh', 'ja']) assert.equal(localizer.text(value, lang), value.match(/\w+ Paint/g).map(name => items.get(name.toLowerCase())?.[lang] || name).join(' / '));
  }
});

test('snapshot columns preserve all data and independent price values', () => {
  for (const section of sections) {
    assert.equal(new Set(section.headers).size, section.headers.length);
    assert.ok(!section.headers.includes('Guides'));
    for (const row of section.data) for (const key of Object.keys(row)) {
      assert.ok(key === '_note' || section.headers.includes(key), `Hidden ${section.section}: ${key}`);
    }
  }
  const frames = sections.find(s => s.section === 'Frames');
  assert.equal(frames.headers[0], 'Item Name');
  assert.deepEqual(frames.data.map(r => r['Item Name']), ['Common frames', 'Common armors']);
  const es = sections.find(s => s.headers.includes('Episode 1 Weapons')).data[0];
  assert.equal(es.Price, '35');
  assert.equal(es['Price [2]'], '25');
  const paints = sections.find(s => s.headers.includes('Old Paints')).data[0];
  assert.equal(paints.Price, '2-3');
  assert.equal(paints['Price [2]'], '5');
});

test('every snapshot label and cell has a translation or an explicit identity/notation', () => {
  // These are verified English identities without a Chinese authority entry.
  const englishIdentities = new Set(["Nei's Claw (Replica)", 'Rabarta', 'Reverser', 'Ryuker']);
  const values = new Set(sections.flatMap(s => [s.section, ...s.headers.map(h => h.replace(/ \[\d+\]$/, '')), ...s.data.flatMap(r => Object.values(r))]));
  for (const value of values) {
    if (!value || !/[a-z]/i.test(value)) continue;
    for (const lang of ['zh', 'ja']) {
      const output = localizer.text(value, lang);
      if (output !== value) continue;
      if (/^(?:N\/A|[NMD]|AB|RL|HUmar, RAmar|HUnewearl, RAmarl|\d+:\d+pd)$/.test(value)) continue;
      if (englishIdentities.has(value) || value.startsWith('ES ')) continue;
      const item = items.get(value.toLowerCase());
      assert.ok(item && (!item[lang] || item[lang] === value), `${lang}: untranslated ${value}`);
    }
  }
});
