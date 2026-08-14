import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const buildManifest = JSON.parse(readFileSync('_site/build-manifest.json', 'utf8'));

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
    readySelector: '#class option',
    minimumReadyCount: 2,
    noLegacyRuntime: true,
  },
  {
    name: 'character table',
    path: '/tools/chartable.html',
    title: /全等级人物能力表/,
    heading: '全等级人物能力表',
    noLegacyRuntime: true,
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
    readySelector: '.enemy-picker',
    minimumReadyCount: 1,
    noLegacyRuntime: true,
  },
  {
    name: 'OPM combo calculator',
    path: '/tools/ccopm.html',
    title: /Combo Calculator - PSOStats/,
    heading: 'Combo Calculator OPM',
    readySelector: '.enemy-picker',
    minimumReadyCount: 1,
    noLegacyRuntime: true,
  },
  {
    name: 'event archive',
    path: '/event/christmas.html?year=2025',
    title: /2025圣诞活动/,
    heading: 'CHRISTMAS 2025',
    readySelector: '#content',
    readyText: '2025',
  },
  {
    name: 'price guide',
    path: '/data/price_guide.html',
    title: /物品价格参考/,
    heading: '物品价格参考',
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

test('data-driven tools avoid asynchronous loading placeholders', () => {
  const statusHtml = readFileSync('_site/tools/status.html', 'utf8');
  const chartableHtml = readFileSync('_site/tools/chartable.html', 'utf8');
  const comboHtml = readFileSync('_site/tools/cc.html', 'utf8');
  const comboOpmHtml = readFileSync('_site/tools/ccopm.html', 'utf8');

  expect(statusHtml).toContain('class="stat-table"');
  expect(statusHtml).not.toContain('正在加载人物数据');
  expect(chartableHtml).toContain('请选择职业查看能力表');
  expect(chartableHtml).not.toContain('正在加载人物数据');
  expect(comboHtml).toContain('id="combo-calc-table"');
  expect(comboHtml).not.toContain('Loading calculator data');
  expect(comboOpmHtml).toContain('id="combo-calc-table"');
  expect(comboOpmHtml).not.toContain('Loading calculator data');
});

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
    if (pageCase.noLegacyRuntime) {
      await expect.poll(() => page.evaluate(() => ({
        jquery: typeof window.jQuery,
        bootstrap: typeof window.bootstrap,
        vue: typeof window.Vue,
      }))).toEqual({ jquery: 'undefined', bootstrap: 'undefined', vue: 'undefined' });
    }

    expect(failedResources).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}

for (const { route } of buildManifest.angular.routes) {
  test(`${route} prerendered Angular route has no runtime errors`, async ({ page }) => {
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    const response = await page.goto(route, { waitUntil: 'load' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('haven-tools-app')).toBeAttached();
    await expect(page.locator('body')).not.toBeEmpty();
    expect(runtimeErrors).toEqual([]);
  });
}

test('challenge guides use localized redraws and remember the guidance language', async ({ page }) => {
  await page.goto('/guide/ep1ch.html');
  const firstMap = page.locator('.challenge-map img').first();
  await expect(firstMap).toHaveAttribute('src', /\/maps\/zh\/area_01\.svg$/);
  await expect(page.locator('.challenge-map img')).toHaveCount(42);
  await expect(page.locator('.challenge-legend li')).toHaveCount(7);
  await expect(page.locator('.challenge-legend')).toContainText('主路线');
  await expect(page.locator('.challenge-legend')).toContainText('传送点');

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(firstMap).toHaveAttribute('src', /\/maps\/en\/area_01\.svg$/);
  const c2Maps = page.locator('.challenge-map img[data-i18n-src]');
  await expect(c2Maps).toHaveCount(42);
  await expect(c2Maps.first()).toHaveAttribute('src', /\/maps\/en\/area_01\.svg$/);
  await expect(c2Maps.first()).toHaveAttribute('alt', 'EP1 Challenge Area 01 map');
  await expect(page.locator('.challenge-legend')).toContainText('Primary route');
  await expect(page.locator('.challenge-language')).toContainText('independently redrawn');

  await page.goto('/guide/ep2ch.html');
  const ep2Maps = page.locator('.challenge-map img[data-i18n-src]');
  await expect(ep2Maps.first()).toHaveAttribute('src', /\/maps\/en\/c1_area_01\.svg$/);
  await expect(ep2Maps).toHaveCount(25);
  await expect(ep2Maps.first()).toHaveAttribute('alt', 'EP2 C1 Challenge Area 01 map');
  await expect(page.locator('.challenge-legend')).toContainText('Primary route');
});

test('challenge and Seabed guides keep their complete map inventories usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [path, expectedMaps] of [
    ['/guide/ep1ch.html', 42],
    ['/guide/ep2ch.html', 25],
  ]) {
    await page.goto(path);
    await expect(page.locator('.challenge-map img')).toHaveCount(expectedMaps);
    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    )).toBe(true);
  }

  await page.goto('/guide/seabed.html');
  await expect(page.locator('.map-card')).toHaveCount(8);
  await expect(page.locator('.map-card img')).toHaveCount(8);
  await expect(page.locator('.map-meta a')).toHaveCount(8);
  await expect(page.locator('.jump-links a')).toHaveCount(6);
  for (const image of await page.locator('.map-card img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(
      (element) => element.complete && element.naturalWidth > 0,
    )).toBe(true);
  }
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )).toBe(true);
});

