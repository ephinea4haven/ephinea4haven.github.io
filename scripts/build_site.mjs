import { build as esbuild, transform } from 'esbuild';
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
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, '_site');
const temporaryDirectory = path.join(root, `.site-build-${process.pid}`);
const backupDirectory = path.join(root, `.site-backup-${process.pid}`);
const budgets = JSON.parse(await readFile(path.join(root, 'build-budgets.json'), 'utf8'));

const rootFiles = ['index.html', '404.html', 'CNAME'];
const siteDirectories = ['assets', 'data', 'event', 'guide', 'tools'];
const excludedTrees = [path.join(root, 'data', 'droptable')];
const excludedFiles = new Set([path.join(root, 'assets', 'js', 'combo_calc.js')]);
const target = 'es2018';

function isInside(file, directory) {
  const relative = path.relative(directory, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isMinifiableSource(file) {
  return file.endsWith('.js')
    && !file.endsWith('.min.js')
    && !excludedFiles.has(file)
    && !excludedTrees.some((directory) => isInside(file, directory));
}

function isGeneratedSibling(file) {
  if (!file.endsWith('.min.js')) {
    return false;
  }
  const source = file.replace(/\.min\.js$/, '.js');
  return existsSync(source) && isMinifiableSource(source);
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

function pageUrlForOutput(pageFile, originalUrl, outputRelative) {
  const suffix = originalUrl.match(/#.*$/)?.[0] || '';
  if (originalUrl.startsWith('/')) {
    return `/${outputRelative}${suffix}`;
  }
  let relative = toPosix(path.relative(
    path.dirname(path.relative(root, pageFile)),
    outputRelative,
  ));
  if (originalUrl.startsWith('./') && !relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  return `${relative}${suffix}`;
}

function scriptEntries(html, pageFile) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const entries = [];
  visit(document, (node) => {
    if (node.tagName !== 'script' || !node.sourceCodeLocation?.attrs) {
      return;
    }
    const src = node.attrs?.find((attribute) => attribute.name === 'src')?.value;
    if (!src) {
      return;
    }
    const sourceFile = localPathFromUrl(pageFile, src);
    if (!sourceFile) {
      return;
    }
    entries.push({
      pageFile,
      sourceFile,
      sourceUrl: src,
      type: node.attrs?.find((attribute) => attribute.name === 'type')?.value === 'module'
        ? 'module'
        : 'classic',
      location: node.sourceCodeLocation.attrs.src,
    });
  });
  return entries;
}

function rewriteAttribute(html, location, name, value) {
  return `${html.slice(0, location.startOffset)}${name}="${value}"`
    + html.slice(location.endOffset);
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
          && !isMinifiableSource(file)
          && !isGeneratedSibling(file);
      },
    });
  }
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

async function discoverMinifiableSources() {
  return (await Promise.all(
    siteDirectories.map(async (directory) => {
      const absolute = path.join(root, directory);
      return (await walk(absolute)).filter(isMinifiableSource);
    }),
  )).flat().sort();
}

async function minifyClassic(sourceFile) {
  const source = await readFile(sourceFile, 'utf8');
  const result = await transform(source, {
    loader: 'js',
    minify: true,
    target,
    legalComments: 'eof',
    sourcefile: relativeToRoot(sourceFile),
  });
  return {
    code: result.code,
    inputs: [sourceFile],
  };
}

async function bundleModule(sourceFile) {
  const result = await esbuild({
    entryPoints: [sourceFile],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target,
    minify: true,
    legalComments: 'eof',
    metafile: true,
    plugins: [{
      name: 'site-root-imports',
      setup(context) {
        context.onResolve({ filter: /^\// }, (args) => {
          if (args.kind === 'entry-point') {
            return null;
          }
          return { path: path.join(root, args.path.slice(1)) };
        });
      },
    }],
  });
  if (result.outputFiles.length !== 1) {
    throw new Error(
      `${relativeToRoot(sourceFile)} emitted ${result.outputFiles.length} module outputs; expected one`,
    );
  }
  const inputs = Object.keys(result.metafile.inputs)
    .map((file) => path.resolve(root, file));
  return {
    code: result.outputFiles[0].text,
    inputs,
  };
}

async function emitEntry(sourceFile, type) {
  const result = type === 'module'
    ? await bundleModule(sourceFile)
    : await minifyClassic(sourceFile);
  const digest = sha256(result.code);
  const sourceRelative = relativeToRoot(sourceFile);
  const parsed = path.posix.parse(sourceRelative);
  const outputRelative = path.posix.join(
    parsed.dir,
    `${parsed.name}.${digest.slice(0, 12)}.min.js`,
  );
  const output = path.join(temporaryDirectory, outputRelative);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, result.code);

  const inputContents = await Promise.all(result.inputs.map((file) => readFile(file)));
  return {
    source: sourceRelative,
    output: outputRelative,
    type,
    sha256: digest,
    inputBytes: inputContents.reduce((total, content) => total + content.length, 0),
    outputBytes: Buffer.byteLength(result.code),
    inputGzipBytes: inputContents.reduce(
      (total, content) => total + gzipSync(content).length,
      0,
    ),
    outputGzipBytes: gzipSync(result.code).length,
    inputs: result.inputs.map(relativeToRoot).sort(),
  };
}

