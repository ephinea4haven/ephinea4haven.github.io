import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { decode } from 'cborg';
import { archiveEntries, buildSearch, glossaryAliases, searchCategory, searchDocument, searchRoutes } from './build_search.mjs';

test('canonical standalone routes exclude error documents, duplicate aliases and event fragments', () => {
  assert.deepEqual(searchRoutes([
    '/', '/index.html', '/en', '/en/', '/ja/index.html',
    '/data/protocol', '/data/protocol/', '/data/protocol/index.html',
    '/404.html', '/en/404.html', '/ja/404.html', '/data/ep3-cards/404.html', '/en/data/ep3-cards/404.html', '/event/christmas/2025.html', '/ja/event/easter/2024.html',
    '/event/christmas', '/tools/cc.html',
  ]), ['/', '/data/ep3-cards/404.html', '/data/protocol/', '/en/', '/en/data/ep3-cards/404.html', '/event/christmas/', '/ja/', '/tools/cc.html']);
});

test('historical event records use localized host URLs, accurate years, and no default-year duplicate', () => {
  const html = `<html lang="ja"><body><h1>2025年クリスマス</h1>
    <section data-seasonal-event data-event="christmas" data-default-year="2025" data-years="2025,2024,2023"></section></body></html>`;
  assert.deepEqual(archiveEntries(html, '/ja/event/christmas.html'), [
    { url: '/ja/event/christmas.html?year=2023', language: 'ja', title: '2023年クリスマス', fragment: '/ja/event/christmas/2023.html' },
    { url: '/ja/event/christmas.html?year=2024', language: 'ja', title: '2024年クリスマス', fragment: '/ja/event/christmas/2024.html' },
  ]);
  assert.deepEqual(searchRoutes(['/ja/event/christmas.html?year=2023', '/ja/event/christmas/2023.html']), ['/ja/event/christmas.html?year=2023']);
});

test('search categories distinguish tools and long-form mechanics across languages', () => {
  for (const language of ['', '/en', '/ja']) {
    assert.equal(searchCategory(`${language}/data/items/excalibur.html`), 'items');
    assert.equal(searchCategory(`${language}/data/enemies/booma.html`), 'enemies');
    assert.equal(searchCategory(`${language}/tools/mechanics.html`), 'guides');
    assert.equal(searchCategory(`${language}/tools/cc.html`), 'tools');
    assert.equal(searchCategory(`${language}/event/christmas/`), 'events');
    assert.equal(searchCategory(`${language}/data/quest.html`), 'reference');
  }
});

test('maintained glossary aliases support shared names without guessing mismatched parallel lists', () => {
  const aliases = glossaryAliases(`<table>
    <tr><td><code>Excal</code> / <code>Lame</code></td><td>Excalibur / Lame d'Argent</td></tr>
    <tr><td><code>RS</code></td><td>Red Sword / Red Saber</td></tr>
    <tr><td><code>SLore</code> / <code>SML</code></td><td>Swordsman Lore</td></tr>
    <tr><td><code>One</code> / <code>Two</code></td><td>A / B / C</td></tr>
    <tr><td>unmarked alias</td><td>Excalibur</td></tr>
  </table>`);
  assert.deepEqual([...aliases], [['excalibur', ['Excal']], ["lame d'argent", ['Lame']],
    ['red sword', ['RS']], ['red saber', ['RS']], ['swordsman lore', ['SLore', 'SML']]]);
});

