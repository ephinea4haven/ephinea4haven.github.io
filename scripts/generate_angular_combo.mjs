import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'src', 'app', 'generated', 'combo');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const mode of ['multi', 'opm']) {
  const source = await readFile(
    path.join(root, 'assets', 'js', `combo_calc_${mode}_data.js`),
    'utf8',
  );
  const declarations = [...source.matchAll(/^const ([A-Za-z][A-Za-z0-9_]*) = (.*);$/gm)];
  if (declarations.length !== 5) {
    throw new Error(`Expected five Combo datasets for ${mode}; found ${declarations.length}`);
  }
  const modules = declarations.map(([, name, json]) => {
    JSON.parse(json);
    return `export const ${name} = ${json};`;
  });
  await writeFile(
    path.join(output, `${mode}-data.ts`),
    `// @ts-nocheck -- generated from the pinned upstream dataset\n${modules.join('\n')}\n`,
  );
}

let engine = await readFile(path.join(root, 'assets', 'js', 'combo_calc.js'), 'utf8');
engine = engine
  .replace(
    'evpModifier, base_ata, snGlitch, atpInput, comboInput, range\n)',
    'evpModifier, base_ata, snGlitch, atpInput, comboInput, range, classStats\n)',
  )
  .replace(
    'damageToUse, atpInput, comboInput, range)',
    'damageToUse, atpInput, comboInput, range, classStats)',
  )
  .replace(
    'baseDamage, atpInput, comboInput, range\n)',
    'baseDamage, atpInput, comboInput, range, classStats\n)',
  )
  .replaceAll(
    /\s+let className = \$\('#class-select'\)\.val\(\);/g,
    '\n    const className = atpInput.playerClass;',
  )
  .replace(
    'getFrameDataForWeapon(weapon, className)',
    'getFrameDataForWeapon(weapon, className, classStats)',
  )
  .replace(
    'function getFrameDataForWeapon(weapon, className) {',
    'function getFrameDataForWeapon(weapon, className, classStats) {',
  );

const browserFunctions = new Set([
  'appendMonsterRow',
  'getRange',
  'pushSort',
  'updateDamageTable',
  'updateTotalFrames',
]);
const syntaxTree = ts.createSourceFile(
  'combo_calc.js', engine, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS,
);
const removals = syntaxTree.statements
  .filter((statement) => ts.isFunctionDeclaration(statement)
    && statement.name && browserFunctions.has(statement.name.text))
  .map((statement) => [statement.getFullStart(), statement.end])
  .sort(([left], [right]) => right - left);
if (removals.length !== browserFunctions.size) {
  throw new Error(`Expected ${browserFunctions.size} browser-only Combo functions; found ${removals.length}`);
}
for (const [start, end] of removals) engine = `${engine.slice(0, start)}${engine.slice(end)}`;
if (engine.includes('$(') || /\b(?:document|window)\./.test(engine)) {
  throw new Error('Generated Combo domain still depends on a legacy browser API');
}

engine += `\nexport {
  barriers,
  createMonsterRow,
  formatAccuracyText,
  getEvpModifier,
  getFrameDataForWeapon,
  getFramesForCombo,
  getSetEffectAta,
  getSetEffectAtp,
};\n`;
await writeFile(
  path.join(output, 'engine.ts'),
  `// @ts-nocheck -- generated from the pinned upstream calculation source\n${engine}`,
);
console.log('Generated Angular Combo data and calculation modules.');
