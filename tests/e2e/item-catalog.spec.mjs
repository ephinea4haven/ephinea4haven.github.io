import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const items = JSON.parse(readFileSync('src/app/item-catalog/catalog.json', 'utf8'));
const names = JSON.parse(readFileSync(process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json', 'utf8')).items;

test('catalog publishes every sample as an independent localized page', () => {
  expect(new Set(items.map((item) => item.id)).size).toBe(12);
  for (const item of items) {
    const html = readFileSync(`_site/data/items/${item.id}.html`, 'utf8');
    expect(html).toContain(names[item.en].zh);
    expect(html).toContain(item.code);
    expect(html).toContain(item.source);
    if (item.image) expect(readFileSync(`.${item.image}`).subarray(0, 3).toString()).toBe('GIF');
  }
});

test('search accepts canonical Chinese, English and Japanese names', async ({ page }) => {
  await page.goto('/data/items.html');
  const input = page.getByRole('searchbox');
  for (const query of ['红色光剑', 'red saber', '赤のセイバー']) {
    await input.fill(query);
    await expect(page.locator('.item-row')).toHaveCount(1);
    await expect(page.locator('.item-row')).toContainText('Red Saber');
  }
  await page.reload();
  await expect(input).toHaveValue('赤のセイバー');
  await expect(page.locator('.item-row')).toHaveCount(1);
});

test('class and rarity filters compose; ATP sort uses base upper bound', async ({ page }) => {
  await page.goto('/data/items.html?category=weapon');
  await page.getByLabel('可装备职业', { exact: true }).selectOption('FOnewearl');
  await page.getByLabel('星级', { exact: true }).selectOption('10');
  await expect(page.locator('.item-row')).toHaveCount(2);
  await page.getByLabel('排序', { exact: true }).selectOption('atp');
  await expect(page.locator('.item-row').first()).toContainText('Red Saber');
  await expect(page.locator('.item-row').last()).toContainText('Elysion');
  await expect(page.locator('.item-list')).not.toContainText('Ancient Saber');
});

test('pagination and detail navigation restore the list query', async ({ page }) => {
  await page.goto('/data/items.html');
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.locator('.item-row')).toHaveCount(4);
  await page.locator('.item-row').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('波动护甲');
  await page.getByRole('link', { name: '← 返回道具列表', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.item-row').first()).toContainText('Guard Wave');
});

test('details distinguish base and grinded ATP, class limits, and absent screenshots', async ({ page }) => {
  await page.goto('/data/items/saber.html');
  await expect(page.locator('.attribute-grid')).toContainText('40–55');
  await expect(page.locator('.attribute-grid')).toContainText('110–125');
  await expect(page.locator('.attribute-grid')).toContainText('随机');
  await expect(page.locator('.image-stage')).toContainText('暂无截图');
  await page.goto('/data/items/lavis-cannon.html');
  await expect(page.locator('.class-grid .allowed')).toHaveCount(4);
  await expect(page.locator('.image-stage img')).toBeVisible();
});

test('empty results recover, malformed pagination is bounded', async ({ page }) => {
  await page.goto('/data/items.html?q=not-a-real-item&page=Infinity');
  await expect(page.getByRole('heading', { name: '没有找到匹配的道具' })).toBeVisible();
  await page.getByRole('button', { name: '清除全部条件' }).click();
  await expect(page.locator('.item-row')).toHaveCount(8);
  await page.goto('/data/items.html?page=9999');
  await expect(page.locator('.item-row')).toHaveCount(4);
});

for (const width of [390, 820, 1280]) {
  test(`catalog and detail are accessible without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/data/items.html', '/data/items/lavis-cannon.html']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    }
  });
}

test('mobile filters and image-only browsing work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/data/items.html');
  await expect(page.locator('#catalog-filters')).toBeHidden();
  await page.getByRole('button', { name: '筛选条件' }).click();
  await page.getByLabel('只看有截图的道具').check();
  await expect(page.locator('.item-row')).toHaveCount(7);
  expect(await page.locator('.item-row img').evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
});

test('detail section deep links and related-item navigation update scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/data/items/lavis-cannon.html#effects');
  await expect.poll(() => page.locator('#effects').evaluate((node) => Math.abs(node.getBoundingClientRect().top))).toBeLessThan(50);
  await page.locator('.related-items a').last().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('红色光剑');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});
