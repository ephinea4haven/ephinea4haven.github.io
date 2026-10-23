import { test, expect } from '@playwright/test';
import externalSystems from '../../content/external-systems.json' with { type: 'json' };

test('Pages directory redirects preserve queries; missing routes retain HTTP 404', async ({ request }) => {
  const redirect = await request.get('/en/items?category=weapon', { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(redirect.headers().location).toBe('/en/items/?category=weapon');
  for (const url of ['/items/', '/en/items/', '/ja/character-stats/', '/items/excalibur/']) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(await response.text()).toContain('ng-state');
  }
  for (const url of ['/missing-route/', '/en/missing-route/', '/data/items.html', '/tools/status.html']) {
    expect((await request.get(url)).status(), url).toBe(404);
  }
});

test('explicit index document normalizes in Angular without a second document request', async ({ page }) => {
  const documents = [];
  page.on('request', r => { if (r.isNavigationRequest()) documents.push(r.url()); });
  await page.goto('/en/items/index.html?category=weapon');
  await expect(page).toHaveURL(/\/en\/items\/\?category=weapon$/);
  await expect(page.locator('.item-row').first()).toBeVisible();
  expect(documents).toHaveLength(1);
});

test('the shared 404 page reacts when its language changes', async ({ page }) => {
  await page.goto('/en/missing-route/');
  await expect(page.locator('h1')).toHaveText('404 - Page not found');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('404 - 页面未找到');
  await expect(page.locator('h1 + p a')).toHaveAttribute('href', '/');
});

test('content and catalog pages navigate in one Angular document, including back', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { window.__routeDocument = 'same'; });
  await page.locator('a[href="/items/"]').first().click();
  await expect(page.locator('.item-row').first()).toBeVisible();
  await page.locator('.item-row').first().click();
  await expect(page.locator('.detail-shell')).toBeVisible();
  expect(await page.evaluate(() => window.__routeDocument)).toBe('same');
  await page.goBack();
  await expect(page.locator('.item-row').first()).toBeVisible();
  await page.locator('a.brand').click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => window.__routeDocument)).toBe('same');
});

for (const event of ['easter', 'anniversary']) {
  test(`${event}: years react to query navigation, restore default content and browser history`, async ({ page }) => {
    await page.goto(`/en/events/${event}/`);
    await expect(page.locator('#yearNav event-year-nav')).toBeAttached();
    const latest = await page.locator('#yearNav .year-current').textContent();
    const old = page.locator('#yearNav a').first();
    const year = await old.textContent();
    await page.evaluate(() => { window.__routeDocument = 'same'; });
    if (event === 'anniversary') await page.locator('.year-rail-toggle').click();
    await old.click();
    await expect(page.locator('#yearNav .year-current')).toHaveText(year.trim());
    await expect(page).toHaveTitle(new RegExp(year.trim()));
    const content = page.locator(event === 'easter' ? '#yearContent' : '#content');
    await expect(content).not.toBeEmpty();
    if (event === 'anniversary') await page.locator('.year-rail-toggle').click();
    await page.locator('#yearNav a').filter({ hasText: latest.trim() }).click();
    await expect(page.locator('#yearNav .year-current')).toHaveText(latest.trim());
    await expect(content).not.toBeEmpty();
    await page.goBack();
    await expect(page.locator('#yearNav .year-current')).toHaveText(year.trim());
    await expect(page).toHaveTitle(new RegExp(year.trim()));
    expect(await page.evaluate(() => window.__routeDocument)).toBe('same');
  });
}

test('anniversary year changes discard the previous layout state', async ({ page }) => {
  await page.goto('/en/events/anniversary/?year=2024');
  await expect(page.locator('#content')).toHaveClass(/anniv-legacy/);
  await page.locator('.year-rail-toggle').click();
  await page.locator('#yearNav a').filter({ hasText: '2025' }).click();
  await expect(page.locator('#content .anniv-2025')).toBeVisible();
  await expect(page.locator('#content')).not.toHaveClass(/anniv-legacy/);
});

