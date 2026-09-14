import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { extractMechanicTables } from '../../scripts/extract_monster_mechanics.mjs';
const details=JSON.parse(readFileSync('src/app/generated/monster-catalog/details.server.json','utf8'));
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
