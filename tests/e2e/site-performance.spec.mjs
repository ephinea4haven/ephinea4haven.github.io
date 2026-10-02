import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const budgets = JSON.parse(readFileSync(new URL('../../performance-budgets.json', import.meta.url), 'utf8'));
const home = (language) => language === 'zh' ? '/' : `/${language}/`;

// Use complete resource URLs, not initiatorType: modulepreload is often "other"
// and lazy Angular route modules are part of the real initial page load too.
async function resourceSnapshot(page) {
  return page.evaluate(() => performance.getEntriesByType('navigation')
    .concat(performance.getEntriesByType('resource')).map((entry) => ({
      path: new URL(entry.name).pathname,
      origin: new URL(entry.name).origin,
      type: entry.initiatorType,
      bytes: entry.decodedBodySize,
      encodedBytes: entry.encodedBodySize,
    })));
}

const screens = [
  { width: 390, height: 844, deviceScaleFactor: 1 },
  { width: 390, height: 844, deviceScaleFactor: 2 },
  { width: 1440, height: 1000, deviceScaleFactor: 1 },
  { width: 1440, height: 1000, deviceScaleFactor: 2 },
  { width: 860, height: 900, deviceScaleFactor: 1 },
  { width: 861, height: 900, deviceScaleFactor: 1 },
];

for (const language of ['zh', 'en', 'ja']) {
  for (const { width, height, deviceScaleFactor } of screens) {
    test(`cold homepage ${language} stays within resource budgets at ${width}px DPR${deviceScaleFactor}`, async ({ browser, baseURL }, testInfo) => {
      const context = await browser.newContext({
        baseURL, viewport: { width, height }, deviceScaleFactor, reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        const failures = [];
        page.on('requestfailed', (request) => failures.push(request.url()));
        page.on('response', (response) => {
          if (!response.ok()) failures.push(`${response.status()} ${response.url()}`);
        });
        await page.goto(home(language));
        await expect(page.locator('#swatchTime')).toHaveText(/^@\d{3}\.\d{2}$/);
        await page.evaluate(() => document.fonts.ready);
        // Once hydration, fonts and background downloads are done, collect the
        // cold page's actual requests. No hardware-dependent timing threshold.
        await page.waitForLoadState('networkidle');
        const resources = await resourceSnapshot(page);
        const variant = width <= 860 ? 'mobile' : 'desktop';
        const background = resources.filter(({ path }) => path.startsWith('/assets/img/bg/'));
        const javascriptBytes = resources.filter(({ path }) => path.endsWith('.js'))
          .reduce((sum, entry) => sum + entry.bytes, 0);
        const totalBodyBytes = resources.reduce((sum, entry) => sum + entry.bytes, 0);
        const inventory = testInfo.outputPath('resource-budget.json');
        writeFileSync(inventory, JSON.stringify({ language, width, deviceScaleFactor, javascriptBytes, totalBodyBytes, resources }, null, 2));
        await testInfo.attach('resource-budget.json', { path: inventory, contentType: 'application/json' });
        expect(failures).toEqual([]);
        expect(resources.every(({ origin }) => origin === new URL(baseURL).origin)).toBe(true);
        expect(background.map(({ path }) => path)).toEqual([`/assets/img/bg/lobby-overlook-${variant}.webp`]);
        expect(background[0].bytes).toBeGreaterThan(0);
        expect(background[0].bytes).toBeLessThanOrEqual(budgets.home[variant].maxBackgroundBytes);
        expect(resources.filter(({ path }) => path.startsWith('/assets/search/'))).toEqual([]);
        expect(javascriptBytes).toBeGreaterThan(0);
        expect(javascriptBytes).toBeLessThanOrEqual(budgets.home.maxJavaScriptBytes);
        expect(totalBodyBytes).toBeLessThanOrEqual(budgets.home[variant].maxTotalBodyBytes);
        expect(resources).toHaveLength(new Set(resources.map(({ path }) => path)).size);
        expect(resources.length).toBeLessThanOrEqual(budgets.home.maxRequests);
      } finally {
        await context.close();
      }
    });
  }
}