test('Seabed route variants use an exclusive full-width accordion', async ({ page }) => {
  await page.goto('/guide/seabed.html#routes');
  const variants = page.locator('.route-notes details');
  await expect(variants).toHaveCount(8);
  await expect(page.locator('.route-notes details[open]')).toHaveCount(1);

  await variants.nth(1).locator('summary').click();
  await expect(variants.nth(0)).not.toHaveAttribute('open', '');
  await expect(variants.nth(1)).toHaveAttribute('open', '');
  await expect(variants.nth(1)).toContainText('第二只 Sinow 攻击前');
  await expect.poll(() => variants.nth(1).evaluate((element) => (
    element.getBoundingClientRect().width / element.parentElement.getBoundingClientRect().width
  ))).toBeGreaterThan(0.98);
});

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
    await expect.poll(() => page.evaluate(() => ({
      jquery: typeof window.jQuery,
      bootstrap: typeof window.bootstrap,
      vue: typeof window.Vue,
    }))).toEqual({ jquery: 'undefined', bootstrap: 'undefined', vue: 'undefined' });
    await expect(page.locator('#native-btn')).toHaveCSS('color', 'rgb(165, 255, 170)');
    const tableRows = page.locator('#combo-calc-table tbody tr');

    for (const enemyButton of ['#native-btn', '#abeast-btn', '#machine-btn', '#dark-btn']) {
      await page.locator('#clear-btn').click();
      await expect(tableRows).toHaveCount(0);
      await page.locator(enemyButton).click();
      await expect.poll(() => tableRows.count()).toBeGreaterThan(0);
      await expect(tableRows.first()).toContainText(/\d/);
    }

    await page.locator('#clear-btn').click();
    await page.locator('#abeast-btn').click();
    await expect(tableRows.first().locator('th')).toHaveClass(/monster-title-ABeast/);
    await expect(tableRows.first().locator('th')).toHaveCSS('color', 'rgb(245, 255, 153)');

    await page.locator('#clear-btn').click();
    await page.locator('#native-btn').click();
    await expect.poll(() => tableRows.count()).toBeGreaterThan(5);

    const initialClassAtp = await page.locator('#classMinAtpInput').inputValue();
    await page.locator('#class-select').selectOption('RAmarl');
    await expect(page.locator('#classMinAtpInput')).not.toHaveValue(initialClassAtp);

    await page.locator('.weapon-picker').selectOption({ label: 'Dark Flow' });
    await expect(page.locator('#attack1')).toHaveValue('SPECIAL');
    await expect(page.locator('#attack2')).toHaveValue('NONE');
    await expect(page.locator('#hits2 option:checked')).toHaveText('0');
    await expect(page.locator('#hits2')).toBeDisabled();
    await expect(tableRows.first().locator('td').nth(1)).not.toContainText('NaN');
    await page.locator('.weapon-picker').selectOption({ label: 'Asteron Belt' });
    await expect(page.locator('#special-select')).toHaveValue('Hell*');
    await page.locator('.weapon-picker').selectOption({ label: 'Spread Needle' });
    await expect(page.locator('#special-select')).toHaveValue('Seize');
    await page.locator('.weapon-picker').selectOption({ label: 'Unarmed' });
    await expect(page.locator('#attack1')).toHaveValue('NORMAL');
    await expect(page.locator('#attack2')).toHaveValue('NORMAL');
    await expect(page.locator('#attack3')).toHaveValue('NORMAL');
    await page.locator('#attack2').selectOption('NONE');
    await expect(page.locator('#hits2 option:checked')).toHaveText('0');
    await expect(page.locator('#hits2')).toBeDisabled();
    await expect(tableRows.first().locator('td').nth(1)).not.toContainText('NaN');
    await page.locator('#attack2').selectOption('NORMAL');
    await expect(page.locator('#hits2 option:checked')).toHaveText('1');
    await expect(page.locator('#hits2')).toBeEnabled();

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

for (const accessibilityPath of [
  '/tools/cc.html',
  '/tools/ccopm.html',
  '/tools/status.html',
  '/tools/chartable.html',
]) {
  test(`${accessibilityPath} has no WCAG A/AA accessibility violations`, async ({ page }) => {
    await page.goto(accessibilityPath);
    if (accessibilityPath.includes('/cc')) {
      await page.locator('#native-btn').click();
      await expect.poll(() => page.locator('#combo-calc-table tbody tr').count())
        .toBeGreaterThan(0);
      const rowsBeforeRemoval = await page.locator('#combo-calc-table tbody tr').count();
      const removeEnemyButton = page.getByRole('button', { name: /^Remove / }).first();
      await expect(removeEnemyButton).toBeVisible();
      await removeEnemyButton.click();
      await expect(page.locator('#combo-calc-table tbody tr'))
        .toHaveCount(rowsBeforeRemoval - 1);
    } else if (accessibilityPath.endsWith('/status.html')) {
      await page.locator('#class').selectOption('ramarl');
      await page.locator('#lv').selectOption('100');
    } else {
      await page.locator('#classSelect').selectOption('ramarl');
      await page.locator('#levelInput').fill('123');
      await page.locator('.jump-btn').click();
      await expect(page.locator('#ramarl')).toHaveClass(/active/);
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const violations = results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map(({ target }) => target.join(' ')),
    }));

    expect(violations).toEqual([]);
  });
}

for (const { path, selectors } of [
  {
    path: '/guide/ep1ch.html',
    selectors: ['.challenge-language', '.challenge-map:first-of-type'],
  },
  {
    path: '/guide/seabed.html',
    selectors: ['.seabed-hero', '.source-note', '.map-card:first-of-type', '.equipment-table-wrap'],
  },
]) {
  test(`${path} feature UI has no WCAG A/AA accessibility violations`, async ({ page }) => {
    await page.goto(path);
    let scan = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    for (const selector of selectors) scan = scan.include(selector);
    const results = await scan.analyze();
    const violations = results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map(({ target }) => target.join(' ')),
    }));

    expect(violations).toEqual([]);
  });
}

