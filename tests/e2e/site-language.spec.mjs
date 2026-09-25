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

  // Directory pages use a trailing slash.
  const protocol = await (await request.get('/ja/data/protocol/')).text();
  expect(protocol).toContain('<link rel="canonical" href="https://www.psohaven.com/ja/data/protocol/"');
  const events = await (await request.get('/event/event.html')).text();
  for (const hreflang of ['zh-CN', 'en', 'ja', 'x-default']) expect(events).toContain(`hreflang="${hreflang}"`);
});

test('a chosen language opens that version of this and later pages', async ({ page }) => {
  await page.goto('/event/event.html');
  await expect(bar(page)).toBeVisible();
  await bar(page).getByRole('button', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/event\/event\.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(bar(page).getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');

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
});

test('the 404 page speaks the missing URL\'s language', async ({ page }) => {
  for (const [path, heading, link, home] of [
    ['/no-such-page.html', '404 - 页面未找到', '返回首页', '/'],
    ['/en/no-such-page.html', '404 - Page not found', 'Back to Home', '/en/'],
    ['/ja/no-such-page.html', '404 - ページが見つかりません', 'ホームに戻る', '/ja/'],
  ]) {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveText(heading);
    await expect(page.getByRole('link', { name: link, exact: true })).toHaveAttribute('href', home);
  }
});

test('Section ID Finder has Chinese, English and Japanese URLs', async ({ page }) => {
  await page.goto('/tools/id.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('#name')).toHaveAttribute('placeholder', '角色名');
  await bar(page).getByRole('button', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/tools\/id\.html$/);
  await expect(page.locator('#name')).toHaveAttribute('placeholder', 'Name');
  await page.locator('#name').fill('Haven');
  await expect(page.locator('#tf1')).toHaveText('Bluefull');
  await bar(page).getByRole('button', { name: '日本語', exact: true }).click();
  await expect(page).toHaveURL(/\/ja\/tools\/id\.html$/);
  await expect(page.locator('#name')).toHaveAttribute('placeholder', 'キャラクター名');
  await expect(page.locator('#tf1')).toHaveText('該当なし');
  await page.locator('#name').fill('Haven');
  await expect(page.locator('#tf1')).toHaveText('Bluefull');
  await page.getByRole('button', { name: 'DC/PC/GC/XB' }).click();
  await expect(page.locator('#tf0')).toHaveText('Yellowboze');
  await page.locator('#name').fill('あ');
  await expect(page.locator('#tf0')).toHaveText('該当なし');
  await page.locator('#name').fill('12345678901');
  await expect(page.locator('#tf1')).toHaveText('該当なし');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});

for (const width of [390, 1280]) {
  test(`language bar fits without horizontal scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/event/event.html');
    await bar(page).getByRole('button', { name: '日本語', exact: true }).click();
    await expect(page).toHaveURL(/\/ja\/event\/event\.html$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

for (const language of ['zh', 'en', 'ja']) {
  for (const mode of ['cc', 'ccopm']) {
    const prefix = language === 'zh' ? '' : '/' + language;
    test(mode + ' renders and calculates in ' + language, async ({ page, request }) => {
      const path = prefix + '/tools/' + mode + '.html';
      const html = await (await request.get(path)).text();
      const attack = { zh: '普通攻击', en: 'Normal', ja: '通常攻撃' }[language];
      expect(html).toContain(attack);
      expect(html).toContain('hreflang="ja"');
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', language === 'zh' ? 'zh-CN' : language);
      await expect(page.locator('#attack1 option:checked')).toHaveText(attack);
      await page.locator('.weapon-picker').selectOption('Dark Flow');
      await expect(page.locator('#attack1')).toHaveValue('SPECIAL');
      await page.locator('#native-btn').click();
      await expect(page.locator('#combo-calc-table tbody tr').first()).toBeVisible();
      await expect(page.locator('#combo-calc-table')).not.toContainText(/NaN|undefined/);
      await expect(page.locator('.combo-toolbar a')).toHaveAttribute('href', prefix + '/tools/' + (mode === 'cc' ? 'ccopm' : 'cc') + '.html');
      await page.locator('.enemy-chips button').first().click();
      await page.locator('#clear-btn').click();
      await expect(page.locator('#combo-calc-table tbody tr')).toHaveCount(0);
      await page.reload();
      await expect(page.locator('#attack1 option:checked')).toHaveText(attack);
      expect(errors).toEqual([]);
    });
  }
}
