import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'assets/js/combo_calc.js'), 'utf8').replace(/\r\n?/g, '\n');

function generate(t, engine) {
  // Keep the fixture under the project so the generator resolves TypeScript.
  const fixture = fs.mkdtempSync(path.join(root, '.combo-generator-test-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.mkdirSync(path.join(fixture, 'scripts'));
  fs.mkdirSync(path.join(fixture, 'assets/js'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts/generate_angular_combo.mjs'), path.join(fixture, 'scripts/generate_angular_combo.mjs'));
  for (const mode of ['multi', 'opm']) {
    fs.copyFileSync(path.join(root, `assets/js/combo_calc_${mode}_data.js`), path.join(fixture, `assets/js/combo_calc_${mode}_data.js`));
  }
  fs.writeFileSync(path.join(fixture, 'assets/js/combo_calc.js'), engine);
  const result = spawnSync(process.execPath, [path.join(fixture, 'scripts/generate_angular_combo.mjs')], { encoding: 'utf8' });
  const output = path.join(fixture, 'src/app/generated/combo/engine.ts');
  return { ...result, engine: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null };
}

test('LF and CRLF sources generate identical engines with class statistics passed through', t => {
  const lf = generate(t, source);
  const crlf = generate(t, source.replaceAll('\n', '\r\n'));
  assert.equal(lf.status, 0, lf.stderr);
  assert.equal(crlf.status, 0, crlf.stderr);
  assert.equal(crlf.engine, lf.engine);
  const ast = ts.createSourceFile('engine.ts', lf.engine, ts.ScriptTarget.Latest, true);
  for (const name of ['createMonsterRow', 'generateAutoCombo', 'getFrameDataForWeapon']) {
    const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name);
    assert.equal(declaration.parameters.at(-1).name.text, 'classStats', name);
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ['generateAutoCombo', 'getFrameDataForWeapon'].includes(node.expression.getText(ast))) {
      assert.equal(node.arguments.at(-1).getText(ast), 'classStats');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
});

test('source signature changes fail generation instead of silently dropping a transformation', t => {
  const result = generate(t, source.replace('comboInput, range\n)', 'comboInput, distance\n)'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Expected one Combo engine transformation target/);
  assert.equal(result.engine, null);
});
