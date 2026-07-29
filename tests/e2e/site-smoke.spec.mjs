import { expect, test } from '@playwright/test';

const pages = [
  {
    name: 'landing page',
    path: '/',
    title: /Haven.*PSOBB/,
    heading: 'Haven PSOBB',
  },
  {
    name: 'status simulator',
    path: '/tools/status.html',
    title: /角色属性模拟器/,
    heading: '角色属性模拟器',
    resourcePath: '/assets/js/chardata.json',
    readySelector: '#class option',
    minimumReadyCount: 2,
  },
  {
    name: 'character table',
    path: '/tools/chartable.html',
    title: /全等级人物能力表/,
    heading: '全等级人物能力表',
    resourcePath: '/assets/js/chardata.json',
    readySelector: '#humar tbody tr',
    minimumReadyCount: 1,
  },
  {
    name: 'mag chart',
    path: '/tools/mag.html',
    title: /玛古进化图谱/,
    heading: '玛古进化图谱',
  },
  {
    name: 'mag simulator',
    path: '/tools/mag-sim.html',
    title: /玛古模拟器/,
    heading: '玛古模拟器',
  },
  {
    name: 'event archive',
    path: '/event/christmas.html?year=2025',
    title: /2025圣诞活动/,
    heading: 'CHRISTMAS 2025',
    resourcePath: '/event/christmas/2025.html',
    readySelector: '#content',
    readyText: '2025',
  },
  {
    name: 'price guide',
    path: '/data/price_guide.html',
    title: /物品价格参考/,
    heading: '物品价格参考',
    resourcePath: '/assets/js/i18n/i18n_names.json',
    readySelector: '#price-content .price-section',
    minimumReadyCount: 1,
  },
  {
    name: 'drop table',
    path: '/data/droptable/bb/index.html?lang=zh&diff=Ultimate',
    title: /Ephinea PSOBB 掉落表/,
    heading: 'Ephinea PSOBB 掉落表',
  },
  {
    name: '404 page',
    path: '/this-page-does-not-exist',
    title: /页面未找到/,
    heading: '404 - 页面未找到',
    status: 404,
  },
];

for (const pageCase of pages) {
  test(`${pageCase.name} loads the production artifact cleanly`, async ({ page }) => {
    const runtimeErrors = [];
    const failedResources = [];

    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        if (pageCase.status === 404
            && message.text().includes('status of 404 (Not Found)')) {
          return;
        }
        runtimeErrors.push(message.text());
      }
    });
    page.on('response', (response) => {
      if (response.url().startsWith('http://127.0.0.1:4173')
          && response.status() >= 400
          && !(response.request().isNavigationRequest()
            && response.status() === (pageCase.status || 200))) {
        failedResources.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', (request) => {
      if (request.url().startsWith('http://127.0.0.1:4173')) {
        failedResources.push(
          `${request.failure()?.errorText || 'request failed'} ${request.url()}`,
        );
      }
    });

    const resourceResponse = pageCase.resourcePath
      ? page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.origin === 'http://127.0.0.1:4173'
          && url.pathname === pageCase.resourcePath;
      })
      : null;
    const navigationResponse = await page.goto(pageCase.path, { waitUntil: 'load' });
    expect(navigationResponse?.status()).toBe(pageCase.status || 200);
    await expect(page).toHaveTitle(pageCase.title);
    await expect(
      page.getByRole('heading', { name: pageCase.heading, exact: true }),
    ).toBeVisible();

    if (resourceResponse) {
      expect((await resourceResponse).ok()).toBe(true);
    }
    if (pageCase.minimumReadyCount) {
      await expect.poll(
        () => page.locator(pageCase.readySelector).count(),
      ).toBeGreaterThanOrEqual(pageCase.minimumReadyCount);
    }
    if (pageCase.readyText) {
      await expect(page.locator(pageCase.readySelector)).toContainText(pageCase.readyText);
    }

    expect(failedResources).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}
