import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { loadPageI18n, languagesFor, localizedPath } from './page_i18n.mjs';

const dictionary = { window: {} };
vm.runInNewContext(fs.readFileSync('assets/js/i18n/items_i18n.js', 'utf8'), dictionary);
const items = Object.values(dictionary.window.ITEMS_I18N);
const monsters = JSON.parse(fs.readFileSync('content/monster-catalog/names.json', 'utf8'));
const code = ts.transpileModule(fs.readFileSync('src/app/combo/combo-i18n.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const scope = { exports: {}, require: name => {
  if (name.endsWith('/items')) return { ITEM_TRANSLATIONS: items };
  if (name.endsWith('/names.json')) return monsters;
  throw new Error('Unexpected runtime dependency: ' + name);
} };
vm.runInNewContext(code, scope);
const { COMBO_TEXT, comboItemName, comboMonsterName, comboSpecialName } = scope.exports;

test('all upstream tools have three real URLs and no English-only routing', async () => {
  const i18n = await loadPageI18n(process.cwd());
  assert.equal('unprefixed' in i18n, false);
  assert.ok(Object.values(i18n.coverage).every(page => page.languages[0] === 'zh'));
  for (const name of ['cc', 'ccopm', 'id']) {
    const path = 'tools/' + name + '.html';
    assert.deepEqual(languagesFor(i18n, path), ['zh', 'en', 'ja']);
    for (const language of ['en', 'ja']) {
      assert.ok(i18n.localized[language].includes(path));
      assert.equal(localizedPath('/' + path, language), '/' + language + '/' + path);
      assert.ok(i18n.coverage[path].description[language]);
    }
  }
});

test('Combo item identities resolve exact case first and distinguish equipment variants', () => {
  for (const language of ['zh', 'ja']) {
    const expected = name => items.find(item => item.en === name)?.[language] ?? name;
    assert.equal(comboItemName('Smartlink', language), expected('Smartlink'));
    assert.equal(comboItemName('Hammer', language), expected('Hammer'));
    assert.equal(comboItemName('HAMMER', language), expected('HAMMER'));
    assert.equal(comboItemName('Sweetheart (2)', language), expected('SWEETHEART') + ' (2)');
    assert.equal(comboItemName('Black Ring (3)', language), expected('Black Ring') + ' (3)');
    assert.equal(comboItemName('POSS4', language), expected('PROOF OF SWORD-SAINT') + ' ×4');
    const saber = items.find(item => item.en === 'SABER');
    assert.equal(comboItemName('ES Saber', language), saber?.[language] ?? 'ES Saber');
  }
  assert.equal(comboItemName('ES Partisan', 'zh'), 'ES Partisan');
  assert.equal(comboItemName('ES Saber', 'zh'), 'ES Saber');
  assert.equal(comboItemName('Unarmed', 'ja'), '素手');
  assert.equal(comboSpecialName('Hell*', 'ja'), 'ヘル*');
  assert.equal(comboSpecialName('None', 'zh'), '无');
  assert.equal(comboItemName('Unknown upstream item', 'zh'), 'Unknown upstream item');
});

test('both datasets have complete runtime text and translated monster qualifiers', () => {
  for (const language of ['zh', 'ja']) {
    assert.deepEqual(Object.keys(COMBO_TEXT[language]), Object.keys(COMBO_TEXT.en));
    for (const mode of ['multi', 'opm']) {
      const source = fs.readFileSync('assets/js/combo_calc_' + mode + '_data.js', 'utf8');
      const data = Object.fromEntries([...source.matchAll(/^const (\w+) = (.*);$/gm)].map(([, key, value]) => [key, JSON.parse(value)]));
      for (const name of Object.keys(data.enemies)) {
        const suffix = name.match(/ \((.+)\)$/)?.[1];
        if (suffix) assert.ok(COMBO_TEXT[language][suffix], name);
        assert.ok(!comboMonsterName(name, language).includes('undefined'), name);
      }
      for (const weapon of Object.values(data.weapons)) {
        if (weapon.special) assert.ok(comboSpecialName(weapon.special, language), weapon.name);
      }
    }
    assert.equal(comboMonsterName('Arlan (Ruins)', language), monsters.Arlan[language] + '（' + COMBO_TEXT[language].Ruins + '）');
    assert.equal(comboMonsterName('Darvant', language), 'Darvant');
  }
});
