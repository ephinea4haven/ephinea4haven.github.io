import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const items = Object.values(JSON.parse(readFileSync('src/app/generated/item-catalog/details.server.json', 'utf8')));
const names = JSON.parse(readFileSync(process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json', 'utf8')).items;

test('language changes preserve filters, sorting, pagination and authoritative names', async ({page}) => {
  await page.goto('/data/items.html?category=weapon&type=光剑&class=FOnewearl&sort=name&page=2');
  const ids = await page.locator('.item-row').evaluateAll(rows => rows.map(r => new URL(r.href).pathname));
  for (const [button,lang,title] of [['English','en','Item Database'],['日本語','ja','アイテム図鑑'],['中文','zh','道具图鉴']]) {
    await page.getByRole('button',{name:button,exact:true}).click();
    await expect(page.locator('#catalog-title')).toHaveText(title);
    const params = new URL(page.url()).searchParams;
    expect(Object.fromEntries(params)).toEqual({category:'weapon',type:'光剑',class:'FOnewearl',sort:'name',page:'2',lang});
    expect(await page.locator('.item-row').evaluateAll(rows => rows.map(r => new URL(r.href).pathname))).toEqual(ids);
    await expect(page.locator('html')).toHaveAttribute('lang',lang === 'zh' ? 'zh-CN' : lang);
  }
  await page.goto('/data/items.html?q=赤のセイバー&lang=ja');
  await expect(page.locator('.identity strong')).toHaveText(names['Red Saber'].ja);
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('.identity strong')).toHaveText('Red Saber');
  await page.getByRole('button',{name:'中文',exact:true}).click();
  await expect(page.locator('.identity strong')).toHaveText(names['Red Saber'].zh);
});

test('detail language persists through return, refresh and explicit shared links', async ({page}) => {
  await page.goto('/data/items.html?category=weapon&q=Saber');
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await page.locator('.item-row').first().click();
  await expect(page.locator('#item-title')).toHaveText('セイバー');
  await expect(page.locator('#effects .source-language')).toHaveText('仕様の説明（中国語原文）');
  await expect(page.locator('.effect-list.source-copy')).toHaveAttribute('lang','zh-CN');
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('#item-title')).toHaveText('Saber');
  await page.getByRole('link',{name:'← Back to item list',exact:true}).click();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page.getByRole('searchbox')).toHaveValue('Saber');
  await page.reload();
  await expect(page.locator('#catalog-title')).toHaveText('Item Database');
  await page.goto('/data/items.html');
  await expect(page.locator('#catalog-title')).toHaveText('Item Database');
  await page.goto('/data/items.html?lang=zh');
  await expect(page.locator('#catalog-title')).toHaveText('道具图鉴');
  await page.goto('/data/items.html?lang=en&q=missing-item');
  await page.getByRole('button',{name:'Clear all filters'}).click();
  await expect(page).toHaveURL(/items.html\?lang=en$/);
  await expect(page.locator('.item-row')).toHaveCount(24);
});

test('language works when browser preference storage is blocked', async ({page}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked','SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked','SecurityError'); };
  });
  await page.goto('/data/items/saber.html?lang=en');
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
  await expect(page).toHaveURL(/lang=en#attributes$/);
  await expect(page.locator('#attributes')).toContainText('HP drain1 / 5 sec (while moving)');
  await expect(page).toHaveTitle(/SOUL EATER|Soul Eater/);
  expect(requests).toEqual([]);
  await page.goto('/data/items/mag.html?lang=ja');
  await expect(page.locator('.feeding-table tbody tr').first().locator('td').first()).toHaveText('モノメイト');
  await page.goto('/data/items/psycho-wand.html?lang=en');
  await expect(page.locator('#effects')).toContainText('Rafoie');
  await expect(page.locator('#effects')).toContainText('+30% damage');
  await page.goto('/data/items/es-saber.html?lang=ja');
  await expect(page.locator('.detail-overview')).toContainText('日本語名未確認 · 英語表記');
});

