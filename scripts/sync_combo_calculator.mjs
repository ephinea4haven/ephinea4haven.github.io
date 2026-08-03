import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstreamRepository = 'https://github.com/phelix-/psostats-client';
const upstreamApi = 'https://api.github.com/repos/phelix-/psostats-client/commits/main';
const upstreamPages = [
  {
    name: 'multiplayer',
    url: 'https://psostats.com/combo-calculator',
    output: path.join(root, 'tools', 'cc.html'),
    dataOutput: path.join(root, 'assets', 'js', 'combo_calc_multi_data.js'),
    dataUrl: '../assets/js/combo_calc_multi_data.js',
    description: 'PSOBB multiplayer Combo damage calculator',
  },
  {
    name: 'opm',
    url: 'https://psostats.com/combo-calculator/opm',
    output: path.join(root, 'tools', 'ccopm.html'),
    dataOutput: path.join(root, 'assets', 'js', 'combo_calc_opm_data.js'),
    dataUrl: '../assets/js/combo_calc_opm_data.js',
    description: 'PSOBB OPM Combo damage calculator',
  },
];
const upstreamScriptUrl = 'https://psostats.com/static/combo_calc3.js';
const outputScript = path.join(root, 'assets', 'js', 'combo_calc.js');
const metadataFile = path.join(root, 'third_party', 'psostats-combo', 'upstream.json');
const licenseFile = path.join(root, 'third_party', 'psostats-combo', 'LICENSE');
const publishedLicensePath = '/third_party/psostats-combo/LICENSE';
const licenseBanner = `/*! PSOStats Combo Calculator - Copyright (c) 2021 phelix- - MIT License: ${publishedLicensePath} */`;
const checkOnly = process.argv.includes('--check');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function normalizeText(content) {
  return content.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd() + '\n';
}

async function download(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'ephinea4haven-combo-sync',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function replaceRequired(source, pattern, replacement, label) {
  const found = typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source);
  if (!found) {
    throw new Error(`Upstream page no longer contains the expected ${label}`);
  }
  return source.replace(pattern, replacement);
}

function removeUpstreamNavbar(html) {
  const start = html.indexOf('<div class="row psostats-nav">');
  const heading = html.indexOf('<h1>Combo Calculator', start);
  const end = html.lastIndexOf('<div class="row">', heading);
  if (start < 0 || heading < 0 || end < start) {
    throw new Error('Upstream navbar boundaries changed');
  }
  return `${html.slice(0, start)}${html.slice(end)}`;
}

function adaptPage(source, page) {
  for (const marker of [
    'const weapons =',
    'const frames =',
    'const classStats =',
    'const enemies =',
    '<div id="enemy-select-vue"',
  ]) {
    if (!source.includes(marker)) {
      throw new Error(`${page.name} page is missing required marker: ${marker}`);
    }
  }

  let html = source.replace(/\r\n/g, '\n').trim();
  html = removeUpstreamNavbar(html);
  html = replaceRequired(
    html,
    /<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@4\.6\.0\/dist\/css\/bootstrap\.min\.css"[^>]*>/,
    '<link rel="stylesheet" href="../assets/css/bootstrap.min.css">',
    'Bootstrap stylesheet',
  );
  html = replaceRequired(
    html,
    /<script type="text\/javascript" src="https:\/\/code\.jquery\.com\/jquery-[^"]+"[^>]*><\/script>/,
    '<script src="../assets/js/jquery.min.js"></script>',
    'jQuery script',
  );
  html = replaceRequired(
    html,
    /<script type="text\/javascript" src="https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@4\.6\.0\/dist\/js\/bootstrap\.bundle\.min\.js"[^>]*><\/script>/,
    '<script src="../assets/js/popper.min.js"></script>\n        <script src="../assets/js/bootstrap.min.js"></script>',
    'Bootstrap script',
  );
  html = replaceRequired(
    html,
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/vue@2"><\/script>/,
    '<script src="../assets/js/vue.min.js"></script>',
    'Vue script',
  );
  html = replaceRequired(
    html,
    /<script src="https:\/\/unpkg\.com\/vue-multiselect@[^"]+"><\/script>/,
    '<script src="../assets/js/vue-multiselect.min.js"></script>',
    'Vue Multiselect script',
  );
  html = replaceRequired(
    html,
    /<link rel="stylesheet" href="https:\/\/unpkg\.com\/vue-multiselect@[^"]+\/dist\/vue-multiselect\.min\.css">/,
    '<link rel="stylesheet" href="../assets/css/vue-multiselect.min.css">',
    'Vue Multiselect stylesheet',
  );
  html = replaceRequired(
    html,
    '<link href="/static/main2.css" rel="stylesheet" type="text/css">',
    '<link href="../assets/css/main2.css" rel="stylesheet" type="text/css">',
    'PSOStats stylesheet',
  );
  html = replaceRequired(
    html,
    '<script type="text/javascript" src="/static/combo_calc3.js"></script>',
    '<script type="text/javascript" src="../assets/js/combo_calc.js"></script>',
    'Combo Calculator script',
  );

  html = html
    .replaceAll('href="/combo-calculator/opm"', 'href="/tools/ccopm.html"')
    .replaceAll('href="/combo-calculator"', 'href="/tools/cc.html"');
  html = replaceRequired(
    html,
    '<head>',
    `<head>\n        <meta charset="utf-8">\n        <meta name="description" content="${page.description}">`,
    'head element',
  );

  const dataStart = html.indexOf('        const weapons = ');
  const enemiesStart = html.indexOf('        const enemies = ', dataStart);
  const dataEndMarker = '\n        const allEnemiesByLocation = {}';
  const dataEnd = html.indexOf(dataEndMarker, enemiesStart);
  if (dataStart < 0 || enemiesStart < 0 || dataEnd < 0) {
    throw new Error(`${page.name} page data block boundaries changed`);
  }
  const data = normalizeText(
    `${licenseBanner}\n${html.slice(dataStart, dataEnd).replace(/^ {8}/gm, '').trim()}`,
  );
  html = `${html.slice(0, dataStart)}${html.slice(dataEnd + 1)}`;
  html = replaceRequired(
    html,
    '    <script>\n        $(document).ready',
    `    <script src="${page.dataUrl}"></script>\n    <script>\n        $(document).ready`,
    'inline initialization script',
  );

  return {
    data,
    html: normalizeText(`<!doctype html>\n<!--\n  Synced from ${page.url} by scripts/sync_combo_calculator.mjs.
  Keep Haven-specific changes in the sync adapter, not in this generated file.
  PSOStats Combo Calculator copyright (c) 2021 phelix-.
  MIT license: ${publishedLicensePath}
-->\n${html}`),
  };
}

