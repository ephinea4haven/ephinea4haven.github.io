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
    jqueryVersion: '4.0.0+slim',
  },
  {
    name: 'character table',
    path: '/tools/chartable.html',
    title: /全等级人物能力表/,
    heading: '全等级人物能力表',
    resourcePath: '/assets/js/chardata.json',
    readySelector: '#humar tbody tr',
    minimumReadyCount: 1,
    jqueryVersion: '4.0.0+slim',
  },
  {
    name: 'mag chart',
    path: '/tools/mag.html',
    title: /玛古进化图谱/,
    heading: '玛古进化图谱',
  },
  {
    name: 'multiplayer combo calculator',
    path: '/tools/cc.html',
    title: /Combo Calculator - PSOStats/,
    heading: 'Combo Calculator Multiplayer',
    resourcePath: '/assets/js/combo_calc.js',
    readySelector: '#app .multiselect',
    minimumReadyCount: 1,
  },
  {
    name: 'OPM combo calculator',
    path: '/tools/ccopm.html',
    title: /Combo Calculator - PSOStats/,
    heading: 'Combo Calculator OPM',
    resourcePath: '/assets/js/combo_calc.js',
    readySelector: '#enemy-select-vue .multiselect',
    minimumReadyCount: 1,
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
    name: 'NPC guide',
    path: '/guide/npc.html',
    title: /NPC 人物志/,
    heading: 'NPC 人物志',
    readySelector: '.npc-card',
    minimumReadyCount: 25,
  },
  {
    name: 'banner guide',
    path: '/guide/banners.html',
    title: /Banner 顶部公告/,
    heading: 'Banner 顶部公告',
    readySelector: 'main table tbody tr',
    minimumReadyCount: 19,
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

    if (pageCase.path === '/') {
      await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
        contentType: 'text/css',
        body: '/* Google Fonts is external; keep the production smoke test deterministic. */',
      }));
    }

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
    if (pageCase.jqueryVersion) {
      await expect.poll(() => page.evaluate(() => window.jQuery?.fn.jquery.split(' ')[0]))
        .toBe(pageCase.jqueryVersion);
      await expect.poll(() => page.evaluate(() => typeof window.jQuery?.ajax))
        .toBe('undefined');
    }

    expect(failedResources).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}

test('NPC guide keeps card and relationship names bilingual', async ({ page }) => {
  await page.goto('/guide/npc.html');

  const bilingualName = /[\u3400-\u9fff].*（[^）]*[A-Za-z][^）]*）/;
  const cardNames = await page.locator('.npc-name').evaluateAll((elements) => (
    elements.map((element) => element.firstChild?.textContent.trim() || '')
  ));
  expect(cardNames).toHaveLength(25);
  for (const name of cardNames) expect(name).toMatch(bilingualName);
  expect(cardNames).toContain('暗黑佛 / 黑暗法尔兹（Dark Falz）');

  const graphNames = await page.locator('.rel-svg .node:not(.muted) > text.label')
    .evaluateAll((elements) => elements.map((element) => ({
      name: element.textContent.trim(),
      lines: element.querySelectorAll('tspan').length,
      english: element.querySelector('.label-en')?.textContent.trim() || '',
    })));
  expect(graphNames).toHaveLength(25);
  for (const { name, lines, english } of graphNames) {
    expect(name).toMatch(bilingualName);
    expect(lines).toBe(2);
    expect(english).toMatch(/^（.*[A-Za-z].*）$/);
  }
  expect(graphNames.map(({ name }) => name))
    .toContain('暗黑佛 / 黑暗法尔兹（Dark Falz）');
});

for (const calculatorPath of ['/tools/cc.html', '/tools/ccopm.html']) {
  test(`${calculatorPath} exercises calculator controls and enemy groups`, async ({ page }) => {
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        runtimeErrors.push(message.text());
      }
    });

    await page.goto(calculatorPath);
    await expect.poll(
      () => page.evaluate(() => window.jQuery?.fn.jquery.split(' ')[0]),
    ).toBe('4.0.0+slim');
    await expect.poll(() => page.evaluate(() => typeof window.jQuery?.ajax)).toBe('undefined');
    const tableRows = page.locator('#combo-calc-table tbody tr');

    for (const enemyButton of ['#native-btn', '#abeast-btn', '#machine-btn', '#dark-btn']) {
      await page.locator('#clear-btn').click();
      await expect(tableRows).toHaveCount(0);
      await page.locator(enemyButton).click();
      await expect.poll(() => tableRows.count()).toBeGreaterThan(0);
      await expect(tableRows.first()).toContainText(/\d/);
    }

    await page.locator('#clear-btn').click();
    await page.locator('#native-btn').click();
    await expect.poll(() => tableRows.count()).toBeGreaterThan(5);

    const initialClassAtp = await page.locator('#classMinAtpInput').inputValue();
    await page.locator('#class-select').selectOption('RAmarl');
    await expect(page.locator('#classMinAtpInput')).not.toHaveValue(initialClassAtp);

    const damageBeforeShifta = await tableRows.first().innerText();
    await page.locator('#shiftaInput').fill('30');
    await page.locator('#shiftaInput').press('Tab');
    await expect.poll(() => tableRows.first().innerText()).not.toBe(damageBeforeShifta);

    await page.locator('#damage-header').click();
    await expect(page.locator('#damage-header')).toContainText('▲');
    await page.locator('#damage-header').click();
    await expect(page.locator('#damage-header')).toContainText('▼');
    await page.locator('#damage-header').click();
    await expect(page.locator('#damage-header')).toHaveText('Damage');

    await page.locator('#clear-btn').click();
    await expect(tableRows).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
  });
}

