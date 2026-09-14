import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { extractMechanicTables } from '../../scripts/extract_monster_mechanics.mjs';
const details=JSON.parse(readFileSync('src/app/generated/monster-catalog/details.server.json','utf8'));
test('monster area search results are independent of the interface language',async({page})=>{
  for(const term of ['森林','地下砂漠','遺跡 2']) {
    await page.goto(`/data/enemies.html?q=${encodeURIComponent(term)}&lang=${term==='森林'?'zh':'ja'}`);
    await expect(page.getByRole('searchbox')).toHaveValue(term);
    const paths=await page.locator('.monster-card').evaluateAll(cards=>cards.map(card=>new URL(card.href).pathname));
    expect(paths.length).toBeGreaterThan(0);
    for(const language of ['English','日本語','中文']) {
      await page.getByRole('button',{name:language,exact:true}).click();
      await expect(page.getByRole('searchbox')).toHaveValue(term);
      await expect(page.locator('.monster-card')).toHaveCount(paths.length);
      expect(await page.locator('.monster-card').evaluateAll(cards=>cards.map(card=>new URL(card.href).pathname))).toEqual(paths);
    }
    await page.reload();
    await expect(page.locator('.monster-card')).toHaveCount(paths.length);
  }
});

test('monster detail context changes preserve the originating list page',async({page})=>{
  await page.goto('/data/enemies.html?ep=1&page=2&lang=en');
  const first=await page.locator('.monster-card').first().getAttribute('href');
  await page.locator('.monster-card').first().click();
  await page.locator('.section-nav a[href$="#stats"]').click();
  await page.getByRole('button',{name:'Ultimate',exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByLabel('Mode',{exact:true}).selectOption('off');
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page).toHaveURL(/page=2.*#stats$/);
  await page.getByRole('link',{name:'← 一覧に戻る',exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  expect(new URL(await page.locator('.monster-card').first().getAttribute('href'),page.url()).pathname).toBe(new URL(first,page.url()).pathname);
  await page.getByRole('button',{name:'Normal',exact:true}).click();
  await expect(page).not.toHaveURL(/page=/);
});

test('monster list title stays localized after query-only navigation',async({page})=>{
  await page.goto('/data/enemies.html?lang=en');
  await expect(page).toHaveTitle(/Bestiary/);
  await page.getByRole('searchbox').fill('Booma');
  await expect(page).toHaveURL(/q=Booma/);
  await expect(page).toHaveTitle(/Bestiary/);
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await page.getByRole('button',{name:'Ultimate',exact:true}).click();
  await expect(page).toHaveURL(/diff=u/);
  await expect(page).toHaveTitle(/エネミー図鑑/);
});

test('monster sections stay on the detail route and retain language and conditions',async({page})=>{
  await page.goto('/data/enemies/chaos-bringer.html?diff=u&mode=on&lang=en');
  for(const section of ['drops','stats','attacks','behavior']) {
    await page.locator(`.section-nav a[fragment="${section}"], .section-nav a[href$="#${section}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/data/enemies/chaos-bringer.html\\?.*#${section}$`));
    expect(await page.locator(`#${section}`).evaluate(el=>Math.abs(el.getBoundingClientRect().top)<60)).toBe(true);
  }
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page).toHaveURL(/lang=ja.*#behavior$/);
  await page.getByRole('button',{name:'Hard',exact:true}).click();
  await expect(page).toHaveURL(/diff=h.*#behavior$/);
  await page.getByLabel('モード',{exact:true}).selectOption('off');
  await expect(page).toHaveURL(/mode=off.*#behavior$/);
  await page.reload();
  await expect.poll(()=>page.locator('#behavior').evaluate(el=>Math.abs(el.getBoundingClientRect().top))).toBeLessThan(60);
});
test('monster direct section links scroll to the requested content',async({page})=>{
  await page.goto('/data/enemies/chaos-bringer.html?diff=u&lang=en#attacks');
  await expect.poll(()=>page.locator('#attacks').evaluate(el=>Math.abs(el.getBoundingClientRect().top))).toBeLessThan(60);
});
test('monster pagination scrolls to the first new result',async({page})=>{
  await page.goto('/data/enemies.html?lang=en');
  await page.getByRole('button',{name:'Next →',exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.monster-card').first()).toBeInViewport();
});
test('Ultimate-only Megid tables never appear at lower difficulties',async({page})=>{
  for(const id of ['hildeblue-e1','hildeblue-e2','chaos-sorcerer-e1','chaos-sorcerer-e2','poison-lily-e1','nar-lily-e2','deldepth','zol-gibbon']) {
    await page.goto(`/data/enemies/${id}.html?diff=n&lang=en`);
    await expect(page.locator('.mechanic-table').filter({has:page.getByRole('heading',{name:/^Megid level/})})).toHaveCount(0);
    await page.getByRole('button',{name:'Ultimate',exact:true}).click();
    await expect(page.locator('.mechanic-table').filter({has:page.getByRole('heading',{name:/^Megid level/})})).toHaveCount(1);
  }
  await page.goto('/data/enemies/del-lily.html?diff=n&lang=en');
  await expect(page.locator('.mechanic-table').filter({has:page.getByRole('heading',{name:/^Megid level/})})).toHaveCount(1);
});
test('shared boss mechanics preserve source phase and trigger threshold',async({page})=>{
  await page.goto('/data/enemies/olga-flow-form-1.html?lang=en');
  await expect(page.locator('#attacks')).toContainText('Behavior/Mechanics (Second phase)');
  await expect(page.locator('#attacks')).toContainText('Divine Punishment damage threshold');
  await expect(page.locator('#attacks')).toContainText('1280');
});
test('monster search, context and trilingual names survive detail and return',async({page})=>{
  await page.goto('/data/enemies.html?q=Booma&diff=n&mode=on');
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('エネミー図鑑');
  await page.locator('.monster-card').filter({has:page.getByRole('heading',{name:'ブーマ',exact:true})}).click();
  await expect(page.locator('h1')).toHaveText('ブーマ');
  await expect(page.locator('.hero-values strong').first()).toHaveText('92');
  await page.getByRole('button',{name:'Ultimate',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('バートル');
  await expect(page.locator('.hero-values strong').first()).toHaveText('2334');
  await page.getByLabel('モード',{exact:true}).selectOption('off');
  await expect(page.locator('.hero-values strong').first()).toHaveText('1556');
  await page.getByRole('link',{name:'← 一覧に戻る',exact:true}).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Booma');
  await expect(page).toHaveURL(/mode=off/);
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('Bestiary');
});
test('all section colors display source drop probabilities and item links',async({page})=>{
  await page.goto('/data/enemies/booma.html?diff=u&lang=en');
  await expect(page.locator('.drop-card')).toHaveCount(10);
  for(let i=0;i<10;i++) await expect(page.locator('.drop-card').nth(i).locator('.rate')).toHaveText(details.booma.drops.u.cells[i].map(d=>d.rate));
  await expect(page.locator('#drops')).toContainText('already includes DAR');
  await page.locator('.drop-card a').first().click();
  await expect(page).toHaveURL(/\/data\/items\/.*lang=en/);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
});
test('damage facts retain mode conditions, unknowns, and mechanics source language',async({page})=>{
  await page.goto('/data/enemies/chaos-bringer.html?diff=u&lang=en');
  await expect(page.locator('#attacks')).toContainText('700 or 1400');
  await expect(page.locator('.behavior-notes')).toHaveAttribute('lang','zh-CN');
  await page.getByLabel('Mode',{exact:true}).selectOption('off');
  await expect(page.locator('#attacks')).toContainText('490 or 980');
  await expect(page.locator('#attacks')).not.toContainText('700 or 1400');
  await page.goto('/data/enemies/merillia.html?diff=u&lang=en');
  await expect(page.locator('.unknown')).toContainText('Not specified by source');
});
test('missing stat phases and absent rows do not become zero values',async({page})=>{
  await page.goto('/data/enemies/dark-falz-form-3.html?diff=n&lang=en');
  await expect(page.locator('#stats')).toContainText('No stats recorded');
  await expect(page.locator('#drops')).toContainText('boss-clear drops');
  await page.goto('/data/enemies/bee-r-e1.html?lang=en');
  await expect(page.locator('#drops')).toContainText('No independent rare-drop row');
});
test('single-axis boss damage tabs select difficulty, not mode',async({page})=>{
  await page.goto('/data/enemies/kondrieu-phase-1.html?diff=u&mode=off&lang=en');
  await expect(page.locator('.mechanic-table')).toHaveCount(1);
  await expect(page.locator('#attacks')).toContainText('440');
  await page.getByRole('button',{name:'Normal',exact:true}).click();
  await expect(page.locator('#attacks')).toContainText('110');
  await expect(page.locator('#attacks')).not.toContainText('440');
});
test('empty search and image failure remain usable',async({page})=>{
  await page.route('**/assets/img/monsters/**',route=>route.abort());
  await page.goto('/data/enemies.html?q=nonexistent&lang=en');
  await expect(page.locator('.empty')).toContainText('No matching enemies');
  await page.getByRole('button',{name:'Clear filters'}).click();
  await expect(page.locator('.monster-card')).toHaveCount(24);
  await expect(page.locator('monster-image').first()).toContainText('Image unavailable');
});
test('source table extractor keeps nested difficulty, row spans, notes and empty numbers',async({page})=>{
  await page.goto('/data/enemies.html');
  const source='<div class="mw-parser-output"><h2><span class="mw-headline">Behavior/Mechanics</span></h2><h3><span class="mw-headline" id="fixed">Fixed damage</span></h3><div class="tabbertab" title="Ultimate"><div class="tabbertab" title="One Person"><table class="wikitable"><tr><th>Area</th><th>Attack</th><th>Damage</th></tr><tr><td rowspan="2">Forest</td><td><span title="Landing">Jump</span></td><td>5</td></tr><tr><td>Unknown</td><td></td></tr></table></div></div></div>';
  const value=await page.evaluate(({source,fn})=>{const extract=(0,eval)('('+fn+')');return extract(new DOMParser().parseFromString(source,'text/html'));},{source,fn:extractMechanicTables.toString()});
  expect(value[0].context).toEqual(['Ultimate','One Person']);
  expect(value[0].rows[2]).toEqual(['Forest','Unknown','']);
  expect(value[0].rows[1][1]).toBe('Jump (Landing)');
  expect(value[0].headings).toEqual(['Behavior/Mechanics','Fixed damage']);
});
test('source table extractor retains an attack usage table and its phase ancestors',async({page})=>{
  await page.goto('/data/enemies.html');
  const html='<div class="mw-parser-output"><h2><span class="mw-headline">Behavior/Mechanics (Second phase)</span></h2><h3><span class="mw-headline">Divine Punishment</span></h3><h4><span class="mw-headline" id="Usage">Usage</span></h4><table class="wikitable"><caption>Damage threshold</caption><tr><th>Difficulty</th><th>Threshold</th></tr><tr><td>Ultimate</td><td>750</td></tr></table></div>';
  const value=await page.evaluate(({html,fn})=>(0,eval)('('+fn+')')(new DOMParser().parseFromString(html,'text/html')),{html,fn:extractMechanicTables.toString()});
  expect(value).toHaveLength(1);
  expect(value[0].headings).toEqual(['Behavior/Mechanics (Second phase)','Divine Punishment','Usage']);
  expect(value[0].anchor).toBe('Usage');
});
for(const width of [390,1280]) test(`monster pages fit viewport and pass accessibility at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  for(const url of ['/data/enemies.html?lang=ja','/data/enemies/olga-flow-form-2.html?diff=u&lang=en']){
    await page.goto(url);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await page.locator('monster-image img').evaluateAll(images=>images.every(image=>image.getBoundingClientRect().bottom<=image.parentElement.getBoundingClientRect().bottom+1))).toBe(true);
    const results=await new AxeBuilder({page}).include('.bestiary').withTags(['wcag2a','wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  }
});
