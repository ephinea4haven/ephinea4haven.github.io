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

const [
  multi,
  multiData,
  opm,
  opmData,
  script,
  license,
  jqueryScript,
  bootstrapCss,
  jqueryPackageScript,
  bootstrapPackageCss,
  packageText,
  metadataText,
] = await Promise.all([
  read('tools/cc.html'),
  read('assets/js/combo_calc_multi_data.js'),
  read('tools/ccopm.html'),
  read('assets/js/combo_calc_opm_data.js'),
  read('assets/js/combo_calc.js'),
  read('third_party/psostats-combo/LICENSE'),
  read('assets/js/jquery.min.js'),
  read('assets/css/bootstrap.min.css'),
  read('node_modules/jquery/dist/jquery.slim.min.js'),
  read('node_modules/bootstrap/dist/css/bootstrap.min.css'),
  read('package.json'),
  read('third_party/psostats-combo/upstream.json'),
]);
const packageJson = JSON.parse(packageText);
const metadata = JSON.parse(metadataText);
const licensePath = '/third_party/psostats-combo/LICENSE';
const hasTrailingWhitespace = (content) => /[ \t]+$/m.test(content);
const accessibilityControlIds = [
  'classMinAtpInput', 'classMaxAtpInput', 'ataInput', 'shiftaInput', 'zalureInput',
  'special-select', 'sphereInput', 'hitInput', 'minAtpInput', 'maxAtpInput',
  'attack1', 'hits1', 'attack2', 'hits2', 'attack3', 'hits3',
];

for (const [name, page, data, dataFile] of [
  ['multiplayer', multi, multiData, 'combo_calc_multi_data.js'],
  ['OPM', opm, opmData, 'combo_calc_opm_data.js'],
]) {
  check(`${name} page uses the local calculator script`,
    page.includes('src="../assets/js/combo_calc.js"'));
  check(`${name} page uses the shared jQuery`,
    page.includes('src="../assets/js/jquery.min.js"'));
  check(`${name} page uses the shared Bootstrap CSS`,
    page.includes('href="../assets/css/bootstrap.min.css"'));
  check(`${name} page does not load unused Bootstrap JavaScript or Popper`,
    !page.includes('bootstrap.min.js') && !page.includes('popper.min.js'));
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
check('jQuery is pinned exactly in package.json', packageJson.devDependencies.jquery === '4.0.0');
check('Bootstrap is pinned exactly in package.json', packageJson.devDependencies.bootstrap === '5.3.8');
check('jQuery asset identifies version 4.0.0 slim',
  jqueryScript.startsWith('/*! jQuery v4.0.0+slim '));
check('Bootstrap CSS identifies version 5.3.8', /Bootstrap\s+v5\.3\.8/.test(bootstrapCss));
check('local dependencies are not older than upstream',
  metadata.dependencies.local.jquery === '4.0.0'
    && metadata.dependencies.local.bootstrap === '5.3.8'
    && compareVersions(
      metadata.dependencies.local.jquery,
      metadata.dependencies.upstream.jquery,
    ) >= 0
    && compareVersions(
      metadata.dependencies.local.bootstrap,
      metadata.dependencies.upstream.bootstrap,
    ) >= 0);
for (const [name, page] of [['multiplayer', multi], ['OPM', opm]]) {
  check(`${name} page uses Bootstrap 5 input-group markup`,
    !/input-group-(?:prepend|append)/.test(page));
  check(`${name} page uses Bootstrap 5 select markup`,
    !/<select\b[^>]*class="[^"]*\bform-control\b/.test(page));
  check(`${name} page keeps character stat inputs readable on mobile`,
    !page.includes('class="col-6 col-md-3 mb-1"'));
  check(`${name} page gives migrated controls accessible names`,
    accessibilityControlIds.every((id) => new RegExp(
      `<(?:input|select)\\b(?=[^>]*\\bid="${id}")(?=[^>]*\\baria-label="[^"]+")[^>]*>`,
    ).test(page)));
  check(`${name} page exposes enemy tag removal to assistive technology`,
    page.includes('class="multiselect__tag-icon"')
      && page.includes(`:aria-label="'Remove ' + option.name"`)
      && !page.includes('aria-hidden="true" tabindex="1"'));
}
for (const [name, content, packageContent] of [
  ['jQuery', jqueryScript, jqueryPackageScript],
  ['Bootstrap CSS', bootstrapCss, bootstrapPackageCss],
]) {
  check(`${name} shared asset matches its locked package`, hash(content) === hash(packageContent));
}

if (failures) {
  process.exitCode = 1;
} else {
  console.log('Combo Calculator snapshot verification passed.');
}
