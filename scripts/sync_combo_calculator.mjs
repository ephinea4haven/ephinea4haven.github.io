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
const localDependencies = {
  jquery: {
    version: '4.0.0',
    pageUrl: '../assets/js/jquery.min.js',
  },
  bootstrap: {
    version: '5.3.8',
    cssPageUrl: '../assets/css/bootstrap.min.css',
  },
};
const publishedLicensePath = '/third_party/psostats-combo/LICENSE';
const licenseBanner = `/*! PSOStats Combo Calculator - Copyright (c) 2021 phelix- - MIT License: ${publishedLicensePath} */`;
const checkOnly = process.argv.includes('--check');
const accessibilityLabels = new Map([
  ['classMinAtpInput', 'Minimum class ATP'],
  ['classMaxAtpInput', 'Maximum class ATP'],
  ['ataInput', 'ATA'],
  ['shiftaInput', 'Shifta level'],
  ['zalureInput', 'Zalure level'],
  ['special-select', 'Special attack'],
  ['sphereInput', 'Attribute percentage'],
  ['hitInput', 'Weapon Hit'],
  ['minAtpInput', 'Minimum weapon ATP'],
  ['maxAtpInput', 'Maximum weapon ATP'],
  ['attack1', 'First attack'],
  ['hits1', 'First attack hit count'],
  ['attack2', 'Second attack'],
  ['hits2', 'Second attack hit count'],
  ['attack3', 'Third attack'],
  ['hits3', 'Third attack hit count'],
]);

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

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) {
      return Math.sign(difference);
    }
  }
  return 0;
}

function readUpstreamDependencyVersions(source, pageName) {
  const jquery = source.match(/code\.jquery\.com\/jquery-(\d+\.\d+\.\d+)(?:\.slim)?\.min\.js/);
  const bootstrapCss = source.match(/bootstrap@(\d+\.\d+\.\d+)\/dist\/css\/bootstrap\.min\.css/);
  const bootstrapScript = source.match(
    /bootstrap@(\d+\.\d+\.\d+)\/dist\/js\/bootstrap\.bundle\.min\.js/,
  );
  if (!jquery || !bootstrapCss || !bootstrapScript) {
    throw new Error(`${pageName} page dependency versions could not be identified`);
  }
  if (bootstrapCss[1] !== bootstrapScript[1]) {
    throw new Error(`${pageName} page uses mismatched Bootstrap CSS and JavaScript versions`);
  }
  return { jquery: jquery[1], bootstrap: bootstrapCss[1] };
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

function migrateBootstrap5Markup(html) {
  const withoutInputGroupWrappers = html.replace(
    /<div class="input-group-(?:prepend|append)">\s*<div class="input-group-text">([^<]*)<\/div>\s*<\/div>/g,
    '<span class="input-group-text">$1</span>',
  );
  return withoutInputGroupWrappers
    .replace(
      /<select\b[^>]*>/g,
      (tag) => tag.replace(/\bform-control\b/, 'form-select'),
    )
    .replaceAll(
      'class="col-6 col-md-3 mb-1"',
      'class="col-12 col-sm-6 col-md-3 mb-1"',
    );
}

function addAccessibilityNames(html) {
  const namedControls = new Set();
  const output = html.replace(/<(?:input|select)\b[^>]*>/g, (tag) => {
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const label = accessibilityLabels.get(id);
    if (!label) return tag;
    namedControls.add(id);
    return /\baria-label=/.test(tag)
      ? tag
      : tag.replace(/>$/, ` aria-label="${label}">`);
  });
  const missingControls = [...accessibilityLabels.keys()]
    .filter((id) => !namedControls.has(id));
  if (missingControls.length) {
    throw new Error(`Upstream page is missing named controls: ${missingControls.join(', ')}`);
  }
  return output;
}

function addAccessibleEnemyTags(html) {
  html = replaceRequired(
    html,
    '                            @search-change="filterEnemies"\n                    >\n                    </multiselect>',
    `                            @search-change="filterEnemies"
                    >
                        <template slot="tag" slot-scope="{ option, remove }">
                            <span class="multiselect__tag">
                                <span>{{ option.name }}</span>
                                <button type="button" class="multiselect__tag-icon"
                                        @click.stop.prevent="remove(option)"
                                        :aria-label="'Remove ' + option.name"></button>
                            </span>
                        </template>
                    </multiselect>`,
    'enemy multiselect closing tag',
  );
  return replaceRequired(
    html,
    '    </style>',
    `        button.multiselect__tag-icon {
            padding: 0;
            border: 0;
            background: transparent;
        }
    </style>`,
    'page style block',
  );
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
  if (/data-(?:toggle|dismiss|spy)=|\.(?:carousel|collapse|dropdown|modal|popover|scrollspy|tab|toast|tooltip)\s*\(/i.test(source)) {
    throw new Error(
      `${page.name} page began using Bootstrap JavaScript; do not remove the upstream bundle`,
    );
  }

  let html = source.replace(/\r\n/g, '\n').trim();
  html = removeUpstreamNavbar(html);
  html = replaceRequired(
    html,
    /<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@[^/]+\/dist\/css\/bootstrap\.min\.css"[^>]*>/,
    `<link rel="stylesheet" href="${localDependencies.bootstrap.cssPageUrl}">`,
    'Bootstrap stylesheet',
  );
  html = replaceRequired(
    html,
    /<script type="text\/javascript" src="https:\/\/code\.jquery\.com\/jquery-[^"]+"[^>]*><\/script>/,
    `<script src="${localDependencies.jquery.pageUrl}"></script>`,
    'jQuery script',
  );
  html = replaceRequired(
    html,
    /<script type="text\/javascript" src="https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@[^/]+\/dist\/js\/bootstrap\.bundle\.min\.js"[^>]*><\/script>/,
    '',
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
  html = migrateBootstrap5Markup(html);
  html = addAccessibilityNames(html);
  html = addAccessibleEnemyTags(html);
  if (/input-group-(?:prepend|append)/.test(html)
      || /<select\b[^>]*class="[^"]*\bform-control\b/.test(html)
      || html.includes('class="col-6 col-md-3 mb-1"')) {
    throw new Error(`${page.name} page still contains Bootstrap 4 form markup`);
  }
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

const upstreamDependencyVersions = pageSources.map((source, index) => (
  readUpstreamDependencyVersions(source, upstreamPages[index].name)
));
if (JSON.stringify(upstreamDependencyVersions[0]) !== JSON.stringify(upstreamDependencyVersions[1])) {
  throw new Error('Upstream calculator pages use different dependency versions');
}
for (const dependency of ['jquery', 'bootstrap']) {
  if (compareVersions(localDependencies[dependency].version, upstreamDependencyVersions[0][dependency]) < 0) {
    throw new Error(
      `Local ${dependency} ${localDependencies[dependency].version} is older than upstream ${upstreamDependencyVersions[0][dependency]}`,
    );
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
  dependencies: {
    upstream: upstreamDependencyVersions[0],
    local: {
      jquery: localDependencies.jquery.version,
      bootstrap: localDependencies.bootstrap.version,
    },
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
