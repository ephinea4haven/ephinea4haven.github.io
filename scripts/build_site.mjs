import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse } from 'parse5';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, '_site');
const temporaryDirectory = path.join(root, `.site-build-${process.pid}`);
const backupDirectory = path.join(root, `.site-backup-${process.pid}`);
const budgets = JSON.parse(await readFile(path.join(root, 'build-budgets.json'), 'utf8'));

const rootFiles = ['index.html', '404.html', 'CNAME'];
const siteDirectories = ['assets', 'data', 'event', 'guide', 'tools'];
const publishedFiles = [path.join(root, 'third_party', 'psostats-combo', 'LICENSE')];
const excludedTrees = [path.join(root, 'data', 'droptable')];
const excludedFiles = new Set([
  path.join(root, 'assets', 'js', 'combo_calc.js'),
  path.join(root, 'assets', 'js', 'combo_calc_multi_data.js'),
  path.join(root, 'assets', 'js', 'combo_calc_opm_data.js'),
  path.join(root, 'data', 'bdp', 'data.js'),
  path.join(root, 'data', 'prizelist', 'data.js'),
  path.join(root, 'assets', 'js', 'volopt_data.js'),
  path.join(root, 'assets', 'js', 'i18n', 'items_i18n.js'),
  path.join(root, 'assets', 'js', 'price_guide_data.js'),
  path.join(root, 'assets', 'js', 'mag-evolution.js'),
  path.join(root, 'assets', 'js', 'mag-sim-data.js'),
]);
const unpublishedBuildInputs = new Set(excludedFiles);
const execFileAsync = promisify(execFile);
const angularOutputDirectory = path.join(root, 'dist', 'angular-tools', 'browser');

