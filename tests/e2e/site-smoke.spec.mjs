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

test('Angular route hosts keep representative page content centered', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 900 });
  for (const [path, selector] of [
    ['/', '.container'],
    ['/event/anniversary.html?year=2025', '.content-container'],
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
  await expect.poll(() => names.first().evaluate((name) => (
    [...name.children].map((part) => part.className)
  ))).toEqual(['item-zh', 'item-en']);
});

test('Angular content behaviors preserve lookup and Section ID interactions', async ({ page }) => {
  await page.goto('/data/en2chinese.html');
  const lookupRows = page.locator('#lookup tr');
  await expect.poll(() => lookupRows.count()).toBeGreaterThan(500);
  await page.locator('#search-input').fill('V502');
  await expect(page.locator('#result-count')).toContainText(/匹配 \d+ \/ \d+ 项/);
  await expect(page.locator('#lookup tr:visible')).toHaveCount(1);
  await expect(page.locator('#lookup tr:visible').first()).toContainText('V502');

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
  await page.getByRole('button', { name: 'EN', exact: true }).click();
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

test('Angular price guide filters categories and bilingual item names', async ({ page }) => {
  await page.goto('/data/price_guide.html');
  const sections = page.locator('#price-content .price-section');
  await expect.poll(() => sections.count()).toBeGreaterThan(20);
  await page.locator('#price-search').fill('Lavis Cannon');
  await expect(page.locator('#match-count')).toContainText(/找到 [1-9]\d* \/ \d+ 项/);
  await expect(page.locator('#price-content')).toContainText('圣剑「拉维斯·迦农」');
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
  const firstRow = page.locator('#cast-body tr').first();
  await expect(firstRow).toBeVisible();
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
