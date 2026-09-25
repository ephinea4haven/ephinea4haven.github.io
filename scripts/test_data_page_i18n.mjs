import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'parse5';
import { loadPageI18n, localizeBody } from './page_i18n.mjs';

const root = path.resolve(import.meta.dirname, '..');
const pages = ['item-names', 'gallons_roulette', 'weapon_special_reduction', 'price_guide', '200',
  'enemy_weapon_hit', 'equipment_technique_boosts', 'quest', 'itemrt', 'itempt', 'itempmt', 'monsters', 'bb_items'];
const components = new Set(['item-names', 'price_guide']);
const i18n = await loadPageI18n(root);
function nodes(tree, predicate) {
  return [ ...(predicate(tree) ? [tree] : []), ...(tree.childNodes ?? []).flatMap(child => nodes(child, predicate)) ];
}
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');

test('legacy ES labels never bind to ordinary weapon identities', async () => {
  for (const prefix of ['', 'content/i18n/pages/en/', 'content/i18n/pages/ja/']) {
    const tree = parse(await readFile(path.join(root, `${prefix}data/bb_items.html`), 'utf8'));
    const esCells = nodes(tree, n => n.tagName === 'td' && /S Rank Weapon|S武器/.test(text(n)));
    assert.equal(esCells.length, 30);
    for (const cell of esCells) assert.equal(nodes(cell, n => attr(n, 'data-item-en') !== undefined).length, 0);
  }
});

for (const page of pages) {
  test(`${page}: three published editions with metadata`, () => {
    const metadata = i18n.coverage[`data/${page}.html`];
    assert.deepEqual(metadata.languages, ['zh', 'en', 'ja']);
    for (const language of ['en', 'ja']) {
      assert.ok(metadata.title[language]);
      assert.ok(metadata.description[language]);
    }
  });
  if (components.has(page)) continue;
  const source = await readFile(path.join(root, `data/${page}.html`), 'utf8');
  for (const language of ['en', 'ja']) {
    test(`${page}/${language}: preserves anchors, table rows and numeric cells`, () => {
      const original = parse(source);
      const localized = parse(source);
      const body = nodes(localized, n => n.tagName === 'body')[0];
      localizeBody(i18n, body, language, `data/${page}.html`, { itemName: name => name });
      const ids = tree => nodes(tree, n => attr(n, 'id') !== undefined).map(n => attr(n, 'id')).sort();
      assert.deepEqual(ids(localized), ids(original));
      const tables = tree => nodes(tree, n => n.tagName === 'table').map(table => ({
        rows: nodes(table, n => n.tagName === 'tr').length,
        numbers: nodes(table, n => n.tagName === 'td').map(text).map(t => t.trim())
          .filter(t => /^[\dA-Fx+%.,/()\s–−-]+$/.test(t)),
      }));
      assert.deepEqual(tables(localized), tables(original));
      const translatedText = nodes(body, n => n.nodeName === '#text').map(text).join(' ');
      const sourceProse = nodes(nodes(original, n => n.tagName === 'body')[0], n => n.nodeName === '#text')
        .map(text).map(t => t.trim()).filter(t => /[这该为与从个]/u.test(t) && t.length > 15);
      for (const sentence of sourceProse) assert.ok(!translatedText.includes(sentence), `Untranslated: ${sentence}`);
    });
  }
}
