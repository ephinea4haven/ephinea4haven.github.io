import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const visible = '[data-npc-card]:visible';
const ready = async (page) => expect(page.locator('[data-npc-guide]')).toHaveAttribute('data-npc-guide', 'ready');

for (const [prefix,lang] of [['','zh-CN'],['/en','en'],['/ja','ja']]) {
  test(`NPC guide ${lang}: search, episode intersections, empty state and section navigation`, async ({ page }) => {
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto(`${prefix}/guide/npc.html`);
    await ready(page);
    await expect(page.locator('html')).toHaveAttribute('lang',lang);
    await expect(page.locator(visible)).toHaveCount(48);
    await page.locator('#npc-search').fill('ＤＢ');
    await expect(page.locator(visible)).toHaveCount(1);
    await expect(page.locator('#npc-donoph')).toBeVisible();
    await page.locator('#npc-episode').selectOption('4');
    await expect(page.locator(visible)).toHaveCount(0);
    await expect(page.locator('#npc-empty')).toBeVisible();
    await page.locator('#npc-reset').click();
    await expect(page.locator('#npc-search')).toBeFocused();
    await page.locator('#npc-search').fill('Bernie');
    await page.locator('#npc-episode').selectOption('4');
    await expect(page.locator('#npc-bernie')).toBeVisible();
    await expect(page.locator('#npc-donoph')).toBeHidden();
    await page.locator('.npc-directory-nav a[href$="#heroes"]').click();
    await expect(page.locator('#npc-search')).toHaveValue('');
    await expect(page.locator('#npc-episode')).toHaveValue('');
    await expect(page.locator('#heroes')).toBeInViewport();
    await expect(page.locator(visible)).toHaveCount(48);
    await page.locator('#npc-search').fill('Soul of Steel');
    await expect(page.locator('#npc-ult')).toBeVisible();
    await expect(page.locator('#npc-montague')).toBeVisible();
    await page.locator('#npc-search').fill('not-a-character-7349');
    await expect(page.locator('#npc-empty')).toBeVisible();
    await expect(page.locator('[data-npc-group]:visible')).toHaveCount(0);
    await expect(page.locator('#npc-count')).toContainText('0');
    expect(errors).toEqual([]);
  });
}

test('NPC guide keeps localized names and hash targets after language changes and reload', async ({ page }) => {
  await page.goto('/guide/npc.html#npc-donoph');
  await ready(page);
  for (const [language,prefix,itemName] of [['English','/en',"DB's Saber"],['日本語','/ja','ＤＢの剣'],['中文','','DB 之剑']]) {
    await page.getByRole('button',{name:language,exact:true}).click();
    await ready(page);
    await expect(page).toHaveURL(new RegExp(`${prefix}/guide/npc\\.html#npc-donoph$`));
    await expect(page.locator('#npc-donoph')).toContainText(itemName);
    await expect(page.locator('#npc-donoph')).toBeInViewport();
    await page.reload();
    await ready(page);
    await expect(page.locator('#npc-donoph')).toContainText(itemName);
  }
});

test('NPC guide mobile has readable cards, working disclosures and no overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/guide/npc.html');
  await ready(page);
  await page.locator('#npc-search').fill("DB's Saber");
  await expect(page.locator(visible)).toHaveCount(1);
  await expect(page.locator('#npc-donoph .npc-name')).toHaveCSS('margin-top', '0px');
  await expect(page.locator('#npc-donoph .npc-card-heading')).toHaveCSS('text-align', 'left');
  await page.locator('#npc-donoph summary').click();
  await expect(page.locator('#npc-donoph a').filter({hasText:'The Retired Hunter'})).toBeVisible();
  await page.locator('#npc-reset').click();
  await expect(page.locator('.npc-story')).not.toHaveAttribute('open','');
  await page.locator('.npc-story > summary').click();
  await expect(page.locator('#ep3')).toBeVisible();
  await expect(page.locator('.npc-story')).toContainText('Olga');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({page}).include('[data-npc-guide]').analyze();
  expect(accessibility.violations).toEqual([]);
});

test('NPC guide restores portrait cards and a navigable visual relationship diagram', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/guide/npc.html');
  await ready(page);
  await expect(page.locator('.npc-avatar img')).toHaveCount(46);
  for (const image of await page.locator('.npc-avatar img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(image).toHaveCSS('object-fit', 'cover');
    const scale = await image.evaluate(img => {
      const rect = img.getBoundingClientRect();
      return (rect.width / rect.height) / (img.naturalWidth / img.naturalHeight);
    });
    expect(scale).toBeCloseTo(1, 2);
  }
  for (const id of ['flowen', 'rico', 'ult', 'zoke', 'kroe', 'anna', 'tyrell', 'coren']) {
    await expect(page.locator(`#npc-${id} img`)).toHaveAttribute('src', `/assets/img/npc/${id}-model.webp`);
    const dimensions = await page.locator(`#npc-${id} img`).evaluate(img => ({
      declared: [Number(img.getAttribute('width')), Number(img.getAttribute('height'))],
      actual: [img.naturalWidth, img.naturalHeight],
    }));
    expect(dimensions.declared).toEqual(dimensions.actual);
    expect(dimensions.actual).toEqual([900, 900]);
  }
  const avatar = await page.locator('#npc-donoph .npc-avatar').boundingBox();
  const body = await page.locator('#npc-donoph .npc-body').boundingBox();
  expect(body.x).toBeGreaterThan(avatar.x + avatar.width);
  await expect(page.locator('#npc-coren')).toContainText('Section ID');
  await page.locator('.rel-svg a[href$="#npc-donoph"]').click();
  await expect(page.locator('#npc-donoph')).toBeInViewport();
  await expect(page).toHaveURL(/#npc-donoph$/);
});
