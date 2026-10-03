import { test, expect } from '@playwright/test';

const languageButton = (page, name) => page.locator('haven-language-bar').getByRole('button', { name, exact: true });
const selectLanguage = async (page, language) => page.locator(`haven-language-bar button[lang="${language}"]`).click();

const comboValues = (page) => page.locator('haven-combo').evaluate((root) => [...root.querySelectorAll('input, select')]
  .map((control) => [control.id || 'weapon', control.type === 'checkbox' ? control.checked
    : control.id.startsWith('hits') ? control.selectedOptions[0].textContent.trim() : control.value]));
const comboNumbers = (page) => page.locator('#combo-calc-table tbody tr').evaluateAll((rows) => rows.map((row) =>
  [...row.querySelectorAll('td')].map((cell) => cell.textContent.trim())));
const statusValues = (page) => page.locator('haven-status').evaluate((root) => [...root.querySelectorAll('input, select')]
  .map((control) => [control.id, control.value]));

test('clearing a numeric input allows retyping without restoring defaults mid-edit', async ({ page }) => {
  for (const [path, input, key] of [
    ['/en/tools/cc.html', '#ataInput', 'ata'],
    ['/en/tools/status.html', '#magDef', 'mdef'],
  ]) {
    await page.goto(path);
    const control = page.locator(input);
    await control.clear();
    await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe('0');
    await expect(control).toHaveValue('');
    await control.pressSequentially('123');
    await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe('123');
    await expect(control).toHaveValue('123');
    await page.reload();
    await expect(control).toHaveValue('123');
  }
});

test('editing Hit immediately before a language change preserves equipment-derived ATA', async ({ page }) => {
  await page.goto('/en/tools/cc.html');
  await page.locator('.weapon-picker').selectOption('Dark Flow');
  await page.locator('#hitInput').fill('45');
  // The language click blurs Hit and runs its equipment recalculation.
  await selectLanguage(page, 'ja');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/ja/tools/cc.html');
  await expect(page.locator('#hitInput')).toHaveValue('45');
  await expect(page.locator('#ataInput')).toHaveValue('306');
  await expect.poll(() => new URL(page.url()).searchParams.get('ata')).toBe('306');
});

test('Combo preserves the reproduced RAmar configuration through language changes', async ({ page }) => {
  await page.goto('/tools/cc.html');
  await page.locator('#class-select').selectOption('RAmar');
  await page.locator('#ataInput').fill('234');
  await page.locator('#native-btn').click();
  await expect(page.locator('#combo-calc-table tbody tr')).toHaveCount(41);
  await languageButton(page, 'English').click();
  await expect(page).toHaveURL(/\/en\/tools\/cc\.html(?:\?|$)/);
  await expect(page.locator('#class-select')).toHaveValue('RAmar');
  await expect(page.locator('#ataInput')).toHaveValue('234');
  await expect(page.locator('#combo-calc-table tbody tr')).toHaveCount(41);
});

