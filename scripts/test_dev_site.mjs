import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { devRoutes, featurePaths, generatorModules, isGenerationInput, isSearchInput } from './dev_inputs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('development watches authored data and imported generator helpers, excluding its own outputs', async () => {
  const modules = await generatorModules(root);
  for (const file of [
    'index.html', 'guide/rbr.html', 'content/home-i18n.json', 'content/i18n/messages/en.json',
    'data/protocol/action.md', 'data/rbr/source.json', 'assets/js/combo_calc.js',
    'assets/img/background.webp', 'assets/css/index.css', 'scripts/page_i18n.mjs',
    'scripts/item_catalog_mag.mjs', 'src/app/status/item-data.js', 'src/app/item-catalog/catalog-messages.ts',
  ]) assert.equal(isGenerationInput(file, modules), true, file);
  for (const file of [
    'src/app/generated/pages/index.ts', 'assets/data/items/saber.json',
    'assets/data/monsters/booma.json', 'assets/data/item-index.json',
    'content/item-catalog/coverage.json', 'dist/dev-search/assets/search/pagefind.js',
  ]) {
    assert.equal(isGenerationInput(file, modules), false, file);
    assert.equal(isSearchInput(file, modules), false, file);
  }
  assert.equal(isGenerationInput('src/app/combo/combo.component.ts', modules), false);
  assert.equal(isSearchInput('src/app/combo/combo.component.ts', modules), true);
});

test('development search uses canonical authored routes and all catalog entries in each language', async () => {
  const routes = await devRoutes(root);
  for (const prefix of ['', '/en', '/ja']) {
    for (const route of ['/tools/cc.html', '/tools/status.html', '/data/items/saber.html', '/data/enemies/booma.html']) {
      assert.ok(routes.includes(`${prefix}${route}`), `${prefix}${route}`);
    }
  }
  assert.ok(routes.includes('/') && routes.includes('/en') && routes.includes('/ja'));
  assert.ok(!routes.some(route => route.includes(':') || route.includes('*') || route === '/en/index.html'));
  assert.equal(routes.length, new Set(routes).size);
});

test('unsupported route expressions fail clearly instead of silently losing search pages', () => {
  assert.deepEqual(featurePaths('const routes = [{ path: `${prefix}tools/example.html` }];'), ['tools/example.html']);
  assert.throws(() => featurePaths('const routes = [{ path: makePath() }];'), /Unsupported feature route/);
  assert.throws(() => featurePaths('const routes = [];'), /No feature routes/);
});
