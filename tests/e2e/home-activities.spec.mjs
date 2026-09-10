import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Asia/Shanghai' });

for (const [date, activeId] of [
  ['2026-09-10T12:00:00Z', null],
  ['2027-08-20T12:00:00Z', null],
  ['2026-10-25T12:00:00Z', null],
  ['2025-10-25T12:00:00Z', 'halloween-2025'],
  ['2026-01-01T12:00:00Z', 'christmas-2025'],
  ['2026-04-01T12:00:00Z', 'easter-2026'],
]) {
  test(`homepage event status uses registered yearly dates: ${date}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(date));
    await page.goto('/');
    await expect(page.locator('#swatchTime')).toHaveText(/^@\d{3}\.\d{2}$/);
    await expect(page.locator('[data-holiday].holiday-active')).toHaveCount(activeId ? 1 : 0);
    await expect(page.locator('[data-current-activity]:visible')).toHaveCount(activeId ? 1 : 0);
    if (activeId) {
      await expect(page.locator(`[data-holiday="${activeId}"]`)).toHaveClass(/holiday-active/);
      await expect(page.locator(`[data-current-activity="${activeId}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-holiday="anniversary-2026"]')).toBeVisible();
    await expect(page.locator('[data-holiday="anniversary-2026"]')).not.toHaveClass(/holiday-active/);
  });
}

test('homepage event links and panels update together at Pacific date boundaries without reload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-02-06T07:59:59Z'));
  await page.goto('/');
  const link = page.locator('[data-holiday="valentines-2026"]');
  const panel = page.locator('[data-current-activity="valentines-2026"]');
  await expect(page.locator('#swatchTime')).toHaveText(/^@\d{3}\.\d{2}$/);
  await expect(link).not.toHaveClass(/holiday-active/);
  await expect(panel).toBeHidden();

  for (const date of ['2026-02-06T08:00:00Z', '2026-02-21T07:59:59Z']) {
    await page.clock.setFixedTime(new Date(date));
    await expect(link).toHaveClass(/holiday-active/);
    await expect(panel).toBeVisible();
  }

  await page.clock.setFixedTime(new Date('2026-02-21T08:00:00Z'));
  await expect(link).not.toHaveClass(/holiday-active/);
  await expect(panel).toBeHidden();
});
