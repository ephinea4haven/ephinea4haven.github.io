import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { messages } from '../../src/app/ep3-card-catalog/ep3-card.messages.ts';
const cards=JSON.parse(readFileSync('content/ep3-card-catalog/cards.json','utf8')).cards;

test('@smoke EP3 browsing retains filters and language through details',async({page})=>{
  await page.goto('/data/ep3-cards.html');
  await expect(page.locator('.category-tabs button .count')).toHaveText(['26','26','259','120','156','75']);
  await expect(page.locator('.category-tabs button').first()).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.card-table thead th')).toHaveText(['卡牌','卡牌等级','HP','AP','TP','MV']);
  await expect(page.locator('.translation-notice')).toContainText('卡牌名称与说明暂未翻译为中文');
  await page.getByRole('checkbox').check();
  await expect(page.locator('.category-tabs button .count')).toHaveText(['39','39','259','120','168','75']);
  await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByLabel('Name search',{exact:true}).fill('BEARS CANE +');
  await expect(page.locator('.card-row')).toHaveCount(1);
  await page.locator('.card-row').click();
  await expect(page.locator('h1')).toHaveText("Hildebear's Cane+");
  await page.getByRole('button',{name:'日本語',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('ヒルデベアケイン＋');
  await page.getByRole('button',{name:'中文',exact:true}).click();
  await page.getByRole('link',{name:'← 返回卡牌列表',exact:true}).click();
  await expect(page.locator('.card-row')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get('q')).toBe('BEARS CANE +');
  expect(new URL(page.url()).searchParams.get('all')).toBe('1');
});

test('type, class, rank, name and hidden filters compose; pagination survives a round trip',async({page})=>{
  await page.goto('/en/data/ep3-cards.html');
  await page.locator('.category-tabs button').nth(2).click();
  await page.getByRole('combobox',{name:'Card class',exact:true}).selectOption('SWORD_ITEM');
  await page.getByRole('combobox',{name:'Rank',exact:true}).selectOption('N4');
  const expected=cards.filter(c=>!c.hidden&&c.type==='ITEM'&&c.class==='SWORD_ITEM'&&c.rank==='N4');
  await expect(page.locator('.result-count')).toHaveText(`Item ${expected.length}`);
  await page.getByLabel('Name search',{exact:true}).fill('not-a-real-card');
  await expect(page.locator('.empty')).toHaveText('No matching cards');
  await page.goto('/en/data/ep3-cards.html?type=ITEM');
  await page.locator('.page-steps').getByRole('button',{name:'Next page',exact:true}).click();
  const secondPageFirst=cards.filter(c=>!c.hidden&&c.type==='ITEM'&&c.class===cards.find(c=>c.type==='ITEM').class)[24];
  await expect(page.locator('.card-row').first()).toHaveAttribute('href',`/en/data/ep3-cards/${secondPageFirst.id}.html?type=ITEM&page=2`);
  const first=await page.locator('.card-row').first().getAttribute('href');
  await page.locator('.card-row').first().click();
  await page.getByRole('link',{name:'← Back to card list',exact:true}).click();
  await expect(page.locator('.card-row').first()).toHaveAttribute('href',first);
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  await page.goto('/en/data/ep3-cards.html?q=???');
  await expect(page.locator('.result-count')).toHaveText('Hunters 0');
  await page.getByRole('checkbox').check();
  await expect(page.locator('.result-count')).toHaveText('Hunters 12');
  await page.getByLabel('Name search',{exact:true}).fill('オルランド');
  await expect(page.locator('.card-row h2')).toHaveText('Orland');
});

test('player boss SCs are opt-in while boss portraits and generic SCs stay visible',async({page})=>{
  for(const [q,bossId,playerId] of [['Castor',668,702],['Pollux',669,703]]) {
    await page.goto(`/data/ep3-cards.html?q=${q}`);
    await expect(page.locator('.card-row')).toHaveCount(1);
    await expect(page.locator('.card-row')).toHaveAttribute('href',new RegExp(`/ep3-cards/${bossId}\\.html`));
    await page.getByRole('checkbox').check();
    await expect(page.locator('.card-row')).toHaveCount(2);
    await page.locator(`.card-row[href*="/ep3-cards/${playerId}.html"]`).click();
    await expect(page.locator('.portrait')).toContainText('暂无卡图');
  }
  for(const id of [716,727,728,739]) {
    const card=cards.find(c=>c.id===id);
    await page.goto(`/data/ep3-cards.html?q=${encodeURIComponent(card.names.en)}&type=${card.type}`);
    await page.locator(`.card-row[href*="/ep3-cards/${id}.html"]`).click();
    await expect(page.locator('.portrait')).toContainText('暂无卡图');
  }
});

test('details show exact stats, actual art, ranges, restrictions and differences only when present',async({page})=>{
  await page.goto('/en/data/ep3-cards/1.html');
  await expect(page.locator('[data-stat=hp]')).toHaveText('+0');
  await expect(page.locator('[data-stat=ap]')).toHaveText('1');
  await expect(page.locator('[data-stat=tp]')).toHaveText('0');
  await expect(page.locator('[data-stat=mv]')).toHaveText('3');
  await expect(page.locator('.portrait img')).toHaveAttribute('src','/assets/img/ep3-cards/1-medium.webp');
  await expect(page.locator('.differences')).toContainText('−3');
  await expect(page.locator('.effect-notice')).toHaveCount(0);
  await expect(page.locator('.range-grid span')).toHaveCount(30);
  await expect(page.locator('.range-grid .active')).toHaveCount(1);
  await expect(page.locator('.range-grid .origin')).toHaveText('↑');
  await page.goto('/en/data/ep3-cards/13.html');
  await expect(page.locator('.portrait img')).toHaveAttribute('src','/assets/img/ep3-cards/13-large.webp');
  await expect(page.locator('.differences')).toHaveCount(0);
  await page.goto('/en/data/ep3-cards/74.html');
  await expect(page.locator('.effect-notice')).toContainText('in-game text may still describe disc behavior');
  await expect(page.locator('.differences')).toContainText('Expression');
  await expect(page.locator('.differences')).toContainText('Argument 3');
  await page.goto('/en/data/ep3-cards/21.html');
  await expect(page.locator('.portrait')).toContainText('Image unavailable');
  await page.goto('/en/data/ep3-cards/24.html');
  await expect(page.locator('.stats-grid')).toContainText('Permanent');
  await page.goto('/en/data/ep3-cards/248.html');
  await expect(page.locator('.stats-grid')).toContainText('Once');
  await page.goto('/en/data/ep3-cards/237.html');
  await expect(page.getByText('Entire field',{exact:true})).toBeVisible();
  await expect(page.locator('.range-grid')).toHaveCount(0);
  await page.goto('/en/data/ep3-cards/23.html');
  await expect(page.locator('.restriction')).toContainText(['Cannot move','Cannot attack']);
});

for(const language of ['en','ja']) test(`all six types retain source headers and tags in ${language}`,async({page})=>{
  for(const id of [1,7,13,100,560,24]) {
    const card=cards.find(c=>c.id===id);
    await page.goto(`/${language}/data/ep3-cards/${id}.html`);
    await expect(page.locator('h1')).toHaveText(card.names[language]);
    await expect(page.locator('.header-lines p')).toHaveText(card.text[language].header);
    await expect(page.locator('.card-tag h2')).toHaveText(card.text[language].tags.map(t=>t.name));
    await expect(page.locator('.tag-body')).toHaveText(card.text[language].tags.map(t=>t.body));
    expect(await page.locator('.tag-body').allTextContents()).toEqual(card.text[language].tags.map(t=>t.body));
  }
});

test('previous and next use real IDs across gaps and preserve query state',async({page})=>{
  await page.goto('/en/data/ep3-cards/84.html?all=1&type=ACTION&page=2');
  await expect(page.getByRole('link',{name:/Next card/})).toHaveAttribute('href','/en/data/ep3-cards/86.html?all=1&type=ACTION&page=2');
  await page.goto('/en/data/ep3-cards/1.html');
  await expect(page.getByRole('link',{name:/Previous card/})).toHaveCount(0);
  await page.goto('/en/data/ep3-cards/739.html');
  await expect(page.getByRole('link',{name:/Next card/})).toHaveCount(0);
});

for(const width of [390,1280]) test(`EP3 layout and accessibility at ${width}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  for(const [label,url] of [['list','/data/ep3-cards.html'],['detail','/ja/data/ep3-cards/100.html'],['effects','/en/data/ep3-cards/74.html']]) {
    await page.goto(url);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).include('haven-ep3-card-catalog').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(`${label}-${width}.png`),fullPage:true});
  }
});

test('client navigation loads one versioned detail, reports failures and keeps list filters',async({page})=>{
  const requests=[];page.on('request',request=>{if(request.url().includes('/assets/data/ep3-cards/'))requests.push(request.url());});
  await page.goto('/en/data/ep3-cards/1.html');
  await expect(page.locator('h1')).toHaveText('Orland');
  expect(requests).toHaveLength(0);
  await page.getByRole('link',{name:'← Back to card list',exact:true}).click();
  await page.getByLabel('Name search',{exact:true}).fill('Double Saber');
  await page.locator('.card-row').first().click();
  await expect(page.locator('h1')).toHaveText('Double Saber');
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatch(/\/13\.json\?v=[a-f0-9]{12}$/);
  await page.getByRole('link',{name:'← Back to card list',exact:true}).click();
  await page.getByLabel('Name search',{exact:true}).fill('Photon Claw');
  await page.route('**/assets/data/ep3-cards/14.json?*',route=>route.abort());
  await page.locator('.card-row').first().click();
  await expect(page.locator('h1')).toHaveText('Unable to load card data');
  await expect(page.getByRole('link',{name:'Back to card list',exact:true})).toHaveAttribute('href','/en/data/ep3-cards.html?q=Photon%20Claw');
  await page.getByRole('button',{name:'Reload and retry',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('Photon Claw');
});

for(const prefix of ['', '/en', '/ja']) test(`global search includes EP3 aliases in ${prefix||'zh'}`,async({page})=>{
  await page.goto(`${prefix}/data/ep3-cards.html`);
  await page.getByTestId('site-search-trigger').click();
  await page.locator('#site-search-category').selectOption('reference');
  for(const name of ['BEARS CANE +','ヒルデベアケイン＋',"Hildebear's Cane+"]) {
    await page.locator('#site-search-query').fill(name);
    await expect(page.locator(`a.result-title[href="${prefix}/data/ep3-cards/29.html"]`)).toBeVisible({timeout:20000});
  }
});

for(const prefix of ['', '/en', '/ja']) test(`changed effect slots and compact raw colors ${prefix||'zh'}`,async({page})=>{
  for(const card of cards.filter(c=>c.diff.some(d=>d.field==='effects'))) {
    await page.goto(`${prefix}/data/ep3-cards/${card.id}.html`);
    const diff=card.diff.find(d=>d.field==='effects');
    const changed=diff.online.map((slot,i)=>({slot,i})).filter(({slot,i})=>JSON.stringify(slot)!==JSON.stringify(diff.disc[i]));
    await expect(page.locator('[data-effect-slot]')).toHaveCount(changed.length);
    for(const {slot,i} of changed) {
      const table=page.locator(`[data-effect-slot="${i+1}"]`);
      await expect(table.locator('tbody tr')).toHaveCount(card.id===365?7:6);
      if(card.id===365) await expect(table.locator('[data-effect-field="nameIndex"] td')).toHaveText(['12','0']);
      for(const field of ['type','expr','when','arg1','arg2','arg3']) {
        const row=table.locator(`[data-effect-field="${field}"]`);
        await expect(row.locator('td')).toHaveText([String(slot[field]),String(diff.disc[i][field])]);
        await expect(row).toHaveAttribute('data-changed',String(slot[field]!==diff.disc[i][field]));
      }
    }
  }
  for(const card of cards.filter(c=>c.diff.some(d=>['right_colors','top_colors'].includes(d.field)))) {
    await page.goto(`${prefix}/data/ep3-cards/${card.id}.html`);
    for(const diff of card.diff.filter(d=>['right_colors','top_colors'].includes(d.field))) {
      await expect(page.locator(`[data-diff-field="${diff.field}"] td`)).toHaveText([diff.online.join(', '),diff.disc.join(', ')]);
    }
  }
});
for(const width of [390,1280]) test(`stats fill every row at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  for(const prefix of ['', '/en', '/ja']) for(const id of [100,481,24]) {
    await page.goto(`${prefix}/data/ep3-cards/${id}.html`);
    const geometry=await page.locator('.stats-grid').evaluate(grid=>({right:grid.getBoundingClientRect().right,children:[...grid.children].map(el=>{const r=el.getBoundingClientRect();return {top:r.top,right:r.right};})}));
    for(const top of new Set(geometry.children.map(c=>c.top))) expect(Math.abs(Math.max(...geometry.children.filter(c=>c.top===top).map(c=>c.right))-geometry.right)).toBeLessThan(2);
  }
});
test('Chinese utility links, origin, missing art and load failure use confirmed UI',async({page})=>{
  await page.goto('/data/ep3-cards/100.html');
  for(const [label,href] of [['返回主页','/'],['道具图鉴','/data/items.html'],['怪物图鉴','/data/enemies.html']]) await expect(page.locator('.utility').getByRole('link',{name:label,exact:true})).toHaveAttribute('href',href);
  await expect(page.locator('.range-grid')).toHaveAttribute('aria-label','攻击范围 · 使用者 · 朝向 ↑');
  const body=page.locator('[data-kind="status"] .tag-body').first();
  expect((await body.textContent()).split('\n').slice(0,4)).toEqual(['Hero     : ○','Dark     : ○','Item     : ○','Creature: ○']);
  await expect(body).toHaveCSS('white-space','pre-line');
  await page.goto('/data/ep3-cards/21.html');
  await expect(page.locator('.portrait')).toContainText('暂无卡图');
  await page.goto('/data/ep3-cards.html?q=Photon%20Claw');
  await page.route('**/assets/data/ep3-cards/14.json?*',route=>route.abort());
  await page.locator('.card-row').click();
  await expect(page.locator('h1')).toHaveText('资料暂时无法加载');
  await expect(page.getByRole('button',{name:'返回并重试',exact:true})).toBeVisible();
});

for(const prefix of ['', '/en', '/ja']) test(`category table and complete URL state at 390px ${prefix||'zh'}`,async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await page.goto(`${prefix}/data/ep3-cards.html?type=ITEM&class=SWORD_ITEM&rank=N4&all=1&sort=cost&page=2&q=a`);
  await page.locator('.mobile-filter').click();
  await expect(page.locator('#card-class')).toBeDisabled();
  await expect(page.locator('#card-class')).toHaveValue('SWORD_ITEM');
  await expect(page.locator('#card-rank')).toHaveValue('N4');
  await expect(page.locator('#card-sort')).toHaveValue('cost');
  const query=new URL(page.url()).search;
  await page.locator('.card-row').first().click();
  await page.locator('a.back').click();
  expect(new URL(page.url()).search).toBe(query);
  await page.reload();
  await expect(page.locator('#card-rank')).toHaveValue('N4');
  await expect(page.locator('#card-sort')).toHaveValue('cost');
  for(const [i,columns] of [[0,6],[1,6],[2,6],[3,7],[4,4],[5,4]]) {
    await page.locator('.category-tabs button').nth(i).click();
    await expect(page.locator('.card-table thead th')).toHaveCount(columns);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.locator('.mobile-filter').click();
  await page.locator('.text-button').click();
  await expect(page.locator('input[type=search]')).toHaveValue('');
  await expect(page.locator('#card-class')).toBeEnabled();
  await expect(page.locator('#card-sort')).toHaveValue('id');
  await expect(page.locator('#card-rank')).toHaveValue('');
});

for(const [language,prefix] of [[0,''],[1,'/en'],[2,'/ja']]) test(`category cells use exact game values ${prefix||'zh'}`,async({page})=>{
  for(const card of [cards.find(c=>c.cost.ally>0),cards.find(c=>c.type==='ACTION'&&!c.hidden),cards.find(c=>c.type==='ASSIST'&&c.assistTurns===99),cards.find(c=>c.type==='ASSIST'&&c.assistTurns===90)]) {
    await page.goto(`${prefix}/data/ep3-cards.html?type=${card.type}&class=${card.class}&q=${encodeURIComponent(card.names.en)}`);
    const row=page.locator('tbody tr').filter({has:page.locator(`a[href*="/ep3-cards/${card.id}.html?"]`)});
    await expect(row).toHaveCount(1);
    const cost=String(card.cost.self)+(card.cost.ally?' + '+messages.ally[language]+' '+card.cost.ally:'');
    await expect(row.locator('td').nth(1)).toHaveText(cost);
    if(card.type==='ACTION') await expect(row.locator('td').nth(2)).toHaveText(messages[card.targetMode][language]);
    if(card.type==='ASSIST') await expect(row.locator('td').nth(2)).toHaveText(messages[card.assistTurns===99?'permanent':'once'][language]);
  }
  await page.goto(`${prefix}/data/ep3-cards.html?type=ARKZ_SC&class=RA_SC&sort=ap`);
  await expect(page.locator('#card-class')).toHaveValue('RA_SC');
  await expect(page.locator('#card-sort')).toHaveValue('ap');
});

for(const [language,prefix,previous,next,jump] of [
  ['zh','','上一页','下一页','跳转页码'],
  ['en','/en','Previous page','Next page','Go to page'],
  ['ja','/ja','前のページ','次のページ','ページ指定'],
]) for(const width of [390,1280]) test(`bottom pagination shares page and URL state in ${language} at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const state={type:'ITEM',class:'SWORD_ITEM',all:'1',sort:'id'};
  const expected=cards.filter(c=>c.type===state.type&&c.class===state.class).sort((a,b)=>a.id-b.id);
  const pages=Math.ceil(expected.length/24);
  expect(pages).toBeGreaterThan(1);
  await page.goto(`${prefix}/data/ep3-cards.html?${new URLSearchParams(state)}`);
  const top=page.locator('.page-steps'), bottom=page.locator('#card-results > .pagination');
  const input=bottom.getByRole('spinbutton',{name:jump,exact:true});
  const assertPage=async number=>{
    await expect(input).toHaveValue(String(number));
    await expect(top.locator('span')).toHaveText(`${number} / ${pages}`);
    await expect(page.locator('.card-row').first()).toHaveAttribute('href',new RegExp(`/ep3-cards/${expected[(number-1)*24].id}[.]html[?]`));
    const first=(number-1)*24+1,last=Math.min(number*24,expected.length),total=expected.length;
    await expect(bottom.locator(':scope > span')).toHaveText(language==='zh'?`第 ${first}–${last} 件，共 ${total} 件`:language==='ja'?`${total} 件中 ${first}–${last} 件`:`${first}–${last} of ${total} items`);
    const params=new URL(page.url()).searchParams;
    for(const [key,value] of Object.entries(state)) expect(params.get(key)).toBe(value);
    expect(params.get('page')).toBe(number===1?null:String(number));
    for(const bar of [top,bottom]) {
      const previousButton=bar.getByRole('button',{name:previous,exact:true});
      if(number===1) await expect(previousButton).toBeDisabled(); else await expect(previousButton).toBeEnabled();
      const nextButton=bar.getByRole('button',{name:next,exact:true});
      if(number===pages) await expect(nextButton).toBeDisabled(); else await expect(nextButton).toBeEnabled();
    }
  };
  const assertScroll=async()=>{
    await expect.poll(()=>page.locator('#card-results').evaluate(el=>{
      const target=Math.min(scrollY+el.getBoundingClientRect().top-20,document.documentElement.scrollHeight-innerHeight);
      return Math.abs(scrollY-target);
    })).toBeLessThan(2);
  };
  await assertPage(1);
  await bottom.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const bounds=await bottom.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
  await bottom.getByRole('button',{name:next,exact:true}).click();
  await assertPage(2);
  await assertScroll();
  await page.reload();
  await assertPage(2);
  await bottom.getByRole('button',{name:previous,exact:true}).click();
  await assertPage(1);
  await assertScroll();
  await top.getByRole('button',{name:next,exact:true}).click();
  await assertPage(2);
  await input.fill(String(pages));
  await input.press('Enter');
  await assertPage(pages);
  await assertScroll();
  await input.fill('1');
  await input.press('Tab');
  await assertPage(1);
  // The item catalog clamps out-of-range jumps and treats non-integers as page 1.
  await input.fill('999');
  await input.press('Enter');
  await assertPage(pages);
  await input.fill('1.5');
  await input.press('Enter');
  await assertPage(1);
  await input.fill('');
  await input.press('Enter');
  await expect(top.locator('span')).toHaveText(`1 / ${pages}`);
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await page.goto(`${prefix}/data/ep3-cards.html?q=not-a-real-card`);
  await expect(bottom).toHaveCount(0);
});
