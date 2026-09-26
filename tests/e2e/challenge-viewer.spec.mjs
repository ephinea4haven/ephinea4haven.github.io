import { test, expect } from '@playwright/test';

for (const episode of [1, 2]) {
  for (const width of [390, 1440]) {
    test(`EP${episode} map captions span their figure at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/guide/ep${episode}ch.html`);
      const misaligned = await page.locator('.challenge-map').evaluateAll(figures => figures.flatMap(figure => {
        const caption = figure.querySelector('figcaption');
        const button = caption.querySelector('[data-map-open]');
        const box = figure.getBoundingClientRect();
        const heading = caption.getBoundingClientRect();
        const action = button.getBoundingClientRect();
        const style = getComputedStyle(caption);
        const border = parseFloat(getComputedStyle(figure).borderRightWidth);
        const expectedRight = box.right - border - parseFloat(style.paddingRight);
        return Math.abs(heading.width - figure.clientWidth) > 1 || Math.abs(action.right - expectedRight) > 1
          ? [{ id: figure.id, figure: figure.clientWidth, caption: heading.width, rightError: action.right - expectedRight }]
          : [];
      }));
      expect(misaligned).toEqual([]);
    });

    test(`EP${episode} viewer preserves its focal point and supports drag at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/guide/ep${episode}ch.html`);
      await page.locator('[data-map-open]').first().click();
      const dialog = page.getByRole('dialog');
      const canvas = dialog.locator('.challenge-viewer-canvas');
      const image = canvas.locator('img');
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      const zoomIn = dialog.locator('[data-map-zoom="in"]');
      await zoomIn.click();
      // Start away from clamped edges so both axes can preserve their anchor.
      await canvas.evaluate(element => {
        element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
        element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
      });
      const center = () => canvas.evaluate(element => {
        const viewport = element.getBoundingClientRect();
        const map = element.querySelector('img').getBoundingClientRect();
        return { x: (viewport.left + element.clientWidth / 2 - map.left) / map.width,
          y: (viewport.top + element.clientHeight / 2 - map.top) / map.height };
      });
      const before = await center();
      await zoomIn.click();
      const after = await center();
      expect(Math.abs(after.x - before.x)).toBeLessThan(0.05);
      expect(Math.abs(after.y - before.y)).toBeLessThan(0.05);
      await dialog.locator('[data-map-zoom="out"]').click();
      const smaller = await center();
      expect(Math.abs(smaller.x - after.x)).toBeLessThan(0.05);
      expect(Math.abs(smaller.y - after.y)).toBeLessThan(0.05);
      const scrollBefore = await canvas.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }));
      const box = await canvas.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 80, y - 100, { steps: 8 });
      await page.mouse.up();
      const scrollAfter = await canvas.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }));
      expect(scrollAfter.x - scrollBefore.x).toBeCloseTo(80, 0);
      expect(scrollAfter.y - scrollBefore.y).toBeCloseTo(100, 0);
      // Releasing the pointer ends panning; subsequent hovering must not scroll.
      await page.mouse.move(x, y);
      expect(await canvas.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }))).toEqual(scrollAfter);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    });
  }
}

test('Seabed route maps are localized vector maps that open in the shared viewer', async ({ page }) => {
  for (const [prefix, language, open] of [['', 'zh', '放大地图 ↗'], ['/en', 'en', 'Expand map ↗'], ['/ja', 'ja', 'マップを拡大 ↗']]) {
    await page.goto(`${prefix}/guide/seabed.html#maps`);
    const card = page.locator('.map-card').nth(3);
    await expect(card.locator('img')).toHaveAttribute('src', `/assets/img/guide/seabed/maps/${language}/SU-2-2.svg`);
    await card.getByRole('button', { name: open, exact: true }).click();
    const viewer = page.locator('.challenge-viewer');
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('.challenge-viewer-canvas img')).toHaveAttribute('src', new RegExp(`/maps/${language}/SU-2-2\\.svg$`));
    await expect.poll(() => viewer.locator('.challenge-viewer-canvas img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(card.getByRole('button', { name: open, exact: true })).toBeFocused();
  }
});