test('Angular route hosts keep representative page content centered', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 900 });
  for (const [path, selector] of [
    ['/', '.container'],
    ['/event/anniversary.html?year=2025', '.anniversary-page-shell'],
    ['/guide/banners.html', '.content-container'],
    ['/tools/status.html', '.content-container'],
  ]) {
    await page.goto(path);
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${path} should render ${selector}`).not.toBeNull();
    expect(Math.abs(box.x + box.width / 2 - 1512 / 2), `${path} should be horizontally centered`)
      .toBeLessThanOrEqual(1);
  }
});

test('shared page chrome aligns titles and back links with page content', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 900 });
  for (const path of [
    '/data/enemy_weapon_hit.html',
    '/guide/banners.html',
    '/tools/status.html',
  ]) {
    await page.goto(path);
    const centers = await page.locator('body').evaluate(() => {
      const center = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return rect.x + rect.width / 2;
      };
      return {
        title: center('#project_title'),
        backLink: center('.back-link'),
        content: center('.content-container'),
      };
    });

    expect(Math.abs(centers.title - centers.content), `${path} title should align with content`)
      .toBeLessThanOrEqual(1);
    expect(Math.abs(centers.backLink - centers.content), `${path} back link should align with content`)
      .toBeLessThanOrEqual(1);
  }
});

test('status simulator handles Angular inputs and resets', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/tools/status.html');
  await expect.poll(() => page.locator('#class option').count()).toBeGreaterThan(2);
  await expect(page.locator('.resist-list dt')).toHaveText([
    'EFR火焰', 'EIC冰冻', 'ETH雷电', 'EDK暗黑', 'ELT光明',
  ]);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Character Stat Simulator' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.resist-list dt')).toHaveText([
    'EFRFire', 'EICIce', 'ETHThunder', 'EDKDark', 'ELTLight',
  ]);
  await page.getByRole('button', { name: '日', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'キャラクターステータスシミュレーター' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('.resist-list dt')).toHaveText([
    'EFR炎', 'EIC氷', 'ETH雷', 'EDK闇', 'ELT光',
  ]);
  await page.getByRole('button', { name: '中', exact: true }).click();
  await expect(page.getByRole('heading', { name: '角色属性模拟器' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.locator('#class').selectOption('ramarl');
  await page.locator('#lv').selectOption('100');

  await page.locator('#magPow').fill('5');
  await page.locator('#magPow').press('0');
  await expect(page.locator('.limit-badges')).toContainText('玛古等级 55 / 200');
  await page.locator('#magReset').click();
  await expect(page.locator('#magDef')).toHaveValue('5');
  await expect(page.locator('#magPow')).toHaveValue('0');
  await expect(page.locator('.limit-badges')).toContainText('玛古等级 5 / 200');

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

test('status simulator preserves material-plan presets and calculation diagnostics', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/tools/materialplan.html');
  const preset = await page.locator('a[href^="/tools/status.html?"]').first().getAttribute('href');
  expect(preset).toBeTruthy();
  await page.goto(preset);
  await expect(page.locator('#class')).toHaveValue('humar');
  await expect(page.locator('#lv option:checked')).toHaveText('200');
  await expect(page.locator('#magPow')).toHaveValue('147');
  await expect(page.locator('#magDex')).toHaveValue('48');
  await expect(page.locator('#matPow')).toHaveValue('222');
  await expect(page.locator('#armor')).toHaveValue('41');
  await expect(page.locator('#unit1')).toHaveValue('49');
  await expect(page.locator('.stat-table tbody tr')).toHaveCount(8);
  await expect(page.locator('.share-link a')).toHaveAttribute('href', /c=humar.*mpow=147/);

  await page.goto('/tools/status.html?c=ramarl&lv=150&mdef=5&mpow=100&mdex=45&mmind=50&hp=20&tp=10&pow=50&def=25&mind=30&eva=15&lck=10&armor=45&shield=2a&unit1=5b&unit2=5d&unit3=4c&unit4=51');
  const expectedCurrent = { hp: '1098', tp: '969', atp: '907', dfp: '378', mst: '800', ata: '213.9', evp: '700', lck: '60' };
  for (const [stat, value] of Object.entries(expectedCurrent)) {
    await expect(page.locator(`[data-stat="${stat}"] td`).nth(5)).toHaveText(value);
  }
  await expect(page.locator('.resist-list')).toContainText('29');
  await expect(page.locator('[data-equipment-code="45"]')).toContainText('★★★★★★★★★★★');
  await expect(page.locator('.rarity .rare1').filter({ hasText: '★★★★★★★★★' }).first()).toHaveCSS('color', 'rgb(102, 153, 255)');
  await expect(page.locator('.rarity .rare2').filter({ hasText: '★★' }).first()).toHaveCSS('color', 'rgb(255, 102, 102)');
  await expect(page.locator('.effects')).toContainText('Technique speed ×1.5');
  await page.locator('#armor').selectOption('1a');
  await expect(page.locator('[data-equipment-code="1a"]')).toContainText('不可装备');
  await page.locator('#matPow').fill('999');
  await expect(page.locator('.limit-badges .over-limit')).toContainText('材料用量');

  await page.goto('/tools/status.html?c=hucast&lv=123&tp=13&unit1=5e');
  await expect(page.locator('[data-stat="tp"] td').nth(5)).toHaveText('0');
  expect(runtimeErrors).toEqual([]);
});

test('Angular content behaviors cover landing, search, filters, tabs, and RBR data', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page.locator('#swatchTime')).toHaveText(/^@\d{3}\.\d{2}$/);
  await expect(page.locator('#swatchTime')).toHaveAttribute('data-period', /divine|normal/);
  await expect(page.locator('#galatine-atp')).toContainText('ATP');
  await expect(page.locator('#buf-current')).not.toBeEmpty();

  await page.goto('/data/bb_items.html');
  await page.locator('#searchBox').fill('Heavenly/Battle');
  await expect(page.locator('#searchCount')).toContainText(/找到 [1-9]\d* 条/);
  await expect(page.locator('#searchResults .search-results-table tbody tr')).toHaveCount(1);

  await page.goto('/data/monsters.html');
  const total = await page.locator('.monster-entry').count();
  expect(total).toBeGreaterThan(20);
  await page.locator('#monsterSearch').fill('Booma');
  await expect(page.locator('#monsterCount')).toContainText(new RegExp(`/ ${total} 项`));
  expect(await page.locator('.monster-entry:visible').count()).toBeLessThan(total);

  await page.goto('/guide/class-guide.html');
  await page.locator('#tab-ranger').click();
  await expect(page.locator('#ranger')).toBeVisible();
  await expect(page.locator('#hunter')).toBeHidden();
  await expect(page).toHaveURL(/#ranger$/);
  await page.locator('#tab-ranger').press('ArrowRight');
  await expect(page.locator('#force')).toBeVisible();
  await expect(page.locator('#tab-force')).toBeFocused();

  await page.goto('/guide/rbr.html');
  await expect(page.locator('#rbr-tracker-status')).toContainText('Tracker');
  await expect(page.locator('.rbr-episode-card')).toHaveCount(3);
  await expect(page.locator('.rbr-quest-cell')).toHaveCount(58);
  await expect(page.locator('.tier-current-marker')).toHaveCount(3);
  expect(runtimeErrors).toEqual([]);
});

test('character table supports jump, keyboard, highlight, and reset', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/tools/chartable.html');
  await expect(page.locator('.table-container table')).toHaveCount(0);

  await page.locator('#classSelect').selectOption('ramarl');
  await page.locator('#levelInput').fill('123');
  await page.locator('.jump-btn').click();
  await expect(page.locator('.table-container table')).toHaveCount(1);
  await expect(page.locator('#ramarl tbody tr')).toHaveCount(200);
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
    '白金牌 奖池移除圣剑「拉维斯·迦农」 (Lavis Cannon)，新增索尼克玩偶 (Sonic Doll)。',
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

test('anniversary archive returns to the event overview', async ({ page }) => {
  await page.goto('/event/anniversary.html?year=2026');
  await page.getByRole('link', { name: '返回活动页' }).click();

  await expect(page).toHaveURL(/\/event\/event\.html$/);
  await expect(page.getByRole('heading', { name: '周年活动', exact: true })).toBeVisible();
});

test('anniversary visual system has no WCAG A/AA accessibility violations', async ({ page }) => {
  await page.goto('/event/anniversary.html?year=2026');
  await expect(page.locator('#anniv-2026-shop')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('.event-masthead')
    .include('#content')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map(({ target }) => target.join(' ')),
  }))).toEqual([]);
});

test('anniversary archive uses a full-page timeline workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/event/anniversary.html?year=2026');
  const workspace = page.locator('.anniversary-workspace');
  const rail = page.locator('.anniversary-year-rail');
  await expect(workspace).toBeVisible();
  await expect(rail).toBeVisible();
  await expect(rail.locator('#yearNav > *')).toHaveCount(11);
  await expect.poll(() => workspace.evaluate((element) => getComputedStyle(element).display)).toBe('block');
  await expect.poll(() => page.locator('.anniversary-year-rail-layer').evaluate(
    (element) => getComputedStyle(element).position,
  )).toBe('sticky');
  await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).position)).toBe('absolute');
  const railToggle = page.locator('[data-year-rail-toggle]');
  await expect(railToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(railToggle).toHaveAttribute('aria-label', '展开年份导航');
  await expect(railToggle.locator('.year-rail-toggle-label')).toHaveText('年份');
  await expect(railToggle.locator('.year-rail-toggle-icon')).toHaveText('‹');
  const toggleParts = await railToggle.locator('span').evaluateAll((parts) => parts.map((part) => {
    const rect = part.getBoundingClientRect();
    return { left: rect.left, right: rect.right, centerY: rect.top + rect.height / 2 };
  }));
  expect(Math.abs(toggleParts[0].centerY - toggleParts[1].centerY)).toBeLessThan(1);
  expect(toggleParts[0].right).toBeLessThanOrEqual(toggleParts[1].left);
  await expect(page.locator('.anniversary-page-shell')).toHaveClass(/is-year-rail-collapsed/);
  await expect(rail.locator('#yearNav')).toBeHidden();
  const contentBefore = await page.locator('#content').boundingBox();
  await railToggle.click();
  await expect(railToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(railToggle).toHaveAttribute('aria-label', '收起年份导航');
  await expect(rail.locator('#yearNav')).toBeVisible();
  expect(await page.locator('#content').boundingBox()).toEqual(contentBefore);
  await page.locator('[data-year-rail-dismiss]').click({ position: { x: 500, y: 500 } });
  await expect(railToggle).toHaveAttribute('aria-expanded', 'false');

  await railToggle.click();
  await page.keyboard.press('Escape');
  await expect(railToggle).toHaveAttribute('aria-expanded', 'false');

  await expect.poll(() => page.locator('.anniv-2026 .section-nav').evaluate(
    (element) => getComputedStyle(element).position,
  )).toBe('sticky');
  expect((await page.locator('.event-masthead').boundingBox())?.height).toBeLessThan(120);
  await expect(page.locator('.event-masthead')).toContainText('周年活动档案');
  await expect.poll(() => page.locator('.anniv-2026 .feature-card').first().evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return [style.content, style.counterIncrement];
  })).toEqual(['counter(anniversary-change, decimal-leading-zero)', 'anniversary-change 1']);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => workspace.evaluate((element) => getComputedStyle(element).display)).toBe('block');
  await expect.poll(() => railToggle.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
  await railToggle.click();
  await expect.poll(() => rail.locator('#yearNav').evaluate(
    (element) => getComputedStyle(element).display,
  )).toBe('grid');
  await expect.poll(() => page.locator('.anniv-2026 .hero-stats').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('anniversary archive defaults to the announced 2026 event and keeps 2025 available', async ({ page }) => {
  await page.goto('/event/anniversary.html');

  await expect(page.locator('#project_year')).toHaveText('2026');
  await expect(page.locator('#yearNav .year-current')).toHaveText('2026');
  await expect(page.locator('#yearNav a')).toHaveCount(10);
  await expect(page.locator('#anniv-2026-quests')).toContainText('任务阵容暂未更换');
  await expect(page.locator('#anniv-2026-quests')).toContainText('Maximum Attack E: Forest');
  await expect(page.locator('#anniv-2026-quests')).toContainText('Maximum Attack E: Tower');
  await expect(page.locator('#anniv-2026-quests')).toContainText('August Atrocity #1、August Atrocity #2');
  const questGuide = page.locator('#anniv-2026-quest-guide');
  await expect(questGuide).toContainText('11 项 MAE 周回选择');
  await expect(questGuide.locator('[data-quest-guide-year="2026"] tbody tr')).toHaveCount(11);
  await expect(questGuide).toContainText('综合首选 · Desert');
  await expect(questGuide).toContainText('定点首选 · CCA');
  await expect(questGuide).toContainText('配队原则');
  await expect(page.locator('a[href="https://note.com/fine_yarrow878/n/n84a2c42c24f5"]')).toHaveText('みどり · MAE 社区攻略参考');
  await expect(page.locator('#anniv-2026-changes')).toContainText('/badgenotify');
  await expect(page.locator('#anniv-2026-milestones')).toContainText('11 项 MAE 最低值');
  await expect(page.locator('#anniv-2026-milestones')).toContainText('服务器点数为 3,304');
  await expect(page.locator('#anniv-2026-milestones')).toContainText('Meseta 掉落量 +25%（已解锁）');
  await expect(page.locator('#anniv-2026-milestones')).toContainText('August Atrocity #1、#2 始终为 +25%');
  await expect(page.locator('a[href="https://ephinea.pioneer2.net/11th-anniv-event/"]')).toHaveText('2026 官方实时里程碑');
  await expect(page.locator('#anniv-2026-shop')).toContainText('Heart of Flight Fan');
  await expect(page.locator('#anniv-2026-shop')).toContainText('Blue Powder Coating');
  await expect(page.locator('#anniv-2026-shop')).toContainText('光子水晶PC (Photon Crystal)');
  await expect(page.locator('#anniv-2026-shop .special-card').filter({ hasText: '拉古奥盗贼' }).locator('strong'))
    .toHaveText('拉古奥盗贼 · 铜牌 随机奖池');
  const thiefPool = page.locator('#anniv-2026-shop .special-card').filter({ hasText: '拉古奥盗贼' });
  await expect(thiefPool.locator('.prize-list').first().locator('li').nth(0))
    .toHaveText('小ＨＰ回复液 (Monomate)');
  await expect(thiefPool.locator('.prize-list').first().locator('li').nth(1))
    .toHaveText('小ＴＰ回复液 (Monofluid)');
  await expect.poll(() => thiefPool.locator('.item-en').evaluateAll(
    (names) => names.length > 10 && names.every((name) => name.textContent?.startsWith(' ')),
  )).toBe(true);
  await expect.poll(() => thiefPool.locator('p').evaluateAll(
    (paragraphs) => paragraphs.every((paragraph) => getComputedStyle(paragraph).textAlign === 'left'),
  )).toBe(true);
  await expect(thiefPool.locator('.prize-list li')).toHaveCount(24);
  await expect.poll(() => page.locator('#anniv-2026-shop .prize-list li').evaluateAll(
    (items) => items.every((item) => !/[、，,]\s*$/.test(item.textContent?.trim() ?? '')),
  )).toBe(true);
  await expect(page.locator('#anniv-2026-shop .special-card').filter({ hasText: '拉古奥猎人' }).locator('.prize-list li'))
    .toHaveCount(14);
  await expect(page.locator('#anniv-2026-shop .special-card').filter({ hasText: '向导' }).locator('.prize-list li'))
    .toHaveCount(6);

  await page.locator('[data-year-rail-toggle]').click();
  await page.locator('#yearNav a', { hasText: '2025' }).click();
  await expect(page.locator('#project_year')).toHaveText('2025');
  await expect(page.locator('.anniv-2025 .feature-card').filter({ hasText: 'Sonic Doll' })).toBeVisible();
  await expect(page.locator('#anniv-prizes .special-card').filter({ hasText: '拉古奥盗贼' }).locator('.prize-list li'))
    .toHaveCount(11);
});

test('PSOStats quest data belongs to its archived anniversary year', async ({ page }) => {
  const archives = [
    { year: 2021, total: '9,798', highlight: '3:25.204', taRows: 10, leader: 'No Hit', taTime: '44:48' },
    { year: 2022, total: '18,149', highlight: '3,968', taRows: 20, leader: 'No Hit', taTime: '41:36' },
    { year: 2023, total: '15,605', highlight: '2:43.107', taRows: 20, leader: 'mewkey', taTime: '38:03' },
    { year: 2025, total: '13,319', highlight: '2:33.019', taRows: 20, leader: 'slw', taTime: '34:35' },
  ];

  for (const { year, total, highlight, taRows, leader, taTime } of archives) {
    await page.goto(`/event/anniversary.html?year=${year}`);
    const questStats = page.locator(`[data-quest-stats-year="${year}"]`);
    await expect(questStats.locator('tbody tr')).toHaveCount(11);
    await expect(page.locator('#content')).toContainText(total);
    await expect(questStats).toContainText(highlight);
    const taRanking = page.locator(`[data-ta-ranking-year="${year}"]`);
    await expect(taRanking.locator('tbody tr')).toHaveCount(taRows);
    await expect(taRanking.locator('tbody tr').first()).toContainText(leader);
    await expect(taRanking.locator('tbody tr').first()).toContainText(taTime);
    await expect(page.locator(`a[href="https://psostats.com/anniv${year}"]`)).toBeVisible();
  }

  await page.goto('/event/anniversary.html?year=2023');
  await expect(page.locator('[data-ta-ranking-year="2023"] tbody tr').filter({ hasText: '43:17' })).toHaveCount(2);
  await page.goto('/event/anniversary.html?year=2025');
  await expect(page.locator('[data-ta-ranking-year="2025"] tbody tr').filter({ hasText: '40:55' })).toHaveCount(2);

  for (const year of [2024, 2026]) {
    await page.goto(`/event/anniversary.html?year=${year}`);
    await expect(page.locator('[data-quest-stats-year]')).toHaveCount(0);
    await expect(page.locator('[data-ta-ranking-year]')).toHaveCount(0);
    await expect(page.locator(`a[href="https://psostats.com/anniv${year}"]`)).toHaveCount(0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/event/anniversary.html?year=2025');
  const statsWrap = page.locator('[data-quest-stats-year="2025"]').locator('xpath=..');
  const rankingWrap = page.locator('[data-ta-ranking-year="2025"]').locator('xpath=..');
  expect(await statsWrap.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await rankingWrap.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('2026 anniversary navigation contains only primary guide sections', async ({ page }) => {
  await page.goto('/event/anniversary.html?year=2026');
  const nav = page.locator('.anniv-2026 .section-nav');
  await expect(nav.locator('a')).toHaveCount(6);
  expect(await nav.locator('a').allTextContents()).toEqual([
    '年度变化',
    '活动任务',
    '周回攻略',
    '徽章规则',
    '全服里程碑',
    '完整商店',
  ]);
  await expect(nav.locator('a[href$="#anniv-2026-future"]')).toHaveCount(0);
  await expect(nav.locator('a[href$="#anniv-2026-sources"]')).toHaveCount(0);

  for (const link of await nav.locator('a').all()) {
    const href = await link.getAttribute('href');
    const hash = new URL(href, 'http://localhost').hash;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/event/anniversary\\.html\\?year=2026${hash}$`));
    await expect(page.locator(hash)).toBeVisible();
  }
});

