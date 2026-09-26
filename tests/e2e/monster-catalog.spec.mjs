import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { extractMechanicTables } from '../../scripts/extract_monster_mechanics.mjs';
// A page's URL without its language prefix.
const unprefixed=(href)=>new URL(href).pathname.replace(/^\/(en|ja)(?=\/)/,'');
const details=JSON.parse(readFileSync('src/app/generated/monster-catalog/details.server.json','utf8'));
const monsters=JSON.parse(readFileSync('src/app/generated/monster-catalog/index.json','utf8'));
// Browsing shows one region; EP1 opens on Forest, which includes the Dragon's room.
const forest=monsters.filter(m=>m.episode===1&&m.areas.some(a=>['Forest','Under the Dome'].includes(a))).length;
test('monster area search results are independent of the interface language',async({page})=>{
  for(const [term,ep] of [['森林','1'],['地下砂漠','4'],['遺跡 2','1']]) {
    await page.goto(`${term==='森林'?'':'/ja'}/data/enemies.html?ep=${ep}&q=${encodeURIComponent(term)}`);
    await expect(page.getByRole('searchbox')).toHaveValue(term);
    const paths=(await page.locator('.monster-row').evaluateAll(rows=>rows.map(row=>row.href))).map(unprefixed);
    expect(paths.length).toBeGreaterThan(0);
    for(const [language,prefix] of [['English','/en'],['日本語','/ja'],['中文','']]) {
      await page.getByRole('button',{name:language,exact:true}).click();
      await expect(page).toHaveURL(new RegExp(`127\\.0\\.0\\.1:\\d+${prefix}/data/enemies\\.html\\?`));
      await expect(page.getByRole('searchbox')).toHaveValue(term);
      await expect(page.locator('.monster-row')).toHaveCount(paths.length);
      expect((await page.locator('.monster-row').evaluateAll(rows=>rows.map(row=>row.href))).map(unprefixed)).toEqual(paths);
    }
    await page.reload();
    await expect(page.locator('.monster-row')).toHaveCount(paths.length);
  }
});

test('monster detail context changes preserve the originating list page',async({page})=>{
  await page.goto('/en/data/enemies.html?ep=1&q=a&page=2');
  const first=await page.locator('.monster-row').first().getAttribute('href');
  await page.locator('.monster-row').first().click();
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
  expect(unprefixed(new URL(await page.locator('.monster-row').first().getAttribute('href'),page.url()).href)).toBe(unprefixed(new URL(first,page.url()).href));
  await page.getByRole('button',{name:'ノーマル',exact:true}).click();
  await expect(page).not.toHaveURL(/page=/);
});

test('monster list title stays localized after query-only navigation',async({page})=>{
  await page.goto('/en/data/enemies.html');
  await expect(page).toHaveTitle(/Bestiary/);
  await page.getByRole('searchbox').fill('Booma');
  await expect(page).toHaveURL(/q=Booma/);
  await expect(page).toHaveTitle(/Bestiary/);
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page).toHaveURL(/\/ja\/data\/enemies\.html\?q=Booma$/);
  await page.getByRole('button',{name:'アルティメット',exact:true}).click();
  await expect(page).toHaveURL(/diff=u/);
  await expect(page).toHaveTitle(/エネミー図鑑/);
});