test('index copies retain content and real section targets without UI boilerplate or hydration state', () => {
  const source = `<html lang="en"><head><title>Mechanics</title></head><body>
    <haven-site-search>Search site</haven-site-search><nav>navigation</nav>
    <header class="masthead"><a class="brand">PSO HAVEN FIELD ARCHIVE</a><catalog-language>EN JA</catalog-language></header>
    <page-chrome><header><h1>Mechanics</h1></header><a class="back-link">Home</a></page-chrome>
    <div><section id="damage"><h2>Damage</h2><p>Attack formula</p></section></div>
    <footer>footer boilerplate</footer><script id="ng-state">private hydration marker</script>
    <div class="related-section">unrelated item name</div>
  </body></html>`;
  const output = searchDocument(source, '/tools/mechanics.html', ['EXCALIBUR', '王者之剑', 'エクスキャリバー']);
  assert.match(output, /<h1 data-pagefind-meta="title">Mechanics/);
  assert.match(output, /<h2 id="damage">Damage/);
  assert.match(output, /data-pagefind-filter="category:guides"/);
  assert.match(output, /Attack formula/);
  assert.match(output, /EXCALIBUR · 王者之剑 · エクスキャリバー/);
  assert.doesNotMatch(output, /navigation|Search site|boilerplate|hydration marker|unrelated item name|>Home<|FIELD ARCHIVE|EN JA/);
  assert.ok(source.includes('<h2>Damage</h2>'), 'source document remains unmodified');
});

test('only the first section heading inherits its actual section anchor', () => {
  const output = searchDocument(`<html lang="en"><body><h1>Guide</h1>
    <main id="main"><h2>Do not link to the page container</h2></main>
    <section id="real-section"><h2>Section title</h2><h3>Another heading</h3></section>
  </body></html>`, '/guide/example.html');
  assert.match(output, /<h2 id="real-section">Section title/);
  assert.match(output, /<h2>Do not link/);
  assert.match(output, /<h3>Another heading/);
});