test('2025 anniversary section navigation stays on the selected archive year', async ({ page }) => {
  await page.goto('/event/anniversary.html?year=2025');
  const nav = page.locator('.anniv-2025 .section-nav');
  await expect(nav.locator('a')).toHaveCount(6);

  for (const link of await nav.locator('a').all()) {
    const href = await link.getAttribute('href');
    const hash = new URL(href, 'http://localhost').hash;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/event/anniversary\\.html\\?year=2025${hash}$`));
    await expect(page.locator(hash)).toBeVisible();
  }
});

test('anniversary years expose complete localized milestone contracts', async ({ page }) => {
  const expected = [
    { year: 2026, total: '服务器点数为 3,304', rows: 16, first: ['1,000', '稀有物品掉落率 +10%'], last: ['20,000', '官方暂未公开'] },
    { year: 2025, total: '25,417', rows: 11, first: ['2,500', '经验值 +50%'], last: ['20,000', '命中 属性出现概率 +1%'] },
    { year: 2024, total: '11,316', rows: 22, first: ['150', '稀有物品掉落率 +10%'], last: ['12,000 / 14,000 / 16,000 / 18,000 / 20,000', '官方最终存档仍显示“？？？ (???)”'] },
    { year: 2023, total: '18,149,237', rows: 26, first: ['25 万', '周年徽章掉落率 +25%'], last: ['1,500 万', '命中 属性出现概率 +1%'] },
    { year: 2022, total: '13,578,324', rows: 24, first: ['25 万', '任意掉落率 +5%'], last: ['1,500 万', '官方最终存档仍显示“？？？ (???)”'] },
    { year: 2021, total: '11,050,327', rows: 19, first: ['5 万', 'Festivity on the Beach'], last: ['600 万后', '每 10 万击杀使徽章率 +1%'] },
    { year: 2020, total: '8,777,030', rows: 19, first: ['5 万', 'Festivity on the Beach'], last: ['600 万后', '每 10 万击杀使徽章率 +1%'] },
    { year: 2019, total: '4,352,016', rows: 18, first: ['5 万', 'Beach Laughter'], last: ['750 万', '官方页面保留为“???”'] },
    { year: 2018, total: '2,482,339', rows: 17, first: ['5 万', 'Festivity on the Beach'], last: ['500 万', '官方页面保留为“???”'] },
    { year: 2017, total: '6,092,971', rows: 18, first: ['5 万', 'Festivity on the Beach'], last: ['500 万后', '每 20,000 击杀使徽章率 +1%'] },
    { year: 2016, total: '最终突破 450 万', rows: 20, first: ['5 万', 'Resting at the Beach'], last: ['600 万', 'Photon Sphere'] },
  ];
  for (const { year, total, rows, first, last } of expected) {
    await page.goto(`/event/anniversary.html?year=${year}`);
    await expect(page.locator(`#anniv-${year}-milestones`)).toBeVisible();
    await expect(page.locator('#content')).toContainText(total);
    const milestoneRows = page.locator(`.milestone-table[data-milestone-year="${year}"] tbody tr`);
    await expect(milestoneRows).toHaveCount(rows);
    await expect(milestoneRows.first().locator('td').nth(0)).toHaveText(first[0]);
    await expect(milestoneRows.first().locator('td').nth(1)).toContainText(first[1]);
    await expect(milestoneRows.last().locator('td').nth(0)).toHaveText(last[0]);
    await expect(milestoneRows.last().locator('td').nth(1)).toContainText(last[1]);
  }
});

