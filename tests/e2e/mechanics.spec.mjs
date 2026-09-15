import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';

test('mechanics authored item references use exact authority keys', () => {
  const authority = JSON.parse(readFileSync(
    process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json', 'utf8',
  )).items;
  const document = parse(readFileSync('tools/mechanics.html', 'utf8'));
  const names = [];
  function visit(node) {
    const name = node.attrs?.find((attribute) => attribute.name === 'data-item-en')?.value;
    if (name) names.push(name);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(document);
  expect(names.length).toBeGreaterThan(0);
  expect(names.filter((name) => !Object.hasOwn(authority, name))).toEqual([]);
});

test('mechanics diagrams remain readable and keyboard accessible', async ({ page }) => {
  await page.goto('/tools/mechanics.html#incoming-physical');
  const diagrams = page.locator('.mechanics-flow, .mechanics-outcome, .mechanics-threshold, .mechanics-figure, .mechanics-pb-card');
  await expect(diagrams).toHaveCount(18);
  for (const width of [320, 390, 760, 761, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await diagrams.evaluateAll((figures) => figures.filter((figure) => {
      const bounds = figure.getBoundingClientRect();
      return bounds.left < 0 || bounds.right > window.innerWidth
        || figure.scrollWidth > figure.clientWidth + 1;
    }).map((figure) => figure.textContent));
    expect(overflow, `Diagram overflow at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `Page overflow at ${width}px`)
      .toBeLessThanOrEqual(width);
  }

  const navigation = page.getByRole('navigation', { name: '机制章节导航' });
  for (const link of await navigation.getByRole('link').all()) {
    const target = new URL(await link.getAttribute('href'), page.url()).hash;
    await link.focus();
    await page.keyboard.press('Enter');
    expect(new URL(page.url()).hash).toBe(target);
    await expect(page.locator(target)).toBeInViewport();
  }

  for (const [id, name] of [
    ['pb-damage', '攻击型伤害'], ['pb-chain', '连锁与捐赠'],
    ['pb-support', '治疗与辅助'], ['pb-gain', 'PB 槽积累'],
  ]) {
    const link = page.getByRole('link', { name, exact: true });
    await link.focus();
    await page.keyboard.press('Enter');
    expect(new URL(page.url()).hash).toBe('#' + id);
    await expect(page.locator('#' + id)).toBeInViewport();
  }
  for (const icon of await page.locator('.mechanics-pb-card img').all()) {
    await icon.scrollIntoViewIfNeeded();
    await expect.poll(() => icon.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  }

  const jump = page.getByRole('link', { name: '何时会被击倒？ ↓', exact: true });
  await jump.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#knockdown$/);
  const source = page.locator('.mechanics-source-note');
  await source.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(source).toHaveAttribute('open', '');
  await expect(source).toContainText('尚未验证当前线上运行时是否有额外修改');

  const results = await new AxeBuilder({ page })
    .include('.mechanics-nav')
    .include('.mechanics-figure')
    .include('.mechanics-pb-grid')
    .include('.mechanics-flow')
    .include('.mechanics-outcomes')
    .include('.mechanics-threshold')
    .include('.mechanics-source-note')
    .include('.mechanics-table-scroll')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })))
    .toEqual([]);
});
