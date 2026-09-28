import { expect, test } from '@playwright/test';

for (const route of ['/', '/en/', '/ja/']) {
  test(`${route} activates Angular's deferred production stylesheets`, async ({ page, request }) => {
    const response = await request.get(route);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toMatch(/data-beasties-media="all"/);

    await page.goto(route);
    const stylesheets = page.locator('head link[rel="stylesheet"][href^="/assets/angular/"]');
    await expect(stylesheets).toHaveCount(1);
    await expect(stylesheets).toHaveAttribute('media', 'all');
    await expect(stylesheets).not.toHaveAttribute('data-beasties-media');
    await expect.poll(() => stylesheets.evaluateAll((links) =>
      links.every((link) => link.sheet?.cssRules.length > 0),
    )).toBe(true);
  });
}
