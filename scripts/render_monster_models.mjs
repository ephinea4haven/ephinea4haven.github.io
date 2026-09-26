#!/usr/bin/env node
// Render monster models through a phantasmal-world build that exposes window.__renderNpc
// (opened with ?npcBatch=1). Writes <label>-black.png and <label>-white.png for each job.
// Usage: node scripts/render_monster_models.mjs <jobs.json> <out-dir> [harness-url]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [jobsFile, outDir, url = 'http://127.0.0.1:8765/index.html?npcBatch=1'] = process.argv.slice(2);
if (!jobsFile || !outDir) throw new Error('Usage: node scripts/render_monster_models.mjs <jobs.json> <out-dir> [harness-url]');
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage();
await page.goto(url);
await page.waitForFunction(() => window.__npcReady === true, null, { timeout: 120000 });
const failures = [];
for (const job of jobs) {
  const result = await page.evaluate(job => window.__renderNpc(job).then(r => ({ ...r, bounds: [...r.bounds] }), e => ({ error: String(e) })), job);
  if (result.error) {
    failures.push(`${job.label}: ${result.error}`);
    continue;
  }
  for (const background of ['black', 'white']) {
    writeFileSync(`${outDir}/${job.label}-${background}.png`, Buffer.from(result[background].split(',')[1], 'base64'));
  }
  writeFileSync(`${outDir}/${job.label}.json`, JSON.stringify({ bounds: result.bounds, materials: result.materials, textureIndices: result.textureIndices, textureCount: result.textureCount }));
  console.log(`${job.label}: rendered`);
}
await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