for (const mode of ['cc', 'ccopm']) {
  test(`${mode} restores every control, selection and numeric result across languages and reload`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/en/tools/${mode}.html`);
    await page.locator('#class-select').selectOption('RAmarl');
    await page.locator('.weapon-picker').selectOption('Dark Flow');
    await page.locator('#frame-select').selectOption('Crimson Coat');
    await page.locator('#barrier-select').selectOption('None');
    await page.locator('#unit-select').selectOption('POSS2');
    await page.locator('#commanderBlade').check();
    await page.locator('#smartlinkInput').uncheck();
    await page.locator('#ataGlitch').check();
    await page.locator('#frozenCheckbox').check();
    await page.locator('#paralyzedCheckbox').check();
    await page.locator('#maxDamageCheckbox').check();
    await page.locator('#special-select').selectOption('Berserk');
    for (const [id, value] of Object.entries({
      classMinAtpInput: '1234', classMaxAtpInput: '1267', hitInput: '45', sphereInput: '85',
      shiftaInput: '30', zalureInput: '21', minAtpInput: '710', maxAtpInput: '790', ataInput: '234.5',
    })) {
      await page.locator(`#${id}`).fill(value);
      await page.locator(`#${id}`).press('Tab');
    }
    await page.locator('#attack1').selectOption('HEAVY');
    await page.locator('#hits1').selectOption({ label: '2' });
    await page.locator('#attack2').selectOption('SPECIAL');
    await page.locator('#hits2').selectOption({ label: '3' });
    await page.locator('#native-btn').click();
    await page.locator('.enemy-chips button').first().click();
    await page.locator('#damage-header button').click();
    await expect(page.locator('#damage-header')).toContainText('▲');
    await expect(page.locator('#combo-calc-table tbody tr')).toHaveCount(40);
    const values = await comboValues(page);
    const numbers = await comboNumbers(page);
    expect(numbers).toHaveLength(40);
    await expect(page).toHaveURL(/ata=234.5/);
    for (const [language, prefix] of [['ja', '/ja'], ['zh', ''], ['en', '/en']]) {
      await selectLanguage(page, language);
      await expect.poll(() => new URL(page.url()).pathname).toBe(`${prefix}/tools/${mode}.html`);
      await expect.poll(() => comboValues(page)).toEqual(values);
      await expect.poll(() => comboNumbers(page)).toEqual(numbers);
      await expect(page.locator('#damage-header')).toContainText('▲');
    }
    await page.reload();
    await expect.poll(() => comboValues(page)).toEqual(values);
    await expect.poll(() => comboNumbers(page)).toEqual(numbers);
    // The address bar itself is a reproducible share link.
    const share = page.url();
    await page.goto('/en/');
    await page.goBack();
    await expect(page).toHaveURL(share);
    await expect.poll(() => comboValues(page)).toEqual(values);
    await expect.poll(() => comboNumbers(page)).toEqual(numbers);
    await page.locator('#autoCombo').check();
    await expect(page).toHaveURL(/autoCombo=1/);
    // The URL can update before Angular renders the automatic combo results.
    await expect(page.locator('#attack1')).toBeDisabled();
    await expect(page.locator('#combo-calc-table tbody th')).toHaveText(
      numbers.map(() => /\([NHS.]{3} \d+f\)$/));
    const autoNumbers = await comboNumbers(page);
    expect(autoNumbers).not.toEqual(numbers);
    await page.reload();
    await expect(page.locator('#autoCombo')).toBeChecked();
    await expect(page.locator('#attack1')).toBeDisabled();
    await expect.poll(() => comboNumbers(page)).toEqual(autoNumbers);
    expect(errors).toEqual([]);
  });
}

test('Combo mode changes preserve inputs and selection while using the target enemy stats', async ({ page }) => {
  await page.goto('/en/tools/cc.html');
  await page.locator('#class-select').selectOption('RAmar');
  await page.locator('.weapon-picker').selectOption('Dark Flow');
  await page.locator('#native-btn').click();
  await expect(page.locator('#combo-calc-table tbody tr')).toHaveCount(41);
  const values = await comboValues(page);
  const multiplayerNumbers = await comboNumbers(page);
  await page.locator('.combo-toolbar a').click();
  await expect(page).toHaveURL(/\/en\/tools\/ccopm\.html\?/);
  await expect.poll(() => comboValues(page)).toEqual(values);
  await expect(page.locator('#combo-calc-table tbody tr')).toHaveCount(41);
  await expect.poll(() => comboNumbers(page)).not.toEqual(multiplayerNumbers);
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/tools\/cc\.html\?/);
  await expect.poll(() => comboNumbers(page)).toEqual(multiplayerNumbers);
});

