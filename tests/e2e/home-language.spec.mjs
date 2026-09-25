import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
const {current}=JSON.parse(readFileSync('data/rbr/source.json','utf8'));
const week=new Date(`${current.week} 00:00:00 GMT`);
const home=(lang)=>lang==='zh'?'/':`/${lang}/`;
const authority=JSON.parse(readFileSync(process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json','utf8'));

for(const [lang,heading,title,galatine] of [
  ['zh','面向全球玩家的多语言维基','面向全球玩家',authority.items.Galatine.zh],
  ['en','A multilingual wiki for players worldwide','players worldwide','Galatine'],
  ['ja','世界中のプレイヤーのための多言語 Wiki','世界中のプレイヤー',authority.items.Galatine.ja],
]) test(`homepage supports direct ${lang} links and all text remains localized after ticks`,async({page})=>{
  await page.clock.install({time:new Date(week.getTime()+86400000)});
  await page.goto(home(lang));
  await expect(page.locator('.hero-title-sub')).toHaveText(heading);
  await expect(page).toHaveTitle(new RegExp(title));
  await expect(page.locator('html')).toHaveAttribute('lang',lang==='zh'?'zh-CN':lang);
  await expect(page.locator('#galatine h2')).toContainText(galatine);
  await expect(page.locator(`button[data-home-lang=${lang}]`)).toHaveAttribute('aria-pressed','true');
  await page.clock.fastForward(3000);
  await expect(page.locator('.home-rbr')).toHaveAttribute('data-status','fresh');
  if(lang==='en') {
    const copy=await page.locator('body').innerText();
    expect(copy.replace('中文','').replace('日本語','')).not.toMatch(/[\u3400-\u9fff]/);
    await expect(page.locator('#buf-next')).toContainText('Next week:');
  }
  await expect(page.locator('a[href*="timezone.html"]')).toHaveCount(0);
});

test('onboarding follows input language needs when switching languages',async({page})=>{
  await page.goto('/');
  const steps=page.locator('#start .step');
  const patch=page.locator('#chinese-patch-guide');
  for(const lang of ['zh','ja','en','zh']) {
    await page.locator(`[data-home-lang=${lang}]`).click();
    await expect(steps).toHaveCount(3);
    // The launcher guide has every language version, so the link follows the homepage's language.
    await expect(steps.nth(2)).toHaveAttribute('href',lang==='zh'?'/guide/launcher.html':`/${lang}/guide/launcher.html`);
    if(lang==='en') await expect(steps.nth(2)).not.toContainText('IME');
    else await expect(steps.nth(2)).toContainText('IME');
    if(lang==='zh') await expect(patch).toBeVisible();
    else await expect(patch).toBeHidden();
    await expect(page.locator('a[href="/guide/localized.html"]:visible')).toHaveCount(lang==='zh'?2:0);
    await expect(page.locator('#start a[href="/guide/ime.html"]')).toHaveCount(0);
  }
});

test('language selection opens separate URLs and is remembered across pages',async({page})=>{
  await page.goto('/?campaign=test#directory');
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page).toHaveURL(/\/en\/?\?campaign=test#directory$/);
  await expect(page).toHaveTitle(/players worldwide/);
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content',/tools in English, Japanese and Chinese\.$/);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href','https://www.psohaven.com/en/');
  await expect(page.locator('link[rel=alternate][hreflang=ja]')).toHaveAttribute('href','https://www.psohaven.com/ja/');
  await page.reload();
  await expect(page.locator('.hero-title-sub')).toHaveText('A multilingual wiki for players worldwide');
  await page.getByRole('link',{name:'Getting started',exact:true}).first().click();
  await expect(page).toHaveURL(/#start$/);
  await expect(page.locator('.hero-title-sub')).toHaveText('A multilingual wiki for players worldwide');
  // Links lead to the English version of pages that have one.
  await page.getByRole('link',{name:'Bestiary',exact:true}).click();
  await expect(page).toHaveURL(/\/en\/data\/enemies\.html/);
  await expect(page.locator('h1')).toHaveText('Bestiary');
  // The remembered choice opens the English version from a Chinese URL.
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.locator('.hero-title-sub')).toHaveText('A multilingual wiki for players worldwide');
  await page.goto('/ja/');
  await expect(page.locator('.hero-title-sub')).toHaveText('世界中のプレイヤーのための多言語 Wiki');
  const chart=page.locator('.tag-links a[href*="dropcharts.psohaven.com/bb/"]');
  await expect(chart).toHaveAttribute('href',/lang=ja/);
  await expect(chart).toHaveAttribute('href',/diff=Ultimate/);
});

test('language works without storage',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value:()=>{throw new Error('blocked');}});Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw new Error('blocked');}});});
  await page.goto('/');
  await expect(page.locator('.hero-title-sub')).toHaveText('面向全球玩家的多语言维基');
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('.hero-title-sub')).toHaveText('A multilingual wiki for players worldwide');
  await page.reload();
  await expect(page.locator('.hero-title-sub')).toHaveText('A multilingual wiki for players worldwide');
});

for(const date of ['2026-02-10T12:00:00Z','2026-04-01T12:00:00Z','2025-10-25T12:00:00Z','2026-01-01T12:00:00Z']) test(`seasonal content is translated at ${date}`,async({page})=>{
  await page.clock.setFixedTime(new Date(date));
  await page.goto('/en/');
  const activity=page.locator('[data-current-activity]:visible');
  await expect(activity).toHaveCount(1);
  await expect(activity.locator('h2')).toContainText(/Ephinea/);
  expect(await activity.innerText()).not.toMatch(/[\u3400-\u9fff]/);
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(activity.locator('h2')).toContainText('イベント');
  await page.getByRole('button',{name:'中文',exact:true}).click();
  await expect(activity.locator('h2')).toContainText('活动');
});

for(const timezoneId of ['Asia/Shanghai','America/Los_Angeles','Europe/London']) test.describe(`weekly transition in ${timezoneId}`,()=>{
 test.use({timezoneId});
 test('weekly data uses UTC and language updates do not change it',async({page})=>{
  await page.clock.install({time:new Date('2026-09-19T23:59:59Z')});
  await page.goto('/en/');
  await expect(page.locator('#buf-current')).toContainText('(RER)');
  await page.clock.fastForward(2000);
  await expect(page.locator('#buf-current')).toContainText('(RDR)');
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page.locator('#buf-current')).toContainText('(RDR)');
  await expect(page.locator('#buf-next')).toContainText('来週：');
 });
});

for(const width of [390,1280]) test(`all homepage languages fit and pass accessibility at ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/en/');
 for(const lang of ['en','ja','zh']) {
  await page.locator(`[data-home-lang=${lang}]`).click();
  await expect(page.locator(`[data-home-lang=${lang}]`)).toHaveAttribute('aria-pressed','true');
  if(lang==='en') await expect(page.locator('.hero-title-sub')).toHaveCSS('letter-spacing','normal');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.locator('.directory')).toHaveCSS('opacity','1');
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`home-${lang}-${width}.png`),fullPage:true});
 }
});
