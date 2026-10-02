import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const budgets = JSON.parse(readFileSync(new URL('../../performance-budgets.json', import.meta.url), 'utf8'));

const open = async page => {
  await page.getByTestId('site-search-trigger').click();
  await expect(page.getByTestId('site-search-dialog')).toBeVisible();
  await expect(page.locator('#site-search-query')).toBeFocused();
};
const query = async (page, value, category = '') => {
  await page.locator('#site-search-category').selectOption(category);
  await page.locator('#site-search-query').fill(value);
  await expect(page.getByTestId('site-search-results')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 });
};

for (const [language, prefix] of [['zh', ''], ['en', '/en'], ['ja', '/ja']]) {
  test(`global search uses authoritative names and abbreviations in ${language}`, async ({ page }) => {
    await page.goto(`${prefix}/`);
    await open(page);
    const results = page.getByTestId('site-search-results');
    for (const name of ['EXCALIBUR', '王者之剑', 'エクスキャリバー', 'Excal']) {
      await query(page, name, 'items');
      await expect(results.locator(`a.result-title[href="${prefix}/data/items/excalibur.html"]`)).toBeVisible();
    }
    for (const [name, identities] of [['RM', ['resta-merge']], ['SML', ['swordsman-lore']], ['RS', ['red-sword', 'red-saber']]]) {
      await query(page, name, 'items');
      for (const identity of identities) await expect(results.locator(`a.result-title[href="${prefix}/data/items/${identity}.html"]`)).toBeVisible();
    }
    await query(page, 'Rag Rappy', 'enemies');
    await expect(results.locator(`a.result-title[href="${prefix}/data/enemies/rag-rappy-e1.html"]`)).toBeVisible();
    const urls = await results.locator('a.result-title').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    expect(urls.every(url => language === 'zh' ? !/^\/(en|ja)\//.test(url) : url.startsWith(`${prefix}/`))).toBe(true);
  });
}

for (const [language, prefix, indexLanguage] of [['zh', '', 'zh-cn'], ['en', '/en', 'en'], ['ja', '/ja', 'ja']]) {
  test(`search downloads only ${language} shards and reuses results after reopening`, async ({ page }, testInfo) => {
    const requests = [];
    const bodies = [];
    page.on('request', request => {
      if (request.url().includes('/assets/search/')) requests.push(new URL(request.url()).pathname);
    });
    page.on('response', response => {
      if (response.url().includes('/assets/search/')) {
        bodies.push(response.body().then(body => ({ url: new URL(response.url()).pathname, bytes: body.length })));
      }
    });
    await page.goto(`${prefix}/`);
    await open(page);
    expect(requests).toEqual([]);
    await query(page, 'Excal', 'items');
    await expect(page.locator(`a.result-title[href="${prefix}/data/items/excalibur.html"]`)).toBeVisible();
    const shards = requests.filter(url => /\.(?:pf_meta|pf_index|pf_filter|pf_fragment)$/.test(url));
    expect(shards.length).toBeGreaterThan(0);
    expect(shards.every(url => url.split('/').pop().replace(/^pagefind\./, '').startsWith(`${indexLanguage}_`))).toBe(true);
    const downloaded = await Promise.all(bodies);
    const rawBodyBytes = downloaded.reduce((sum, file) => sum + file.bytes, 0);
    const metric = testInfo.outputPath(`search-first-query-${language}.json`);
    writeFileSync(metric, JSON.stringify({ language, rawBodyBytes, files: downloaded }, null, 2));
    await testInfo.attach(`search-first-query-${language}.json`, { path: metric, contentType: 'application/json' });
    expect(rawBodyBytes).toBeLessThanOrEqual(budgets.search.maxFirstQueryBodyBytes);
    const previous = [...requests];
    await page.keyboard.press('Escape');
    await open(page);
    await expect(page.locator(`a.result-title[href="${prefix}/data/items/excalibur.html"]`)).toBeVisible();
    expect(requests).toEqual(previous);
    await query(page, '');
    await query(page, 'Excal', 'items');
    await expect(page.locator(`a.result-title[href="${prefix}/data/items/excalibur.html"]`)).toBeVisible();
    expect(requests).toEqual(previous);
  });
}

test('search loads on demand, links to real sections, handles no results and restores keyboard focus', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.url().includes('/assets/search/')) requests.push(request.url()); });
  await page.goto('/');
  await open(page);
  expect(requests).toEqual([]);
  await query(page, 'Pvar', 'guides');
  const section = page.getByTestId('site-search-results').locator('a[href^="/tools/mechanics.html#"]').first();
  await expect(section).toBeVisible();
  const destination = await section.getAttribute('href');
  expect(requests.some(url => url.includes('/assets/search/pagefind.js'))).toBe(true);
  await query(page, '"unfindableword987654321"');
  await expect(page.getByTestId('site-search-dialog').getByRole('status')).toContainText('没有找到');
  await page.locator('#site-search-query').fill('');
  await expect(page.getByTestId('site-search-results').locator('li')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('site-search-dialog')).not.toBeVisible();
  await expect(page.getByTestId('site-search-trigger')).toBeFocused();
  await page.goto(destination);
  await expect(page.locator(destination.slice(destination.indexOf('#')))).toBeVisible();
});

