import { test, expect } from '@playwright/test';

for (const prefix of ['', '/en', '/ja']) {
  test(`RBR Section IDs pair names with icons in ${prefix || 'zh'}`, async ({page}) => {
    if (prefix === '/ja') await page.setViewportSize({width:390,height:850});
    await page.goto(`${prefix}/guide/rbr.html#rbr-quest-MU1`);
    const badges = page.locator('.rbr-section-id');
    expect(await badges.count()).toBeGreaterThan(60);
    await expect.poll(() => badges.evaluateAll(elements => elements.every(element => {
      const image = element.querySelector('img');
      return image?.complete && image.naturalWidth > 0
        && image.getAttribute('src') === `/assets/img/section/icon/${element.textContent}.png`
        && image.alt === '';
    }))).toBe(true);
    const row = page.locator('tr:has(#rbr-quest-MU1)');
    await expect(row.locator('.rbr-section-id')).toHaveText(['Whitill', 'Viridia']);
    await expect(row).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await row.screenshot({path:`test-results/rbr-icons-${prefix.slice(1) || 'zh'}.png`});
    const chart = page.locator('#rbr-tier-chart');
    await chart.scrollIntoViewIfNeeded();
    await expect.poll(() => chart.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    if (!prefix) await chart.screenshot({path:'test-results/rbr-chart-icons.png'});
    const charts = page.locator('.tier-figure img');
    const metrics = [];
    for (const image of await charts.all()) {
      const source = await (await page.request.get(await image.getAttribute('src'))).text();
      metrics.push(await image.evaluate((element, source) => {
        const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
        const label = svg.querySelectorAll('text')[1];
        const cell = label.previousElementSibling;
        const width = element.getBoundingClientRect().width;
        const scale = (width - 4) / Number(svg.documentElement.getAttribute('width'));
        return {
          width,
          cellWidth: Number(cell.getAttribute('width')) * scale,
          cellHeight: Number(cell.getAttribute('height')) * scale,
          fontSize: Number(label.getAttribute('font-size')) * scale,
        };
      }, source));
    }
    expect(metrics).toHaveLength(2);
    for (const key of Object.keys(metrics[0])) {
      expect(metrics[1][key], key).toBeCloseTo(metrics[0][key], 1);
    }
    if (!prefix) await charts.nth(1).screenshot({path:'test-results/non-rbr-chart.png'});
  });
}
