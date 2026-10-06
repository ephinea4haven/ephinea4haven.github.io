import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const authority = JSON.parse(readFileSync(process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json', 'utf8')).items;

for (const prefix of ['', '/en', '/ja']) {
  test(`BB items ${prefix || '/zh'}: multilingual specials and section links`, async ({ page }) => {
    await page.goto(`${prefix}/data/bb_items.html`);
    const itemCells = await page.locator('td[data-item-en]').evaluateAll(cells => cells.map(cell => ({ name: cell.dataset.itemEn, text: cell.textContent })));
    expect(itemCells).toHaveLength(945);
    const language = prefix.slice(1) || 'zh';
    for (const { name, text } of itemCells) {
      expect(text.trim(), name).toBe(language === 'en' ? name : authority[name][language] || name);
    }
    await page.locator('#searchBox').fill('Saber');
    await expect(page.locator('#searchResults')).toContainText('000100');
    await page.locator('#searchBox').fill('');
    await page.locator('.toc a[href$="#s-rank-specials"]').click();
    await expect(page).toHaveURL(/#s-rank-specials$/);
    await page.reload();
    await expect(page.locator('#s-rank-specials')).toBeInViewport();
    const table = page.locator('#s-rank-specials + table');
    await expect(table.locator('tbody tr')).toHaveCount(16);
    await expect(table).toContainText('灵祭 / Spirit / スピリット');
    await expect(table).toContainText("王之 / King's / キング");
    await page.locator('#searchBox').fill('スピリット');
    await expect(page.locator('#searchResults')).toContainText('灵祭 / Spirit / スピリット');
    await page.locator('#searchBox').fill('');
    const ordinary = page.locator('#weapon-specials + table');
    await expect(ordinary).toContainText('金祭 / Charge / チャージ');
    const charge = ordinary.locator('tbody tr').filter({ hasText: '金祭 / Charge / チャージ' });
    await expect(charge.locator('td')).toHaveCount(3);
    await expect(charge.locator('td').nth(2)).toContainText(/200.*3\.33/);
    const demons = ordinary.locator('tbody tr').filter({ hasText: "恶魔 / Demon's / デーモン" });
    await expect(demons.locator('td').nth(2)).toContainText(/75%.*45%/);
    await page.locator('#searchBox').fill('强麻痹');
    await expect(page.locator('#searchResults tbody tr')).toHaveCount(1);
    await expect(page.locator('#searchResults tbody tr')).toHaveText('15强麻痹 / Seize / シーズ');
    await page.locator('#searchBox').fill('');
    await page.locator('#armor-slots a').click();
    await expect(page).toHaveURL(/#armor-slots$/);
    await expect(page.locator('#armor-slots')).toBeInViewport();
  });
}