test('historical anniversary years share the modern archive presentation', async ({ page }) => {
  for (const year of [2016, 2020, 2024]) {
    await page.goto(`/event/anniversary.html?year=${year}`);
    const content = page.locator('#content');
    await expect(content).toHaveClass(/anniv-legacy/);
    await expect(content.locator('.year-hero')).toBeVisible();
    await expect(content.locator('.archive-section').first()).toBeVisible();
    await expect(content).toHaveAttribute('data-anniversary-year', String(year));
    await expect.poll(() => content.locator('.archive-section').first().evaluate((section) => {
      const style = getComputedStyle(section);
      const accent = getComputedStyle(section, '::before');
      return style.display !== 'none'
        && Number.parseFloat(style.borderTopLeftRadius) <= 6
        && Number.parseFloat(style.borderTopRightRadius) >= 20
        && Number.parseFloat(accent.width) === 4;
    })).toBe(true);
    await expect.poll(() => content.locator('.year-hero').evaluate(
      (hero) => getComputedStyle(hero, '::after').content.replaceAll('"', ''),
    )).toBe(String(year));
    const sectionBackgrounds = await content.locator('.archive-section').evaluateAll(
      (sections) => sections.slice(0, 3).map((section) => getComputedStyle(section).backgroundImage),
    );
    expect(new Set(sectionBackgrounds).size).toBeGreaterThan(1);
  }
});