test('search reinitializes after in-app language navigation', async ({ page }) => {
  await page.goto('/');
  await open(page);
  await query(page, 'Excal', 'items');
  await expect(page.locator('a.result-title[href="/data/items/excalibur.html"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('[data-home-lang="en"]').click();
  await open(page);
  await expect(page.locator('#site-search-query')).toHaveValue('');
  await query(page, 'Excal', 'items');
  await expect(page.locator('a.result-title[href="/en/data/items/excalibur.html"]')).toBeVisible();
  await expect(page.locator('a.result-title[href="/data/items/excalibur.html"]')).toHaveCount(0);
});

test('search reports a failed download and retries without reloading the page', async ({ page }) => {
  await page.route('**/assets/search/pagefind.js*', route => route.abort());
  await page.goto('/en/');
  await open(page);
  await query(page, 'Excal');
  await expect(page.getByTestId('site-search-dialog').getByRole('status')).toContainText('Search could not load');
  await page.unroute('**/assets/search/pagefind.js*');
  await page.getByRole('button', { name: 'Retry search', exact: true }).click();
  await expect(page.locator('a.result-title[href="/en/data/items/excalibur.html"]')).toBeVisible({ timeout: 20000 });
});

test('a failed dialog module offers a working page reload recovery', async ({ page }) => {
  await page.goto('/en/');
  await page.route('**/assets/angular/*.js', route => route.abort());
  await page.getByTestId('site-search-trigger').click();
  await expect(page.getByRole('alert')).toContainText('Reload this page');
  await page.unroute('**/assets/angular/*.js');
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reload page', exact: true }).click(),
  ]);
  await open(page);
  await query(page, 'Excal', 'items');
  await expect(page.locator('a.result-title[href="/en/data/items/excalibur.html"]')).toBeVisible();
});