test('Pagefind builds all categories reproducibly with authoritative aliases in every edition', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'haven-search-'));
  try {
    const routes = [];
    const ep3Root = (await readFile('src/app/ep3-card-catalog/ep3-card-catalog.component.html', 'utf8')).match(/<main[^>]*>/)[0];
    for (const [prefix, language, title] of [['', 'zh-CN', '王者之剑'], ['/en', 'en', 'EXCALIBUR'], ['/ja', 'ja', 'エクスキャリバー']]) {
      const route = `${prefix}/data/items/excalibur.html`;
      routes.push(route);
      const filename = path.join(directory, route);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, `<html lang="${language}"><body><h1>${title}</h1><p>Fixture content</p></body></html>`);
      for (const categoryRoute of ['/data/ep3-cards/29.html', '/data/ep3-cards/404.html', '/data/enemies/booma.html', '/guide/example.html', '/tools/example.html', '/event/example.html', '/data/quest.html']) {
        const url = `${prefix}${categoryRoute}`;
        routes.push(url);
        const categoryFile = path.join(directory, url);
        await mkdir(path.dirname(categoryFile), { recursive: true });
        await writeFile(categoryFile, `<html lang="${language}"><body>${url.includes("/ep3-cards/") ? ep3Root : "<main>"}<h1>${searchCategory(url)}</h1>
          <p data-pagefind-filter="edition:classic">Shared fixture content</p>
          <p data-pagefind-filter="edition:custom">Multiple values on the same page</p></main></body></html>`);
      }
    }
    const report = await buildSearch({ directory, routes });
    assert.equal(report.pages, 24);
    assert.ok(report.javascriptGzipBytes > 0);
    assert.ok(report.javascriptGzipBytes <= 19500, 'minified search runtime and worker stay within 19.5 KB gzip');
    const outputDirectory = path.join(directory, 'assets/search');
    const files = await readdir(outputDirectory);
    assert.ok(files.includes('pagefind.js'));
    assert.ok(files.includes('pagefind-worker.js'));
    assert.ok(files.includes('pagefind-entry.json'));
    assert.ok(!files.some(filename => filename.includes('-ui') || filename.includes('-highlight')));
    const fragmentFiles = (await readdir(path.join(outputDirectory, 'fragment'))).sort();
    assert.equal(fragmentFiles.length, 24);
    const fragments = await Promise.all(fragmentFiles.map(async filename => {
      const content = gunzipSync(await readFile(path.join(outputDirectory, 'fragment', filename))).toString();
      return JSON.parse(content.replace(/^pagefind_dcd/, ''));
    }));
    for (const fragment of fragments) {
      if (fragment.url.endsWith('/excalibur.html')) {
        const normalized = fragment.content.replaceAll('\u200b', '');
        for (const name of ['EXCALIBUR', '王者之剑', 'エクスキャリバー', 'Excal']) assert.ok(normalized.includes(name), `${fragment.url} missing ${name}`);
      }
      if (fragment.url.endsWith('/ep3-cards/29.html')) {
        const normalized = fragment.content.replaceAll('\u200b', '');
        for (const name of ["Hildebear's Cane+", 'ヒルデベアケイン＋', 'BEARS CANE +']) assert.ok(normalized.includes(name), `${fragment.url} missing ${name}`);
      }
      assert.deepEqual(fragment.filters.category, [searchCategory(fragment.url)]);
    }
    const firstEntry = await readFile(path.join(outputDirectory, 'pagefind-entry.json'), 'utf8');
    // Resolve all filter page IDs back through metadata to their actual result URLs.
    // Multiple filter names, multiple values, and multiple values on one page must survive.
    for (const details of Object.values(JSON.parse(firstEntry).languages)) {
      const unpack = async filename => decode(gunzipSync(await readFile(path.join(outputDirectory, filename))).subarray(12));
      const meta = await unpack(`pagefind.${details.hash}.pf_meta`);
      const pageUrls = await Promise.all(meta[1].map(async ([hash]) => {
        const content = gunzipSync(await readFile(path.join(outputDirectory, 'fragment', `${hash}.pf_fragment`))).toString();
        return JSON.parse(content.replace(/^pagefind_dcd/, '')).url;
      }));
      assert.deepEqual(meta[3].map(([name]) => name), ['category', 'edition']);
      for (const [name, hash] of meta[3]) {
        const filter = await unpack(`filter/${hash}.pf_filter`);
        const expectedValues = name === 'category' ? ['enemies', 'events', 'guides', 'items', 'reference', 'tools'] : ['classic', 'custom'];
        assert.deepEqual(filter[1].map(([value]) => value), expectedValues);
        for (const [value, ids] of filter[1]) {
          const actual = ids.map(id => pageUrls[id]).sort();
          const expected = pageUrls.filter(url => name === 'category'
            ? searchCategory(url) === value : !url.endsWith('/excalibur.html')).sort();
          assert.deepEqual(actual, expected, `${name}:${value} preserves its result membership`);
        }
      }
    }
    const originalFiles = (await readdir(outputDirectory, { recursive: true })).sort();
    const published = await Promise.all(originalFiles.map(async filename => {
      const info = await stat(path.join(outputDirectory, filename));
      return info.isFile() ? [filename, info.mtimeMs, createHash('sha256').update(await readFile(path.join(outputDirectory, filename))).digest('hex')] : undefined;
    }));
    for (let repeat = 0; repeat < 2; repeat += 1) {
      await buildSearch({ directory, routes });
      assert.equal(await readFile(path.join(outputDirectory, 'pagefind-entry.json'), 'utf8'), firstEntry, 'unchanged content has a reproducible index entry');
      const repeated = (await readdir(outputDirectory, { recursive: true })).sort();
      assert.deepEqual(repeated, originalFiles, 'unchanged builds must not create new content hashes');
      for (const [filename, modified, hash] of published.filter(Boolean)) {
        assert.equal((await stat(path.join(outputDirectory, filename))).mtimeMs, modified, `${filename} must not trigger dev watchers when its bytes are unchanged`);
        assert.equal(createHash('sha256').update(await readFile(path.join(outputDirectory, filename))).digest('hex'), hash, `${filename} bytes remain reproducible`);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
