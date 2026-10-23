import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { contentRoute, pageRoutes, publicHref, publicPageKey, routeDocument } from './public_routes.mjs';
import { featurePaths } from './dev_inputs.mjs';

test('explicit public routes cover every authored page and never collide', async () => {
  async function walk(dir) {
    return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat();
  }
  const pages = (await Promise.all(['data', 'guide', 'tools', 'event'].map(walk))).flat()
    .filter(p => p.endsWith('.html') && !p.startsWith('data/droptable/') && !/^event\/[^/]+\/\d{4}\.html$/.test(p));
  for (const page of ['index.html', '404.html', ...pages]) assert.ok(Object.hasOwn(pageRoutes, page), page);
  assert.equal(new Set(Object.values(pageRoutes)).size, Object.keys(pageRoutes).length);
  for (const route of Object.values(pageRoutes)) {
    if (route === '404.html') continue;
    assert.match(route, /^(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/);
    assert.doesNotMatch(route, /^(?:assets|data|tools|guide|en|ja)(?:\/|$)/);
  }
  const features = featurePaths(await readFile('src/app/app.routes.server.ts', 'utf8'));
  for (const route of features.filter(p => !p.includes(':'))) assert.ok(Object.values(pageRoutes).includes(route), route);
});

test('source identity, public URL and output document are separate', () => {
  assert.equal(contentRoute('tools/status.html'), 'character-stats');
  assert.equal(publicHref('/en/tools/status.html?level=200#result'), '/en/character-stats/?level=200#result');
  assert.equal(routeDocument('/en/character-stats/?level=200#result'), 'en/character-stats/index.html');
  assert.equal(publicHref('/data/items/excalibur.html'), '/items/excalibur/');
  assert.equal(publicHref('/ja/data/ep3-cards/404.html'), '/ja/cards/404/');
  assert.equal(publicHref('/index.html'), '/');
  assert.equal(publicPageKey('data/items/'), 'items/');
  assert.equal(publicPageKey('data/protocol'), 'reference/protocol');
  for (const resource of ['/assets/data/items/excalibur.json', '/event/christmas/2025.html', 'https://example.com/data/items.html', '//example.com/index.html']) assert.equal(publicHref(resource), resource);
  assert.equal(routeDocument('/404.html'), '404.html');
  assert.throws(() => contentRoute('new-page.html'), /no public route/);
});
