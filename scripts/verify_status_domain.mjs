import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ItemData } from '../src/app/status/item-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const domainSource = await readFile(path.join(root, 'src/app/status/status-domain.ts'), 'utf8');
const domainJavaScript = ts.transpileModule(domainSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual(domainJavaScript.diagnostics, [], 'status domain must transpile without diagnostics');
const domainUrl = `data:text/javascript;base64,${Buffer.from(domainJavaScript.outputText).toString('base64')}`;
const { CHARACTER_CLASSES, StatusCalculator } = await import(domainUrl);
const characterData = JSON.parse(await readFile(path.join(root, 'assets/js/chardata.json'), 'utf8'));
const items = new ItemData();
const calculator = new StatusCalculator(items, characterData);

const BASE_INPUT = Object.freeze({
  level: 123,
  mag: Object.freeze({ def: 7, pow: 63, dex: 52, mind: 31 }),
  materials: Object.freeze({ hp: 17, tp: 13, pow: 47, def: 23, mind: 41, evade: 19, luck: 11 }),
  armor: '-',
  shield: '-',
  units: Object.freeze(['-', '-', '-', '-']),
});

function calculate(characterClass, overrides = {}) {
  return calculator.calculate({
    ...BASE_INPUT,
    ...overrides,
    characterClass,
    mag: { ...BASE_INPUT.mag, ...overrides.mag },
    materials: { ...BASE_INPUT.materials, ...overrides.materials },
    units: overrides.units ?? [...BASE_INPUT.units],
  });
}

function statVector(result) {
  return ['hp', 'tp', 'atp', 'dfp', 'mst', 'ata', 'evp', 'lck']
    .map((stat) => result.stats[stat].current);
}

// Approved fixtures captured from the pre-retirement calculator and independently
// checked across every catalog entry before the old runtime was removed.
const CLASS_STAT_FIXTURES = {
  humar: [1024, 798, 919, 332, 650, 1727, 560, 82],
  hunewearl: [934, 924, 854, 346, 776, 1561, 533, 82],
  hucast: [1148, 0, 1011, 337, 194, 1646, 499, 82],
  hucaseal: [950, 0, 894, 284, 194, 1865, 579, 82],
  ramar: [957, 762, 770, 270, 614, 2115, 491, 82],
  ramarl: [903, 861, 726, 303, 713, 2000, 600, 82],
  racast: [1071, 0, 801, 335, 194, 1870, 467, 82],
  racaseal: [1025, 0, 747, 375, 194, 1901, 515, 82],
  fomar: [806, 1415, 721, 250, 804, 1465, 503, 82],
  fomarl: [903, 1446, 674, 280, 825, 1550, 473, 82],
  fonewm: [876, 1577, 632, 290, 912, 1367, 513, 82],
  fonewearl: [853, 1674, 630, 263, 977, 1378, 572, 82],
};
const fixtureEquipment = { armor: '45', shield: '27', units: ['5b', '5d', '4c', '51'] };
for (const characterClass of CHARACTER_CLASSES) {
  assert.deepEqual(
    statVector(calculate(characterClass, fixtureEquipment)),
    CLASS_STAT_FIXTURES[characterClass],
    `${characterClass} fixed calculation fixture`,
  );
}

const CLASS_MASK_INDEXES = {
  humar: [0, 3, 6], hunewearl: [0, 5, 7], hucast: [0, 4, 6], hucaseal: [0, 4, 7],
  ramar: [1, 3, 6], ramarl: [1, 3, 7], racast: [1, 4, 6], racaseal: [1, 4, 7],
  fomar: [2, 3, 6], fomarl: [2, 3, 7], fonewm: [2, 5, 6], fonewearl: [2, 5, 7],
};
const RESIST_KEYS = ['fire', 'ice', 'thunder', 'dark', 'light'];

function validateCatalog(name, catalog, expectedLength, maskIndex) {
  for (const [code, item] of Object.entries(catalog)) {
    assert.equal(item.length, expectedLength, `${name} ${code} tuple length`);
    assert.equal(typeof item[0], 'string', `${name} ${code} name`);
    assert.equal(item[maskIndex].length, 8, `${name} ${code} equip mask length`);
    for (const value of item.slice(1, maskIndex)) {
      assert.equal(typeof value, 'number', `${name} ${code} numeric field`);
      assert.ok(Number.isFinite(value), `${name} ${code} finite numeric field`);
    }
    for (const value of item[maskIndex]) assert.ok(value === 0 || value === 1, `${name} ${code} binary equip mask`);
  }
}

validateCatalog('armor', items.armors, 8, 7);
validateCatalog('shield', items.shields, 8, 7);
validateCatalog('unit', items.units, 16, 15);
assert.equal(Object.keys(items.armors).length, 86, 'armor catalog completeness');
assert.equal(Object.keys(items.shields).length, 105, 'shield catalog completeness');
assert.equal(Object.keys(items.units).length, 160, 'unit catalog completeness');

let catalogCases = 0;
for (const characterClass of CHARACTER_CLASSES) {
  const indexes = CLASS_MASK_INDEXES[characterClass];
  for (const [kind, catalog] of [['armor', items.armors], ['shield', items.shields]]) {
    for (const [code, item] of Object.entries(catalog)) {
      const result = calculate(characterClass, { [kind]: code });
      const equipment = result.equipment[kind];
      const expectedEquipable = indexes.every((index) => item[7][index] > 0);
      assert.equal(equipment.equipable, expectedEquipable, `${characterClass} ${kind} ${code} equipability`);
      assert.equal(equipment.stars, item[6], `${kind} ${code} stars`);
      for (let index = 0; index < RESIST_KEYS.length; index++) {
        assert.equal(
          result.resists[RESIST_KEYS[index]],
          expectedEquipable ? Math.max(0, item[index + 1]) : 0,
          `${characterClass} ${kind} ${code} ${RESIST_KEYS[index]}`,
        );
      }
      catalogCases++;
    }
  }
  for (const [code, item] of Object.entries(items.units)) {
    const result = calculate(characterClass, { units: [code, '-', '-', '-'] });
    const equipment = result.equipment.units[0];
    const expectedEquipable = indexes.every((index) => item[15][index] > 0);
    assert.equal(equipment.equipable, expectedEquipable, `${characterClass} unit ${code} equipability`);
    assert.equal(equipment.stars, item[14], `unit ${code} stars`);
    if (expectedEquipable) {
      const expectedStats = [item[1], item[2], item[3], item[4], item[5], item[6], item[7]];
      const statNames = ['hp', 'tp', 'atp', 'dfp', 'mst', 'ata', 'evp'];
      for (let index = 0; index < statNames.length; index++) {
        const expected = ['hucast', 'hucaseal', 'racast', 'racaseal'].includes(characterClass) && statNames[index] === 'tp'
          ? 0 : expectedStats[index];
        assert.equal(result.stats[statNames[index]].unit, expected, `${characterClass} unit ${code} ${statNames[index]}`);
      }
      if (code !== '52') assert.equal(result.stats.lck.unit, item[8], `${characterClass} unit ${code} lck`);
      for (let index = 0; index < RESIST_KEYS.length; index++) {
        assert.equal(result.resists[RESIST_KEYS[index]], Math.max(0, item[index + 9]), `${characterClass} unit ${code} ${RESIST_KEYS[index]}`);
      }
    }
    catalogCases++;
  }
}
const expectedCatalogCases = CHARACTER_CLASSES.length
  * (Object.keys(items.armors).length + Object.keys(items.shields).length + Object.keys(items.units).length);
assert.equal(catalogCases, expectedCatalogCases, 'complete character/equipment matrix');

function compatibleResult(kind, code) {
  for (const characterClass of CHARACTER_CLASSES) {
    const overrides = kind === 'unit' ? { units: [code, '-', '-', '-'] } : { [kind]: code };
    const result = calculate(characterClass, overrides);
    const equipment = kind === 'unit' ? result.equipment.units[0] : result.equipment[kind];
    if (equipment.equipable) return { characterClass, result };
  }
  assert.fail(`${kind} ${code} is not equipable by any class`);
}

const effectCases = [
  ['armor', '1e', 'nonBattleAtp', 35], ['armor', '1f', 'nonBattleAtp', 10],
  ['armor', '23', 'trapVision', true], ['armor', '54', 'trapVision', true],
  ['armor', '24', 'nonBattleAta', -10], ['armor', '33', 'cureParalysis', true],
  ['armor', '38', 'attackSpeed', 10], ['armor', '39', 'attackSpeed', 20],
  ['armor', '56', 'attackSpeed', 20], ['armor', '3a', 'attackSpeed', 30], ['armor', '3b', 'attackSpeed', 40],
  ['shield', '16', 'curePoison', true], ['shield', '18', 'nonBattleAta', 15],
  ['shield', '1c', 'nonBattleAta', 20], ['shield', '1d', 'nonBattleAtp', 15],
  ['shield', '20', 'nonBattleAtp', 35], ['shield', '2b', 'nonBattleAtp', 35],
  ['shield', '8a', 'nonBattleAtp', 35], ['shield', '31', 'trapVision', true],
  ['unit', '3c', 'techniqueLevel', 1], ['unit', '3d', 'techniqueLevel', 2], ['unit', '3e', 'techniqueLevel', 3],
  ['unit', '3f', 'attackSpeed', 5], ['unit', '40', 'attackSpeed', 10], ['unit', '41', 'attackSpeed', 20],
  ['unit', '42', 'curePoison', true], ['unit', '43', 'cureParalysis', true], ['unit', '44', 'cureSlow', true],
  ['unit', '45', 'cureConfuse', true], ['unit', '46', 'cureFreeze', true], ['unit', '47', 'cureShock', true],
  ['unit', '49', 'attackSpeed', 40], ['unit', '53', 'attackSpeed', 40],
  ['unit', '4a', 'v50x', 1], ['unit', '4b', 'v50x', 2], ['unit', '4c', 'techniqueSpeed', true],
  ['unit', '51', 'smartlink', true], ['unit', '60', 'techniqueLevel', 4],
];
for (const [kind, code, effect, expected] of effectCases) {
  assert.equal(compatibleResult(kind, code).result.effects[effect], expected, `${kind} ${code} ${effect}`);
}

const shieldMst = compatibleResult('shield', '1b').result;
assert.equal(shieldMst.stats.mst.equipment, 20, 'FORCE WALL MST effect');
const redRing = compatibleResult('shield', '27').result;
assert.equal(redRing.stats.mst.equipment, 20, 'RED RING MST effect');
assert.equal(redRing.stats.lck.equipment, 20, 'RED RING LCK effect');
assert.equal(redRing.effects.nonBattleAtp, 20, 'RED RING non-battle ATP effect');
assert.equal(redRing.effects.nonBattleAta, 20, 'RED RING non-battle ATA effect');

const divineProtection = compatibleResult('unit', '52').result;
assert.equal(
  divineProtection.stats.lck.unit,
  divineProtection.stats.lck.base + divineProtection.stats.lck.material,
  'DIVINE PROTECTION doubles base plus material LCK',
);
const v50xClass = compatibleResult('unit', '4a').characterClass;
assert.equal(calculate(v50xClass, { units: ['4a', '4b', '-', '-'] }).effects.v50x, 2, 'V502 wins after V501');
assert.equal(calculate(v50xClass, { units: ['4b', '4a', '-', '-'] }).effects.v50x, 2, 'V502 wins before V501');
const battleClass = compatibleResult('unit', '49').characterClass;
assert.equal(calculate(battleClass, { units: ['3f', '49', '-', '-'] }).effects.attackSpeed, 40, 'attack speed uses the strongest unit');
const techniqueClass = compatibleResult('unit', '3e').characterClass;
assert.equal(calculate(techniqueClass, { units: ['3c', '3e', '-', '-'] }).effects.techniqueLevel, 4, 'technique level bonuses stack');

function expectedCombinedResists(armorCode, shieldCode, bonus) {
  const armor = items.armors[armorCode];
  const shield = items.shields[shieldCode];
  return RESIST_KEYS.map((_, index) => armor[index + 1] + shield[index + 1] + bonus[index]);
}
for (const [armor, shield, bonus] of [
  ['56', '9b', [20, 20, 20, 20, 20]],
  ['45', '2a', [2, 2, 2, 5, 5]],
]) {
  const match = CHARACTER_CLASSES
    .map((characterClass) => calculate(characterClass, { armor, shield }))
    .find((result) => result.equipment.armor.equipable && result.equipment.shield.equipable);
  assert.ok(match, `${armor}/${shield} has a compatible class`);
  assert.deepEqual(Object.values(match.resists), expectedCombinedResists(armor, shield, bonus), `${armor}/${shield} resistance combo`);
}

const limits = calculate('humar', {
  mag: { def: 5, pow: 147, dex: 48, mind: 0 },
  materials: { hp: 125, tp: 125, pow: 222, def: 0, mind: 0, evade: 0, luck: 28 },
});
assert.equal(limits.mag.level, 200, 'Mag level total');
assert.equal(limits.materials.used, 250, 'HP and TP materials are excluded from the shared material cap');
assert.equal(limits.materials.maximum, 250, 'HUmar shared material cap');
assert.equal(limits.materials.hpMaximum, 125, 'HUmar HP material cap');
assert.equal(limits.materials.tpMaximum, 125, 'HUmar TP material cap');
assert.throws(() => calculate('humar', { level: 0 }), /Unsupported level/, 'invalid level is rejected');

const materialPlan = parse(await readFile(path.join(root, 'tools/materialplan.html'), 'utf8'));
const presetUrls = [];
function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}
visit(materialPlan, (node) => {
  if (node.tagName !== 'a') return;
  const href = node.attrs?.find((attribute) => attribute.name === 'href')?.value;
  if (href?.startsWith('/tools/status.html?')) presetUrls.push(new URL(href, 'https://psohaven.invalid'));
});
assert.equal(presetUrls.length, 47, 'material plan preset completeness');

