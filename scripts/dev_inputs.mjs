import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export const generators = [
  'scripts/generate_item_catalog.mjs',
  'scripts/generate_monster_catalog.mjs',
  'scripts/generate_ep3_card_catalog.mjs',
  'scripts/generate_angular_combo.mjs',
  'scripts/generate_angular_content.mjs',
];

export const ignoredOutputs = [
  '.git', 'node_modules', '.angular', 'dist', '_site', 'artifacts',
  'src/app/generated', 'assets/data/items', 'assets/data/monsters', 'assets/data/ep3-cards',
  'assets/data/item-index.json', 'content/item-catalog/coverage.json',
  'test-results', 'playwright-report', '.site-build-*', '.site-backup-*',
];

// Follow generator imports as well as their data inputs: changing a shared
// localization/model helper must regenerate the same files as changing its data.
export async function generatorModules(root) {
  const modules = new Set();
  async function visit(file) {
    if (modules.has(file)) return;
    modules.add(file);
    const source = ts.createSourceFile(file, await readFile(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest);
    for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)
          || !node.moduleSpecifier.text.startsWith('.')) continue;
      const imported = path.resolve(root, path.dirname(file), node.moduleSpecifier.text);
      await visit(path.relative(root, imported));
    }
  }
  for (const generator of generators) await visit(generator);
  return modules;
}

const inside = (file, directory) => file === directory || file.startsWith(`${directory}/`);
export function isGenerationInput(file, modules) {
  if (ignoredOutputs.some(output => inside(file, output))) return false;
  return ['index.html', '404.html'].includes(file) || modules.has(file)
    || ['content', 'data', 'event', 'guide', 'tools', 'assets'].some(directory => inside(file, directory));
}

export function isSearchInput(file, modules) {
  return isGenerationInput(file, modules) || (inside(file, 'src') && !inside(file, 'src/app/generated'))
    || file === 'scripts/build_search.mjs';
}

export async function externalGenerationInputs(root) {
  const authority = path.resolve(root, process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json');
  const inputs = [authority, path.join(path.dirname(authority), 'bb/data/en.js'),
    path.resolve(root, 'data/droptable/bb/data/zh.js')];
  // Resolve symlinks so native watchers receive changes made in the sibling
  // drop-table repository as well as edits through this repository's link.
  const { realpath } = await import('node:fs/promises');
  return Promise.all(inputs.map(async file => {
    await stat(file);
    return realpath(file);
  }));
}

function sourceTree(source) {
  return ts.createSourceFile('routes.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

export function featurePaths(source) {
  const paths = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText() === 'path') {
      const value = node.initializer;
      if (!ts.isTemplateExpression(value) || value.head.text !== '' || value.templateSpans.length !== 1
          || value.templateSpans[0].expression.getText() !== 'prefix') {
        throw new Error(`Unsupported feature route in dev search: ${value.getText()}`);
      }
      paths.push(value.templateSpans[0].literal.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceTree(source));
  if (!paths.length) throw new Error('No feature routes found for dev search');
  return paths;
}

export async function devRoutes(root) {
  const [features, content, catalog, monsters, ep3Cards] = await Promise.all([
    readFile(path.join(root, 'src/app/app.routes.server.ts'), 'utf8'),
    readFile(path.join(root, 'src/app/generated/content.routes.server.ts'), 'utf8'),
    readFile(path.join(root, 'src/app/generated/item-catalog/index.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'src/app/generated/monster-catalog/index.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'src/app/generated/ep3-card-catalog/index.json'), 'utf8').then(JSON.parse),
  ]);
  const routes = new Set();
  const parameters = { card: ep3Cards.map(row => `${row.id}.html`), item: catalog.map(row => `${row[0]}.html`), monster: monsters.map(row => `${row.id}.html`) };
  for (const feature of featurePaths(features)) {
    const parameter = /:([\w]+)/.exec(feature)?.[1];
    if (parameter && !parameters[parameter]) throw new Error(`Unknown dev route parameter: ${parameter}`);
    const expanded = parameter ? parameters[parameter].map(value => feature.replace(`:${parameter}`, value)) : [feature];
    for (const prefix of ['', 'en/', 'ja/']) for (const route of expanded) routes.add(`/${prefix}${route}`);
  }
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map(node.properties.filter(ts.isPropertyAssignment).map(property => [property.name.getText(), property.initializer]));
      if (properties.get('renderMode')?.getText() === 'RenderMode.Prerender') {
        const route = properties.get('path');
        if (!route || !ts.isStringLiteral(route)) throw new Error('Unsupported generated route in dev search');
        routes.add(`/${route.text}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceTree(content));
  return [...routes].sort();
}
