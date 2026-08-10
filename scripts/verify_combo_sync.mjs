import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (filename) => readFile(path.join(root, filename), 'utf8');
const hash = (content) => createHash('sha256').update(content).digest('hex');
let failures = 0;
function check(name, condition) {
  console[condition ? 'log' : 'error'](`${condition ? 'PASS' : 'FAIL'} ${name}`);
  if (!condition) failures += 1;
}

const [multiData, opmData, engine, license, metadataText, packageText, routes, template] =
  await Promise.all([
    read('assets/js/combo_calc_multi_data.js'),
    read('assets/js/combo_calc_opm_data.js'),
    read('assets/js/combo_calc.js'),
    read('third_party/psostats-combo/LICENSE'),
    read('third_party/psostats-combo/upstream.json'),
    read('package.json'),
    read('src/app/app.routes.ts'),
    read('src/app/combo/combo.component.html'),
  ]);
const metadata = JSON.parse(metadataText);
const packageJson = JSON.parse(packageText);
for (const [name, data] of [['multiplayer', multiData], ['OPM', opmData]]) {
  for (const dataset of ['weapons', 'frames', 'classStats', 'enemyNameSort', 'enemies']) {
    check(`${name} includes ${dataset}`, data.includes(`const ${dataset} =`));
  }
}
check('upstream calculation logic is present',
  engine.includes("'use strict';") && engine.includes('function createMonsterRow'));
check('metadata records a verified upstream commit',
  /^[0-9a-f]{40}$/.test(metadata.observedMainCommit)
    && metadata.verifiedScriptCommit === metadata.observedMainCommit);
check('metadata records Angular presentation ownership',
  metadata.presentation === 'Haven-owned Angular components');
check('generated hashes match metadata',
  hash(engine) === metadata.generatedSha256.script
    && hash(multiData) === metadata.generatedSha256.multiplayerData
    && hash(opmData) === metadata.generatedSha256.opmData
    && hash(license) === metadata.generatedSha256.license);
check('both Combo routes use the shared Angular component',
  routes.includes("path: 'tools/cc.html'")
    && routes.includes("path: 'tools/ccopm.html'")
    && routes.match(/\.\/combo\/combo\.component/g)?.length === 2);
check('Angular template preserves calculator controls',
  ['class-select', 'damage-header', 'native-btn', 'clear-btn', 'combo-calc-table']
    .every((id) => template.includes(`id="${id}"`)));
check('Combo no longer declares Bootstrap', packageJson.devDependencies.bootstrap === undefined);

if (failures) process.exitCode = 1;
else console.log('Angular Combo synchronization contract verification passed.');