async function transformScripts(pages) {
  const entriesByKey = new Map();
  const entriesByPage = new Map();
  const typeBySource = new Map();

  for (const pageFile of pages) {
    const html = await readFile(pageFile, 'utf8');
    const entries = scriptEntries(html, pageFile);
    entriesByPage.set(pageFile, entries);
    for (const entry of entries) {
      if (!isMinifiableSource(entry.sourceFile)) {
        continue;
      }
      const existingType = typeBySource.get(entry.sourceFile);
      if (existingType && existingType !== entry.type) {
        throw new Error(`${relativeToRoot(entry.sourceFile)} is used as both module and classic script`);
      }
      typeBySource.set(entry.sourceFile, entry.type);
      const key = `${entry.type}:${entry.sourceFile}`;
      entriesByKey.set(key, entry);
    }
  }

  const assets = [];
  const outputByKey = new Map();
  for (const key of [...entriesByKey.keys()].sort()) {
    const entry = entriesByKey.get(key);
    const asset = await emitEntry(entry.sourceFile, entry.type);
    assets.push(asset);
    outputByKey.set(key, asset.output);
  }

  for (const pageFile of pages) {
    const destination = path.join(temporaryDirectory, path.relative(root, pageFile));
    let html = await readFile(pageFile, 'utf8');
    const replacements = entriesByPage.get(pageFile)
      .filter((entry) => isMinifiableSource(entry.sourceFile))
      .map((entry) => {
        const output = outputByKey.get(`${entry.type}:${entry.sourceFile}`);
        return {
          ...entry,
          output,
          url: pageUrlForOutput(pageFile, entry.sourceUrl, output),
        };
      })
      .sort((left, right) => right.location.startOffset - left.location.startOffset);
    for (const replacement of replacements) {
      html = rewriteAttribute(html, replacement.location, 'src', replacement.url);
    }
    await writeFile(destination, html);
  }

  return assets;
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

async function validateOutput(pages, assets, eligibleSources) {
  const errors = [];
  for (const pageFile of pages) {
    const outputPage = path.join(temporaryDirectory, path.relative(root, pageFile));
    const html = await readFile(outputPage, 'utf8');
    for (const reference of resourceReferences(html, pageFile)) {
      if (!(await outputReferenceExists(reference))) {
        errors.push(`${relativeToRoot(pageFile)}: missing ${reference.url}`);
      }
    }
  }
  await validateCssResources(errors);

  for (const asset of assets) {
    if (await exists(path.join(temporaryDirectory, asset.source))) {
      errors.push(`readable source leaked into artifact: ${asset.source}`);
    }
    const output = path.join(temporaryDirectory, asset.output);
    const content = await readFile(output);
    if (sha256(content) !== asset.sha256) {
      errors.push(`hash mismatch: ${asset.output}`);
    }
  }

  const accountedInputs = new Set(assets.flatMap((asset) => asset.inputs));
  for (const source of eligibleSources) {
    const relative = relativeToRoot(source);
    if (!accountedInputs.has(relative)) {
      errors.push(`minifiable source is not reachable from any HTML entry: ${relative}`);
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
    reason: excludedFiles.has(file) ? 'upstream-managed' : 'explicit-tree-opt-out',
  })));
  return {
    files: details,
    totalBytes: details.reduce((total, file) => total + file.bytes, 0),
  };
}

async function writeManifest(pages, assets, eligibleSources) {
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
  const sourceContents = await Promise.all(eligibleSources.map((file) => readFile(file)));
  const totals = assets.reduce((summary, asset) => ({
    sourceBytes: summary.sourceBytes,
    outputBytes: summary.outputBytes + asset.outputBytes,
    sourceGzipBytes: summary.sourceGzipBytes,
    outputGzipBytes: summary.outputGzipBytes + asset.outputGzipBytes,
  }), {
    sourceBytes: sourceContents.reduce((total, content) => total + content.length, 0),
    outputBytes: 0,
    sourceGzipBytes: sourceContents.reduce(
      (total, content) => total + gzipSync(content).length,
      0,
    ),
    outputGzipBytes: 0,
  });
  const manifest = {
    schemaVersion: 1,
    target,
    coverage: {
      sources: eligibleSources.map(relativeToRoot),
      sourceFiles: eligibleSources.length,
      outputEntries: assets.length,
    },
    budgets,
    assets: assets.sort((left, right) => left.source.localeCompare(right.source)),
    artifactFiles,
    totals,
    inline,
    excluded,
  };
  await writeFile(
    path.join(temporaryDirectory, 'build-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

function enforceBudgets(manifest) {
  const failures = [];
  if (manifest.totals.outputGzipBytes > budgets.maxJavaScriptGzipBytes) {
    failures.push(
      `JavaScript gzip budget exceeded: ${manifest.totals.outputGzipBytes} `
      + `> ${budgets.maxJavaScriptGzipBytes}`,
    );
  }
  if (manifest.inline.bytes > budgets.maxInlineScriptBytes) {
    failures.push(
      `Inline script budget exceeded: ${manifest.inline.bytes} `
      + `> ${budgets.maxInlineScriptBytes}`,
    );
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
  await copySiteSource();
  const pages = await discoverPages();
  const eligibleSources = await discoverMinifiableSources();
  const assets = await transformScripts(pages);
  await validateOutput(pages, assets, eligibleSources);
  const manifest = await writeManifest(pages, assets, eligibleSources);
  enforceBudgets(manifest);
  await publishAtomically();

  const rawSaving = 1 - manifest.totals.outputBytes / manifest.totals.sourceBytes;
  const gzipSaving = 1 - manifest.totals.outputGzipBytes / manifest.totals.sourceGzipBytes;
  console.log(
    `Built _site with ${manifest.assets.length} compressed entries: `
    + `${manifest.totals.sourceBytes} -> ${manifest.totals.outputBytes} bytes `
    + `(${(rawSaving * 100).toFixed(1)}% smaller), gzip `
    + `${manifest.totals.sourceGzipBytes} -> ${manifest.totals.outputGzipBytes} bytes `
    + `(${(gzipSaving * 100).toFixed(1)}% smaller).`,
  );
} catch (error) {
  await rm(temporaryDirectory, { recursive: true, force: true });
  throw error;
}
