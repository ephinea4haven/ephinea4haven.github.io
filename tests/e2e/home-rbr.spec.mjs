import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const data=JSON.parse(readFileSync('data/rbr/source.json','utf8'));
const {rbr:ratings}=JSON.parse(readFileSync('data/rbr/tiers.json','utf8'));
const paletteSource=readFileSync('data/droptable/bb/data/zh.js','utf8');
const sectionIds=JSON.parse(paletteSource.match(/"sectionIds"\s*:\s*(\[[^\]]+\])/)[1]);
const sectionColors=JSON.parse(paletteSource.match(/"sectionColors"\s*:\s*(\[[^\]]+\])/)[1]);
const sunday=new Date(`${data.current.week} 00:00:00 GMT`);
test('home renders source RBR quests and opens the RBR detail page',async({page})=>{
  await page.clock.install({time:new Date(sunday.getTime()+86400000)});
  await page.goto('/');
  const panel=page.locator('.home-rbr');
  await expect(panel.getByRole('heading')).toHaveText('本周 RBR 任务');
  await expect(panel.locator('.home-rbr-quest')).toHaveCount(data.current.quests.length);
  for(const [index,quest] of data.current.quests.entries()){
    await expect(panel.locator('.home-rbr-quest').nth(index)).toContainText(quest.name);
    await expect(panel.locator('.home-rbr-quest').nth(index)).toHaveAttribute('href','/guide/rbr.html');
    const card=panel.locator('.home-rbr-quest').nth(index);
    const tier=Object.entries(ratings.tiers).find(([,quests])=>quests.includes(quest.abbreviation))[0];
    const section=ratings.recommendedSectionIds[quest.abbreviation];
    await expect(card.locator('.home-rbr-tier')).toHaveText(`Tier ${tier}`);
    await expect(card.locator('.home-rbr-section')).toHaveText(`推荐 ID · ${section}`);
    const color=sectionColors[sectionIds.indexOf(section)];
    const rgb=`rgb(${color.slice(1).match(/../g).map(hex=>parseInt(hex,16)).join(', ')})`;
    await expect(card).toHaveCSS('border-top-color',rgb);
    const icon=card.locator('.home-rbr-section img');
    await expect(icon).toHaveAttribute('src',`/assets/img/section/icon/${section}.png`);
    await expect(icon).toBeVisible();
    await expect.poll(()=>icon.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  }
  await expect(panel.locator('.home-rbr-note')).toContainText(ratings.asOf);
  await panel.locator('.home-rbr-quest').first().click();
  await expect(page).toHaveURL(/\/guide\/rbr.html$/);
  await expect(page.locator('#rbr-tracker-episodes')).toContainText(data.current.quests[0].abbreviation);
});
test('home marks stale rotations across the UTC Sunday boundary',async({page})=>{
  await page.clock.install({time:new Date(sunday.getTime()+7*86400000-60000)});
  await page.setViewportSize({width:390,height:850});
  await page.goto('/');
  await expect(page.locator('.home-rbr h2')).toHaveText('本周 RBR 任务');
  await page.clock.fastForward(120000);
  await expect(page.locator('.home-rbr h2')).toHaveText('RBR 任务 · 待更新');
  await expect(page.locator('.home-rbr-status')).toContainText('本周轮替尚待核对');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
