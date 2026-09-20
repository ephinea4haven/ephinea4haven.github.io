import { test, expect } from '@playwright/test';

test('Mag chart displays rendered defaults and restores them after colour preview', async ({ page }) => {
  await page.goto('/tools/mag.html');
  const image = page.locator('.mag-card__sprite[data-mag="Mag"]').first();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBe(900);
  const defaultSource = await image.getAttribute('src');

  await page.locator('.mag-swatch[data-hex]:not([data-hex=""])').first().click();
  await expect(image).toHaveAttribute('src', /^data:image\/png/);
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBe(64);

  await page.locator('.mag-swatch--reset').first().click();
  await expect(image).toHaveAttribute('src', defaultSource);
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBe(900);
});
