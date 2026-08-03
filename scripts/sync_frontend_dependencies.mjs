import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const files = [
  ['node_modules/jquery/dist/jquery.slim.min.js', 'assets/js/jquery.min.js'],
  ['node_modules/bootstrap/dist/css/bootstrap.min.css', 'assets/css/bootstrap.min.css'],
];

for (const [sourceRelative, outputRelative] of files) {
  const source = await readFile(path.join(root, sourceRelative));
  const output = path.join(root, outputRelative);
  if (checkOnly) {
    let current;
    try {
      current = await readFile(output);
    } catch {
      throw new Error(`${outputRelative} is missing; run npm run sync:frontend`);
    }
    if (!source.equals(current)) {
      throw new Error(`${outputRelative} does not match ${sourceRelative}; run npm run sync:frontend`);
    }
    continue;
  }
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, source);
  await rename(temporary, output);
}

console.log(checkOnly
  ? 'Shared frontend dependencies match the locked npm packages.'
  : 'Updated shared frontend dependencies from the locked npm packages.');