test('English detail request failures expose translated retry and return controls', async ({page}) => {
  await page.goto('/data/items.html?lang=en&q=V801');
  await page.route('**/assets/data/items/v801.json',route=>route.abort());
  await page.locator('.item-row').click();
  await expect(page.getByRole('heading',{name:'Item details could not be loaded'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Retry'})).toBeVisible();
  await page.getByRole('link',{name:'Back to the database →'}).click();
  await expect(page.locator('#catalog-title')).toHaveText('Item Database');
  await expect(page).toHaveURL(/lang=en/);
});

for (const width of [390,820,1280]) {
  test(`English and Japanese layouts remain accessible at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    for (const lang of ['en','ja']) for (const path of ['/data/items.html?category=unit','/data/items/nidra.html','/data/items/addslot.html']) {
      await page.goto(`${path}${path.includes('?') ? '&' : '?'}lang=${lang}`);
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
  await page.goto('/data/items.html?lang=en');
  await page.locator('.item-row').first().hover();
  expect(await page.locator('.row-arrow').first().evaluate(n => ({transition:getComputedStyle(n).transitionDuration,transform:getComputedStyle(n).transform}))).toEqual({transition:'0s',transform:'none'});
});

test('the full inventory is prerendered with bounded per-item hydration data', () => {
  expect(items).toHaveLength(1044);
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
  await expect(page.locator('.item-row').first()).toContainText('Commander Blade');
  await expect(page.locator('.item-row').last()).toContainText("DB's Saber (3070)");
  await expect(page.locator('.item-list')).toContainText('Elysion');
  await expect(page.locator('.item-list')).not.toContainText('Ancient Saber');
});

test('equipment class filters exclude consumables and reset on the tools category', async ({page}) => {
  await page.goto('/data/items.html?class=HUmar&q=Monomate');
  await expect(page.locator('.item-row')).toHaveCount(0);
  await page.getByRole('button', {name: /其他道具 246/}).click();
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
  await expect(page.locator('.image-stage')).toContainText('图片加载失败');
  await expect(page.locator('.image-stage')).not.toContainText('暂无截图');
  await expect(page.getByRole('link',{name:'查看原图 ↗'})).toBeVisible();
});

test('pagination, jump input, and detail back navigation retain the list', async ({page}) => {
  await page.goto('/data/items.html?category=weapon');
  await page.getByLabel('跳转页码').fill('3');
  await page.getByLabel('跳转页码').press('Enter');
  await expect(page).toHaveURL(/page=3/);
  const first = await page.locator('.item-row').first().getAttribute('href');
  await page.locator('.item-row').first().click();
  await expect(page.locator('#item-title')).toBeVisible();
  await page.getByRole('link', {name:'← 返回道具列表',exact:true}).click();
  await expect(page).toHaveURL(/page=3/);
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
  await expect(page.locator('.item-row')).toHaveCount(12);
  await expect(page.getByLabel('跳转页码')).toHaveValue('44');
});

test('unknown rarity, historical items and unavailable items are explicit', async ({page}) => {
  await page.goto('/data/items.html?category=mag&rarity=unknown');
  await expect(page.locator('.item-row')).toHaveCount(24);
  await page.goto('/data/items.html?status=unavailable&q=Star%20Song');
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
    for (const path of ['/data/items.html','/data/items/nidra.html','/data/items/addslot.html']) {
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
  await page.getByLabel('只看有截图的道具').check();
  await expect(page.locator('.result-toolbar')).toContainText('524');
  await expect(page.locator('.item-row')).toHaveCount(24);
  expect(await page.locator('.item-row').first().locator('img').evaluate(img=>img.complete && img.naturalWidth > 0)).toBe(true);
});

test('section links and related navigation update the scroll position', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  for (const lang of ['zh','en','ja']) {
    await page.goto(`/data/items/lavis-cannon.html?lang=${lang}#effects`);
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
  await page.goto('/data/items.html?q=V801');
  expect(requests).toEqual([]);
  await page.route('**/assets/data/items/v801.json',route=>route.abort());
  await page.locator('.item-row').click();
  await expect(page.getByRole('heading',{name:'道具资料暂时未能加载'})).toBeVisible();
  await page.unroute('**/assets/data/items/v801.json');
  await page.getByRole('button',{name:'重新加载'}).click();
  await expect(page.locator('#item-title')).toBeVisible();
  await expect(page.locator('#item-title')).toHaveText('V801');
  expect(requests).toHaveLength(1);
});