test('event overview milestone link loads the historical year and scrolls to its anchor', async ({ page }) => {
  await page.goto('/event/event.html');
  await page.locator('a[href="/event/anniversary.html?year=2017#anniv-2017-milestones"]').click();

  await expect(page).toHaveURL(/\/event\/anniversary\.html\?year=2017#anniv-2017-milestones$/);
  const anchor = page.locator('#anniv-2017-milestones');
  await expect(anchor).toBeVisible();
  await expect.poll(() => anchor.evaluate((element) => {
    const { top, bottom } = element.getBoundingClientRect();
    return top >= 0 && bottom <= window.innerHeight;
  })).toBe(true);
});

test('banner item lists use Chinese-first bilingual names', async ({ page }) => {
  await page.goto('/guide/banners.html');

  const names = page.locator('.item-list .item-bilingual');
  await expect.poll(() => names.count()).toBeGreaterThan(80);
  await expect(page.locator('.weapon-table').filter({ hasText: 'Lavis Cannon' })).toContainText(
    '圣剑「拉维斯·迦农」(Lavis Cannon)',
  );
  await expect(page.locator('#other-items + .table-scroll')).toContainText(
    '红色手镯(Red Ring)',
  );
  await expect(page.locator('#other-items + .table-scroll')).toContainText(
    '天使之琴之心(Heart of Angel Harp)',
  );
  await expect(page.getByText('天使之琴涂之心', { exact: true })).toHaveCount(0);
  await expect.poll(() => names.first().evaluate((name) => (
    [...name.children].map((part) => part.className)
  ))).toEqual(['item-zh', 'item-en']);
});

test('Angular content behaviors preserve lookup and Section ID interactions', async ({ page }) => {
  await page.goto('/data/en2chinese.html');
  const lookupRows = page.locator('#lookup tr');
  await expect.poll(() => lookupRows.count()).toBeGreaterThan(500);
  await page.locator('#search-input').fill('V502');
  await expect(page.locator('#result-count')).toContainText(/找到 \d+ \/ \d+ 项/);
  await expect(page.locator('#lookup tr:visible')).toHaveCount(1);
  await expect(page.locator('#lookup tr:visible').first()).toContainText('V502');
  await page.locator('#search-input').fill('5TH ANNIV. BLADE');
  await expect(page.locator('#lookup tr:visible').first().locator('td').nth(1)).toHaveText('PSO5周年纪念·感恩刀');
  await page.locator('#search-input').fill('ＰＳＯ５周年');
  await expect(page.locator('#lookup tr:visible')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /半角|全角/ })).toHaveCount(0);

  await page.goto('/tools/id.html');
  await page.locator('#name').fill('Haven');
  await expect(page.locator('#tf1')).not.toHaveText('N/A');
  await expect(page.locator('#img1')).not.toHaveAttribute('src', /Impossible/);
  await page.getByRole('button', { name: 'DC/PC/GC/XB' }).click();
  await expect(page.locator('#Legacy')).toBeVisible();
  await expect(page.locator('#BB')).toBeHidden();
});

