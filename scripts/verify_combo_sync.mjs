import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (filename) => readFile(path.join(root, filename), 'utf8');
const hash = (content) => createHash('sha256').update(content).digest('hex');

let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}`);
  }
}

const [multi, multiData, opm, opmData, script, license, metadataText] = await Promise.all([
  read('tools/cc.html'),
  read('assets/js/combo_calc_multi_data.js'),
  read('tools/ccopm.html'),
  read('assets/js/combo_calc_opm_data.js'),
  read('assets/js/combo_calc.js'),
  read('third_party/psostats-combo/LICENSE'),
  read('third_party/psostats-combo/upstream.json'),
]);
const metadata = JSON.parse(metadataText);
const licensePath = '/third_party/psostats-combo/LICENSE';
const hasTrailingWhitespace = (content) => /[ \t]+$/m.test(content);

for (const [name, page, data, dataFile] of [
  ['multiplayer', multi, multiData, 'combo_calc_multi_data.js'],
  ['OPM', opm, opmData, 'combo_calc_opm_data.js'],
]) {
  check(`${name} page uses the local calculator script`,
    page.includes('src="../assets/js/combo_calc.js"'));
  check(`${name} page has no remote script or stylesheet dependencies`,
    !/(?:src|href)="https?:\/\//.test(page));
  check(`${name} page loads its extracted data`, page.includes(`src="../assets/js/${dataFile}"`));
  check(`${name} data includes server-rendered weapons`, data.includes('const weapons ='));
  check(`${name} data includes server-rendered enemies`, data.includes('const enemies ='));
  check(`${name} page excludes the PSOStats navbar`, !page.includes('psostats-nav'));
  check(`${name} page records the upstream license`, page.includes(`MIT license: ${licensePath}`));
  check(`${name} page has no trailing whitespace`, !hasTrailingWhitespace(page));
  check(`${name} data records the upstream license`, data.includes(`MIT License: ${licensePath}`));
  check(`${name} data has no trailing whitespace`, !hasTrailingWhitespace(data));
}

check('multiplayer links to the local OPM page', multi.includes('href="/tools/ccopm.html"'));
check('OPM links to the local multiplayer page', opm.includes('href="/tools/cc.html"'));
check('upstream calculator logic is present',
  script.includes("'use strict';") && script.includes('function updateDamageTable'));
check('calculator script records the upstream license', script.includes(`MIT License: ${licensePath}`));
check('calculator script has no trailing whitespace', !hasTrailingWhitespace(script));
check('metadata records an upstream commit', /^[0-9a-f]{40}$/.test(metadata.observedMainCommit));
check('deployed script is verified against the recorded commit',
  metadata.verifiedScriptCommit === metadata.observedMainCommit
    && metadata.sourceSha256.script === metadata.sourceSha256.commitScript);
check('generated multiplayer hash matches metadata',
  hash(multi) === metadata.generatedSha256.multiplayerPage);
check('generated multiplayer data hash matches metadata',
  hash(multiData) === metadata.generatedSha256.multiplayerData);
check('generated OPM hash matches metadata', hash(opm) === metadata.generatedSha256.opmPage);
check('generated OPM data hash matches metadata', hash(opmData) === metadata.generatedSha256.opmData);
check('generated script hash matches metadata', hash(script) === metadata.generatedSha256.script);
check('generated license hash matches metadata', hash(license) === metadata.generatedSha256.license);
check('source license is recorded', Boolean(metadata.sources.license && metadata.sourceSha256.license));

if (failures) {
  process.exitCode = 1;
} else {
  console.log('Combo Calculator snapshot verification passed.');
}
