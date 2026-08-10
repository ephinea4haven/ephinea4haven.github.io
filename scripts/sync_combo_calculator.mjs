import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = 'https://github.com/phelix-/psostats-client';
const commitApi = 'https://api.github.com/repos/phelix-/psostats-client/commits/main';
const deployedScriptUrl = 'https://psostats.com/static/combo_calc3.js';
const pages = [
  {
    name: 'multiplayer',
    url: 'https://psostats.com/combo-calculator',
    output: path.join(root, 'assets', 'js', 'combo_calc_multi_data.js'),
  },
  {
    name: 'opm',
    url: 'https://psostats.com/combo-calculator/opm',
    output: path.join(root, 'assets', 'js', 'combo_calc_opm_data.js'),
  },
];
const engineOutput = path.join(root, 'assets', 'js', 'combo_calc.js');
const metadataOutput = path.join(root, 'third_party', 'psostats-combo', 'upstream.json');
const licenseOutput = path.join(root, 'third_party', 'psostats-combo', 'LICENSE');
const licensePath = '/third_party/psostats-combo/LICENSE';
const licenseBanner = `/*! PSOStats Combo Calculator - Copyright (c) 2021 phelix- - MIT License: ${licensePath} */`;
const checkOnly = process.argv.includes('--check');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function normalize(content) {
  return `${content.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd()}\n`;
}

async function download(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': 'ephinea4haven-combo-sync', ...options.headers },
  });
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function extractData(source, pageName) {
  const start = source.indexOf('        const weapons = ');
  const enemies = source.indexOf('        const enemies = ', start);
  const end = source.indexOf('\n        const allEnemiesByLocation = {}', enemies);
  if (start < 0 || enemies < 0 || end < 0) {
    throw new Error(`${pageName} data boundaries changed upstream`);
  }
  const data = source.slice(start, end).replace(/^ {8}/gm, '').trim();
  for (const name of ['weapons', 'frames', 'classStats', 'enemyNameSort', 'enemies']) {
    if (!data.includes(`const ${name} =`)) {
      throw new Error(`${pageName} is missing the ${name} dataset`);
    }
  }
  return normalize(`${licenseBanner}\n${data}`);
}

function dependencyVersions(source, pageName) {
  const jquery = source.match(/code\.jquery\.com\/jquery-(\d+\.\d+\.\d+)/)?.[1];
  const bootstrap = source.match(/bootstrap@(\d+\.\d+\.\d+)\/dist\/css/)?.[1];
  const vue = source.match(/cdn\.jsdelivr\.net\/npm\/vue@(\d+)/)?.[1];
  if (!jquery || !bootstrap || !vue) {
    throw new Error(`${pageName} dependency provenance could not be identified`);
  }
  return { jquery, bootstrap, vue };
}

async function writeAtomic(filename, content) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, content);
  await rename(temporary, filename);
}

async function verify(filename, expected) {
  const actual = await readFile(filename, 'utf8').catch(() => null);
  if (actual !== expected) {
    throw new Error(`${path.relative(root, filename)} is stale; run npm run sync:combo`);
  }
}

const commit = JSON.parse(await download(commitApi, {
  headers: { Accept: 'application/vnd.github+json' },
}));
if (!/^[0-9a-f]{40}$/.test(commit.sha || '')) {
  throw new Error('GitHub returned an invalid upstream commit SHA');
}
const commitScriptUrl = `https://raw.githubusercontent.com/phelix-/psostats-client/${commit.sha}/static/combo_calc3.js`;
const licenseUrl = `https://raw.githubusercontent.com/phelix-/psostats-client/${commit.sha}/LICENSE`;
const first = await Promise.all([
  download(deployedScriptUrl),
  download(commitScriptUrl),
  download(licenseUrl),
  ...pages.map(({ url }) => download(url)),
]);
const second = await Promise.all([
  download(deployedScriptUrl),
  ...pages.map(({ url }) => download(url)),
]);
const [deployedScript, commitScript, license, ...pageSources] = first;
if (sha256(deployedScript) !== sha256(commitScript)) {
  throw new Error(`Deployed calculator does not match upstream commit ${commit.sha}`);
}
for (const [label, before, after] of [
  ['script', deployedScript, second[0]],
  ...pages.map((page, index) => [page.name, pageSources[index], second[index + 1]]),
]) {
  if (sha256(before) !== sha256(after)) {
    throw new Error(`Upstream ${label} changed during synchronization; retry`);
  }
}

const generatedEngine = normalize(`${licenseBanner}\n${deployedScript}`);
const generatedData = pageSources.map((source, index) => extractData(source, pages[index].name));
const generatedLicense = normalize(license);
const observedDependencies = pageSources.map((source, index) => (
  dependencyVersions(source, pages[index].name)
));
if (JSON.stringify(observedDependencies[0]) !== JSON.stringify(observedDependencies[1])) {
  throw new Error('Upstream calculator pages use different dependency versions');
}
const metadata = `${JSON.stringify({
  repository,
  observedMainCommit: commit.sha,
  verifiedScriptCommit: commit.sha,
  presentation: 'Haven-owned Angular components',
  sources: {
    script: deployedScriptUrl,
    commitScript: commitScriptUrl,
    multiplayerPage: pages[0].url,
    opmPage: pages[1].url,
    license: licenseUrl,
  },
  sourceSha256: {
    script: sha256(deployedScript),
    commitScript: sha256(commitScript),
    multiplayerPage: sha256(pageSources[0]),
    opmPage: sha256(pageSources[1]),
    license: sha256(license),
  },
  generatedSha256: {
    script: sha256(generatedEngine),
    multiplayerData: sha256(generatedData[0]),
    opmData: sha256(generatedData[1]),
    license: sha256(generatedLicense),
  },
  observedUpstreamDependencies: observedDependencies[0],
}, null, 2)}\n`;
const outputs = [
  [engineOutput, generatedEngine],
  [pages[0].output, generatedData[0]],
  [pages[1].output, generatedData[1]],
  [licenseOutput, generatedLicense],
  [metadataOutput, metadata],
];

if (checkOnly) {
  await Promise.all(outputs.map(([filename, content]) => verify(filename, content)));
  console.log(`Combo data and calculation snapshot is current (${commit.sha.slice(0, 12)}).`);
} else {
  await Promise.all(outputs.map(([filename, content]) => writeAtomic(filename, content)));
  console.log(`Synced Combo data and calculation rules from PSOStats (${commit.sha.slice(0, 12)}).`);
}
