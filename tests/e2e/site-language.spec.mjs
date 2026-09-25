import { test, expect } from '@playwright/test';

const bar = (page) => page.locator('haven-language-bar');

test('each language version is a separate prerendered URL with hreflang alternates', async ({ request }) => {
  const english = await (await request.get('/en/guide/ep1ch.html')).text();
  expect(english).toContain('<html lang="en"');
  expect(english).toContain('<link rel="canonical" href="https://www.psohaven.com/en/guide/ep1ch.html"');
  for (const [hreflang, href] of [['zh-CN', '/guide/ep1ch.html'], ['en', '/en/guide/ep1ch.html'], ['ja', '/ja/guide/ep1ch.html'], ['x-default', '/guide/ep1ch.html']]) {
    expect(english).toContain(`<link rel="alternate" href="https://www.psohaven.com${href}" hreflang="${hreflang}"`);
  }
  expect(english).toContain('/assets/img/challenge/ep1/maps/en/area_01.svg');
  expect(english).not.toContain('/assets/img/challenge/ep1/maps/zh/');

  // Directory pages use a trailing slash; a Chinese-only page lists no other versions.
  const protocol = await (await request.get('/ja/data/protocol/')).text();
  expect(protocol).toContain('<link rel="canonical" href="https://www.psohaven.com/ja/data/protocol/"');
  const chineseOnly = await (await request.get('/guide/rbr.html')).text();
  expect(chineseOnly).not.toContain('hreflang="en"');
  expect(chineseOnly).not.toContain('hreflang="ja"');
  expect((await request.get('/en/guide/rbr.html')).status()).toBe(404);
});

test('a chosen language opens the versions that exist and says when a page has none', async ({ page }) => {
  await page.goto('/guide/rbr.html');
  await expect(bar(page)).toBeVisible();
  await bar(page).getByRole('button', { name: 'English', exact: true }).click();
  // A Chinese-only page stays where it is, stays Chinese, and says so in the reader's language.
  await expect(page).toHaveURL(/\/guide\/rbr\.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(bar(page).getByRole('button', { name: '中文', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bar(page).getByRole('status')).toHaveText('This page is currently available in Chinese only.');

  await page.goto('/data/items.html');
  await expect(page).toHaveURL(/\/en\/data\/items\.html$/);
  await expect(page.locator('h1')).toHaveText('Item Database');
  await page.goto('/');
  await expect(page.locator('.hero-title-sub')).toHaveText('A multilingual wiki for players worldwide');
  await expect(bar(page)).toBeHidden();

  await page.goto('/data/protocol/');
  await expect(page).toHaveURL(/\/en\/data\/protocol\/?$/);
  await expect(page.locator('#project_title')).toHaveText('Protocol Reference');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(bar(page).getByRole('status')).toHaveCount(0);
});

test('switching back to Chinese removes the notice', async ({ page }) => {
  await page.goto('/tools/mag.html');
  await bar(page).getByRole('button', { name: '日本語', exact: true }).click();
  await expect(bar(page).getByRole('status')).toHaveText('このページは現在、中国語版のみです。');
  await expect(page).toHaveTitle('玛古进化图谱 | Ephinea PSOBB');
  await bar(page).getByRole('button', { name: '中文', exact: true }).click();
  await expect(bar(page).getByRole('status')).toHaveCount(0);
  await page.reload();
  await expect(bar(page).getByRole('status')).toHaveCount(0);
});

test('pages written in English keep their URL and say so to Japanese readers', async ({ page }) => {
  await page.goto('/tools/id.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(bar(page).getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await bar(page).getByRole('button', { name: '日本語', exact: true }).click();
  await expect(page).toHaveURL(/\/tools\/id\.html$/);
  await expect(bar(page).getByRole('status')).toHaveText('このページは現在、英語版のみです。');
});

for (const width of [390, 1280]) {
  test(`language bar and its notice fit without horizontal scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/guide/seabed.html');
    await bar(page).getByRole('button', { name: 'English', exact: true }).click();
    await expect(bar(page).getByRole('status')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}
