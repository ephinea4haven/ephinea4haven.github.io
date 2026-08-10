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