async function writeAtomic(filename, content) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, filename);
}

async function verifyCurrent(filename, expected) {
  let actual;
  try {
    actual = await readFile(filename, 'utf8');
  } catch {
    throw new Error(`${path.relative(root, filename)} is missing; run npm run sync:combo`);
  }
  if (actual !== expected) {
    throw new Error(`${path.relative(root, filename)} is stale; run npm run sync:combo`);
  }
}

const commit = JSON.parse(await download(upstreamApi, {
  headers: { Accept: 'application/vnd.github+json' },
}));
if (!/^[0-9a-f]{40}$/.test(commit.sha || '')) {
  throw new Error('GitHub returned an invalid upstream commit SHA');
}

const commitScriptUrl = `https://raw.githubusercontent.com/phelix-/psostats-client/${commit.sha}/static/combo_calc3.js`;
const licenseUrl = `https://raw.githubusercontent.com/phelix-/psostats-client/${commit.sha}/LICENSE`;
const [upstreamScript, commitScript, upstreamLicense, ...pageSources] = await Promise.all([
  download(upstreamScriptUrl),
  download(commitScriptUrl),
  download(licenseUrl),
  ...upstreamPages.map((page) => download(page.url)),
]);
if (!upstreamScript.includes("'use strict';") || !upstreamScript.includes('updateDamageTable')) {
  throw new Error('Downloaded Combo Calculator script failed its sanity check');
}
if (sha256(upstreamScript) !== sha256(commitScript)) {
  throw new Error(`Deployed Combo Calculator script does not match upstream commit ${commit.sha}`);
}

const [stableScript, ...stablePages] = await Promise.all([
  download(upstreamScriptUrl),
  ...upstreamPages.map((page) => download(page.url)),
]);
for (const [name, first, second] of [
  ['script', upstreamScript, stableScript],
  ...upstreamPages.map((page, index) => [page.name, pageSources[index], stablePages[index]]),
]) {
  if (sha256(first) !== sha256(second)) {
    throw new Error(`Upstream ${name} changed during synchronization; retry from a stable deployment`);
  }
}

const generatedPages = pageSources.map((source, index) => adaptPage(source, upstreamPages[index]));
const generatedScript = normalizeText(`${licenseBanner}\n${upstreamScript}`);
const generatedLicense = normalizeText(upstreamLicense);
const metadata = `${JSON.stringify({
  repository: upstreamRepository,
  observedMainCommit: commit.sha,
  verifiedScriptCommit: commit.sha,
  sources: {
    script: upstreamScriptUrl,
    commitScript: commitScriptUrl,
    multiplayerPage: upstreamPages[0].url,
    opmPage: upstreamPages[1].url,
    license: licenseUrl,
  },
  sourceSha256: {
    script: sha256(upstreamScript),
    commitScript: sha256(commitScript),
    multiplayerPage: sha256(pageSources[0]),
    opmPage: sha256(pageSources[1]),
    license: sha256(upstreamLicense),
  },
  generatedSha256: {
    script: sha256(generatedScript),
    multiplayerPage: sha256(generatedPages[0].html),
    multiplayerData: sha256(generatedPages[0].data),
    opmPage: sha256(generatedPages[1].html),
    opmData: sha256(generatedPages[1].data),
    license: sha256(generatedLicense),
  },
}, null, 2)}\n`;

const outputs = [
  [outputScript, generatedScript],
  [upstreamPages[0].output, generatedPages[0].html],
  [upstreamPages[0].dataOutput, generatedPages[0].data],
  [upstreamPages[1].output, generatedPages[1].html],
  [upstreamPages[1].dataOutput, generatedPages[1].data],
  [licenseFile, generatedLicense],
  [metadataFile, metadata],
];

if (checkOnly) {
  await Promise.all(outputs.map(([filename, content]) => verifyCurrent(filename, content)));
  console.log(`Combo Calculator snapshot is current (${commit.sha.slice(0, 12)}).`);
} else {
  await Promise.all(outputs.map(([filename, content]) => writeAtomic(filename, content)));
  console.log(`Synced Combo Calculator from PSOStats (${commit.sha.slice(0, 12)}).`);
}
