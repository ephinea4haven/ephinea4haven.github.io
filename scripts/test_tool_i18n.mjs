import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { parseFragment } from 'parse5';
import { loadPageI18n, localizeBody } from './page_i18n.mjs';
import { initializeMag } from '../src/app/mag/mag.runtime.js';

const root = new URL('../', import.meta.url).pathname;
const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const i18n = await loadPageI18n(root);
const pages = ['aim', 'aim2', 'v50x', 'survial_hp', 'equipment', 'materialplan', 'mag'];
const context = { window: {} };
for (const file of ['assets/js/mag-evolution.js', 'assets/js/mag-sim-data.js', 'assets/js/i18n/items_i18n.js']) {
  vm.runInNewContext(read(file), context);
}
const items = Object.values(context.window.ITEMS_I18N);
const names = new Map(items.map(item => [item.en, item]));
const walk = (node, visit) => { visit(node); for (const child of node.childNodes || []) walk(child, visit); };
const texts = (tree) => {
  const values = [];
  walk(tree, node => {
    if (node.nodeName === '#text') values.push(node.value);
    for (const attr of node.attrs || []) if (['title', 'alt', 'aria-label', 'data-copied-label'].includes(attr.name)) values.push(attr.value);
  });
  return values.join(' ');
};
const values = (tree, attribute) => {
  const result = [];
  walk(tree, node => { for (const attr of node.attrs || []) if (attr.name === attribute) result.push(attr.value); });
  return result;
};

for (const page of pages) {
  test(page + ': translated regions preserve anchors, controls and numeric cells', () => {
    const source = read('tools/' + page + '.html');
    const original = parseFragment(source.slice(source.indexOf('<body>') + 6, source.indexOf('</body>')));
    assert.deepEqual(i18n.coverage['tools/' + page + '.html'].languages, ['zh', 'en', 'ja']);
    const cells = (tree) => {
      const result = [];
      walk(tree, node => {
        if (node.tagName === 'td') {
          const text = texts(node).trim();
          if (/^[\d\s/+×%?.x−-]+$/.test(text)) result.push(text);
        }
      });
      return result;
    };
    for (const language of ['en', 'ja']) {
      const translated = structuredClone(original);
      localizeBody(i18n, translated, language, 'tools/' + page + '.html', {
        itemName: (name, lang) => {
          assert.ok(names.has(name), 'Unknown item: ' + name);
          return lang === 'en' ? name : names.get(name)[lang] || name;
        },
      });
      assert.deepEqual(values(translated, 'id'), values(original, 'id'));
      assert.deepEqual(values(translated, 'data-copy'), values(original, 'data-copy'));
      assert.deepEqual(values(translated, 'data-feed-table'), values(original, 'data-feed-table'));
      assert.deepEqual(cells(translated), cells(original));
      assert.deepEqual(values(translated, 'href').filter(v => v.includes('/tools/status.html?')),
        values(original, 'href').filter(v => v.includes('/tools/status.html?')));
      const text = texts(translated);
      if (language === 'en') assert.doesNotMatch(text, /[\u3400-\u9fff]/);
      else assert.doesNotMatch(text, /玛古|喂食|触发|职业|角色服装|固定伤害|目标|能力药|回到顶部|已复制|使用：数/);
    }
  });
}

for (const language of ['zh', 'en', 'ja']) {
  test('Mag runtime renders charts, feeding names and colour states in ' + language, () => {
    const charts = ['HU', 'RA', 'FO'].map(key => ({
      dataset: { magChart: key }, classList: { add() {} }, innerHTML: '',
      insertAdjacentHTML() {},
    }));
    const feeds = Array.from({ length: 8 }, (_, index) => {
      const tbody = { innerHTML: '' };
      return { dataset: { feedTable: String(index) }, tbody, querySelector: () => tbody };
    });
    const current = { textContent: '', dataset: {} };
    let click;
    const picker = {
      innerHTML: '', querySelector: () => current, querySelectorAll: () => [],
      addEventListener: (_, callback) => { click = callback; },
    };
    const host = {
      style: { setProperty() {}, removeProperty() {} },
      querySelectorAll(selector) {
        return selector === '[data-mag-chart]' ? charts : selector === '[data-feed-table]' ? feeds :
          selector === '[data-mag-colorpicker]' ? [picker] : [];
      },
    };
    initializeMag(host, context.window.MAG_EVOLUTION, context.window.MAG_SIM, language, items);
    const rendered = charts.map(c => c.innerHTML).join('') + feeds.map(f => f.tbody.innerHTML).join('') + picker.innerHTML;
    assert.ok(charts.every(c => c.innerHTML.includes('mag-grid--lv100')));
    assert.ok(feeds.every(f => (f.tbody.innerHTML.match(/<tr>/g) || []).length === context.window.MAG_SIM.itemOrder.length));
    assert.doesNotMatch(rendered, /undefined|\{(?:first|name|result|stat|stats)\}/);
    const text = texts(parseFragment(rendered));
    if (language === 'en') assert.doesNotMatch(text, /[\u3400-\u9fff]/);
    if (language === 'ja') assert.doesNotMatch(text, /玛古|职业|进化|原色|一阶|二阶|无敌|圣泉术/);
    const name = language === 'en' ? 'Monomate' : names.get('Monomate')[language] || 'Monomate';
    assert.ok(rendered.includes(name));
    const choose = (hex) => click({ target: { closest: () => ({ dataset: { hex }, classList: { add() {} } }) } });
    choose('#7FFF00');
    assert.equal(current.dataset.exclusive, { zh: 'E 服独占', en: 'Ephinea exclusive', ja: 'Ephinea限定' }[language]);
    choose('');
    assert.equal(current.textContent, { zh: '原色', en: 'Original', ja: '元の色' }[language]);
    assert.equal(current.dataset.exclusive, '');
  });
}