test('Angular multilingual data tables switch language without legacy globals', async ({ page }) => {
  await page.goto('/data/bdp/');
  await expect.poll(() => page.locator('.bdp-row').count()).toBeGreaterThan(0);
  const nugBazooka = page.locator('[data-item-zh="NUG2000火箭筒"]').first();
  await expect(nugBazooka).toHaveText('NUG2000火箭筒');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(nugBazooka).toHaveText('Nug2000-Bazooka');
  await expect(page.getByRole('group', { name: '中文道具译名字符宽度' })).toHaveCount(0);
  await expect(page.locator('#pageTitle')).toHaveText("Black Paper's Deal Drop Charts");
  await expect(page.locator('.bdp-head')).toContainText('Ultimate');
  await expect.poll(() => page.evaluate(() => ({
    jquery: typeof window.jQuery,
    bootstrap: typeof window.bootstrap,
    vue: typeof window.Vue,
  }))).toEqual({ jquery: 'undefined', bootstrap: 'undefined', vue: 'undefined' });

  await page.goto('/data/prizelist/');
  await expect(page.locator('#pageTitle')).toHaveText("Coren's Prize List");
  await expect(page.locator('.day-head').first()).toContainText('Monday');
  await page.getByRole('button', { name: '日', exact: true }).click();
  await expect(page.locator('.day-head').first()).toContainText('月曜日');
});

