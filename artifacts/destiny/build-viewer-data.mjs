import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(fs.readFileSync(path.join(here, 'drops.json'), 'utf8'));
const bbSource = fs.readFileSync(path.join(here, '../../../droptable/bb/data/en.js'), 'utf8');
const context = {window: {}};
vm.runInNewContext(bbSource, context, {filename: 'droptable/bb/data/en.js'});
const sectionColors = Array.from(context.window.DROP_DATA_EN.sectionColors);
const sectionIds = Array.from(input.sectionIds);
const expectedIds = Array.from(context.window.DROP_DATA_EN.sectionIds);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(input.schema === 'destiny-drops-v1', 'Unexpected source schema');
assert(JSON.stringify(sectionIds) === JSON.stringify(expectedIds), 'Section ID order differs from viewer');
assert(sectionColors.length === sectionIds.length, 'Section ID color count differs');

const difficulties = new Map([
  ['normal', 'Normal'], ['hard', 'Hard'],
  ['very-hard', 'Very Hard'], ['ultimate', 'Ultimate']
]);
const episodes = new Map([[1, 'Episode 1'], [2, 'Episode 2'], [4, 'Episode 4']]);
const data = Object.fromEntries(Array.from(difficulties.values(), difficulty => [
  difficulty, {monsters: Object.fromEntries(Array.from(episodes.values(), episode => [episode, []]))}
]));
const seen = new Set();

for (const table of input.tables) {
  const difficulty = difficulties.get(table.difficulty);
  const episode = episodes.get(table.episode);
  assert(difficulty && episode, `Unknown table ${table.difficulty} / ${table.episode}`);
  const key = `${difficulty}/${episode}`;
  assert(!seen.has(key), `Duplicate table ${key}`);
  seen.add(key);
  assert(Array.isArray(table.rows), `Missing rows in ${key}`);

  data[difficulty].monsters[episode] = table.rows.map((row, rowIndex) => {
    const location = `${key} row ${rowIndex + 1}`;
    assert(typeof row.monster === 'string' && row.monster.length, `Missing monster at ${location}`);
    assert(row.dar === null || typeof row.dar === 'string', `Invalid DAR at ${location}`);
    assert(Array.isArray(row.drops) && row.drops.length === sectionIds.length,
      `Expected ${sectionIds.length} cells at ${location}`);
    const drops = row.drops.map((cell, cellIndex) => {
      assert(cell.sectionId === sectionIds[cellIndex],
        `Section ID order mismatch at ${location}, cell ${cellIndex + 1}`);
      assert(typeof cell.noItem === 'boolean', `Missing noItem at ${location}, cell ${cellIndex + 1}`);
      assert(cell.item === null || typeof cell.item === 'string',
        `Invalid item at ${location}, cell ${cellIndex + 1}`);
      assert(cell.rate === null || typeof cell.rate === 'string',
        `Invalid rate at ${location}, cell ${cellIndex + 1}`);
      assert(cell.noItem === (cell.item === null),
        `Item and noItem disagree at ${location}, cell ${cellIndex + 1}`);
      return {item: cell.item, rate: cell.rate};
    });
    return {name: row.monster, dropRate: row.dar, drops};
  });
}

assert(seen.size === difficulties.size * episodes.size, 'Missing difficulty/episode tables');
const output = path.join(here, 'dropcharts/destiny/data/en.js');
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, `// Generated from artifacts/destiny/drops.json by build-viewer-data.mjs\nwindow.DROP_DATA_EN = ${JSON.stringify({sectionIds, sectionColors, data}, null, 2)};\n`);
process.stdout.write(`${output}\n`);
