import { test, expect } from '@playwright/test';

const MASK = '/assets/img/mag/color-mask/Varuna.webp';

// Snapshot the <img> pixels in the page so later comparisons stay in-page.
function snapshot(image) {
  return image.evaluate((img) => {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    window.__magBefore = cx.getImageData(0, 0, cv.width, cv.height).data;
  });
}

function compareWithSnapshot(image, maskUrl) {
  return image.evaluate(async (img, url) => {
    const read = (source) => {
      const cv = document.createElement('canvas');
      cv.width = 900;
      cv.height = 900;
      const cx = cv.getContext('2d');
      cx.drawImage(source, 0, 0);
      return cx.getImageData(0, 0, 900, 900).data;
    };
    const mask = new Image();
    mask.src = url;
    await mask.decode();
    const m = read(mask);
    const before = window.__magBefore;
    const after = read(img);
    let tinted = 0;
    let fixed = 0;
    let fixedChanged = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (before[i + 3] < 250) continue;
      if (m[i] === 255 && before[i] > 60 && after[i] < before[i] * 0.3) tinted += 1;
      if (m[i] === 0) {
        fixed += 1;
        const drift = Math.max(
          Math.abs(before[i] - after[i]),
          Math.abs(before[i + 1] - after[i + 1]),
          Math.abs(before[i + 2] - after[i + 2]),
        );
        if (drift > 6) fixedChanged += 1; // lossy WebP re-encode tolerance
      }
    }
    return { tinted, fixed, fixedChanged };
  }, maskUrl);
}

test('Mag chart tints only the colour-node mask of the rendered default', async ({ page }) => {
  await page.goto('/tools/mag.html');
  const image = page.locator('.mag-card__sprite[data-mag="Varuna"]').first();
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBe(900);
  const defaultSource = await image.getAttribute('src');
  await snapshot(image);

  await page.locator('.mag-swatch[data-hex="#19FF19"]').first().click();
  await expect(image).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBe(900);
  const { tinted, fixed, fixedChanged } = await compareWithSnapshot(image, MASK);
  expect(tinted).toBeGreaterThan(500);
  expect(fixed).toBeGreaterThan(10000);
  expect(fixedChanged / fixed).toBeLessThan(0.01);

  await page.locator('.mag-swatch--reset').first().click();
  await expect(image).toHaveAttribute('src', defaultSource);
  await expect.poll(() => image.evaluate(img => img.naturalWidth)).toBe(900);
});
