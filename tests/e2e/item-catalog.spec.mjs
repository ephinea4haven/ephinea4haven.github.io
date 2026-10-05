import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const items = Object.values(JSON.parse(readFileSync('src/app/generated/item-catalog/details.server.json', 'utf8')));
// Index rows carry the ES / TypeM series in column 14; series weapons are listed under their series, not their type.
const series = new Map(JSON.parse(readFileSync('src/app/generated/item-catalog/index.json', 'utf8')).map(row => [row[0], row[14]]));
const listedSabers = items.filter(item => item.type === 'Saber' && !series.get(item.id));
// A page's URL without its language prefix.
const unprefixed = (href) => new URL(href).pathname.replace(/^\/(en|ja)(?=\/)/, '');
const names = JSON.parse(readFileSync(process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json', 'utf8')).items;

for (const [id, english, chinese] of [
  ['cladding-of-epsilon', 'Cladding of Epsilon', '厄普西隆外壳'],
  ['epsiguard', 'EPSIGUARD', '厄普西隆之盾'],
  ['epsilon-plating', 'Epsilon Plating', '厄普西隆之盾镀层'],
]) {
  test(`${english} preserves the confirmed Epsilon name after hydration and reload`, async ({page}) => {
    await page.goto(`/data/items/${id}.html`);
    await expect(page.locator('#item-title')).toHaveText(chinese);
    await page.getByRole('button', {name: 'English', exact: true}).click();
    await expect(page.locator('#item-title')).toHaveText(english);
    await page.getByRole('button', {name: '中文', exact: true}).click();
    await expect(page.locator('#item-title')).toHaveText(chinese);
    await page.reload();
    await expect(page.locator('#item-title')).toHaveText(chinese);
  });
}

for (const [id, count] of [['akikos-frying-pan', 4], ['soul-eater', 6], ['ragol-ring', 9]]) {
  test(`quest acquisition guide ${id} survives language changes and mobile reload`, async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/data/items/${id}.html#availability`);
    const guide = page.locator('#availability .acquisition-guide');
    for (const [button, heading, first] of [
      ['中文', '任务获取步骤', '创建 One Person'],
      ['English', 'Quest walkthrough', 'Use One Person mode'],
      ['日本語', 'クエスト入手手順', 'One Person モード'],
    ]) {
      await page.getByRole('button', {name: button, exact: true}).click();
      await expect(guide.getByRole('heading', {name: heading, exact: true})).toBeVisible();
      await expect(guide.locator('ol > li')).toHaveCount(count);
      await expect(guide.locator('li').first()).toContainText(first);
      await expect(guide.locator('a').first()).toHaveAttribute('href', /^https:\/\/wiki\.pioneer2\.net\//);
      await page.reload();
      await expect(guide.locator('li').first()).toContainText(first);
      expect((await guide.boundingBox()).width).toBeGreaterThanOrEqual(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const results = await new AxeBuilder({page}).include('#availability').analyze();
    expect(results.violations).toEqual([]);
  });
}

test('list shows all three item names with the active language first on desktop and mobile', async ({page}, testInfo) => {
  const item = items.find(item => item.id === 'manda60-vise');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({width, height: 1000});
    await page.goto('/en/data/items.html?q=M%26A60');
    await expect(page.locator('.item-row')).toHaveCount(1);
    for (const [button, language] of [['English', 'en'], ['中文', 'zh'], ['日本語', 'ja']]) {
      await page.getByRole('button', {name: button, exact: true}).click();
      const identity = page.locator('.item-row .identity');
      await expect(identity.locator('.item-name')).toHaveText(item[language]);
      await expect(identity.locator('.translated-name')).toHaveCount(2);
      for (const other of ['en', 'zh', 'ja'].filter(key => key !== language)) {
        await expect(identity.locator(`.translated-name > [lang="${other}"]`)).toHaveText(item[other]);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width !== 320 && language === 'en') {
        await page.locator('.item-table').screenshot({path: testInfo.outputPath(`three-names-${width}.png`)});
      }
    }
  }
  const unverified = items.find(item => !item.ja && item.category === 'weapon');
  await page.goto(`/en/data/items.html?q=${unverified.code}`);
  await page.getByRole('button', {name: 'English', exact: true}).click();
  await expect(page.locator('.translated-name > span:last-child').filter({hasText: 'Name unverified'})).toHaveCount(1);
  for (const id of ['blue-odoshi-violet-nimaidou', 'heart-of-partisan-of-lightning']) {
    const longName = items.find(item => item.id === id);
    await page.goto(`/en/data/items.html?category=${longName.category}&q=${longName.code}`);
    // The static page has 24 rows until the index loads and URL filters apply.
    await expect(page.locator('.item-row')).toHaveCount(1);
    await expect(page.locator('.item-name')).toHaveText(longName.en);
    await expect(page.locator('.translated-name')).toHaveCount(2);
    expect(await page.locator('.item-names').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('all technique merges display model previews in lists and details', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  for (const item of items.filter(item => item.category === 'shield' && item.id.endsWith('-merge'))) {
    await page.goto(`/en/data/items.html?category=shield&q=${item.code}`);
    const thumbnail = page.locator(`.item-row[href*="/${item.id}.html"] item-image img`);
    await expect(thumbnail).toHaveAttribute('src', `/assets/img/items/shields/thumbs/${item.id}.webp`);
    await page.goto(`/en/data/items/${item.id}.html`);
    const picture = page.locator('.image-stage img');
    await expect(picture).toHaveAttribute('src', `/assets/img/items/shields/${item.id}.webp`);
    await expect(picture).toBeVisible();
    await expect(page.locator('figcaption')).toContainText('Image: original model render');
    expect(await picture.evaluate(img => img.complete && img.naturalWidth === 900)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('technique barriers identify their block preview separately from equipped models', async ({page}) => {
  for (const id of ['assist-barrier', 'recovery-barrier', 'red-barrier', 'blue-barrier', 'yellow-barrier']) {
    await page.goto(`/en/data/items/${id}.html`);
    await expect(page.locator('.image-stage img')).toHaveAttribute('src', '/assets/img/items/shields/block-effect-6.webp');
    await expect(page.locator('figcaption')).toContainText('Block effect preview');
    await expect(page.locator('.image-stage img')).toHaveCSS('mix-blend-mode', 'plus-lighter');
  }
});

test('shield renders retain the copper emblem and a connected ring silhouette', async ({page}) => {
  await page.goto('/en/data/items/red-ring.html');
  const result = await page.evaluate(async () => {
    const read = async src => {
      const image = new Image(); image.src = src; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 180;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 180, 180);
      return context.getImageData(0, 0, 180, 180).data;
    };
    const copper = await read('/assets/img/items/shields/weapons-copper-shield.webp');
    let visible = 0, warm = 0;
    for (let i = 0; i < copper.length; i += 4) if (copper[i + 3] > 100) {
      visible++; if (copper[i] > copper[i + 2] * 1.2) warm++;
    }
    const ring = await read('/assets/img/items/shields/red-ring.webp');
    const seen = new Set(); let largest = 0, total = 0;
    for (let i = 0; i < 180 * 180; i++) {
      if (ring[i * 4 + 3] <= 100) continue;
      total++;
      if (seen.has(i)) continue;
      const stack = [i]; seen.add(i); let count = 0;
      while (stack.length) {
        const p = stack.pop(); count++;
        for (const q of [p - 180, p + 180, ...(p % 180 ? [p - 1] : []), ...(p % 180 < 179 ? [p + 1] : [])]) {
          if (q >= 0 && q < 180 * 180 && !seen.has(q) && ring[q * 4 + 3] > 100) {seen.add(q); stack.push(q);}
        }
      }
      largest = Math.max(largest, count);
    }
    return {warmFraction: warm / visible, ringConnectedFraction: largest / total, visible, total};
  });
  expect(result.visible).toBeGreaterThan(1000);
  expect(result.warmFraction).toBeGreaterThan(0.25);
  expect(result.total).toBeGreaterThan(1000);
  expect(result.ringConnectedFraction).toBeGreaterThan(0.95);
});

test('paired Mechgun images contain two complete silhouettes and appear in lists and details', async ({page}, testInfo) => {
  const ids = ['mechgun', 'assault', 'repeater', 'gatling', 'vulcan', 'es-mechgun', 'typeme-mechgun'];
  await page.goto('/en/data/items.html?type=机枪');
  for (const id of ids) {
    const item = items.find(item => item.id === id);
    await page.goto(`/en/data/items.html?q=${item.code}`);
    const thumbnail = page.locator(`.item-row[href*="/${id}.html"] item-image img`);
    await expect(thumbnail).toHaveAttribute('src', `/assets/img/items/models/thumbs/${id}.webp`);
    await expect(thumbnail).toHaveAttribute('alt', /Model preview/);
    await page.goto(`/en/data/items/${id}.html`);
    const picture = page.locator('.image-stage img');
    await expect(picture).toHaveAttribute('src', `/assets/img/items/models/${id}.webp`);
    await expect(page.locator('figcaption')).toContainText('Image: original model render');
    // Count substantial disconnected alpha regions. The old single-gun files
    // have one silhouette; metadata alone cannot establish a paired image.
    for (const source of [`/assets/img/items/models/${id}.webp`, `/assets/img/items/models/thumbs/${id}.webp`]) {
      const result = await page.evaluate(async source => {
        const image = new Image(); image.src = source; await image.decode();
        const canvas = document.createElement('canvas');
        const w = canvas.width = image.naturalWidth, h = canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, w, h).data;
        const visited = new Uint8Array(w * h), components = [];
        let clipped = false;
        for (let i = 0; i < w * h; i++) {
          if (data[i * 4 + 3] < 128 || visited[i]) continue;
          const stack = [i]; visited[i] = 1; let count = 0;
          while (stack.length) {
            const p = stack.pop(), x = p % w, y = Math.floor(p / w); count++;
            if (x === 0 || y === 0 || x === w - 1 || y === h - 1) clipped = true;
            for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
              if (q >= 0 && !visited[q] && data[q * 4 + 3] >= 128) { visited[q] = 1; stack.push(q); }
            }
          }
          if (count > w * h * 0.03) components.push(count);
        }
        return {components: components.length, clipped, ratio: w / h, cornerAlpha: data[3]};
      }, source);
      expect(result, source).toEqual({components: 2, clipped: false, ratio: 4 / 3, cornerAlpha: 0});
    }
  }
  await page.setViewportSize({width: 1440, height: 1200});
  await page.goto('/en/data/items.html?type=机枪');
  await expect(page.locator('.item-row').first()).toHaveAttribute('href', /mechgun\.html/);
  await page.locator('.item-table').screenshot({path: testInfo.outputPath('mechgun-list.png')});
});

test('confirmed Unitxt renames survive detail hydration and language switching', async ({ page }) => {
  for (const en of ['Thirteen', 'Game Magazine', 'TypeSA/SABER', 'D-Parts ver1.01']) {
    const item = items.find(candidate => candidate.en === en);
    expect(item, en).toBeDefined();
    await page.goto(`/data/items/${item.id}.html`);
    await expect(page.locator('#item-title')).toHaveText(names[en].zh);
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('#item-title')).toHaveText(en);
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect(page.locator('#item-title')).toHaveText(names[en].zh);
    await page.reload();
    await expect(page.locator('#item-title')).toHaveText(names[en].zh);
  }
});

test('item list title stays localized after query-only navigation', async ({page}) => {
  await page.goto('/en/data/items.html');
  await expect(page).toHaveTitle(/Item Database/);
  await page.getByRole('searchbox').fill('Saber');
  await expect(page).toHaveURL(/q=Saber/);
  await expect(page).toHaveTitle(/Item Database/);
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page).toHaveURL(/\/ja\/data\/items\.html\?q=Saber/);
  await page.getByRole('searchbox').fill('V101');
  await expect(page).toHaveURL(/q=V101/);
  await expect(page).toHaveTitle(/アイテム図鑑/);
});

test('language changes preserve filters, sorting, pagination and authoritative names', async ({page}) => {
  await page.goto('/data/items.html?category=weapon&type=光剑&class=FOnewearl&sort=name&page=2');
  // Capture the filtered second page after hydration, not the prerendered first page.
  await expect(page.locator('.page-steps')).toContainText('2 /');
  const ids = await page.locator('.item-row').evaluateAll(rows => rows.map(r => r.href));
  for (const [button,lang,title,prefix] of [['English','en','Item Database','/en'],['日本語','ja','アイテム図鑑','/ja'],['中文','zh','道具图鉴','']]) {
    await page.getByRole('button',{name:button,exact:true}).click();
    await expect(page.locator('#catalog-title')).toHaveText(title);
    const url = new URL(page.url());
    expect(url.pathname).toBe(`${prefix}/data/items.html`);
    expect(Object.fromEntries(url.searchParams)).toEqual({category:'weapon',type:'光剑',class:'FOnewearl',sort:'name',page:'2'});
    const rows = await page.locator('.item-row').evaluateAll(rows => rows.map(r => r.href));
    expect(rows.map(unprefixed)).toEqual(ids.map(unprefixed));
    expect(rows.every(href => new URL(href).pathname.startsWith(`${prefix}/data/items/`))).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('lang',lang === 'zh' ? 'zh-CN' : lang);
  }
  await page.goto('/ja/data/items.html?q=赤のセイバー');
  await expect(page.locator('.item-row')).toHaveCount(1);
  await expect(page.locator('.identity strong')).toHaveText(names['Red Saber'].ja);
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('.identity strong')).toHaveText('Red Saber');
  await page.getByRole('button',{name:'中文',exact:true}).click();
  await expect(page.locator('.identity strong')).toHaveText(names['Red Saber'].zh);
});

test('detail language persists through return, refresh and later visits', async ({page}) => {
  await page.goto('/data/items.html?category=weapon&q=Saber');
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page.locator('#catalog-title')).toHaveText('アイテム図鑑');
  await page.locator('.item-row').first().click();
  await expect(page.locator('#item-title')).toHaveText('セイバー');
  // Mechanics text is written in each language, not shown as the Chinese original.
  await expect(page.locator('#effects .effect-list')).toContainText('エクストラアタックはドロップやショップで生成された個々のアイテムで決まり');
  await expect(page.locator('#availability .availability-text')).toHaveText('通常ドロップと武器屋。');
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('#item-title')).toHaveText('Saber');
  await page.getByRole('link',{name:'← Back to item list',exact:true}).click();
  await expect(page).toHaveURL(/\/en\/data\/items\.html\?/);
  await expect(page.getByRole('searchbox')).toHaveValue('Saber');
  await page.reload();
  await expect(page.locator('#catalog-title')).toHaveText('Item Database');
  // The remembered language opens the English version of a Chinese URL.
  await page.goto('/data/items.html');
  await expect(page).toHaveURL(/\/en\/data\/items\.html$/);
  await expect(page.locator('#catalog-title')).toHaveText('Item Database');
  await page.getByRole('button',{name:'中文',exact:true}).click();
  await expect(page.locator('#catalog-title')).toHaveText('道具图鉴');
  await page.goto('/data/items.html');
  await expect(page.locator('#catalog-title')).toHaveText('道具图鉴');
  await page.goto('/en/data/items.html?q=missing-item');
  await page.getByRole('button',{name:'Clear all filters'}).click();
  await expect(page).toHaveURL(/\/en\/data\/items\.html\?category=weapon$/);
  await expect(page.locator('.item-row')).toHaveCount(24);
});

test('list names match ordinary, gold and rainbow BB drop-chart styles', async ({page}, testInfo) => {
  for (const [id, query, weight, kind] of [
    ['saber', 'Saber', '400', 'ordinary'],
    ['galatine', 'Galatine', '700', 'gold'],
    ['lavis-cannon', 'Lavis Cannon', '900', 'rainbow'],
    ['agito-1975', 'Agito (1975)', '700', 'gold'],
  ]) {
    await page.goto(`/data/items.html?category=weapon&q=${encodeURIComponent(query)}`);
    const row = page.locator(`.item-row[href*="/items/${id}.html"]`);
    const name = row.locator('.identity strong');
    await expect(name).toHaveClass(/item-name/);
    await expect(name).toHaveCSS('font-weight', weight);
    if (kind === 'gold') {
      await expect(name).toHaveCSS('color', 'rgb(240, 207, 131)');
      const hint = id === 'galatine' ? '公告条件：未鉴定 Hit ≥ 20%。' : '稀有道具';
      await expect(name).toHaveAttribute('title', hint);
      await expect(row).toHaveAttribute('aria-description', hint);
    } else if (kind === 'rainbow') {
      await expect(name).toHaveCSS('background-size', '300% auto');
      await expect(name).toHaveCSS('animation-duration', '4s');
      await expect(name).toHaveAttribute('title', '公告道具 · 无 Hit 要求');
      await page.emulateMedia({reducedMotion:'reduce'});
      await expect(name).toHaveCSS('animation-name', 'none');
    } else {
      await expect(name).not.toHaveClass(/ss-rare-item|rare-item/);
      await expect(name).not.toHaveAttribute('title');
    }
  }
  await page.goto('/data/items.html');
  await expect(page.locator('.ss-rare-item').first()).toBeVisible();
  await expect(page.locator('.rare-item').first()).toBeVisible();
  await page.locator('.item-row[href*="/delsabers-buster.html"]').evaluate(el => el.scrollIntoView({block:'center'}));
  await page.screenshot({path:testInfo.outputPath('name-tiers-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.item-row[href*="/delsabers-buster.html"]').evaluate(el => el.scrollIntoView({block:'center'}));
  await page.screenshot({path:testInfo.outputPath('name-tiers-mobile.png')});
  for (const [lang, hint] of [['English', 'Banner condition: untekked Hit ≥ 20%.'], ['日本語', 'ドロップ告知条件：未鑑定 Hit ≥ 20%。']]) {
    await page.getByRole('button', {name:lang,exact:true}).click();
    await expect(page.locator('.item-row[href*="/galatine.html"] .item-name')).toHaveAttribute('title', hint);
  }
});

test('all unsealed results use top-tier names independently of banner eligibility', async ({page}, testInfo) => {
  for (const [id, title, category] of [
    ['tsumikiri-j-sword', 'Tsumikiri J-Sword', 'weapon'],
    ['excalibur', 'Excalibur', 'weapon'],
    ['adept', 'Adept', 'unit'],
    ['proof-of-sword-saint', 'Proof of Sword-Saint', 'unit'],
  ]) {
    await page.goto(`/data/items.html?category=${category}&q=${encodeURIComponent(title)}`);
    await page.getByRole('button', {name:'中文',exact:true}).click();
    const row = page.locator(`.item-row[href*="/items/${id}.html"]`);
    const name = row.locator('.item-name');
    await expect(name).toHaveClass(/ss-rare-item/);
    await expect(name).not.toHaveClass(/(?:^|\s)rare-item(?:\s|$)/);
    await expect(name).toHaveCSS('font-weight', '900');
    await expect(name).toHaveAttribute('title', '解封成品 · 顶级');
    await expect(row).toHaveAttribute('aria-description', '解封成品 · 顶级');
    for (const [language, hint] of [['English','Unsealed item · top tier'], ['日本語','封印解除後のアイテム · 最上位']]) {
      await page.getByRole('button', {name:language,exact:true}).click();
      await expect(name).toHaveClass(/ss-rare-item/);
      await expect(name).toHaveAttribute('title', hint);
    }
  }
  await page.goto('/data/items.html?category=weapon&q=Excalibur');
  await page.getByRole('button', {name:'中文',exact:true}).click();
  await expect(page.locator('.ss-rare-item')).toHaveCount(1);
  await page.screenshot({path:testInfo.outputPath('unsealed-top-tier.png')});
});

test('the three Dark weapons use top-tier names with crafting labels', async ({page}, testInfo) => {
  await page.goto('/data/items.html?category=weapon&q=Dark');
  for (const [language, hint] of [['中文','合成成品 · 顶级'], ['English','Combined item · top tier'], ['日本語','合成後のアイテム · 最上位']]) {
    await page.getByRole('button', {name:language,exact:true}).click();
    for (const id of ['dark-flow','dark-meteor','dark-bridge']) {
      const row = page.locator(`.item-row[href*="/items/${id}.html"]`);
      const name = row.locator('.item-name');
      await expect(name).toHaveClass(/ss-rare-item/);
      await expect(name).not.toHaveClass(/(?:^|\s)rare-item(?:\s|$)/);
      await expect(name).toHaveCSS('font-weight', '900');
      await expect(name).toHaveAttribute('title', hint);
      await expect(row).toHaveAttribute('aria-description', hint);
    }
  }
  await page.getByRole('button', {name:'中文',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.item-row').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('dark-weapons.png')});
});

test('rare weapons and converted results stay gold without automatic top-tier promotion', async ({page}, testInfo) => {
  for (const [id, title] of [
    ['master-raven','Master Raven'], ['last-swan','Last Swan'],
    ['dual-bird','Dual Bird'], ['guld-milla','Guld Milla'],
    ['mille-marteaux','Mille Marteaux'], ['baranz-launcher','Baranz Launcher'],
    ['maser-beam','Maser Beam'], ['power-maser','Power Maser'],
    ['boomas-claw', "Booma's Claw"], ['double-cannon','Double Cannon'],
  ]) {
    await page.goto(`/data/items.html?category=weapon&q=${encodeURIComponent(title)}`);
    const row = page.locator(`.item-row[href*="/items/${id}.html"]`);
    const name = row.locator('.item-name');
    for (const [language, hint] of [['中文','稀有道具'], ['English','Rare item'], ['日本語','レアアイテム']]) {
      await page.getByRole('button', {name:language,exact:true}).click();
      await expect(name).toHaveClass(/(?:^|\s)rare-item(?:\s|$)/);
      await expect(name).not.toHaveClass(/ss-rare-item/);
      await expect(name).toHaveCSS('font-weight', '700');
      await expect(name).toHaveCSS('color', 'rgb(240, 207, 131)');
      await expect(name).toHaveAttribute('title', hint);
      await expect(row).toHaveAttribute('aria-description', hint);
    }
  }
  await page.getByRole('button', {name:'中文',exact:true}).click();
  await page.goto('/data/items.html?category=weapon&q=Maser');
  await expect(page.locator('.item-row')).toHaveCount(3);
  for (const id of ['maser-beam', 'power-maser', 'phonon-maser']) {
    await expect(page.locator(`.item-row[href*="/items/${id}.html"] .item-name`)).toHaveClass(/(?:^|\s)rare-item(?:\s|$)/);
  }
  await page.screenshot({path:testInfo.outputPath('rare-maser-weapons.png')});
});

test('language works when browser preference storage is blocked', async ({page}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked','SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked','SecurityError'); };
  });
  await page.goto('/en/data/items/saber.html');
  await expect(page.locator('#item-title')).toHaveText('Saber');
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page.locator('#item-title')).toHaveText('セイバー');
  await page.reload();
  await expect(page.locator('#item-title')).toHaveText('セイバー');
});

test('language changes keep detail fragments without fetching detail data again', async ({page}) => {
  await page.goto('/data/items/soul-eater.html#attributes');
  const requests=[];
  page.on('request',r => { if(r.url().includes('/assets/data/items/')) requests.push(r.url()); });
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page).toHaveURL(/\/en\/data\/items\/soul-eater\.html#attributes$/);
  await expect(page.locator('#attributes')).toContainText('HP drain1 / 5 sec (while moving)');
  await expect(page).toHaveTitle(/SOUL EATER|Soul Eater/);
  expect(requests).toEqual([]);
  await page.goto('/ja/data/items/mag.html');
  await expect(page.locator('.feeding-table tbody tr').first().locator('td').first()).toHaveText('モノメイト');
  await page.goto('/en/data/items/psycho-wand.html');
  await expect(page.locator('#effects')).toContainText('Rafoie');
  await expect(page.locator('#effects')).toContainText('+30% damage');
  await page.goto('/ja/data/items/es-saber.html');
  await expect(page.locator('.detail-overview')).toContainText('日本語名未確認 · 英語表記');
});

test('English detail request failures expose translated retry and return controls', async ({page}) => {
  await page.goto('/en/data/items.html?category=unit&q=V801');
  await page.route(/\/assets\/data\/items\/v801\.json\?v=[0-9a-f]{12}$/,route=>route.abort());
  // The prerendered list is unfiltered; wait for hydration to apply the query before clicking.
  await expect(page.locator('.item-row')).toHaveCount(1);
  await page.locator('.item-row').click();
  await expect(page.getByRole('heading',{name:'Item details could not be loaded'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Retry'})).toBeVisible();
  await page.getByRole('link',{name:'Back to the database →'}).click();
  await expect(page.locator('#catalog-title')).toHaveText('Item Database');
  await expect(page).toHaveURL(/\/en\/data\/items\.html/);
});

for (const width of [390,820,1280]) {
  test(`English and Japanese layouts remain accessible at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    for (const lang of ['en','ja']) for (const path of ['/data/items.html?category=unit','/data/items/nidra.html','/data/items/addslot.html']) {
      await page.goto(`/${lang}${path}`);
      await expect(page.locator('main.catalog-shell')).toHaveAttribute('lang',lang);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path.includes('category=unit')) {
        expect(await page.locator('.item-row item-image').evaluateAll(images => images.every(image => {
          const text = image.querySelector('small');
          if (!text) return true;
          const box = image.getBoundingClientRect(), label = text.getBoundingClientRect();
          return label.top >= box.top && label.bottom <= box.bottom && label.left >= box.left && label.right <= box.right;
        }))).toBe(true);
      }
      expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    }
  });
}

test('reduced motion disables decorative row movement', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/en/data/items.html');
  await page.locator('.item-row').first().hover();
  expect(await page.locator('.row-arrow').first().evaluate(n => ({transition:getComputedStyle(n).transitionDuration,transform:getComputedStyle(n).transform}))).toEqual({transition:'0s',transform:'none'});
});

test('the full inventory is prerendered with bounded per-item hydration data', () => {
  expect(items).toHaveLength(1045);
  for (const item of items) {
    const html = readFileSync(`_site/data/items/${item.id}.html`, 'utf8');
    expect(html).toContain('id="item-title"');
    expect(html).toContain((names[item.en]?.zh || item.en).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
    expect(html).toContain(item.source.replaceAll('&', '&amp;'));
    expect(html).not.toContain('资料暂时未能加载');
    const state = html.match(/<script id="ng-state"[^>]*>(.*?)<\/script>/s)?.[1];
    expect(state, item.id).toBeTruthy();
    expect(Buffer.byteLength(state)).toBeLessThan(64000);
    expect(Object.keys(JSON.parse(state)).filter(key => key.startsWith('item:'))).toEqual([`item:${item.id}`]);
  }
});

test('Chinese, English, Japanese and code search survive reload', async ({page}) => {
  await page.goto('/data/items.html');
  for (const query of ['红色光剑', 'red saber', '赤のセイバー', '002D00']) {
    await page.getByRole('searchbox').fill(query);
    await expect(page.locator('.item-row')).toHaveCount(1);
    await expect(page.locator('.item-row')).toContainText('Red Saber');
  }
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('002D00');
});

test('subtype, class, rarity and base ATP sorting compose', async ({page}) => {
  await page.goto('/data/items.html?category=weapon');
  await page.getByLabel('细分类别', {exact:true}).selectOption('光剑');
  await page.getByLabel('可装备职业', {exact:true}).selectOption('FOnewearl');
  await page.getByLabel('星级', {exact:true}).selectOption('10');
  await page.getByLabel('排序', {exact:true}).selectOption('atp');
  await expect(page.locator('.item-row')).toHaveCount(13);
  await expect(page.locator('.item-row').first()).toHaveAttribute('href', /\/commander-blade\.html\?/);
  await expect(page.locator('.item-row').first().locator('[lang="en"]')).toHaveText('COMMANDER BLADE');
  await expect(page.locator('.item-row').last()).toHaveAttribute('href', /\/dbs-saber-3070\.html\?/);
  await expect(page.locator('.item-row[href*="/elysion.html?"]')).toHaveCount(1);
  await expect(page.locator('.item-row[href*="/ancient-saber.html?"]')).toHaveCount(0);
});

test('equipment class filters exclude consumables and reset on the tools category', async ({page}) => {
  await page.goto('/data/items.html?class=HUmar&q=Monomate');
  await expect(page.locator('.item-row')).toHaveCount(0);
  await page.getByRole('button', {name: /其他道具 247/}).click();
  await expect(page.locator('.item-row')).toHaveCount(1);
  await expect(page.getByLabel('可装备职业', {exact:true})).toBeDisabled();
});

test('tool category URLs ignore an incompatible equipment class on entry and reload', async ({page}) => {
  await page.goto('/data/items.html?category=tool&class=HUmar&q=Monomate');
  for (let pass=0;pass<2;pass++) {
    await expect(page.locator('.item-row')).toHaveCount(1);
    await expect(page.getByLabel('可装备职业', {exact:true})).toHaveValue('');
    await expect(page.getByLabel('可装备职业', {exact:true})).toBeDisabled();
    await expect(page.locator('.item-row')).not.toHaveAttribute('href', /class=/);
    await page.reload();
  }
});

test('corrected periodic effects, shop specials and Mag feeding values render', async ({page}) => {
  await page.goto('/data/items/soul-eater.html');
  await expect(page.locator('#attributes')).toContainText('HP 消耗1 / 5 秒（移动时）');
  await expect(page.locator('#attributes')).not.toContainText('HP 回复');
  await page.goto('/data/items/vulcan.html');
  await expect(page.locator('#attributes')).toContainText('特殊攻击可变');
  await expect(page.locator('#availability')).toContainText('武器商店');
  await page.goto('/data/items/mag.html');
  await expect(page.locator('.feeding-table tbody tr')).toHaveCount(11);
  await expect(page.locator('.feeding-table tbody tr').first()).toContainText('小HP回复液');
  await expect(page.locator('.feeding-table tbody tr').first().locator('td')).toHaveText(['小HP回复液','+5','+40','+5','0','+3','+3']);
});

test('an existing image that fails to load is not presented as a missing screenshot', async ({page}) => {
  await page.route('**/assets/img/items/wiki/29f6af4df3b08415.png',route=>route.abort());
  await page.goto('/data/items/saber.html');
  await page.getByRole('button', {name:'现有图片', exact:true}).click();
  await expect(page.locator('.image-stage')).toContainText('图片加载失败');
  await expect(page.locator('.image-stage')).not.toContainText('暂无截图');
  await expect(page.getByRole('link',{name:'查看原图 ↗'})).toBeVisible();
});

test('HD details default to HD and switching changes both the image and its source link', async ({page}) => {
  const requested = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  await page.goto('/data/items/saber.html');
  const picture = page.locator('.image-stage img');
  const link = page.locator('.item-figure figcaption a');
  await expect(picture).toHaveAttribute('src', '/assets/img/items/hd/items/saber.webp');
  await expect.poll(() => picture.evaluate(img => img.naturalWidth)).toBe(1024);
  expect(requested).not.toContain('/assets/img/items/wiki/29f6af4df3b08415.png');
  await expect(page.getByRole('button', {name:'高清图片', exact:true})).toHaveAttribute('aria-pressed', 'true');
  await expect(link).toHaveAttribute('href', '/assets/img/items/hd/items/saber.webp');
  await page.getByRole('button', {name:'现有图片', exact:true}).click();
  await expect(picture).toHaveAttribute('src', '/assets/img/items/wiki/29f6af4df3b08415.png');
  await expect(link).toHaveAttribute('href', '/assets/img/items/wiki/29f6af4df3b08415.png');
  await expect(page.locator('.item-figure figcaption')).toContainText('Ephinea Wiki');
  // Another language is another page: it opens with the default HD image, and the keyboard switches it.
  await page.getByRole('button', {name:'English', exact:true}).click();
  await expect(page).toHaveURL(/\/en\/data\/items\/saber\.html$/);
  await expect(page.getByRole('button', {name:'HD image', exact:true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name:'Standard image', exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(picture).toHaveAttribute('src', '/assets/img/items/wiki/29f6af4df3b08415.png');
  await page.getByRole('button', {name:'HD image', exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(picture).toHaveAttribute('src', '/assets/img/items/hd/items/saber.webp');
  await expect(page.locator('.item-figure figcaption')).toContainText('HD gallery');
});

test('TypeM details without a Wiki file show the ItemKT image with its own source label', async ({page}) => {
  await page.goto('/data/items/typeri-rifle.html');
  const picture = page.locator('.image-stage img');
  const caption = page.locator('.item-figure figcaption');
  await expect(picture).toHaveAttribute('src', '/assets/img/items/hd/type/typeri-rifle.webp');
  await page.getByRole('button', {name:'现有图片', exact:true}).click();
  await expect(picture).toHaveAttribute('src', '/assets/img/items/itemkt/d74e3b44dc594b5e.png');
  await expect.poll(() => picture.evaluate(img => img.naturalWidth)).toBe(320);
  await expect(caption).toContainText('图片来源：游戏贴图（ItemKT）');
  await expect(caption).not.toContainText('Ephinea Wiki');
  await expect(page.getByRole('link', {name:'图片原始页面 ↗'})).toHaveCount(0);
});

test('Mag details show the original-model render with its own source label', async ({page}) => {
  await page.goto('/data/items/varuna.html');
  const picture = page.locator('.image-stage img');
  const caption = page.locator('.item-figure figcaption');
  await expect(picture).toHaveAttribute('src', '/assets/img/mag/default/Varuna.webp');
  await expect.poll(() => picture.evaluate(img => img.naturalWidth)).toBe(900);
  await expect(caption).toContainText('图片来源：原始模型渲染');
  await page.getByRole('button', {name:'现有图片', exact:true}).click();
  await expect(picture).toHaveAttribute('src', '/assets/img/items/wiki/3e69aa39006afee6.png');
  await expect(caption).toContainText('Ephinea Wiki');
  await page.getByRole('button', {name:'English', exact:true}).click();
  await page.getByRole('button', {name:'HD image', exact:true}).click();
  await expect(caption).toContainText('original model render');
});

test('lists load small equipment thumbnails and appearance filtering excludes category boxes', async ({page}) => {
  const hdRequests = [];
  page.on('request', request => { if (request.url().includes('/assets/img/items/hd/')) hdRequests.push(request.url()); });
  await page.goto('/data/items.html?q=Saber');
  await expect(page.locator('.item-row').first().locator('img')).toHaveAttribute('src', '/assets/img/items/wiki/29f6af4df3b08415.png');
  await page.locator('.category-tabs button').nth(1).click();
  await page.getByRole('searchbox').fill('Dress Plate');
  await expect(page.locator('.item-row')).toHaveCount(1);
  await expect(page.locator('.item-row img')).toHaveAttribute('src', '/assets/img/items/equipment/thumbs/dress-plate.webp');
  await page.getByLabel('只看有外观图的道具').check();
  await expect(page.locator('.item-row')).toHaveCount(1);
  await page.getByRole('searchbox').fill('Hunter Field');
  await expect(page.locator('.item-row')).toHaveCount(0);
  await page.getByLabel('只看有外观图的道具').uncheck();
  await expect(page.locator('.item-row img')).toHaveAttribute('src', '/assets/img/items/equipment/box-red.webp');
  expect(hdRequests).toEqual([]);
});

test('single-source and missing-image details have no unnecessary image switch', async ({page}) => {
  for (const [id, image] of [
    ['smoking-plate', '/assets/img/items/equipment/smoking-plate.webp'],
    ['stealth', items.find(item => item.id === 'stealth').image],
    ['god-power', '/assets/img/items/equipment/box-red.webp'],
  ]) {
    await page.goto(`/data/items/${id}.html`);
    await expect(page.locator('.image-stage img')).toHaveAttribute('src', image);
    await expect(page.locator('.image-switch')).toHaveCount(0);
    await expect.poll(() => page.locator('.image-stage img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
});

test('equipment previews show effects, models and rarity boxes across list and detail routes', async ({page}, testInfo) => {
  for (const [id, query, category, suffix, kind] of [
    ['aura-field', 'Aura Field', 'armor', 'thumbs/aura-field.webp', '效果预览'],
    ['secure-feet', 'Secure Feet', 'shield', 'thumbs/secure-feet.webp', '模型预览'],
    ['hunter-field', 'Hunter Field', 'armor', 'box-red.webp', '类别示意图'],
    ['celestial-armor', 'Celestial Armor', 'armor', 'box-blue.webp', '类别示意图'],
    ['god-power', 'God/Power', 'unit', 'box-red.webp', '类别示意图'],
    ['angel-luck', 'Angel/Luck', 'unit', 'box-blue.webp', '类别示意图'],
    ['cure-confuse', 'Cure/Confuse', 'unit', 'box-red.webp', '类别示意图'],
    ['addslot', 'AddSlot', 'tool', 'box-red.webp', '类别示意图'],
  ]) {
    await page.goto(`/data/items.html?category=${category}&q=${encodeURIComponent(query)}`);
    const image = page.locator('.item-row img');
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('src', `/assets/img/items/${category === 'shield' ? 'shields' : 'equipment'}/${suffix}`);
    await expect(image).toHaveAttribute('alt', new RegExp(kind));
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.locator('.item-row').click();
    await expect(page).toHaveURL(new RegExp(`/items/${id}\\.html`));
    await expect(page.locator('.image-stage img')).toHaveAttribute('alt', new RegExp(kind));
    await expect.poll(() => page.locator('.image-stage img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    if (kind === '类别示意图') await expect(page.locator('.item-figure')).toContainText('非装备外观');
    if (kind === '效果预览') await expect(page.locator('.item-figure')).toContainText('离线效果预览');
    if (id === 'addslot') {
      await page.screenshot({path: testInfo.outputPath('addslot-desktop.png')});
      await page.setViewportSize({width:390, height:844});
      await page.screenshot({path: testInfo.outputPath('addslot-mobile.png')});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('equipment preview descriptions are localized and a broken preview stays a load error', async ({page}) => {
  for (const [language, text] of [['en', 'Offline effect preview'], ['ja', 'オフラインのエフェクトプレビュー']]) {
    await page.goto(`/${language}/data/items/aura-field.html`);
    await expect(page.locator('.item-figure figcaption')).toContainText(text);
  }
  await page.route('**/assets/img/items/equipment/aura-field.webp', route => route.abort());
  await page.goto('/data/items/aura-field.html');
  await expect(page.locator('.image-stage')).toContainText('图片加载失败');
  await expect(page.locator('.image-stage img')).toHaveAttribute('src', '/assets/img/items/no-image.webp');
});

test('Smoking Plate preserves transparent background and black smoke in list and detail images', async ({page}, testInfo) => {
  for (const [url, selector] of [
    ['/data/items.html?category=armor&q=Smoking%20Plate', '.item-row img'],
    ['/data/items/smoking-plate.html', '.image-stage img'],
  ]) {
    await page.goto(url);
    const image = page.locator(selector);
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('alt', /效果预览/);
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const pixels = await image.evaluate(img => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(img, 0, 0);
      return { background: [...context.getImageData(0, 0, 1, 1).data],
        smoke: [...context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data] };
    });
    expect(pixels.background[3]).toBe(0);
    expect(pixels.smoke.slice(0, 3).every(channel => channel < 25)).toBe(true);
    expect(pixels.smoke[3]).toBeGreaterThan(0);
    await expect(image).toHaveCSS('mix-blend-mode', 'normal');
    await expect(image.locator('..')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(image.locator('..')).toHaveCSS('box-shadow', 'none');
  }
  await page.screenshot({ path: testInfo.outputPath('smoking-plate-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.image-stage img')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('smoking-plate-mobile.png') });
});

test('Stealth Suit shows a transparent character illustration in lists and details', async ({page}, testInfo) => {
  for (const [url, selector] of [
    ['/data/items.html?category=armor&q=Stealth%20Suit', '.item-row img'],
    ['/data/items/stealth-suit.html', '.image-stage img'],
  ]) {
    await page.goto(url);
    const image = page.locator(selector);
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('alt', /隐身效果示意/);
    await expect(image).toHaveCSS('opacity', '0.35');
    await expect(image.locator('..')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(image.locator('..')).toHaveCSS('box-shadow', 'none');
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const alpha = await image.evaluate(img => {
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      return {corner: pixels[3], visible: pixels.filter((v, i) => i % 4 === 3 && v > 0).length};
    });
    expect(alpha.corner).toBe(0);
    expect(alpha.visible).toBeGreaterThan(100);
  }
  await expect(page.locator('figcaption')).toContainText('角色透明度仅用于说明');
  await page.screenshot({path: testInfo.outputPath('stealth-suit-desktop.png')});
  await page.getByRole('button', {name:'高清图片', exact:true}).click();
  await expect(page.locator('.image-stage img')).toHaveAttribute('src', '/assets/img/items/hd/items/stealth-suit.webp');
  await expect(page.locator('.image-stage img')).toHaveCSS('opacity', '1');
  await page.getByRole('button', {name:'隐身效果示意', exact:true}).click();
  await expect(page.locator('.image-stage img')).toHaveCSS('opacity', '0.35');
  await page.setViewportSize({width:390, height:844});
  await page.screenshot({path: testInfo.outputPath('stealth-suit-mobile.png')});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('new armor particle previews replace boxes in mobile lists and detail pages', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  for (const [id, code, blend] of [['chu-chu-fever', '01012C', 'normal'], ['virus-armor-lafuteria', '01012F', 'plus-lighter']]) {
    await page.goto(`/data/items.html?category=armor&q=${code}`);
    await expect(page.locator('.item-row')).toHaveCount(1);
    await expect(page.locator('.item-row img')).toHaveAttribute('src', `/assets/img/items/equipment/thumbs/${id}.webp`);
    await page.locator('.mobile-filter').click();
    await page.getByLabel('只看有外观图的道具').check();
    await expect(page.locator('.item-row')).toHaveCount(1);
    await page.goto(`/data/items/${id}.html`);
    await expect(page.locator('.image-stage img')).toHaveAttribute('src', `/assets/img/items/equipment/${id}.webp`);
    await expect(page.locator('.image-stage img')).toHaveCSS('mix-blend-mode', blend);
    await expect(page.locator('figcaption')).toContainText('离线效果预览');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('all particle previews retain alpha in full images and thumbnails', async ({page}) => {
  const effects = items.filter(item => item.imageKind === 'effect');
  expect(effects).toHaveLength(57);
  await page.goto('/data/items/aura-field.html');
  for (const item of effects) {
    for (const src of [item.image, item.image.replace(/\/(equipment|shields)\//, '/$1/thumbs/')]) {
      const pixels = await page.evaluate(async src => {
        const image = new Image(); image.src = src; await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0, translucent = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) visible++;
          if (data[i] > 0 && data[i] < 255) translucent++;
        }
        return {corner: data[3], visible, translucent};
      }, src);
      expect(pixels.corner, src).toBe(0);
      expect(pixels.visible, src).toBeGreaterThan(0);
      expect(pixels.translucent, src).toBeGreaterThan(0);
    }
    await page.goto(`/data/items/${item.id}.html`);
    await expect(page.locator('.image-stage img')).toHaveCSS('mix-blend-mode', item.imageBlend === 'additive' ? 'plus-lighter' : 'normal');
    await expect(page.locator('.image-stage item-image')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('.image-stage item-image')).toHaveCSS('box-shadow', 'none');
  }
});

test('Wedding Dress and Dress Plate default to particles and keep HD as an optional view', async ({page}, testInfo) => {
  for (const id of ['wedding-dress', 'dress-plate']) {
    await page.goto(`/data/items/${id}.html`);
    const image = page.locator('.image-stage img');
    await expect(image).toHaveAttribute('src', `/assets/img/items/equipment/${id}.webp`);
    await expect(image).toHaveAttribute('alt', /效果预览/);
    await expect(image).toHaveCSS('mix-blend-mode', 'plus-lighter');
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.screenshot({path: testInfo.outputPath(`${id}.png`)});
    await page.getByRole('button', {name:'高清图片', exact:true}).click();
    await expect(image).toHaveAttribute('src', `/assets/img/items/hd/items/${id}.webp`);
    await expect(image).toHaveCSS('mix-blend-mode', 'normal');
    await page.getByRole('button', {name:'效果预览', exact:true}).click();
    await expect(image).toHaveAttribute('src', `/assets/img/items/equipment/${id}.webp`);
  }
});

test('a failed HD image remains switchable to the existing Wiki image', async ({page}) => {
  await page.route('**/assets/img/items/hd/items/saber.webp', route => route.abort());
  await page.goto('/data/items/saber.html');
  await expect(page.locator('.image-stage')).toContainText('图片加载失败');
  await expect(page.locator('.image-stage img')).toHaveAttribute('src', '/assets/img/items/no-image.webp');
  await page.getByRole('button', {name:'现有图片', exact:true}).click();
  await expect(page.locator('.image-stage img')).toHaveAttribute('src', '/assets/img/items/wiki/29f6af4df3b08415.png');
  await expect.poll(() => page.locator('.image-stage img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.image-stage')).not.toContainText('图片加载失败');
});

test('related navigation resets the image selection for the next item', async ({page}) => {
  await page.goto('/data/items/lavis-cannon.html');
  await page.getByRole('button', {name:'现有图片', exact:true}).click();
  const related = page.locator('.related-items a').first();
  const targetId = (await related.getAttribute('href')).match(/\/items\/([^/?]+)\.html/)[1];
  const target = items.find(item => item.id === targetId);
  expect(target.hdImage).toBeTruthy();
  await related.click();
  await expect(page.locator('.image-stage img')).toHaveAttribute('src', target.hdImage);
  await expect(page.getByRole('button', {name:'高清图片', exact:true})).toHaveAttribute('aria-pressed', 'true');
});

test('lists browse one subcategory, searches cover the category, and paging works from the top', async ({page}) => {
  await page.goto('/data/items.html');
  await expect(page.locator('#type-filter')).toHaveValue('光剑');
  await expect(page.locator('.item-row')).toHaveCount(24);
  const sabers = listedSabers.length;
  await expect(page.locator('.result-toolbar strong')).toHaveText(String(sabers));
  const steps = page.locator('.page-steps');
  await expect(steps).toContainText(`1 / ${Math.ceil(sabers / 24)}`);
  await steps.getByRole('button', {name:'下一页', exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(steps).toBeInViewport();
  await steps.getByRole('button', {name:'上一页', exact:true}).click();
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.locator('#type-filter optgroup')).toHaveCount(2);
  await expect(page.locator('#type-filter option[value="光剑"]')).toHaveText(`光剑 (${sabers})`);
  await page.locator('#type-filter').selectOption('TypeM 武器');
  await expect(page.locator('.result-toolbar strong')).toHaveText('30');
  await expect(page.locator('.item-row').first()).toHaveAttribute('href', /\/typesa-saber\.html\?/);
  await expect(page.locator('.item-row').first().locator('[lang="en"]')).toHaveText('TypeSA/SABER');
  await page.locator('#type-filter').selectOption('ES 武器');
  await expect(page.locator('.result-toolbar strong')).toHaveText('30');
  await page.locator('#type-filter').selectOption('步枪');
  await expect(page).toHaveURL(/type=%E6%AD%A5%E6%9E%AA|type=步枪/);
  await expect(page.locator('.item-row').first()).toContainText('Rifle');
  await expect(page.locator('.item-row[href*="/typeri-rifle.html?"]')).toHaveCount(0);
  await page.getByRole('searchbox').fill('TypeSH');
  await expect(page.locator('.item-row')).toHaveCount(1);
  await expect(page.locator('.item-row')).toHaveAttribute('href', /\/typesh-shot\.html\?/);
  await expect(page.locator('.item-row [lang="en"]')).toHaveText('TypeSH/SHOT');
  await expect(page.locator('#type-filter')).toBeDisabled();
  await expect(page.locator('.filters')).toContainText('搜索时不限细分类别。');
  await page.getByRole('searchbox').fill('');
  await expect(page.locator('#type-filter')).toBeEnabled();
  await expect(page.locator('#type-filter')).toHaveValue('步枪');
});

test('pagination, jump input, and detail back navigation retain the list', async ({page}) => {
  await page.goto('/data/items.html?category=weapon');
  await page.getByLabel('跳转页码').fill('2');
  await page.getByLabel('跳转页码').press('Enter');
  await expect(page).toHaveURL(/page=2/);
  // Row links carry the list query, so this waits for page 2 to render before reading it.
  await expect(page.locator('.item-row').first()).toHaveAttribute('href', /page=2/);
  const first = await page.locator('.item-row').first().getAttribute('href');
  await page.locator('.item-row').first().click();
  await expect(page.locator('#item-title')).toBeVisible();
  await page.getByRole('link', {name:'← 返回道具列表',exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.item-row').first()).toHaveAttribute('href',first);
});

test('base stats, grinding, targets and replica identities stay distinct', async ({page}) => {
  await page.goto('/data/items/dbs-saber.html');
  await expect(page.locator('#attributes')).toContainText('288–338');
  await expect(page.locator('#attributes')).not.toContainText('288–328');
  await page.goto('/data/items/sword.html');
  await expect(page.locator('#attributes')).toContainText('普通攻击目标数10');
  await page.goto('/data/items/neis-claw-replica.html');
  await expect(page.locator('#item-title')).toHaveText("Nei's Claw (Replica)");
  await expect(page.locator('.source-section')).toContainText('000D02');
});

test('empty results and malformed pagination recover', async ({page}) => {
  await page.goto('/data/items.html?q=not-a-real-item&page=Infinity');
  await expect(page.getByRole('heading',{name:'没有找到匹配的道具'})).toBeVisible();
  await page.getByRole('button',{name:'清除全部条件'}).click();
  await expect(page.locator('.item-row')).toHaveCount(24);
  await page.goto('/data/items.html?page=9999');
  const sabers = listedSabers.length;
  await expect(page.locator('.item-row')).toHaveCount(sabers % 24 || 24);
  await expect(page.getByLabel('跳转页码')).toHaveValue(String(Math.ceil(sabers / 24)));
});

test('unknown rarity, historical items and unavailable items are explicit', async ({page}) => {
  await page.goto('/data/items.html?category=mag&rarity=unknown');
  await expect(page.locator('.item-row')).toHaveCount(24);
  await page.goto('/data/items.html?q=Star%20Song');
  await expect(page.locator('.item-row')).toHaveCount(1);
  await expect(page.locator('.item-row')).toContainText('当前无法获取');
  await page.goto('/data/items/1st-anniv-bronze-badge.html');
  await expect(page.locator('.detail-overview')).toContainText('历史道具');
});

test('Mag and item-specific details render supported mechanics', async ({page}) => {
  await page.goto('/data/items/sato.html');
  await expect(page.locator('#attributes')).toContainText('0–35%');
  await expect(page.locator('#attributes')).toContainText('PSOBB 不启用死亡触发');
  await page.goto('/data/items/psycho-wand.html');
  await expect(page.locator('#effects')).toContainText('魔法加成');
  await expect(page.locator('#effects')).toContainText('TP 消耗减半');
  await page.goto('/data/items/v101.html');
  await expect(page.locator('.drop-table')).toContainText('1/2048');
});

for (const width of [390,820,1280]) {
  test(`list and long details pass accessibility and overflow checks at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    for (const path of ['/data/items.html','/data/items/nidra.html','/data/items/addslot.html','/data/items/saber.html']) {
      await page.goto(path);
      await expect(page.getByRole('heading',{level:1})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    }
  });
}

test('mobile filters expose image-only results with real local files', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/data/items.html');
  await expect(page.locator('#catalog-filters')).toBeHidden();
  await page.getByRole('button',{name:'筛选条件'}).click();
  await page.getByLabel('只看有外观图的道具').check();
  await expect(page.locator('.result-toolbar')).toContainText(String(listedSabers.filter(item => item.image).length));
  await expect(page.locator('.item-row')).toHaveCount(24);
  expect(await page.locator('.item-row').first().locator('img').evaluate(img=>img.complete && img.naturalWidth > 0)).toBe(true);
});

test('section links and related navigation update the scroll position', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  for (const lang of ['zh','en','ja']) {
    await page.goto(`${lang === 'zh' ? '' : `/${lang}`}/data/items/lavis-cannon.html#effects`);
    await expect.poll(()=>page.locator('#effects').evaluate(n=>Math.abs(n.getBoundingClientRect().top))).toBeLessThan(50);
    const link = page.locator('.related-items a').first();
    const target = new URL(await link.getAttribute('href'), page.url()).href;
    await link.click();
    await expect(page).toHaveURL(target);
    await expect(page.locator('#item-title')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  }
});

test('details load on demand and a failed request has an explicit retry state', async ({page}) => {
  const requests = [];
  page.on('request',r=>{if(r.url().includes('/assets/data/items/'))requests.push(r.url());});
  await page.goto('/data/items.html?category=unit&q=V801');
  expect(requests).toEqual([]);
  await page.route(/\/assets\/data\/items\/v801\.json\?v=[0-9a-f]{12}$/,route=>route.abort());
  await expect(page.locator('.item-row')).toHaveCount(1);
  await page.locator('.item-row').click();
  await expect(page.getByRole('heading',{name:'道具资料暂时未能加载'})).toBeVisible();
  await page.unroute(/\/assets\/data\/items\/v801\.json\?v=[0-9a-f]{12}$/);
  await page.getByRole('button',{name:'重新加载'}).click();
  await expect(page.locator('#item-title')).toBeVisible();
  await expect(page.locator('#item-title')).toHaveText('V801');
  expect(requests).toHaveLength(1);
});

test('cosmetics overview covers weapon hearts, ring paints and platings with working links', async ({page}) => {
  const overview = JSON.parse(readFileSync('src/app/generated/item-catalog/cosmetics.json', 'utf8'));
  await page.goto('/data/cosmetics.html');
  await expect(page.locator('#cosmetics-title')).toHaveText('外观道具');
  await expect(page.locator('#weapon-hearts .cosmetic-card')).toHaveCount(overview.hearts.length);
  await expect(page.locator('#ring-paints .cosmetic-card')).toHaveCount(overview.paints.length);
  await expect(page.locator('#ring-platings .cosmetic-card')).toHaveCount(overview.platings.length);
  const samba = page.locator('#heart-of-samba-maracas');
  await expect(samba).toContainText('桑巴沙锤');
  for (const weapon of ['dual-bird', 'guld-milla', 'manda60-vise', 'mille-marteaux']) {
    await expect(samba.locator(`a[href="/data/items/${weapon}.html"]`)).toHaveCount(1);
  }
  await expect(page.locator('#heart-of-flamberge')).toContainText('蓝色');
  await expect(page.locator('#onyx-paint')).toContainText('漆黑色');
  await expect(page.locator('#onyx-paint')).toContainText('× 99');
  await expect(page.locator('#deep-plating')).toContainText('V502 × 1');
  const requests = [];
  page.on('request', r => { if (r.url().includes('/assets/data/items/')) requests.push(new URL(r.url())); });
  await samba.getByRole('heading').getByRole('link').click();
  await expect(page).toHaveURL(/\/data\/items\/heart-of-samba-maracas\.html$/);
  await expect(page.locator('#item-title')).toHaveText(names['Heart of Samba Maracas'].zh);
  await expect(page.locator('#effects .cosmetic-links a')).toHaveText(['双翎', '伽尔德·米拉', 'M&A60 老虎钳', '米尔·马尔托'].map(name => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  expect(requests.map(url => url.pathname)).toEqual(['/assets/data/items/heart-of-samba-maracas.json']);
  expect(requests[0].searchParams.get('v')).toMatch(/^[0-9a-f]{12}$/);
  await page.getByRole('link', {name: '查看全部外观道具 →'}).click();
  await expect(page).toHaveURL(/\/data\/cosmetics\.html#weapon-hearts$/);
});

test('equipment detail pages list the cosmetic items that apply to them', async ({page}) => {
  await page.goto('/en/data/items/excalibur.html');
  const hearts = page.locator('#effects h3', {hasText: 'Available cosmetic items'}).locator('xpath=following-sibling::ul[1]/li');
  await expect(hearts).toHaveCount(5);
  await expect(hearts.first()).toContainText('Lollipop');
  await page.goto('/data/items/red-ring.html');
  await expect(page.locator('#effects h3', {hasText: '可用外观道具'}).locator('xpath=following-sibling::ul[1]/li')).toHaveCount(22);
  await page.goto('/ja/data/items/deep-plating.html');
  await expect(page.locator('#effects')).toContainText('The Forge での交換に必要なアイテム');
  await expect(page.locator('#effects .cosmetic-links').last().locator('li')).toHaveCount(7);
  await expect(page.locator('#effects .cosmetic-links').last()).toContainText('× 10');
  await expect(page.locator('#effects')).not.toContainText('{|');
});

for (const width of [390, 1280]) {
  test(`cosmetics overview is accessible and fits at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    for (const lang of ['zh', 'en', 'ja']) {
      await page.goto(`${lang === 'zh' ? '' : `/${lang}`}/data/cosmetics.html`);
      await expect(page.locator('main.catalog-shell')).toHaveAttribute('lang', lang === 'zh' ? 'zh-CN' : lang);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
    }
    await expect(page).toHaveTitle(/外観アイテム/);
  });
}

test('monster detail requests carry the dataset version', async ({page}) => {
  const requests = [];
  page.on('request', r => { if (r.url().includes('/assets/data/monsters/')) requests.push(new URL(r.url())); });
  await page.goto('/data/enemies.html');
  await page.locator('a[href*="/data/enemies/"]').first().click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].searchParams.get('v')).toMatch(/^[0-9a-f]{12}$/);
});


test('primary item categories have no All option and reset keeps the selected category', async ({page}) => {
  for (const lang of ['zh','en','ja']) {
    await page.goto(`${lang === 'zh' ? '' : `/${lang}`}/data/items.html`);
    await expect(page.locator('.category-tabs button')).toHaveCount(6);
    await expect(page.locator('.category-tabs button').first()).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.item-row').first()).toHaveAttribute('href',/category=weapon/);
    await expect(page.locator('#type-filter')).toHaveValue('光剑');
    await expect(page.locator('#type-filter option[value=""]')).toHaveCount(0);
    await expect(page.locator('#status-filter')).toHaveCount(0);
    await expect(page.locator('#class-filter option').first()).toHaveAttribute('value','');
    await expect(page.locator('#rarity-filter option').first()).toHaveAttribute('value','');
  }
  await page.goto('/en/data/items.html?category=unit&q=nonexistent');
  await page.getByRole('button',{name:'Clear all filters',exact:true}).click();
  await expect(page).toHaveURL(/category=unit/);
  await expect(page.locator('.category-tabs button[aria-pressed="true"]')).toContainText('Units');
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page.goto('/en/data/items/v801.html');
  await page.getByRole('link',{name:'← Back to item list',exact:true}).click();
  await expect(page).toHaveURL(/category=unit/);
  await page.reload();
  await expect(page.locator('.category-tabs button[aria-pressed="true"]')).toContainText('Units');
});