const numericPresetFields = ['lv', 'mdef', 'mpow', 'mdex', 'mmind', 'hp', 'tp', 'pow', 'def', 'mind', 'eva', 'lck'];
const presetFields = new Set([
  'c', ...numericPresetFields, 'armor', 'shield', 'unit1', 'unit2', 'unit3', 'unit4',
]);
for (const url of presetUrls) {
  const params = url.searchParams;
  const characterClass = params.get('c');
  assert.ok(CHARACTER_CLASSES.includes(characterClass), `material preset has known class: ${url.pathname}${url.search}`);
  for (const key of params.keys()) assert.ok(presetFields.has(key), `${characterClass} material preset field ${key}`);
  for (const key of numericPresetFields) {
    const value = params.get(key);
    if (value !== null) assert.match(value, /^\d+$/, `${characterClass} material preset ${key}`);
  }
  const number = (key) => Number(params.get(key) ?? 0);
  const units = [1, 2, 3, 4].map((index) => params.get(`unit${index}`) ?? '-');
  const result = calculator.calculate({
    characterClass,
    level: number('lv'),
    mag: { def: number('mdef'), pow: number('mpow'), dex: number('mdex'), mind: number('mmind') },
    materials: {
      hp: number('hp'), tp: number('tp'), pow: number('pow'), def: number('def'),
      mind: number('mind'), evade: number('eva'), luck: number('lck'),
    },
    armor: params.get('armor') ?? '-',
    shield: params.get('shield') ?? '-',
    units,
  });
  assert.ok(result.mag.level <= 200, `${characterClass} material preset Mag level`);
  assert.ok(result.materials.used <= result.materials.maximum, `${characterClass} shared material limit`);
  assert.ok(result.materials.hpUsed <= result.materials.hpMaximum, `${characterClass} HP material limit`);
  assert.ok(result.materials.tpUsed <= result.materials.tpMaximum, `${characterClass} TP material limit`);
  assert.ok(result.equipment.armor.equipable, `${characterClass} material preset armor`);
  assert.ok(result.equipment.shield.equipable, `${characterClass} material preset shield`);
  assert.ok(result.equipment.units.every((unit) => unit.equipable), `${characterClass} material preset units`);
}

console.log(`Status domain verified: 12 class fixtures, ${catalogCases} catalog cases, ${effectCases.length} special effects, 2 equipment combos, ${presetUrls.length} material presets.`);
