import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageRoots = ['data', 'event', 'guide', 'tools'];
const retiredAssets = [
  'assets/js/jquery.min.js',
  'assets/js/vue.min.js',
  'assets/js/vue-multiselect.min.js',
  'assets/js/page-chrome.js',
  'assets/css/bootstrap.min.css',
  'assets/css/vue-multiselect.min.css',
  'assets/js/i18n/i18n_names.json',
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  }));
  return nested.flat();
}

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const name of ['jquery', 'bootstrap', 'vue', 'vue-multiselect']) {
  if (dependencies[name]) throw new Error(`Retired runtime remains in package.json: ${name}`);
}

for (const relative of retiredAssets) {
  try {
    await access(path.join(root, relative));
    throw new Error(`Retired browser asset still exists: ${relative}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const angularSources = (await walk(path.join(root, 'src', 'app')))
  .filter((file) => file.endsWith('.ts'));
for (const file of angularSources) {
  const source = await readFile(file, 'utf8');
  const usesViewInitHook = /\b(?:AfterViewInit|ngAfterViewInit)\b/.test(source);
  const accessesDom = /\b(?:ElementRef|document|window|querySelector)\b/.test(source);
  if (usesViewInitHook && accessesDom) {
    throw new Error(
      `${path.relative(root, file)} performs work in ngAfterViewInit; `
      + 'use an Angular render callback for DOM access and hydration safety',
    );
  }
  if (!file.includes(`${path.sep}generated${path.sep}`)
      && source.includes('ViewEncapsulation.None')) {
    throw new Error(
      `${path.relative(root, file)} disables style encapsulation outside the generated-content boundary`,
    );
  }
}

const itemConsumerContracts = [
  {
    file: 'src/app/events/seasonal-event.directive.ts',
    forbidden: /\bOVERRIDES\b/,
    message: 'seasonal events must not override canonical item translations',
  },
  {
    file: 'src/app/data/volopt.directive.ts',
    forbidden: /\bzh\??\s*:/,
    message: 'Vol Opt display metadata must not contain Chinese item translations',
  },
];
for (const contract of itemConsumerContracts) {
  const source = await readFile(path.join(root, contract.file), 'utf8');
  if (!source.includes('ITEM_TRANSLATIONS')) {
    throw new Error(`${contract.file} must consume canonical ITEM_TRANSLATIONS`);
  }
  if (contract.forbidden.test(source)) {
    throw new Error(`${contract.file}: ${contract.message}`);
  }
}

const canonicalItemPages = [
  'data/weapon_special_reduction.html',
  'data/enemy_weapon_hit.html',
  'data/WSBoost.html',
  'data/gallons_roulette.html',
];
const contentGenerator = await readFile(path.join(root, 'scripts/generate_angular_content.mjs'), 'utf8');
for (const relative of canonicalItemPages) {
  const source = await readFile(path.join(root, relative), 'utf8');
  if (!/<page-chrome\b[^>]*\bitem-width\b/.test(source)) {
    throw new Error(`${relative} must expose the shared item translation width control`);
  }
  if (!contentGenerator.includes(`'${relative}', ['ItemTranslationWidthBehavior']`)) {
    throw new Error(`${relative} must activate ItemTranslationWidthBehavior`);
  }
  if (!contentGenerator.includes(`'${relative}'`)) {
    throw new Error(`${relative} must derive displayed names from canonical item translations`);
  }
}

const volOptSource = await readFile(path.join(root, 'guide/volopt.html'), 'utf8');
const volOptItemList = volOptSource.match(/<ul data-item-translation-list>([\s\S]*?)<\/ul>/)?.[1];
if (!volOptItemList) {
  throw new Error('guide/volopt.html is missing its item-translation list contract');
}
if (/<strong(?![^>]*data-item-name)[^>]*>[^<]*[A-Za-z][^<]*[\u3400-\u9fff]/.test(volOptItemList)) {
  throw new Error('guide/volopt.html contains an unmarked hard-coded bilingual item name');
}

const angularTemplates = (await walk(path.join(root, 'src', 'app')))
  .filter((file) => file.endsWith('.html'));
for (const file of angularTemplates) {
  const source = await readFile(file, 'utf8');
  if (source.includes('$any(this)')) {
    throw new Error(`${path.relative(root, file)} bypasses strict template typing with $any(this)`);
  }
}

const htmlFiles = [
  path.join(root, 'index.html'),
  path.join(root, '404.html'),
  ...(await Promise.all(pageRoots.map((directory) => walk(path.join(root, directory))))).flat(),
].filter((file) => file.endsWith('.html') && !file.startsWith(path.join(root, 'data', 'droptable')));

const violations = [];
for (const file of htmlFiles) {
  const source = await readFile(file, 'utf8');
  const document = parse(source);
  visit(document, (node) => {
    if (node.tagName === 'script') violations.push(`${path.relative(root, file)} contains <script>`);
    for (const attribute of node.attrs || []) {
      if (/^on[a-z]+$/i.test(attribute.name)) {
        violations.push(`${path.relative(root, file)} contains ${attribute.name}`);
      }
    }
  });
}
if (violations.length) throw new Error(`HTML bypasses Angular ownership:\n${violations.join('\n')}`);

console.log(`Angular ownership verified across ${htmlFiles.length} HTML sources; retired runtimes are absent.`);