test('a superseded search cannot replace newer results', async ({ page }) => {
  let delayed = false;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/search/fragment/*', async route => {
    if (!delayed) { delayed = true; await gate; }
    await route.continue();
  });
  try {
    await page.goto('/en/');
    await open(page);
    await page.locator('#site-search-query').fill('Excal');
    await expect.poll(() => delayed).toBe(true);
    await page.evaluate(() => {
      window.searchRaceStale = false;
      new MutationObserver(() => {
        if (document.querySelector('a.result-title[href="/en/data/items/excalibur.html"]')) window.searchRaceStale = true;
      }).observe(document.querySelector('[data-testid="site-search-results"]'), { childList: true, subtree: true });
    });
    // Unquoted Pagefind terms can match shorter indexed prefixes; this exact phrase is absent.
    await page.locator('#site-search-query').fill('"unfindableword987654321"');
    release();
    await expect(page.getByTestId('site-search-dialog').getByRole('status')).toContainText('No results');
    await expect(page.getByTestId('site-search-results').locator('li')).toHaveCount(0);
    expect(await page.evaluate(() => window.searchRaceStale)).toBe(false);
  } finally { release(); }
});

test('mobile search dialog fits the viewport and exposes accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/tools/cc.html');
  await open(page);
  await query(page, 'Excal', 'items');
  const dialog = page.getByTestId('site-search-dialog');
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('[data-testid="site-search-dialog"]').analyze();
  expect(accessibility.violations).toEqual([]);
});

test('selecting a section on the current page closes the modal before following its anchor', async ({ page }) => {
  await page.goto('/tools/mechanics.html');
  await open(page);
  await query(page, 'Pvar', 'guides');
  const section = page.getByTestId('site-search-results').locator('a[href^="/tools/mechanics.html#"]').first();
  const destination = await section.getAttribute('href');
  await section.click();
  await expect(page.getByTestId('site-search-dialog')).not.toBeVisible();
  await expect(page).toHaveURL(url => `${url.pathname}${url.hash}` === destination);
  await expect(page.locator(destination.slice(destination.indexOf('#')))).toBeVisible();
});

for (const prefix of ['', '/en', '/ja']) test(`historical event search links to a working year host in ${prefix || 'zh'}`, async ({ page }) => {
  await page.goto(`${prefix}/`);
  await open(page);
  await query(page, 'Christmas 2015', 'events');
  const result = page.locator(`a.result-title[href="${prefix}/event/christmas.html?year=2015"]`);
  await expect(result).toBeVisible();
  const loaded = page.waitForResponse(response => response.url().endsWith(`${prefix}/event/christmas/2015.html`) && response.ok());
  await result.click();
  await loaded;
  await expect(page.locator('#yearNav [aria-current="page"]')).toHaveText('2015');
  await expect(page.locator('#content')).toContainText('2015');
});

test('search queries are plain text, including markup and path-like input', async ({ page }) => {
  await page.goto('/en/');
  await open(page);
  await query(page, '<img src=x onerror="window.searchInjected=true"> ../../event/christmas.html?year=../../etc/passwd');
  await expect(page.getByTestId('site-search-dialog').getByRole('status')).toContainText('No results');
  expect(await page.evaluate(() => window.searchInjected)).toBeUndefined();
  await expect(page.getByTestId('site-search-results').locator('img')).toHaveCount(0);
});

test('excerpts render only text and fixed marks without executing or fetching embedded markup', async ({ page }) => {
  const resources = [];
  page.on('request', request => { if (request.url().includes('search-excerpt-probe')) resources.push(request.url()); });
  const result = {
    url: '/en/tools/mechanics.html', meta: { title: 'Safety fixture' }, filters: { category: ['guides'] },
    excerpt: 'A &amp; B <mark>日 &lt;月&gt; <em>nested</em></mark> &lt;mark&gt;literal&lt;/mark&gt; '
      + '<img src="/search-excerpt-probe-image" onerror="window.searchExcerptInjected=true">'
      + '<iframe src="/search-excerpt-probe-frame"></iframe><script>window.searchExcerptInjected=true</script>'
      + '<svg onload="window.searchExcerptInjected=true"><text>safe text</text></svg>',
    sub_results: [{ title: 'Section', url: '/en/tools/mechanics.html#physical-damage', excerpt: '&quot;quoted&quot; <mark>&#x65e5;</mark>' }],
  };
  await page.route('**/assets/search/pagefind.js*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export async function options(){} export async function init(){} export async function destroy(){}
      export async function search(){return {results:[{data:async()=>(${JSON.stringify(result)})}]}}`,
  }));
  await page.goto('/en/');
  await open(page);
  await query(page, 'fixture');
  const excerpts = page.locator('.result-excerpt');
  await expect(excerpts.first()).toHaveText('A & B 日 <月> nested <mark>literal</mark> safe text');
  await expect(excerpts.nth(1)).toHaveText('"quoted" 日');
  expect(await excerpts.locator('mark').allTextContents()).toEqual(['日 <月> ', 'nested', '日']);
  await expect(excerpts.locator(':not(mark)')).toHaveCount(0);
  expect(resources).toEqual([]);
  expect(await page.evaluate(() => window.searchExcerptInjected)).toBeUndefined();
});

test('loading more results moves keyboard focus to the first newly displayed result', async ({ page }) => {
  await page.goto('/en/');
  await open(page);
  await query(page, 'Saber', 'items');
  const results = page.getByTestId('site-search-results').locator('a.result-title');
  await expect(results).toHaveCount(10);
  const more = page.getByRole('button', { name: 'Show more', exact: true });
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(results.nth(10)).toBeFocused();
});

for (const width of [320, 390]) test(`search entry remains operable beside existing controls at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  for (const route of ['/', '/tools/mechanics.html', '/data/items.html', '/data/enemies.html']) {
    await page.goto(route);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const trigger = page.getByTestId('site-search-trigger');
    const box = await trigger.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const top = page.locator('#backToTop');
    if (await top.isVisible()) {
      const other = await top.boundingBox();
      expect(box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y).toBe(true);
    }
    await open(page);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});

for (const prefix of ['', '/en', '/ja']) test(`mobile archive navigation and floating controls stay clickable in ${prefix || 'zh'}`, async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${prefix}/event/anniversary.html`);
    const trigger = page.getByTestId('site-search-trigger');
    const years = page.locator('[data-year-rail-toggle]');
    await expect(years).toHaveAttribute('aria-expanded', 'false');
    await years.click();
    await expect(years).toHaveAttribute('aria-expanded', 'true');
    await open(page);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await years.click();
    await expect(years).toHaveAttribute('aria-expanded', 'false');
    for (const [route, selector] of [['/tools/materialplan.html', '#backToTop'], ['/data/bdp/', '.back-to-top']]) {
      await page.goto(`${prefix}${route}`);
      // Opening and closing the real dialog also establishes that browser behavior has hydrated.
      await open(page);
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const top = page.locator(selector);
      await expect(top).toBeVisible();
      const separate = async () => {
        const a = await trigger.boundingBox();
        const b = await top.boundingBox();
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
      };
      await separate();
      await top.hover();
      await top.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
      await separate();
      await top.click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    }
  }
});
