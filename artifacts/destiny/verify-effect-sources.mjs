import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Source validation requires the original local resources. Preview tests only
// require committed PNGs and provenance; neither silently skips missing files.
const manifest = JSON.parse(await readFile(new URL('./resources/completeness/armor-effects/render-manifest.json', import.meta.url), 'utf8'));
for (const entry of manifest.items) {
  for (const source of [...entry.dependencies, entry.image]) {
    const bytes = await readFile(source.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256,
      `${entry.name}: ${source.role || 'image'} changed`);
  }
}
console.log(`Verified all source dependencies and images for ${manifest.items.length} equipment effects.`);