test('leaving an event year cancels its pending archive request', async ({ page }) => {
  await page.goto('/en/events/easter/');
  const latest = (await page.locator('#yearNav .year-current').textContent()).trim();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/en/event/easter/*.html', async route => {
    await gate;
    await route.fulfill({ contentType: 'text/html', body: '<p>STALE ARCHIVE RESPONSE</p>' }).catch(() => {});
  });
  const request = page.waitForRequest('**/en/event/easter/*.html');
  await page.locator('#yearNav a').first().click();
  const pending = await request;
  const cancelled = page.waitForEvent('requestfailed', { predicate: r => r === pending });
  await page.locator('#yearNav a').filter({ hasText: latest }).click();
  await cancelled;
  release();
  await expect(page.locator('#yearNav .year-current')).toHaveText(latest);
  await expect(page.locator('#yearContent')).not.toBeEmpty();
  await expect(page.locator('#yearContent')).not.toContainText('STALE ARCHIVE RESPONSE');
});

test('Mag section navigation works after leaving and reopening the page', async ({ page }) => {
  await page.goto('/en/mags/');
  await page.evaluate(() => { window.__routeDocument = 'mag'; });
  for (let visit = 0; visit < 2; visit++) {
    const links = page.locator('[data-section-nav] a');
    const target = await links.nth(1).evaluate(a => a.hash.slice(1));
    await links.nth(1).click();
    await expect(page.locator(`[data-mag-section][aria-labelledby="${target}"]`)).toBeVisible();
    await page.goBack();
    await page.locator('.back-link').click();
    await expect(page).toHaveURL(/\/en\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/mags\/$/);
  }
  expect(await page.evaluate(() => window.__routeDocument)).toBe('mag');
});

test('protocol tab state belongs to the router and survives language changes', async ({ page }) => {
  await page.goto('/en/reference/protocol/');
  await page.locator('#tab-list [data-tab="subcommands"]').click();
  await expect(page).toHaveURL(/#subcommands$/);
  await page.getByRole('button', { name: '日本語', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/reference\/protocol\/#subcommands$/);
  await expect(page.locator('#proto-content section[data-tab="subcommands"]')).toHaveClass(/active/);
});

test('empty fragment links scroll both reward tables to the top without reloading', async ({ page }) => {
  for (const prefix of ['', '/en', '/ja']) {
    for (const quest of ['black-paper-deal', 'corens-prizes']) {
      await page.goto(`${prefix}/quests/${quest}/`);
      await page.getByTestId('site-search-trigger').click();
      await expect(page.getByTestId('site-search-dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.evaluate(() => { window.__routeDocument = 'top'; window.scrollTo(0, document.documentElement.scrollHeight); });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await page.locator('a.back-to-top').click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => window.__routeDocument)).toBe('top');
    }
  }
});

for (const [language, prefix] of [['zh', ''], ['en', '/en'], ['ja', '/ja']]) {
  test(`external systems stay direct, localized links in ${language}`, async ({ page, context }) => {
    for (const origin of Object.values(externalSystems)) {
      await context.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: '<title>External system</title>' }));
    }
    await page.goto(`${prefix}/`);
    const links = await page.locator('a[href]').evaluateAll((elements, systems) => elements.flatMap(a => {
      const system = Object.entries(systems).find(([, origin]) => new URL(a.href).origin === origin)?.[0];
      return system ? [{ system, href: a.href, target: a.target, router: a.hasAttribute('routerlink') }] : [];
    }), externalSystems);
    expect(new Set(links.map(link => link.system))).toEqual(new Set(Object.keys(externalSystems)));
    for (const link of links) {
      const url = new URL(link.href);
      expect(url.origin).toBe(externalSystems[link.system]);
      expect(link.target).toBe('_blank');
      expect(link.router).toBe(false);
      if (link.system === 'dropCharts') {
        expect(url.searchParams.get('lang')).toBe(language);
        expect(url.searchParams.get('diff')).toBe('Ultimate');
      }
    }
    const popup = page.waitForEvent('popup');
    await page.locator(`a[href^="${externalSystems.dropCharts}/"]`).first().click();
    const external = await popup;
    await expect(external).toHaveURL(`${externalSystems.dropCharts}/bb/?lang=${language}&diff=Ultimate`);
    await external.close();
    await expect(page).toHaveURL(new URL(`${prefix}/`, 'http://127.0.0.1:4173').href);
    for (const route of ['/items/excalibur/', '/enemies/booma/']) {
      await page.goto(`${prefix}${route}`);
      await expect(page.locator(`a[href^="${externalSystems.dropCharts}"]`)).toHaveAttribute('href', `${externalSystems.dropCharts}/bb/?lang=${language}`);
    }
  });
}
