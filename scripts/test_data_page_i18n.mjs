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

test('ordinary weapon specials show the same three-language names as S-Ranks', async () => {
  for (const prefix of ['', 'content/i18n/pages/en/', 'content/i18n/pages/ja/']) {
    const tree = parse(await readFile(path.join(root, prefix, 'data/bb_items.html'), 'utf8'));
    const tables = nodes(tree, n => n.tagName === 'table');
    const ordinary = tables.find(n => text(n).includes('Draw'));
    // The search result renderer reads one code/name pair per source row.
    for (const row of nodes(ordinary, n => n.tagName === 'tr').slice(1)) {
      assert.equal(nodes(row, n => n.tagName === 'td').length, 3);
    }
    const cells = nodes(ordinary, n => n.tagName === 'td').map(text);
    const byCode = new Map();
    const descriptions = new Map();
    for (let i = 0; i < cells.length; i += 3) {
      byCode.set(cells[i], cells[i + 1]);
      descriptions.set(cells[i], cells[i + 2]);
      assert.ok(cells[i + 2].trim());
    }
    assert.match(descriptions.get('0C'), /200.*3\.33/);
    assert.match(descriptions.get('0D'), /20%.*3\.33/);
    assert.match(descriptions.get('0E'), /25%.*3\.33/);
    assert.match(descriptions.get('27'), /50%.*20%/);
    assert.match(descriptions.get('28'), /75%.*45%/);
    assert.equal(byCode.get('01'), '吸血 / Draw / ドロー');
    assert.equal(byCode.get('0C'), '金祭 / Charge / チャージ');
    for (let i = 1; i <= 40; i++) {
      const name = byCode.get(i.toString(16).toUpperCase().padStart(2, '0'));
      assert.equal(name.split(' / ').length, 3);
    }
    const srank = tables.find(n => text(n).includes('HP Revival'));
    for (const row of nodes(srank, n => n.tagName === 'tr').slice(1)) {
      const name = nodes(row, n => n.tagName === 'td')[1];
      if (/Revival|Jellen|Zalure/.test(text(name))) continue;
      assert.ok([...byCode.values()].includes(text(name)), text(name));
    }
  }
});

test('legacy ES labels never bind to ordinary weapon identities', async () => {
  for (const prefix of ['', 'content/i18n/pages/en/', 'content/i18n/pages/ja/']) {
    const tree = parse(await readFile(path.join(root, `${prefix}data/bb_items.html`), 'utf8'));
    const esCells = nodes(tree, n => n.tagName === 'td' && /^ES /.test(text(n)));
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

// Ephinea Wiki ES weapons, Spirit, Berserk, Demon's and Geist mechanics;
// hexadecimal special IDs cross-checked against newserv ItemNameIndex.cc.
test('S-Rank mechanics and special IDs agree across all published languages', async () => {
  for (const prefix of ['', 'content/i18n/pages/en/', 'content/i18n/pages/ja/']) {
    const tree = parse(await readFile(path.join(root, prefix, 'data/bb_items.html'), 'utf8'));
    const table = nodes(tree, n => n.tagName === 'table').find(n => text(n).includes('HP Revival'));
    const rows = nodes(table, n => n.tagName === 'tr').slice(1).map(n => nodes(n, c => c.tagName === 'td').map(text));
    assert.deepEqual(rows.map(r => r[0]), Array.from({ length: 16 }, (_, i) => (i + 1).toString(16).toUpperCase().padStart(2, '0')));
    const effects = Object.fromEntries(rows.map(([code, , effect]) => [code, effect]));
    for (const code of ['01', '02']) assert.match(effects[code], /21/);
    assert.match(effects['03'], /HP/);
    assert.match(effects['04'], /TP/);
    assert.match(effects['07'], /概率.*冻结|Chance to freeze|確率.*凍結/);
    assert.match(effects['0A'], /EDK/);
    assert.match(effects['0B'], /20%.*3\.33/);
    assert.match(effects['0C'], /25%.*3\.33/);
    for (const code of ['0B', '0C', '0D']) assert.match(effects[code], /当前|current|現在/);
    assert.match(effects['0D'], /75%.*45%/);
    assert.match(effects['0D'], /50%/);
    assert.match(effects['0F'], /6%/);
    assert.match(effects['0F'], /最大|maximum/);
    assert.match(effects['0F'], /25 \/ 50 \/ 75 \/ 100/);
    assert.doesNotMatch(text(table), /Kings|10%|双倍|double damage|2倍/);
    assert.equal(rows.at(-1)[1], "王之 / King's / キング");
    assert.equal(rows[10][1], '灵祭 / Spirit / スピリット');
    for (const row of rows) assert.equal(row[1].split(' / ').length, 3);
    const headings = nodes(tree, n => ['h2', 'h3'].includes(n.tagName));
    const ids = headings.map(n => attr(n, 'id'));
    assert.ok(ids.every(Boolean));
    assert.equal(new Set(ids).size, ids.length);
    const toc = nodes(tree, n => attr(n, 'class') === 'toc')[0];
    for (const heading of headings) {
      const id = attr(heading, 'id');
      assert.equal(attr(nodes(heading, n => n.tagName === 'a')[0], 'href'), '#' + id);
      assert.ok(nodes(toc, n => attr(n, 'href') === '#' + id).length, 'Missing navigation: ' + id);
    }
  }
});
