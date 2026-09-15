import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';

test('mechanics authored item references use exact authority keys', () => {
  const authority = JSON.parse(readFileSync(
    process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json', 'utf8',
  )).items;
  const document = parse(readFileSync('tools/mechanics.html', 'utf8'));
  const names = [];
  function visit(node) {
    const name = node.attrs?.find((attribute) => attribute.name === 'data-item-en')?.value;
    if (name) names.push(name);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(document);
  expect(names.length).toBeGreaterThan(0);
  expect(names.filter((name) => !Object.hasOwn(authority, name))).toEqual([]);
});

test('mechanics diagrams remain readable and keyboard accessible', async ({ page }) => {
  await page.goto('/tools/mechanics.html#incoming-physical');
  await expect(page.getByRole('banner')).toHaveCount(1);
  const diagrams = page.locator('.mechanics-flow, .mechanics-outcome, .mechanics-threshold, .mechanics-figure, .mechanics-pb-card');
  await expect(diagrams).toHaveCount(20);
  for (const width of [320, 390, 760, 761, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await diagrams.evaluateAll((figures) => figures.filter((figure) => {
      const bounds = figure.getBoundingClientRect();
      return bounds.left < 0 || bounds.right > window.innerWidth
        || figure.scrollWidth > figure.clientWidth + 1;
    }).map((figure) => figure.textContent));
    expect(overflow, `Diagram overflow at ${width}px`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `Page overflow at ${width}px`)
      .toBeLessThanOrEqual(width);
  }

  const navigation = page.getByRole('navigation', { name: '机制章节导航' });
  const chapters = [
    ['A 物理伤害', 'physical-damage'], ['B 攻击命中', 'accuracy'],
    ['C 回避与 Guard', 'incoming-physical'], ['D 魔法伤害', 'technique-damage'],
    ['E 击倒阈值', 'knockdown'], ['F 消耗自身 HP', 'hp-drain'],
    ['G PB 技能与伤害', 'photon-blast'], ['H 玛古事件', 'mag-triggers'],
  ];
  await expect(navigation.getByRole('link')).toHaveCount(chapters.length);
  for (const [name, id] of chapters) {
    const link = navigation.getByRole('link', { name, exact: true });
    const target = '#' + id;
    await expect(link).toHaveAttribute('href', '/tools/mechanics.html' + target);
    await link.focus();
    await page.keyboard.press('Enter');
    expect(new URL(page.url()).hash).toBe(target);
    await expect(page.locator(target)).toBeInViewport();
  }

  for (const [id, name] of [
    ['pb-analysis', '逐个技能分析'],
    ['pb-parameters', '参数速查'], ['pb-damage', '攻击型伤害'], ['pb-chain', '连锁与捐赠'],
    ['pb-support', '治疗与辅助'], ['pb-gain', 'PB 槽积累'],
    ['pb-levels', '双子等级算例'],
  ]) {
    const link = page.getByRole('link', { name, exact: true });
    await link.focus();
    await page.keyboard.press('Enter');
    expect(new URL(page.url()).hash).toBe('#' + id);
    await expect(page.locator('#' + id)).toBeInViewport();
  }
  const blasts = [
    ['Farlla', '海蛇', 'Farlla'], ['Estlla', '海豚', 'Estlla'],
    ['Golla', '角鹿', 'Golla'], ['Pilla', '神像', 'Pilla'],
    ['Leilla', '女神', 'Leilla'], ['Mylla & Youlla', '双子', 'Mylla_Youlla'],
  ];
  const cards = page.locator('.mechanics-pb-card');
  await expect(cards).toHaveCount(blasts.length);
  for (const [english, chinese, filename] of blasts) {
    const card = cards.filter({ has: page.locator('h4 small', { hasText: english }) });
    await expect(card).toHaveCount(1);
    await expect(card.locator('h4')).toContainText(chinese);
    await expect(card.locator('img')).toHaveAttribute('src', '/assets/img/mag/pb/' + filename + '.png');
  }
  const chain = page.getByRole('list', { name: '四人有效 PB 连锁示例' }).getByRole('listitem');
  await expect(chain).toHaveCount(4);
  for (const [index, filename] of ['Estlla', 'Pilla', 'Leilla', 'Mylla_Youlla'].entries()) {
    await expect(chain.nth(index).locator('img')).toHaveAttribute('src', '/assets/img/mag/pb/' + filename + '.png');
    await expect(chain.nth(index).locator('span')).toHaveText(`${index + 1} · ${index === 0 ? '首发' : '加入'}`);
  }
  const icons = page.locator('.mechanics-pb-card img, .mechanics-pb-chain img');
  await expect(icons).toHaveCount(10);
  for (const icon of await icons.all()) {
    await icon.scrollIntoViewIfNeeded();
    await expect.poll(() => icon.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  }

  const jump = page.getByRole('link', { name: '何时会被击倒？ ↓', exact: true });
  await jump.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#knockdown$/);
  const source = page.locator('.mechanics-source-note');
  await source.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(source).toHaveAttribute('open', '');
  await expect(source).toContainText('尚未验证当前线上运行时是否有额外修改');

  const results = await new AxeBuilder({ page })
    .include('.mechanics-nav')
    .include('.mechanics-pb-nav')
    .include('.mechanics-figure')
    .include('.mechanics-pb-grid')
    .include('.mechanics-flow')
    .include('.mechanics-outcomes')
    .include('.mechanics-threshold')
    .include('.mechanics-source-note')
    .include('.mechanics-table-scroll')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })))
    .toEqual([]);
  const landmarks = await new AxeBuilder({ page }).withRules(['landmark-unique']).analyze();
  expect(landmarks.violations).toEqual([]);
});