test('canonical item pages preserve authoritative Unitxt mixed-width names', async ({ page }) => {
  await page.goto('/data/weapon_special_reduction.html');
  const justice = page.locator('[data-item-zh="Ｈ＆Ｓ２５正义制裁"]');
  await expect(justice).toHaveText('Ｈ＆Ｓ２５正义制裁');
  await expect(page.getByText('暗杀者的投刃', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /半角|全角/ })).toHaveCount(0);

  await page.goto('/data/enemy_weapon_hit.html');
  await expect(page.locator('[data-item-zh="森隐雷藏拳套０型"]')).toHaveText('森隐雷藏拳套０型');

  await page.goto('/data/equipment_technique_boosts.html');
  await expect(page.getByRole('heading', { name: '装备技能增幅', exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-item-zh="冰杖「达冈」"]')).toHaveText('冰杖「达冈」');
  const caduceusRow = page.locator('tr', { has: page.locator('[data-item-en="Caduceus"]') });
  const tyrellRow = page.locator('tr', { has: page.locator('[data-item-en="Tyrell\'s Parasol"]') });
  await expect(caduceusRow.locator('td').nth(1)).toHaveText('Grants');
  await expect(caduceusRow.locator('td').nth(2)).toHaveText('伤害 +20%');
  await expect(tyrellRow.locator('td').first()).toContainText('总督恩赐的阳伞');
  await expect(tyrellRow.locator('td').nth(1)).toHaveText('Shifta / Deband / Resta');
  await expect(tyrellRow.locator('td').nth(2)).toHaveText('范围 +100%');
  await expect(page.locator('[data-item-en="Ignition Cloak"]')).toBeVisible();
  await expect(page.locator('[data-item-en="FOIE MERGE"]')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(58);
  await expect(page.getByText('IZMAELA', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Two Kamui', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Evil Curst', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-item-zh="冰杖「达冈」"]')).toHaveText('冰杖「达冈」');
});

test('Angular price guide filters categories and bilingual item names', async ({ page }) => {
  await page.goto('/data/price_guide.html');
  const sections = page.locator('#price-content .price-section');
  await expect.poll(() => sections.count()).toBeGreaterThan(20);
  await page.locator('#price-search').fill('Lavis Cannon');
  await expect(page.locator('#match-count')).toContainText(/找到 [1-9]\d* \/ \d+ 项/);
  await expect(page.locator('#price-content')).toContainText('圣剑「拉维斯·迦农」');
  await page.locator('#price-search').fill('Frozen Shooter');
  await expect(page.locator('#price-content')).toContainText('冷射枪');
  await page.locator('#price-search').fill('5th Anniv. Blade');
  await expect(page.locator('#price-content')).toContainText('PSO5周年纪念·感恩刀');
  await page.locator('#price-search').fill('ＰＳＯ５周年');
  await expect(page.locator('#price-content')).toContainText('PSO5周年纪念·感恩刀');
  await expect(page.getByRole('button', { name: /半角|全角/ })).toHaveCount(0);
  await page.locator('#price-search').fill('not-a-real-pso-item');
  await expect(page.locator('.empty-result')).toBeVisible();
  await page.locator('#price-search').fill('');
  await page.getByRole('button', { name: '玛古', exact: true }).click();
  await expect(page.locator('#price-content .price-section')).toHaveCount(2);
});

test('Angular price guide hydrates the prerendered DOM in place', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { main: null, removed: false };
    Object.defineProperty(window, '__hydrationProbe', { value: probe });
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!probe.main && node.nodeType === Node.ELEMENT_NODE) {
            probe.main = node.matches?.('main.price-guide')
              ? node
              : node.querySelector?.('main.price-guide');
          }
        }
        for (const node of record.removedNodes) {
          if (probe.main && (node === probe.main || node.contains?.(probe.main))) {
            probe.removed = true;
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto('/data/price_guide.html');
  await expect(page.locator('#price-search')).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    captured: Boolean(window.__hydrationProbe.main),
    removed: window.__hydrationProbe.removed,
  }))).toEqual({ captured: true, removed: false });
});

for (const path of ['/tools/cc.html', '/tools/ccopm.html']) {
  test(`${path} hydrates its mode-specific prerendered calculator in place`, async ({ page }) => {
    await page.addInitScript(() => {
      const probe = { main: null, removed: false };
      Object.defineProperty(window, '__comboHydrationProbe', { value: probe });
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!probe.main && node.nodeType === Node.ELEMENT_NODE) {
              probe.main = node.matches?.('main.combo-shell')
                ? node
                : node.querySelector?.('main.combo-shell');
            }
          }
          for (const node of record.removedNodes) {
            if (probe.main && (node === probe.main || node.contains?.(probe.main))) {
              probe.removed = true;
            }
          }
        }
      }).observe(document, { childList: true, subtree: true });
    });

    await page.goto(path);
    await expect(page.locator('#combo-calc-table')).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      captured: Boolean(window.__comboHydrationProbe.main),
      removed: window.__comboHydrationProbe.removed,
    }))).toEqual({ captured: true, removed: false });
  });
}

test('Angular protocol, Vol Opt, and Mag controls remain interactive', async ({ page }) => {
  await page.goto('/data/protocol/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('#project_title')).toHaveText('Protocol Reference');
  await page.locator('#tab-list [data-tab="subcommands"]').click();
  await expect(page.locator('#proto-content section.active')).toHaveAttribute('data-tab', 'subcommands');
  await expect.poll(() => page.locator('#section-list a').count()).toBeGreaterThan(0);

  await page.goto('/guide/volopt.html');
  await expect(page.locator('[data-item-name="Excalibur"]')).toContainText('Excalibur 王者之剑');
  const firstRow = page.locator('#cast-body tr').first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow).toContainText('王者之剑');
  await expect(page.locator('[data-item-name="Excalibur"]')).toContainText('Excalibur 王者之剑');
  const initial = await firstRow.innerText();
  await page.locator('#mode-tabs [data-mode="one_person"]').click();
  await page.locator('#class-tabs [data-class="ramarl"]').click();
  await expect.poll(() => firstRow.innerText()).not.toBe(initial);
  await page.locator('#mode-tabs [data-mode="normal"]').click();
  await expect.poll(() => page.locator('#shifta-tabs button').count()).toBeGreaterThan(1);
  await page.locator('#shifta-tabs button').last().click();
  await expect(page.locator('#shifta-tabs button').last()).toHaveClass(/active/);

  await page.goto('/tools/mag.html');
  await expect.poll(() => page.locator('#panel-hu .mag-card').count()).toBeGreaterThan(5);
  await page.getByRole('tab', { name: /枪手/ }).click();
  await expect(page.locator('#panel-ra')).toBeVisible();
  await expect(page.locator('#panel-hu')).toBeHidden();
  await page.getByRole('tab', { name: /表2/ }).click();
  await expect(page.locator('#panel-recipe2')).toBeVisible();
  await expect.poll(() => page.locator('#panel-recipe2 tbody tr').count()).toBeGreaterThan(5);
});

test('Angular event archive prerenders the default year and loads requested years', async ({ page }) => {
  await page.goto('/event/easter.html');
  await expect(page.locator('#eventYear')).toHaveText('2026');
  await expect(page.locator('#yearContent')).not.toContainText('载入中');
  await expect(page.locator('#yearContent')).toContainText('2026');

  await page.goto('/event/easter.html?year=2025');
  await expect(page.locator('#eventYear')).toHaveText('2025');
  await expect(page.locator('#yearContent')).toContainText('2025');
  await page.locator('[data-preview-image]').first().click();
  await expect(page.locator('#imagePreview')).toBeVisible();
  await page.locator('.image-preview-close').click();
  await expect(page.locator('#imagePreview')).toBeHidden();
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