function isInside(file, directory) {
  const relative = path.relative(directory, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toPosix(file) {
  return file.split(path.sep).join('/');
}

function relativeToRoot(file) {
  return toPosix(path.relative(root, file));
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

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
  for (const child of node.childNodes || []) {
    visit(child, callback);
  }
  if (node.content) {
    visit(node.content, callback);
  }
}

function localPathFromUrl(pageFile, url) {
  const encoded = url.split(/[?#]/, 1)[0];
  let clean;
  try {
    clean = decodeURIComponent(encoded);
  } catch {
    clean = encoded;
  }
  if (!clean
      || clean.startsWith('#')
      || /^(?:[a-z]+:)?\/\//i.test(clean)
      || clean.startsWith('data:')
      || clean.startsWith('mailto:')
      || clean.startsWith('javascript:')) {
    return null;
  }
  return clean.startsWith('/')
    ? path.join(root, clean.slice(1))
    : path.resolve(path.dirname(pageFile), clean);
}

async function copySiteSource() {
  await mkdir(temporaryDirectory, { recursive: true });

  for (const filename of rootFiles) {
    const source = path.join(root, filename);
    if (await exists(source)) {
      await cp(source, path.join(temporaryDirectory, filename));
    }
  }

  for (const directory of siteDirectories) {
    const source = path.join(root, directory);
    await cp(source, path.join(temporaryDirectory, directory), {
      recursive: true,
      filter(file) {
        return !excludedTrees.some((tree) => isInside(file, tree))
          && !unpublishedBuildInputs.has(file)
          && path.basename(file) !== '.DS_Store';
      },
    });
  }

  for (const source of publishedFiles) {
    const destination = path.join(temporaryDirectory, path.relative(root, source));
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
  }
}

async function buildAngularApplication() {
  await execFileAsync(process.execPath, [
    path.join(root, 'scripts', 'generate_angular_combo.mjs'),
  ], { cwd: root });
  await execFileAsync(process.execPath, [
    path.join(root, 'scripts', 'generate_angular_content.mjs'),
  ], { cwd: root });
  const angularCli = path.join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  await execFileAsync(process.execPath, [angularCli, 'build', 'haven-tools'], {
    cwd: root,
    env: {
      ...process.env,
      NG_BUILD_MAX_WORKERS: '1',
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=4096`.trim(),
    },
  });

}

async function installAngularApplication(pages) {
  const destination = path.join(temporaryDirectory, 'assets', 'angular');
  await mkdir(destination, { recursive: true });
  const browserFiles = (await walk(angularOutputDirectory)).sort();
  for (const source of browserFiles.filter((file) => !file.endsWith('.html'))) {
    const relative = path.relative(angularOutputDirectory, source);
    const output = path.join(destination, relative);
    await mkdir(path.dirname(output), { recursive: true });
    await cp(source, output);
  }

  const prerenderManifest = JSON.parse(await readFile(
    path.join(root, 'dist', 'angular-tools', 'prerendered-routes.json'),
    'utf8',
  ));
  const prerenderedRoutes = Object.keys(prerenderManifest.routes).sort();
  const pageSet = new Set(pages.map(relativeToRoot));
  const routeAssets = [];
  const angularPages = new Set();
  let hosts = 0;
  for (const route of prerenderedRoutes) {
    const relativeRoute = route.replace(/^\//, '');
    const historicalPage = relativeRoute === ''
      ? 'index.html'
      : (pageSet.has(relativeRoute) ? relativeRoute : `${relativeRoute}/index.html`);
    if (!pageSet.has(historicalPage)) {
      throw new Error(`Angular prerender route has no historical page: ${route}`);
    }
    angularPages.add(historicalPage);
    const prerenderedPage = relativeRoute
      ? path.join(angularOutputDirectory, relativeRoute, 'index.html')
      : path.join(angularOutputDirectory, 'index.html');
    let html = await readFile(prerenderedPage, 'utf8');
    html = html.replace(
      /((?:src|href)=")((?:chunk|main|styles)-[^"/]+\.(?:js|css))/g,
      '$1/assets/angular/$2',
    );
    routeAssets.push({
      route,
      files: [...html.matchAll(/(?:src|href)="\/assets\/angular\/([^"?]+\.js)/g)]
        .map((match) => `assets/angular/${match[1]}`),
    });
    await writeFile(path.join(temporaryDirectory, historicalPage), html);
    hosts += 1;
  }

  const fragmentPattern = /^event\/(?:anniversary|christmas|easter|halloween|valentines)\/\d{4}\.html$/;
  const unexpectedNonAngularPages = [...pageSet]
    .filter((page) => !angularPages.has(page) && !fragmentPattern.test(page));
  if (unexpectedNonAngularPages.length) {
    throw new Error(`Public HTML is not Angular-owned:\n${unexpectedNonAngularPages.join('\n')}`);
  }
  if (!hosts) {
    throw new Error('Angular build has no HTML host document');
  }

  const files = (await walk(destination)).sort();
  const javascript = files.filter((file) => file.endsWith('.js'));
  const chunks = await Promise.all(javascript.map(async (file) => ({
    file: toPosix(path.relative(temporaryDirectory, file)),
    gzipBytes: gzipSync(await readFile(file)).length,
  })));
  const javascriptGzipBytes = chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0);
  const gzipByFile = new Map(chunks.map((chunk) => [chunk.file, chunk.gzipBytes]));
  const routes = routeAssets.map(({ route, files }) => ({
    route,
    files: [...new Set(files)].sort(),
    gzipBytes: [...new Set(files)].reduce(
      (total, file) => total + (gzipByFile.get(file) ?? 0),
      0,
    ),
  }));
  return {
    hosts,
    hostPages: [...angularPages].sort(),
    files: files.map((file) => toPosix(path.relative(temporaryDirectory, file))),
    javascriptGzipBytes,
    chunks,
    routes,
  };
}

async function discoverPages() {
  const rootPages = rootFiles
    .filter((file) => file.endsWith('.html'))
    .map((file) => path.join(root, file));
  const nestedPages = (await Promise.all(
    siteDirectories.map(async (directory) => {
      const absolute = path.join(root, directory);
      return (await walk(absolute)).filter(
        (file) => file.endsWith('.html')
          && !excludedTrees.some((tree) => isInside(file, tree)),
      );
    }),
  )).flat();
  return [...rootPages, ...nestedPages].sort();
}

function resourceReferences(html, pageFile) {
  const document = parse(html);
  const references = [];
  visit(document, (node) => {
    if (!node.tagName) {
      return;
    }
    const attributes = new Map((node.attrs || []).map((attribute) => [attribute.name, attribute.value]));
    const candidates = [];
    if (node.tagName === 'script' && attributes.has('src')) {
      candidates.push(attributes.get('src'));
    }
    if (['a', 'link'].includes(node.tagName) && attributes.has('href')) {
      candidates.push(attributes.get('href'));
    }
    if (['img', 'audio', 'video', 'source', 'input'].includes(node.tagName)
        && attributes.has('src')) {
      candidates.push(attributes.get('src'));
    }
    if (node.tagName === 'object' && attributes.has('data')) {
      candidates.push(attributes.get('data'));
    }
    if (attributes.has('srcset')) {
      candidates.push(...attributes.get('srcset').split(',').map(
        (candidate) => candidate.trim().split(/\s+/, 1)[0],
      ));
    }
    for (const url of candidates) {
      const sourcePath = localPathFromUrl(pageFile, url);
      if (sourcePath) {
        references.push({ pageFile, url, sourcePath });
      }
    }
  });
  return references;
}

async function outputReferenceExists(reference) {
  const relative = path.relative(root, reference.sourcePath);
  const outputResource = path.join(temporaryDirectory, relative);
  try {
    const details = await stat(outputResource);
    if (details.isFile()) {
      return true;
    }
    if (details.isDirectory()) {
      return (await stat(path.join(outputResource, 'index.html'))).isFile();
    }
    return false;
  } catch {
    return false;
  }
}

async function validateCssResources(errors) {
  const cssFiles = (await walk(temporaryDirectory))
    .filter((file) => file.endsWith('.css'))
    .sort();
  for (const cssFile of cssFiles) {
    const css = await readFile(cssFile, 'utf8');
    const virtualSource = path.join(root, path.relative(temporaryDirectory, cssFile));
    for (const match of css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
      const sourcePath = localPathFromUrl(virtualSource, match[2]);
      if (!sourcePath) {
        continue;
      }
      const reference = { sourcePath };
      if (!(await outputReferenceExists(reference))) {
        errors.push(
          `${toPosix(path.relative(temporaryDirectory, cssFile))}: missing ${match[2]}`,
        );
      }
    }
  }
}

function isAngularInlineScript(node, attributes) {
  const id = attributes.get('id');
  const type = attributes.get('type');
  const source = node.childNodes?.map((child) => child.value || '').join('').trim() || '';
  return (id === 'ng-state' && type === 'application/json')
    || (id === 'ng-event-dispatch-contract' && type === 'text/javascript')
    || (!id && /^window\.__jsaction_bootstrap\(document\.body,"ng",\[.*\],\[.*\]\);$/.test(source));
}

async function validateOutput(pages, angularPages) {
  const errors = [];
  for (const pageFile of pages) {
    const outputPage = path.join(temporaryDirectory, path.relative(root, pageFile));
    const html = await readFile(outputPage, 'utf8');
    const document = parse(html);
    let hasHydrationState = false;
    let hasHydratedRoot = false;
    visit(document, (node) => {
      const attributes = new Map((node.attrs || []).map(({ name, value }) => [name, value]));
      if (node.tagName === 'haven-tools-app' && attributes.has('ngh')) {
        hasHydratedRoot = true;
      }
      if (node.tagName !== 'script') return;
      const source = attributes.get('src');
      if (attributes.get('id') === 'ng-state') {
        hasHydrationState = true;
      }
      if (!source?.startsWith('/assets/angular/') && !isAngularInlineScript(node, attributes)) {
        errors.push(`${relativeToRoot(pageFile)}: non-Angular script ${source ?? '(inline)'}`);
      }
    });
    if (angularPages.has(relativeToRoot(pageFile)) && (!hasHydratedRoot || !hasHydrationState)) {
      errors.push(`${relativeToRoot(pageFile)}: missing Angular hydration metadata`);
    }
    for (const reference of resourceReferences(html, pageFile)) {
      if (!(await outputReferenceExists(reference))) {
        errors.push(`${relativeToRoot(pageFile)}: missing ${reference.url}`);
      }
    }
  }
  await validateCssResources(errors);

  const forbiddenRuntime = /(?:^|\/)(?:jquery(?:\.min)?\.js|bootstrap(?:\.bundle|\.min)?\.(?:js|css)|vue(?:-multiselect)?(?:\.min)?\.(?:js|css)|page-chrome\.js)$/i;
  for (const file of await walk(temporaryDirectory)) {
    const relative = toPosix(path.relative(temporaryDirectory, file));
    if (forbiddenRuntime.test(relative)) errors.push(`retired runtime leaked into artifact: ${relative}`);
    if (path.basename(file) === '.DS_Store') errors.push(`operating-system metadata leaked into artifact: ${relative}`);
  }

  for (const source of publishedFiles) {
    const output = path.join(temporaryDirectory, path.relative(root, source));
    if (!(await exists(output))) {
      errors.push(`required published file is missing: ${relativeToRoot(source)}`);
    } else if (sha256(await readFile(output)) !== sha256(await readFile(source))) {
      errors.push(`required published file changed: ${relativeToRoot(source)}`);
    }
  }

  if (errors.length) {
    throw new Error(`Artifact validation failed:\n${errors.join('\n')}`);
  }
}

async function inlineScriptStats(pages) {
  let blocks = 0;
  let bytes = 0;
  for (const pageFile of pages) {
    const html = await readFile(pageFile, 'utf8');
    const document = parse(html, { sourceCodeLocationInfo: true });
    visit(document, (node) => {
      if (node.tagName !== 'script'
          || node.attrs?.some((attribute) => attribute.name === 'src')
          || !node.sourceCodeLocation?.startTag
          || !node.sourceCodeLocation?.endTag) {
        return;
      }
      blocks += 1;
      const body = html.slice(
        node.sourceCodeLocation.startTag.endOffset,
        node.sourceCodeLocation.endTag.startOffset,
      );
      bytes += Buffer.byteLength(body);
    });
  }
  return { blocks, bytes };
}

async function excludedStats() {
  const files = [
    ...excludedFiles,
    ...(await Promise.all(excludedTrees.map(walk))).flat()
      .filter((file) => file.endsWith('.js') && !file.endsWith('.min.js')),
  ].sort();
  const details = await Promise.all(files.map(async (file) => ({
    file: relativeToRoot(file),
    bytes: (await stat(file)).size,
    gzipBytes: gzipSync(await readFile(file)).length,
    published: false,
    reason: unpublishedBuildInputs.has(file) ? 'angular-build-input' : 'explicit-tree-opt-out',
  })));
  return {
    files: details,
    totalBytes: details.reduce((total, file) => total + file.bytes, 0),
    publishedGzipBytes: details.reduce(
      (total, file) => total + (file.published ? file.gzipBytes : 0),
      0,
    ),
  };
}

async function writeManifest(pages, angular) {
  const inline = await inlineScriptStats(pages);
  const excluded = await excludedStats();
  const artifactFiles = await Promise.all(
    (await walk(temporaryDirectory)).sort().map(async (file) => {
      const content = await readFile(file);
      return {
        file: toPosix(path.relative(temporaryDirectory, file)),
        bytes: content.length,
        sha256: sha256(content),
      };
    }),
  );
  const totals = {
    publishedJavaScriptGzipBytes: excluded.publishedGzipBytes + angular.javascriptGzipBytes,
  };
  const manifest = {
    schemaVersion: 1,
    coverage: {
      angularRoutes: angular.routes.length,
      angularHosts: angular.hosts,
      fragmentResources: pages.filter((file) => /event\/(?:anniversary|christmas|easter|halloween|valentines)\/\d{4}\.html$/.test(relativeToRoot(file))).length,
    },
    budgets,
    artifactFiles,
    totals,
    inline,
    excluded,
    angular,
  };
  await writeFile(
    path.join(temporaryDirectory, 'build-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

function enforceBudgets(manifest) {
  const failures = [];
  if (manifest.totals.publishedJavaScriptGzipBytes > budgets.maxJavaScriptGzipBytes) {
    failures.push(
      `JavaScript gzip budget exceeded: ${manifest.totals.publishedJavaScriptGzipBytes} `
      + `> ${budgets.maxJavaScriptGzipBytes}`,
    );
  }
  if (manifest.inline.bytes > budgets.maxInlineScriptBytes) {
    failures.push(
      `Inline script budget exceeded: ${manifest.inline.bytes} `
      + `> ${budgets.maxInlineScriptBytes}`,
    );
  }
  for (const chunk of manifest.angular.chunks) {
    if (chunk.gzipBytes > budgets.maxAngularChunkGzipBytes) {
      failures.push(
        `Angular chunk gzip budget exceeded (${chunk.file}): ${chunk.gzipBytes} `
        + `> ${budgets.maxAngularChunkGzipBytes}`,
      );
    }
  }
  for (const route of manifest.angular.routes) {
    if (route.gzipBytes > budgets.maxAngularRouteGzipBytes) {
      failures.push(
        `Angular route gzip budget exceeded (${route.route}): ${route.gzipBytes} `
        + `> ${budgets.maxAngularRouteGzipBytes}`,
      );
    }
  }
  if (failures.length) {
    throw new Error(`Build budget failed:\n${failures.join('\n')}`);
  }
}

async function publishAtomically() {
  await rm(backupDirectory, { recursive: true, force: true });
  const hadOutput = await exists(outputDirectory);
  if (hadOutput) {
    await rename(outputDirectory, backupDirectory);
  }
  try {
    await rename(temporaryDirectory, outputDirectory);
    await rm(backupDirectory, { recursive: true, force: true });
  } catch (error) {
    if (hadOutput && await exists(backupDirectory)) {
      await rename(backupDirectory, outputDirectory);
    }
    throw error;
  }
}

await rm(temporaryDirectory, { recursive: true, force: true });
try {
  await buildAngularApplication();
  await copySiteSource();
  const pages = await discoverPages();
  const { hostPages, ...angular } = await installAngularApplication(pages);
  await validateOutput(pages, new Set(hostPages));
  const manifest = await writeManifest(pages, angular);
  enforceBudgets(manifest);
  await publishAtomically();

  console.log(
    `Built _site with ${manifest.coverage.angularRoutes} prerendered Angular routes `
    + `and ${manifest.coverage.fragmentResources} event fragment resources.`,
  );
  console.log(
    `Published JavaScript gzip budget: ${manifest.totals.publishedJavaScriptGzipBytes} `
    + `/ ${budgets.maxJavaScriptGzipBytes} bytes.`,
  );
} catch (error) {
  await rm(temporaryDirectory, { recursive: true, force: true });
  throw error;
}
