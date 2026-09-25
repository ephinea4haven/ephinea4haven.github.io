import { test, expect } from '@playwright/test';

for (const language of ['en', 'ja']) {
  test(`${language} archives fetch their own historical fragments and keep year links in that edition`, async ({ page }) => {
    for (const [event, year, target] of [
      ['anniversary', 2016, '#content'], ['christmas', 2015, '#content'],
      ['easter', 2016, '#yearContent'], ['halloween', 2017, '#yearContent'],
      ['valentines', 2016, '#yearContent'],
    ]) {
      const response = page.waitForResponse((entry) => entry.url().endsWith(`/${language}/event/${event}/${year}.html`));
      await page.goto(`/${language}/event/${event}.html?year=${year}`);
      expect((await response).ok()).toBe(true);
      await expect(page.locator('#yearNav [aria-current="page"]')).toHaveText(String(year));
      await expect(page.locator(target)).toContainText(String(year));
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      expect(await page.locator('#yearNav a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
        .toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(`^/${language}/event/${event}\\.html\\?year=`))]));
      if (language === 'en') expect(await page.locator(target).innerText()).not.toMatch(/\p{Script=Han}/u);
    }
  });

  test(`${language} archive failure and repeated shop replies stay in the selected language`, async ({ page }) => {
    await page.route(`**/${language}/event/easter/2016.html`, (route) => route.abort());
    await page.goto(`/${language}/event/easter.html?year=2016`);
    await expect(page.locator('#yearContent')).toHaveText(language === 'en'
      ? 'Could not load the 2016 easter event archive.' : '2016年のイースターイベントを読み込めませんでした。');
    await page.goto(`/${language}/event/anniversary.html?year=2025`);
    const option = page.locator('[data-quest-response^="Soul Eater"]');
    await expect(option).toBeVisible();
    await option.click();
    // SOUL EATER has no Japanese authority name, so both editions show it in English.
    const response = page.locator('.quest-menu-panel', { has: option }).locator('.quest-menu-response');
    await expect(response).toContainText(/soul eater/i);
    await page.locator('[data-quest-response^="Trigrinder"]').click();
    await option.click();
    await expect(response).toContainText(/soul eater/i);
    expect(await response.innerText()).not.toMatch(/铜牌|银牌|金牌|当前|奖品/);
  });
}
