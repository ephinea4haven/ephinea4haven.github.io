// Render challenge-map SVGs to PNG for visual review (docs/CHALLENGE_MAP_REDRAW.md §7).
// Usage: node scripts/render_challenge_maps.mjs <output-directory> <svg>...
// Requires the project's Playwright Chromium: npx playwright install chromium
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [outputDirectory, ...files] = process.argv.slice(2);
if (!outputDirectory || files.length === 0) {
  console.error('Usage: node scripts/render_challenge_maps.mjs <output-directory> <svg>...');
  process.exit(1);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
  for (const file of files) {
    const svg = await readFile(file, 'utf8');
    await page.setContent(`<body style="margin:0;background:#050b16">${svg.replace('<svg ', '<svg width="1000" ')}</body>`);
    const name = `${path.basename(path.dirname(file))}_${path.basename(file, '.svg')}.png`;
    await page.locator('svg').screenshot({ path: path.join(outputDirectory, name) });
    console.log(path.join(outputDirectory, name));
  }
} finally {
  await browser.close();
}
