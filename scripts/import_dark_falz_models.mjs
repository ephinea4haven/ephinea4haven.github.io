// Import visually reviewed complete Dark Falz assemblies; normal builds use WebP assets.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const config = read('content/monster-catalog/model-renders.json');
const manifestPath = 'assets/img/monsters/render/manifest.json';
const manifest = read(manifestPath);
const selected = process.argv.slice(2);
for (const [label, recipe] of Object.entries(config.renders)) {
  if (recipe.renderer !== 'blender-dark-falz' || selected.length && !selected.includes(label)) continue;
  const input = `artifacts/dark-falz-renders/${label}.png`;
  const evidence = read(`artifacts/dark-falz-renders/${label}.json`);
  assert.deepEqual(evidence.recipe, recipe);
  assert.equal(evidence.imageSha256, hash(input));
  for (const [field, file] of [['rendererSha256', 'scripts/render_dark_falz_models.py'],
    ['meshParserSha256', 'scripts/render_npc_models.py'], ['motionParserSha256', 'scripts/pso_motion_frame.py']]) {
    assert.equal(evidence[field], hash(file));
  }
  const file = `${label}.webp`;
  const output = `assets/img/monsters/render/${file}`;
  const thumb = `assets/img/monsters/render/thumbs/${file}`;
  for (const [path, width] of [[output, 1024], [thumb, 160]]) {
    execFileSync('cwebp', ['-quiet', '-q', '85', '-m', '6', '-resize', String(width), '0', input, '-o', path]);
  }
  manifest[label] = {file, sha256: hash(output), thumbSha256: hash(thumb), evidence};
  console.log(`Imported ${label}: ${evidence.parts.length} components`);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
