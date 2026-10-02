import { test, expect } from '@playwright/test';

const widths = [320, 390, 600, 601, 700, 860, 861, 1280];
const languages = ['zh', 'en', 'ja'];
const targets = ['rbr', 'live', 'start', 'directory'];
const home = (language) => language === 'zh' ? '/' : `/${language}/`;
const navigationLink = (page, id) => page.locator(`.topbar-links a[href$="#${id}"]`);

async function expectNoPageOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const regions = await page.evaluate(() => ['.topbar', '.topbar-inner', '.topbar-links', '.home-language'].map((selector) => {
    const node = document.querySelector(selector);
    const rect = node.getBoundingClientRect();
    return { selector, left: rect.left, right: rect.right, viewport: innerWidth };
  }));
  for (const { selector, left, right, viewport } of regions) {
    expect(left, `${selector} left edge`).toBeGreaterThanOrEqual(-1);
    expect(right, `${selector} right edge`).toBeLessThanOrEqual(viewport + 1);
  }
}

async function expectTargetBelowHeader(page, id) {
  const title = id === 'live' ? page.locator('#live .info-bar-head') : page.locator(`#${id} h2`).first();
  await expect(title).toBeVisible();
  await expect.poll(() => title.evaluate((node) => {
    const title = node.getBoundingClientRect();
    const header = document.querySelector('.topbar').getBoundingClientRect();
    return { clearOfHeader: title.top >= header.bottom - 1, insideViewport: title.bottom <= innerHeight + 1 };
  })).toEqual({ clearOfHeader: true, insideViewport: true });
}

async function expectFullyReachable(control) {
  await expect(control).toBeVisible();
  // Permit a scrolling navigation row, but the focused control itself must be usable.
  await expect.poll(() => control.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const navigation = node.closest('.topbar-links')?.getBoundingClientRect();
    const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return rect.left >= (navigation?.left ?? 0) - 1
      && rect.right <= (navigation?.right ?? innerWidth) + 1 && rect.top >= -1
      && rect.bottom <= innerHeight + 1 && (center === node || node.contains(center));
  })).toBe(true);
}

for (const language of languages) {
  for (const width of widths) {
    test(`homepage ${language} navigation and anchor targets work at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // Direct hash entries must also account for the sticky header after hydration.
      await page.goto(`${home(language)}#directory`);
      await expect(page.locator('#swatchTime')).toHaveText(/^@\d{3}\.\d{2}$/);
      await page.evaluate(() => document.fonts.ready);
      await expectTargetBelowHeader(page, 'directory');
      await expect(page.locator('.topbar-links a')).toHaveCount(4);
      await expectNoPageOverflow(page);

      for (const controlLanguage of languages) {
        const control = page.locator(`.home-language button[data-home-lang="${controlLanguage}"]`);
        await expect(control).toBeEnabled();
        await expectFullyReachable(control);
      }

      for (const id of targets) {
        const link = navigationLink(page, id);
        await expect(link).toBeVisible();
        await link.click();
        await expect.poll(() => new URL(page.url()).hash).toBe(`#${id}`);
        await expectTargetBelowHeader(page, id);
        await expectNoPageOverflow(page);
      }

      // Tab moves through the native anchors and scrolls a narrow row as needed.
      await navigationLink(page, targets[0]).focus();
      for (const id of targets.slice(1)) {
        await page.keyboard.press('Tab');
        await expect(navigationLink(page, id)).toBeFocused();
        await expectFullyReachable(navigationLink(page, id));
      }
      await page.keyboard.press('Enter');
      await expect.poll(() => new URL(page.url()).hash).toBe('#directory');
      await expectTargetBelowHeader(page, 'directory');
      await expectNoPageOverflow(page);
      if (language === 'ja' && width === 320) {
        const longLink = page.locator('.tag-links a[href="/ja/data/bdp/"]');
        await expect(longLink).toHaveText('ブラックペーパーズディールのドロップ');
        expect(await longLink.evaluate((node) => {
          const link = node.getBoundingClientRect();
          const text = document.createRange();
          text.selectNodeContents(node);
          return node.scrollWidth <= node.clientWidth + 1 && [...text.getClientRects()].every((rect) =>
            rect.left >= link.left - 1 && rect.right <= link.right + 1
            && rect.top >= link.top - 1 && rect.bottom <= link.bottom + 1);
        })).toBe(true);
      }
    });
  }
}

for (const language of ['en', 'ja']) {
  test(`homepage ${language} keeps focused navigation reachable across viewport resizing`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(home(language));
    await expect(page.locator('#swatchTime')).toHaveText(/^@\d{3}\.\d{2}$/);
    await page.evaluate(() => document.fonts.ready);
    const focusedLink = navigationLink(page, 'start');
    await focusedLink.focus();
    await expectFullyReachable(focusedLink);

    for (const width of [861, 860, 700, 600, 390, 320, 1280]) {
      await test.step(`focused link remains usable at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await expect(focusedLink).toBeFocused();
        await expectFullyReachable(focusedLink);
        await expectNoPageOverflow(page);
      });
    }
    await page.keyboard.press('Enter');
    await expect.poll(() => new URL(page.url()).hash).toBe('#start');
    await expectTargetBelowHeader(page, 'start');
  });
}

test.describe('native homepage navigation without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  for (const language of languages) {
    test(`${language} anchors and direct hash entry work without JavaScript`, async ({ page }) => {
      await page.goto(`${home(language)}#live`);
      await page.evaluate(() => document.fonts.ready);
      await expectTargetBelowHeader(page, 'live');
      for (const id of targets) {
        await navigationLink(page, id).click();
        await expect.poll(() => new URL(page.url()).hash).toBe(`#${id}`);
        await expectTargetBelowHeader(page, id);
        await expectNoPageOverflow(page);
      }
    });
  }
});