test('Status persists all build inputs, results, share links and resets', async ({ page }) => {
  await page.goto('/en/tools/status.html?c=ramarl&lv=100&mdef=5&mpow=100&mdex=45&mmind=50&hp=20&tp=10&pow=50&def=25&mind=30&eva=15&lck=10&armor=45&shield=2a&unit1=5b&unit2=5d&unit3=4c&unit4=51');
  await expect(page.locator('#class')).toHaveValue('ramarl');
  await page.locator('#magPow').fill('110');
  await page.locator('#matLck').fill('12');
  await expect(page.locator('.stat-table [data-stat="atp"] td').nth(2)).toHaveText('220');
  await expect(page.locator('.stat-table [data-stat="lck"] td').nth(1)).toHaveText('24');
  const values = await statusValues(page);
  const numbers = await page.locator('.stat-table tbody').innerText();
  await expect(page).toHaveURL(/mpow=110/);
  for (const [language, prefix] of [['ja', '/ja'], ['zh', ''], ['en', '/en']]) {
    await selectLanguage(page, language);
    await expect.poll(() => new URL(page.url()).pathname).toBe(`${prefix}/tools/status.html`);
    await expect.poll(() => statusValues(page)).toEqual(values);
    await expect.poll(() => page.locator('.stat-table tbody').innerText()).toBe(numbers);
    const share = new URL(await page.locator('.share-link a').getAttribute('href'), page.url());
    expect(share.pathname).toBe(`${prefix}/tools/status.html`);
    expect(share.searchParams.get('mpow')).toBe('110');
    expect(share.searchParams.get('lck')).toBe('12');
  }
  await page.reload();
  await expect.poll(() => statusValues(page)).toEqual(values);
  await page.goto('/en/');
  await page.goBack();
  await expect.poll(() => statusValues(page)).toEqual(values);
  for (const id of ['magReset', 'matReset', 'equipReset', 'unitReset']) await page.locator(`#${id}`).click();
  await page.reload();
  await expect(page.locator('#class')).toHaveValue('ramarl');
  await expect(page.locator('#lv option:checked')).toHaveText('100');
  await expect(page.locator('#magDef')).toHaveValue('5');
  await expect(page.locator('#magPow')).toHaveValue('0');
  await expect(page.locator('#matLck')).toHaveValue('0');
  for (const id of ['armor', 'shield', 'unit1', 'unit2', 'unit3', 'unit4']) await expect(page.locator(`#${id}`)).toHaveValue('-');
});

for (const mode of ['cc', 'ccopm']) {
  test(`${mode} rejects invalid query values and normalizes absent attack hits`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/en/tools/${mode}.html?class=constructor&weapon=missing&frame=__proto__&barrier=missing&unit=missing&ata=Infinity&shifta=-Infinity&hit=NaN&attack1=bad&attack2=NONE&hits2=9&attack3=HEAVY&hits3=0&enemy=constructor&enemy=Bartle&enemy=Bartle&sort=bad&order=asc`);
    await expect(page.locator('#class-select')).toHaveValue('HUcast');
    await expect(page.locator('.weapon-picker')).toHaveValue('Unarmed');
    await expect(page.locator('#ataInput')).toHaveValue('211');
    await expect(page.locator('#shiftaInput')).toHaveValue('0');
    await expect(page.locator('#hitInput')).toHaveValue('0');
    await expect(page.locator('#attack1')).toHaveValue('NORMAL');
    await expect(page.locator('#attack2')).toHaveValue('NONE');
    await expect(page.locator('#hits2 option:checked')).toHaveText('0');
    await expect(page.locator('#hits3 option:checked')).toHaveText('1');
    await expect(page.locator('#combo-calc-table tbody tr')).toHaveCount(1);
    await expect(page.locator('#combo-calc-table')).not.toContainText(/NaN|undefined|Infinity/);
    expect(errors).toEqual([]);
  });
}

test('Status rejects invalid class, numeric and equipment query values', async ({ page }) => {
  await page.goto('/en/tools/status.html?c=constructor&lv=201&mdef=-1&mpow=1000&mdex=1.5&mmind=Infinity&hp=NaN&armor=constructor&shield=__proto__&unit1=missing');
  await expect(page.locator('#class')).toHaveValue('humar');
  await expect(page.locator('#lv option:checked')).toHaveText('200');
  await expect(page.locator('#magDef')).toHaveValue('5');
  for (const id of ['magPow', 'magDex', 'magMind', 'matHP']) await expect(page.locator(`#${id}`)).toHaveValue('0');
  for (const id of ['armor', 'shield', 'unit1']) await expect(page.locator(`#${id}`)).toHaveValue('-');
  await expect(page.locator('.stat-table')).not.toContainText(/NaN|undefined|Infinity/);
});

test('Status preserves the reproduced RAmarl level through language changes', async ({ page }) => {
  await page.goto('/tools/status.html');
  await page.locator('#class').selectOption('ramarl');
  await page.locator('#lv').selectOption({ label: '100' });
  await languageButton(page, 'English').click();
  await expect(page).toHaveURL(/\/en\/tools\/status\.html(?:\?|$)/);
  await expect(page.locator('#class')).toHaveValue('ramarl');
  await expect(page.locator('#lv option:checked')).toHaveText('100');
});