test('Mag and acronym PB entries open the canonical mechanics section', async ({ page }) => {
  for (const [source, name, target] of [
    ['/tools/mag.html#sync', '机制页的 PB 参数速查', 'pb-parameters'],
    ['/tools/mag.html#iq', '游戏机制：玛古光子爆裂（PB）', 'photon-blast'],
    ['/guide/acronym.html#pb', '游戏机制：玛古光子爆裂（PB）', 'photon-blast'],
  ]) {
    await page.goto(source);
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', '/tools/mechanics.html#' + target);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/tools/mechanics.html#' + target);
    await expect(page.locator('#' + target)).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(source);
  }
});

test('each PB explains its role, stat scaling and limits beside its illustration', async ({ page }) => {
  await page.goto('/tools/mechanics.html#pb-analysis');
  const navigation = page.getByRole('navigation', { name: '六种 PB 技能分析' });
  await expect(navigation.getByRole('link')).toHaveCount(6);
  for (const [id, effect, scaling, limitation] of [
    ['farlla', /周围.*敌人/, /ATP/, /Pilla.*高/],
    ['estlla', /前方.*直线/, /EVP/, /朝向/],
    ['golla', /一个敌人/, /ATP/, /Pilla.*相同/],
    ['pilla', /周围.*敌人/, /ATP/, /ATA.*不参与/],
    ['leilla', /恢复 HP/, /IQ.*MST/, /不解除异常状态，也不复活/],
    ['mylla-youlla', /Shifta.*Deband/, /IQ.*Q.*N/, /复活的玩家.*不会获得.*Shifta/],
  ]) {
    const link = navigation.locator(`a[href="/tools/mechanics.html#pb-${id}"]`);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#pb-' + id)).toBeInViewport();
    const card = page.getByRole('article', { name: await link.innerText(), exact: true });
    await expect(card.locator('figure svg')).toHaveCount(1);
    await expect(card.locator('figure figcaption')).toContainText(effect);
    await expect(card.locator('dt')).toHaveText(['作用方式', '参数影响', '使用分析', '连锁定位']);
    await expect(card.locator('dd').nth(1)).toContainText(scaling);
    await expect(card).toContainText(limitation);
    await expect(card.locator('dd').nth(3)).not.toBeEmpty();
  }
});

test('PB donation rules and Twins levels distinguish source facts from worked examples', async ({ page }) => {
  await page.goto('/tools/mechanics.html#pb-chain');
  const rules = page.locator('#pb-chain + ul');
  await expect(rules).toContainText('同房间');
  await expect(rules).toContainText('首个 PB 的起手动画结束前');
  await expect(rules).toContainText('被覆盖的玩家不会获得该次连锁收益');
  await expect(rules).toContainText('每人最多捐赠 30 PB');
  await expect(rules).toContainText('每次捐赠 10 PB');
  await expect(rules.getByRole('link', { name: 'Wiki 连锁规则' })).toHaveAttribute('href', 'https://wiki.pioneer2.net/w/Photon_Blasts#Chaining');
  await expect(rules.getByRole('link', { name: 'Wiki 捐赠规则' })).toHaveAttribute('href', 'https://wiki.pioneer2.net/w/Photon_Blasts#Donating');

  const example = page.getByRole('figure', { name: /双子辅助等级.*公式推算/ });
  await expect(example).toContainText('IQ 200');
  await expect(example).toContainText('Shifta／Deband');
  await expect(example).toContainText('不是玛古等级');
  const rows = example.locator('tbody tr');
  await expect(rows).toHaveCount(6);
  for (const [index, cells] of [
    ['单发，无捐赠', '100', '1', 'Lv.21'],
    ['单发，1 位队友捐赠 30', '130', '1', 'Lv.27'],
    ['单发，3 位队友各捐赠 30', '190', '1', 'Lv.39'],
    ['二连，无捐赠', '100', '2', 'Lv.41'],
    ['三连，无捐赠', '100', '3', 'Lv.61'],
    ['四连，无捐赠', '100', '4', 'Lv.81'],
  ].entries()) {
    await expect(rows.nth(index).locator('th, td')).toHaveText(cells);
  }
  const twins = page.getByRole('article', { name: '双子 Mylla & Youlla', exact: true });
  await expect(twins.getByRole('link', { name: 'Wiki 双子效果与等级公式' })).toHaveAttribute('href', 'https://wiki.pioneer2.net/w/Photon_Blasts#Mylla_&_Youlla');
  const jump = twins.getByRole('link', { name: '捐赠与连锁等级算例' });
  await jump.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#pb-levels')).toBeInViewport();
  await expect(page.getByRole('link', { name: 'Wiki 武器特殊攻击说明' })).toHaveAttribute('href', 'https://wiki.pioneer2.net/w/Game_mechanics#Special_attacks');
  await example.screenshot({ path: test.info().outputPath('pb-levels-desktop.png') });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const scroll = example.getByRole('region', { name: '双子捐赠与连锁等级对照表' });
    expect(await scroll.evaluate(element => element.scrollWidth - element.clientWidth), `All columns fit at ${width}px`).toBeLessThanOrEqual(1);
    const clippedCells = await example.locator('th, td').evaluateAll(cells => cells
      .filter(cell => cell.scrollWidth > cell.clientWidth + 1)
      .map(cell => ({
        text: cell.textContent, width: cell.clientWidth, required: cell.scrollWidth,
        padding: getComputedStyle(cell).padding, font: getComputedStyle(cell).fontSize,
      })));
    expect(clippedCells, `Table text fits at ${width}px`).toEqual([]);
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows.last().getByRole('cell', { name: 'Lv.81', exact: true })).toBeInViewport();
    await example.screenshot({ path: test.info().outputPath(`pb-levels-mobile-${width}.png`) });
  }
});
