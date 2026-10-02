import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generatedFiles } from './generated_files.mjs';

test('failed generation leaves live files intact, then success publishes and removes obsolete files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-generated-'));
  try {
    const file = path.join(directory, 'page.ts');
    const obsolete = path.join(directory, 'old.ts');
    fs.writeFileSync(file, 'last good page');
    fs.writeFileSync(obsolete, 'old route');
    const failed = generatedFiles();
    failed.clean(directory);
    failed.write(file, 'incomplete next page');
    // A validation exception before commit must not erase the live inputs.
    assert.equal(fs.readFileSync(file, 'utf8'), 'last good page');
    assert.equal(fs.readFileSync(obsolete, 'utf8'), 'old route');

    const corrected = generatedFiles();
    corrected.clean(directory);
    corrected.write(file, 'corrected page');
    corrected.write(path.join(directory, 'new.ts'), 'new route');
    corrected.commit();
    assert.equal(fs.readFileSync(file, 'utf8'), 'corrected page');
    assert.equal(fs.readFileSync(path.join(directory, 'new.ts'), 'utf8'), 'new route');
    assert.equal(fs.existsSync(obsolete), false);
    assert.deepEqual(fs.readdirSync(directory).sort(), ['new.ts', 'page.ts']);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('unchanged output keeps its timestamp and does not cause compiler rebuild loops', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'haven-generated-'));
  try {
    const file = path.join(directory, 'same.ts');
    fs.writeFileSync(file, 'same bytes');
    fs.utimesSync(file, new Date(0), new Date(0));
    const output = generatedFiles();
    output.write(file, 'same bytes');
    output.commit();
    assert.equal(fs.statSync(file).mtimeMs, 0);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
