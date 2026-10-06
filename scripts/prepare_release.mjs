import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Keep the local gate a superset of both CI workflows. A failed command throws
// immediately, so later stages cannot turn a failed release into a success.
function npm(...args) {
  console.log(`\nRelease gate: npm ${args.join(' ')}`);
  execFileSync('npm', args, { stdio: 'inherit' });
}

npm('ci');
npm('audit', '--audit-level=low');
npm('exec', '--', 'playwright', 'install', '--with-deps', 'chromium');
npm('test');
npm('run', 'build');
const firstManifest = readFileSync('_site/build-manifest.json');
npm('run', 'build');
if (!firstManifest.equals(readFileSync('_site/build-manifest.json'))) {
  throw new Error('Release rejected: production build manifests differ.');
}
console.log('Reproducible build verified.');

// Match CI isolation: reject focused tests, start our own production server,
// and never conceal a failure with retries.
process.env.CI = 'true';
npm('run', 'test:e2e:smoke', '--', '--workers=2', '--retries=0');
npm('run', 'test:e2e', '--', '--workers=4', '--retries=0');
console.log('Complete local release verification passed.');
