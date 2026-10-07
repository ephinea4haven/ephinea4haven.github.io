import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = path.join(root, '.angular/dev-validation', String(Date.now()));
await mkdir(path.dirname(artifact), { recursive: true });
const report = `${artifact}.log`;
await writeFile(report, '');
let log = '';
const started = Date.now();
const milestones = [];
const mark = message => { milestones.push({ seconds: (Date.now()-started)/1000, message }); console.log(message); };
const child = spawn(process.execPath, ['scripts/dev_site.mjs', '--port', '5175'], { cwd: root, stdio: ['ignore','pipe','pipe'] });
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log += chunk; void appendFile(report, chunk); });
const waitFor = async (predicate, label, timeout=120000) => {
 const deadline=Date.now()+timeout;
 while(!predicate()) { if(Date.now()>deadline) throw new Error(`Timed out: ${label}`); if(child.exitCode!==null) throw new Error(`Dev exited ${child.exitCode}: ${log.slice(-2000)}`); await new Promise(resolve=>setTimeout(resolve,100)); }
};
const template = root+'/src/app/combo/combo.component.html';
const content = root+'/tools/materialplan.html';
const translations = root+'/content/home-i18n.json';
const angularToken = ' data-dev-probe="angular-refresh"';
const contentToken = '<p data-dev-probe="generated-refresh">DevFreshIndexProbeoctober</p>';
const invalidToken = '\nDEV_INVALID_JSON_PROBE\n';
const remove = async (file, token) => { const source=await readFile(file,'utf8'); if(source.includes(token))await writeFile(file,source.replace(token,'')); };
let browser;
try {
 await waitFor(()=>log.includes('Local:'),'development server'); mark('Development server ready');
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5175/tools/cc.html');
 await expect(page.locator('#class-select')).toHaveValue('HUcast');
 const original=await readFile(template,'utf8');
 await writeFile(template,original.replace('<main ',`<main${angularToken} `));
 await expect(page.locator('[data-dev-probe="angular-refresh"]')).toBeVisible({timeout:60000});
 mark('Angular template edit automatically appeared in existing browser page');
 await remove(template,angularToken);
 await expect(page.locator('[data-dev-probe="angular-refresh"]')).toHaveCount(0,{timeout:60000});
 await page.goto('http://127.0.0.1:5175/tools/materialplan.html');
 const beforeFailure=log.length;
 await writeFile(translations,(await readFile(translations,'utf8'))+invalidToken);
 await waitFor(()=>log.slice(beforeFailure).includes('[dev] Generation failed:'),'generation failure');
 mark('Invalid generation input reported without stopping the dev process');
 const beforeRecovery=log.length;
 await writeFile(content,(await readFile(content,'utf8')).replace('<h2 id="方案">',`${contentToken}<h2 id="方案">`));
 await remove(translations,invalidToken);
 await expect(page.locator('[data-dev-probe="generated-refresh"]')).toBeVisible({timeout:90000});
 mark('Corrected input regenerated and automatically refreshed the existing browser page');
 await waitFor(()=>log.slice(beforeRecovery).includes('[dev] Search ready:'),'fresh search index',180000);
 await page.locator('haven-site-search button').first().click();
 await page.locator('#site-search-query').fill('DevFreshIndexProbeoctober');
 await expect(page.locator('.search-results .result-title[href*="/tools/materialplan.html"]')).toBeVisible({timeout:30000});
 const matches = await page.locator('.search-results .result-title').evaluateAll(links => links.map(link => link.getAttribute('href')));
 await page.keyboard.press('Escape');
 if(/Could not resolve|Cannot find module|Events were dropped/.test(log))throw new Error('Development output contained an unexpected compiler/watcher failure');
 mark('Regenerated search index contains the newly edited page text: '+JSON.stringify(matches));
 const beforeRestore=log.length;
 await remove(content,contentToken);
 await expect(page.locator('[data-dev-probe="generated-refresh"]')).toHaveCount(0,{timeout:90000});
 await waitFor(()=>log.slice(beforeRestore).includes('[dev] Content generated;'),'restored generation');
 mark('Temporary source edits restored and browser refreshed again');
} finally {
 await remove(template,angularToken);
 await remove(content,contentToken);
 await remove(translations,invalidToken);
 if(browser)await browser.close();
 const stopped=child.exitCode!==null?Promise.resolve():once(child,'exit');
 child.kill('SIGINT');
 let shutdownTimer; try { await Promise.race([stopped,new Promise((_,reject)=>{shutdownTimer=setTimeout(()=>reject(new Error('Dev shutdown timed out')),15000);})]); } finally {clearTimeout(shutdownTimer);}
 mark('SIGINT stopped development process with exit code '+child.exitCode);
 try { await fetch('http://127.0.0.1:5175',{signal:AbortSignal.timeout(1000)});throw new Error('Port5175 still open after stop'); }
 catch(error){if(error.message==='Port5175 still open after stop')throw error;}
 mark('Port5175 closed after shutdown');
 const assetOrigin = /Search assets served at (http:\/\/127\.0\.0\.1:\d+)/.exec(log)?.[1];
 if (assetOrigin) {
   try { await fetch(`${assetOrigin}/assets/search/pagefind.js`, {signal:AbortSignal.timeout(1000)}); throw new Error('Search asset server remained open after stop'); }
   catch(error) { if (error.message === 'Search asset server remained open after stop') throw error; }
   mark('Search asset server closed after shutdown');
 }
 for (const generator of ['generate_item_catalog', 'generate_monster_catalog', 'generate_ep3_card_catalog', 'generate_angular_combo', 'generate_angular_content']) {
   const result = spawnSync(process.execPath, [`scripts/${generator}.mjs`], { cwd: root, stdio: 'pipe' });
   if (result.status !== 0) throw new Error(`Could not restore generated files: ${result.stderr}`);
 }
 await writeFile(`${artifact}.json`,JSON.stringify({milestones,exitCode:child.exitCode},null,2));
}