test('status simulator handles shared-jQuery inputs and resets', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/tools/status.html');
  await expect.poll(() => page.locator('#class option').count()).toBeGreaterThan(2);
  await page.locator('#class').selectOption('ramarl');
  await page.locator('#lv').selectOption('100');

  await page.locator('#magPow').fill('5');
  await page.locator('#magPow').press('0');
  await expect(page.locator('#output')).toContainText(/5\/50\/0\/0/);
  await page.locator('#magReset').click();
  await expect(page.locator('#magDef')).toHaveValue('5');
  await expect(page.locator('#magPow')).toHaveValue('0');
  await expect(page.locator('#output')).toContainText(/5\/0\/0\/0/);

  await page.locator('#matPow').fill('2');
  await page.locator('#matPow').press('0');
  await expect(page.locator('#matPow')).toHaveValue('20');
  await page.locator('#matReset').click();
  await expect(page.locator('#matPow')).toHaveValue('0');

  const armorValue = await page.locator('#armor option').nth(1).getAttribute('value');
  expect(armorValue).toBeTruthy();
  await page.locator('#armor').selectOption(armorValue);
  await page.locator('#equipReset').click();
  await expect(page.locator('#armor')).toHaveValue('-');
  expect(runtimeErrors).toEqual([]);
});

test('character table supports jump, keyboard, highlight, and reset', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/tools/chartable.html');
  await expect.poll(() => page.locator('.table-container table').evaluateAll(
    (tables) => tables.map((table) => table.querySelectorAll('tbody tr').length),
  )).toEqual(Array(12).fill(200));

  await page.locator('#classSelect').selectOption('ramarl');
  await page.locator('#levelInput').fill('123');
  await page.locator('.jump-btn').click();
  await expect(page.locator('#ramarl')).toHaveClass(/active/);
  await expect(page.locator('#ramarl tbody tr').nth(122)).toHaveClass(/highlight/);
  await expect(page.locator('#ramarl tbody tr').nth(122).locator('td').first()).toHaveText('123');

  await page.locator('#classSelect').selectOption('fomar');
  await page.locator('#levelInput').fill('50');
  await page.locator('#levelInput').press('Enter');
  await expect(page.locator('#fomar')).toHaveClass(/active/);
  await expect(page.locator('#fomar tbody tr').nth(49)).toHaveClass(/highlight/);

  await page.locator('.reset-btn').click();
  await expect(page.locator('#emptyState')).toBeVisible();
  await expect(page.locator('#classSelect')).toHaveValue('');
  await expect(page.locator('#levelInput')).toHaveValue('');
  await expect(page.locator('tbody tr.highlight')).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

test('Combo Calculator remains usable at a mobile viewport', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/cc.html');

  await expect(page.getByRole('heading', { name: 'Combo Calculator Multiplayer' })).toBeVisible();
  await expect(page.locator('#class-select')).toBeVisible();
  await expect(page.locator('#classMinAtpInput')).toHaveValue('1634');
  await expect(page.locator('#classMaxAtpInput')).toHaveValue('1639');
  await expect.poll(() => page.locator('#classMinAtpInput').evaluate(
    (input) => input.getBoundingClientRect().width,
  )).toBeGreaterThanOrEqual(100);
  await page.locator('#machine-btn').click();
  await expect.poll(() => page.locator('#combo-calc-table tbody tr').count()).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test('anniversary feature cards keep bilingual item names visible', async ({ page }) => {
  await page.setViewportSize({ width: 457, height: 800 });
  await page.goto('/event/anniversary.html?year=2025');

  const card = page.locator('.anniv-2025 .feature-card').filter({ hasText: 'Sonic Doll' });
  await expect(card).toContainText(
    '白金牌 奖池移除圣剑「拉维斯·迦农」(Lavis Cannon)，新增索尼克人偶(Sonic Doll)。',
  );
  await expect.poll(() => card.locator('p').evaluate((paragraph) => {
    const paragraphRect = paragraph.getBoundingClientRect();
    const parts = paragraph.querySelectorAll('.item-zh, .item-en');
    return getComputedStyle(paragraph).textAlign === 'left'
      && [...parts].every((part) => (
        part.getBoundingClientRect().right <= paragraphRect.right + 0.5
      ));
  })).toBe(true);
});

test('Combo Calculator license is included in the production artifact', async ({ request }) => {
  const response = await request.get('/third_party/psostats-combo/LICENSE');
  expect(response.ok()).toBe(true);
  await expect(response.text()).resolves.toContain('Copyright (c) 2021 phelix-');
});

test('legacy Mag simulator URL redirects to the standalone site', async ({ page }) => {
  await page.route('https://magfeeder.psohaven.com/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Mag Feeder redirect target</title>',
  }));

  await page.goto('/tools/mag-sim.html?mode=planner#target');

  await expect(page).toHaveURL('https://magfeeder.psohaven.com/?mode=planner#target');
});

const legacyDropChartRedirects = [
  {
    name: 'legacy language page',
    path: '/droptable/cn/CUltimate.html',
    target: 'https://dropcharts.psohaven.com/bb/?lang=zh&diff=Ultimate',
  },
  {
    name: 'former embedded chart',
    path: '/data/droptable/ngc/index.html?lang=zh&diff=Ultimate',
    target: 'https://dropcharts.psohaven.com/ngc/?lang=zh&diff=Ultimate',
  },
];

for (const redirectCase of legacyDropChartRedirects) {
  test(`${redirectCase.name} redirects to the independent site`, async ({ page }) => {
    await page.route('https://dropcharts.psohaven.com/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Drop Charts redirect target</title>',
    }));

    await page.goto(redirectCase.path);

    await expect(page).toHaveURL(redirectCase.target);
  });
}
