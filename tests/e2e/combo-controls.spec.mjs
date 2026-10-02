import { test, expect } from '@playwright/test';

for (const language of ['', '/en', '/ja']) {
  for (const mode of ['cc', 'ccopm']) {
    for (const width of [320, 390, 1440]) {
      test(`Combo options stay compact and clickable: ${language || 'zh'} ${mode} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${language}/tools/${mode}.html`);
        await page.evaluate(() => document.fonts.ready);

        // Checkbox labels must size to their contents, not stretch to a form-grid cell.
        const options = page.locator('#commanderBlade, #smartlinkInput');
        await expect(options).toHaveCount(2);
        const dimensions = await options.evaluateAll((inputs) => inputs.map((input) => {
          const label = input.closest('label');
          const text = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          const range = document.createRange();
          range.selectNodeContents(text);
          return {
            input: input.getBoundingClientRect().toJSON(),
            label: label.getBoundingClientRect().toJSON(),
            text: range.getBoundingClientRect().toJSON(),
            gap: parseFloat(getComputedStyle(label).columnGap),
          };
        }));
        for (const { input, label, text, gap } of dimensions) {
          expect(input.width).toBe(18);
          expect(input.height).toBe(18);
          expect(label.width).toBeLessThanOrEqual(input.width + text.width + gap + 1);
          expect(label.height).toBeLessThanOrEqual(40);
          expect(label.right).toBeLessThanOrEqual(width);
        }

        const commander = page.locator('#commanderBlade');
        const smartlink = page.locator('#smartlinkInput');
        const originalAta = Number(await page.locator('#ataInput').inputValue());
        await commander.locator('..').click();
        await expect(commander).toBeChecked();
        await expect(page.locator('#ataInput')).toHaveValue(String(originalAta + 20));
        await smartlink.focus();
        await smartlink.press('Space');
        await expect(smartlink).not.toBeChecked();
        await page.reload();
        await expect(commander).toBeChecked();
        await expect(smartlink).not.toBeChecked();
      });
    }
  }
}