test('monster sections stay on the detail route and retain language and conditions',async({page})=>{
  await page.goto('/en/data/enemies/chaos-bringer.html?diff=u&mode=on');
  for(const section of ['drops','stats','attacks','behavior']) {
    await page.locator(`.section-nav a[fragment="${section}"], .section-nav a[href$="#${section}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/data/enemies/chaos-bringer.html\\?.*#${section}$`));
    await expect.poll(()=>page.locator(`#${section}`).evaluate(el=>Math.abs(el.getBoundingClientRect().top))).toBeLessThan(60);
  }
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page).toHaveURL(/\/ja\/data\/enemies\/chaos-bringer\.html\?.*#behavior$/);
  await page.getByRole('button',{name:'ハード',exact:true}).click();
  await expect(page).toHaveURL(/diff=h.*#behavior$/);
  await page.getByLabel('モード',{exact:true}).selectOption('off');
  await expect(page).toHaveURL(/mode=off.*#behavior$/);
  await page.reload();
  await expect.poll(()=>page.locator('#behavior').evaluate(el=>Math.abs(el.getBoundingClientRect().top))).toBeLessThan(60);
});
test('monster direct section links scroll to the requested content',async({page})=>{
  await page.goto('/en/data/enemies/chaos-bringer.html?diff=u#attacks');
  await expect.poll(()=>page.locator('#attacks').evaluate(el=>Math.abs(el.getBoundingClientRect().top))).toBeLessThan(60);
});
test('monster pagination scrolls to the first new result',async({page})=>{
  await page.goto('/en/data/enemies.html?q=a');
  await page.getByRole('button',{name:'Next →',exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.monster-row').first()).toBeInViewport();
});
test('the results heading pages like the bottom pager and stays in view',async({page})=>{
  await page.goto('/en/data/enemies.html?q=a');
  const steps=page.locator('.result-heading .page-steps');
  await expect(steps).toContainText('1 / 2');
  await steps.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(steps).toContainText('2 / 2');
  await expect(steps).toBeInViewport();
  await steps.getByRole('button',{name:'Previous',exact:true}).click();
  await expect(page).not.toHaveURL(/page=2/);
  await page.goto('/en/data/enemies.html');
  await expect(page.locator('.result-heading .page-steps')).toHaveCount(0);
});
test('Ultimate-only Megid tables never appear at lower difficulties',async({page})=>{
  for(const id of ['hildeblue-e1','hildeblue-e2','chaos-sorcerer-e1','chaos-sorcerer-e2','poison-lily-e1','nar-lily-e2','deldepth','zol-gibbon']) {
    await page.goto(`/en/data/enemies/${id}.html?diff=n`);
    await expect(page.locator('.mechanic-table').filter({has:page.getByRole('heading',{name:/^Megid level/})})).toHaveCount(0);
    await page.getByRole('button',{name:'Ultimate',exact:true}).click();
    await expect(page.locator('.mechanic-table').filter({has:page.getByRole('heading',{name:/^Megid level/})})).toHaveCount(1);
  }
  await page.goto('/en/data/enemies/del-lily.html?diff=n');
  await expect(page.locator('.mechanic-table').filter({has:page.getByRole('heading',{name:/^Megid level/})})).toHaveCount(1);
});
test('shared boss mechanics preserve source phase and trigger threshold',async({page})=>{
  await page.goto('/en/data/enemies/olga-flow-form-1.html');
  await expect(page.locator('#attacks')).toContainText('Behavior/Mechanics (Second phase)');
  await expect(page.locator('#attacks')).toContainText('Divine Punishment damage threshold');
  await expect(page.locator('#attacks')).toContainText('1280');
});
test('monster search, context and trilingual names survive detail and return',async({page})=>{
  await page.goto('/data/enemies.html?q=Booma&diff=n&mode=on');
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('エネミー図鑑');
  await page.locator('.monster-row').filter({has:page.getByRole('heading',{name:'ブーマ',exact:true})}).click();
  await expect(page.locator('h1')).toHaveText('ブーマ');
  await expect(page.locator('.hero-values strong').first()).toHaveText('92');
  await page.getByRole('button',{name:'アルティメット',exact:true}).click();
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
  await page.goto('/en/data/enemies/booma.html?diff=u');
  await expect(page.locator('.drop-card')).toHaveCount(10);
  for(let i=0;i<10;i++) await expect(page.locator('.drop-card').nth(i).locator('.rate')).toHaveText(details.booma.drops.u.cells[i].map(d=>d.rate));
  await expect(page.locator('#drops')).toContainText('already includes DAR');
  await page.locator('.drop-card a').first().click();
  await expect(page).toHaveURL(/\/en\/data\/items\//);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
});
test('damage facts retain mode conditions and unknowns, with behaviour notes in the page language',async({page})=>{
  await page.goto('/en/data/enemies/chaos-bringer.html?diff=u');
  await expect(page.locator('#attacks')).toContainText('700 or 1400');
  await expect(page.locator('.behavior-notes')).toContainText('knocks the player’s weapon off');
  await page.getByLabel('Mode',{exact:true}).selectOption('off');
  await expect(page.locator('#attacks')).toContainText('490 or 980');
  await expect(page.locator('#attacks')).not.toContainText('700 or 1400');
  await page.goto('/en/data/enemies/merillia.html?diff=u');
  await expect(page.locator('.unknown')).toContainText('Not specified by source');
});
test('missing stat phases and absent rows do not become zero values',async({page})=>{
  await page.goto('/en/data/enemies/dark-falz-form-3.html?diff=n');
  await expect(page.locator('#stats')).toContainText('No stats recorded');
  await expect(page.locator('#drops')).toContainText('boss-clear drops');
  await page.goto('/en/data/enemies/bee-r-e1.html');
  await expect(page.locator('#drops')).toContainText('No independent rare-drop row');
});
test('single-axis boss damage tabs select difficulty, not mode',async({page})=>{
  await page.goto('/en/data/enemies/kondrieu-phase-1.html?diff=u&mode=off');
  await expect(page.locator('.mechanic-table')).toHaveCount(1);
  await expect(page.locator('#attacks')).toContainText('440');
  await page.getByRole('button',{name:'Normal',exact:true}).click();
  await expect(page.locator('#attacks')).toContainText('110');
  await expect(page.locator('#attacks')).not.toContainText('440');
});
test('empty search and image failure remain usable',async({page})=>{
  await page.route('**/assets/img/monsters/**',route=>route.abort());
  await page.goto('/en/data/enemies.html?q=nonexistent');
  await expect(page.locator('.empty')).toContainText('No matching enemies');
  await page.getByRole('button',{name:'Clear filters'}).click();
  await expect(page.locator('.monster-row')).toHaveCount(forest);
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
  for(const url of ['/ja/data/enemies.html','/en/data/enemies/olga-flow-form-2.html?diff=u']){
    await page.goto(url);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await page.locator('monster-image img').evaluateAll(images=>images.every(image=>image.getBoundingClientRect().bottom<=image.parentElement.getBoundingClientRect().bottom+1))).toBe(true);
    const results=await new AxeBuilder({page}).include('.bestiary').withTags(['wcag2a','wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  }
});


test('episode selection has no All option and auxiliary resets preserve the chapter',async({page})=>{
  for(const lang of ['zh','en','ja']) {
    await page.goto(`${lang==='zh'?'':`/${lang}`}/data/enemies.html`);
    const episode=page.locator('.filters select').nth(0);
    await expect(episode).toHaveValue('1');
    await expect(episode.locator('option')).toHaveText(['EP1','EP2','EP4']);
    await expect(page.locator('.filters select').nth(1)).toHaveValue('Forest');
    await expect(page.locator('.filters select').nth(1).locator('option[value=""]')).toHaveCount(0);
    await expect(page.locator('.filters select').nth(2).locator('option').first()).toHaveAttribute('value','');
    const chapters=await page.locator('.monster-location span').allTextContents();
    expect(chapters.length).toBeGreaterThan(0);expect(chapters.every(x=>x==='EP1')).toBe(true);
  }
  await page.goto('/en/data/enemies.html?ep=4&q=nonexistent');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(page.locator('.filters select').first()).toHaveValue('4');
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page.locator('.monster-row').first().click();
  await page.getByRole('link',{name:'← Back to list',exact:true}).click();
  await expect(page.locator('.filters select').first()).toHaveValue('4');
  await page.goto('/en/data/enemies/boota.html');
  await page.getByRole('link',{name:'← Back to list',exact:true}).click();
  await expect(page.locator('.filters select').first()).toHaveValue('4');
  await page.reload();await expect(page.locator('.filters select').first()).toHaveValue('4');
});

test('portrait selection defaults to the model render, follows appearance and updates its full image link',async({page})=>{
  await page.goto('/en/data/enemies/booma.html');
  const portrait=page.locator('.portrait');const img=portrait.locator('img');
  await expect(portrait.locator('.image-switch button')).toHaveText(['Model render','HD image']);
  await expect(img).toHaveAttribute('src',details.booma.renderImage);
  await expect(portrait).toContainText('Image source: original model render');
  await expect(portrait.getByRole('link',{name:'View full image ↗'})).toHaveAttribute('href',details.booma.renderImage);
  await expect.poll(()=>img.evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
  await portrait.getByRole('button',{name:'HD image',exact:true}).click();
  await expect(img).toHaveAttribute('src',details.booma.hdImage);
  await expect(portrait).toContainText('Image source: HD gallery');
  await page.getByRole('button',{name:'Hard',exact:true}).click();
  await expect(page.getByRole('button',{name:'Hard',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(img).toHaveAttribute('src',details.booma.hdImage);
  await page.getByRole('button',{name:'Ultimate',exact:true}).click();
  await expect(img).toHaveAttribute('src',details.booma.ultimateRenderImage);
  expect(details.booma.ultimateRenderImage).not.toBe(details.booma.renderImage);
  await expect(portrait.getByRole('link')).toHaveAttribute('href',details.booma.ultimateRenderImage);
  await page.getByRole('button',{name:'Normal',exact:true}).click();
  await expect(img).toHaveAttribute('src',details.booma.renderImage);
});
test('alternate model poses are offered after the main render',async({page})=>{
  await page.goto('/en/data/enemies/olga-flow-form-1.html');
  const portrait=page.locator('.portrait');const img=portrait.locator('img');
  await expect(portrait.locator('.image-switch button')).toHaveText(['Model render','Ground pose','HD image','HD ground pose']);
  await expect(img).toHaveAttribute('src',details['olga-flow-form-1'].renderImage);
  await portrait.getByRole('button',{name:'Ground pose',exact:true}).click();
  await expect(img).toHaveAttribute('src',details['olga-flow-form-1'].renderAlternates[0].image);
  await expect(portrait).toContainText('Image source: original model render');
  await portrait.getByRole('button',{name:'HD ground pose',exact:true}).click();
  await expect(img).toHaveAttribute('src',details['olga-flow-form-1'].hdAlternates[0].image);
  await expect(portrait).toContainText('Image source: HD gallery');
  await page.goto('/data/enemies/olga-flow-form-1.html');
  await expect(page.locator('.portrait .image-switch button')).toHaveText(['模型渲染','地面姿势','高清图片','高清·地面姿势']);
});
test('the Wiki image is only the portrait of entries without a render or HD image',async({page})=>{
  await page.goto('/en/data/enemies/booma.html');
  await expect(page.locator('.portrait .image-switch button')).toHaveText(['Model render','HD image']);
  await page.goto('/en/data/enemies/vol-opt-form-1.html');
  await expect(page.locator('.image-switch')).toHaveCount(0);
  await expect(page.locator('.portrait img')).toHaveAttribute('src',/\/wiki\//);
  await expect(page.locator('.portrait')).toContainText('Image source: Ephinea Wiki');
  await expect.poll(()=>page.locator('.portrait img').evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
});
test('monster lists request no HD artwork',async({page})=>{
  const hd=[];page.on('request',request=>{if(request.url().includes('/monsters/hd/'))hd.push(request.url());});
  await page.goto('/en/data/enemies.html');
  await expect(page.locator('.monster-row')).toHaveCount(forest);
  await page.getByRole('button',{name:'Ultimate',exact:true}).click();
  await expect(page).toHaveURL(/diff=u/);
  expect(hd).toEqual([]);
});

const portraitButtons={render:'Model render',hd:'HD image'};
for(const [mode,alternate] of [['render','hd'],['hd','render']]) test(`a failed ${mode} portrait can be retried after changing image source`,async({page})=>{
  const pattern=`**/assets/img/monsters/${mode}/**`;
  await page.route(pattern,route=>route.abort());
  await page.goto('/en/data/enemies/booma.html');
  const portrait=page.locator('.portrait');
  const failedButton=portraitButtons[mode];
  const alternateButton=portraitButtons[alternate];
  if(mode!=='render') await portrait.getByRole('button',{name:failedButton,exact:true}).click();
  await expect(portrait.locator('monster-image')).toContainText('Image unavailable');
  await portrait.getByRole('button',{name:alternateButton,exact:true}).click();
  await expect.poll(()=>portrait.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  await page.unroute(pattern);
  await portrait.getByRole('button',{name:failedButton,exact:true}).click();
  await expect(portrait.locator('img')).toHaveAttribute('src',new RegExp(`/monsters/${mode}/`));
  await expect.poll(()=>portrait.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
});

for(const view of ['detail','list']) test(`a failed normal portrait can load again after changing difficulty in the ${view}`,async({page})=>{
  const normalImage=view==='detail'?details.booma.renderImage:JSON.parse(readFileSync('src/app/generated/monster-catalog/index.json')).find(m=>m.id==='booma').thumbnail;
  const pattern=`**${normalImage}`;
  await page.route(pattern,route=>route.abort());
  await page.goto(view==='detail'?'/en/data/enemies/booma.html':'/en/data/enemies.html?q=Booma');
  const portrait=page.locator(view==='detail'?'.portrait':'.monster-row[href*="/booma.html"]');
  await expect(portrait.locator('monster-image')).toContainText('Image unavailable');
  await page.getByRole('button',{name:'Ultimate',exact:true}).click();
  await expect(portrait.locator('img')).not.toHaveAttribute('src',normalImage);
  await expect.poll(()=>portrait.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  await page.unroute(pattern);
  await page.getByRole('button',{name:'Normal',exact:true}).click();
  await expect(portrait.locator('img')).toHaveAttribute('src',normalImage);
  await expect.poll(()=>portrait.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
});

test('difficulty buttons use client names and lists browse one area while searches span the episode',async({page})=>{
  for(const [prefix,names,area] of [['',['普通','困难','极难','极限'],'森林'],['/en',['Normal','Hard','Very Hard','Ultimate'],'Forest'],['/ja',['ノーマル','ハード','ベリーハード','アルティメット'],'森']]) {
    await page.goto(`${prefix}/data/enemies.html`);
    await expect(page.locator('.context-controls button')).toHaveText(names);
    const areaSelect=page.locator('.filters select').nth(1);
    await expect(areaSelect).toHaveValue('Forest');
    await expect(areaSelect.locator('option:checked')).toHaveText(area);
    await expect(page.locator('.monster-row')).toHaveCount(forest);
  }
  await page.goto('/data/enemies.html');
  await page.getByRole('button',{name:'极限',exact:true}).click();
  await expect(page).toHaveURL(/diff=u/);
  await page.locator('.filters select').nth(1).selectOption('Mine');
  await expect(page.locator('.monster-row').first()).toContainText('Gillchic');
  await page.getByRole('searchbox').fill('Booma');
  await expect(page.locator('.filters select').nth(1)).toBeDisabled();
  await expect(page.locator('.filters')).toContainText('搜索时不限区域。');
  await expect(page.locator('.monster-row')).not.toHaveCount(0);
  await page.getByRole('searchbox').fill('');
  await expect(page.locator('.filters select').nth(1)).toHaveValue('Mine');
});

test('each episode\'s regions together list every monster on a single page',async({page})=>{
  for(const ep of [1,2,4]) {
    await page.goto(`/en/data/enemies.html?ep=${ep}`);
    const regions=await page.locator('.filters select').nth(1).locator('option').evaluateAll(options=>options.map(o=>o.value));
    const seen=new Set();
    for(const region of regions) {
      await page.goto(`/en/data/enemies.html?ep=${ep}&area=${encodeURIComponent(region)}`);
      await expect(page.locator('.pagination span')).toHaveText('1 / 1');
      for(const href of await page.locator('.monster-row').evaluateAll(rows=>rows.map(r=>r.getAttribute('href'))))seen.add(href.split('?')[0].split('/').pop().replace('.html',''));
    }
    expect([...seen].sort()).toEqual(monsters.filter(m=>m.episode===ep).map(m=>m.id).sort());
  }
});
