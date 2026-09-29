import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { parse } from 'parse5';

const directory = dirname(fileURLToPath(import.meta.url));
const difficulties = [
  { key: 'normal', label: 'Normal', expectedRows: [45, 53, 21] },
  { key: 'hard', label: 'Hard', expectedRows: [45, 53, 21] },
  { key: 'very-hard', label: 'Very Hard', expectedRows: [45, 53, 21] },
  { key: 'ultimate', label: 'Ultimate', expectedRows: [51, 65, 21] },
];
const episodes = [1, 2, 4];
const sectionIds = [
  'Viridia', 'Greenill', 'Skyly', 'Bluefull', 'Purplenum',
  'Pinkal', 'Redria', 'Oran', 'Yellowboze', 'Whitill',
];

function* descendants(node) {
  for (const child of node.childNodes ?? []) {
    yield child;
    yield* descendants(child);
  }
}

function attribute(node, name) {
  return node.attrs?.find((attr) => attr.name === name)?.value ?? '';
}

function textWithBreaks(node) {
  if (node.nodeName === '#text') return node.value;
  if (node.tagName === 'br') return '\n';
  return (node.childNodes ?? []).map(textWithBreaks).join('');
}

function lines(node) {
  return textWithBreaks(node).split('\n').map((part) => part.trim());
}

function cells(row) {
  return (row.childNodes ?? []).filter((node) => node.tagName === 'td' || node.tagName === 'th');
}

function fail(condition, message) {
  if (!condition) throw new Error(message);
}

function parseTable(table, difficulty, episode) {
  const rows = [...descendants(table)].filter((node) => node.tagName === 'tr');
  fail(rows.length > 1, `${difficulty} EP${episode}: table has no data rows`);
  const header = cells(rows[0]);
  fail(header.length === 11, `${difficulty} EP${episode}: header has ${header.length} columns`);
  const headerNames = header.map((cell) => textWithBreaks(cell).trim());
  fail(headerNames[0] === 'Monster', `${difficulty} EP${episode}: first header is ${headerNames[0]}`);
  fail(sectionIds.every((id, index) => headerNames[index + 1] === id),
    `${difficulty} EP${episode}: Section ID order differs: ${headerNames.join(', ')}`);

  const statistics = {
    rows: 0,
    cells: 0,
    noItem: 0,
    itemWithRate: 0,
    itemWithoutRate: 0,
    unknownRate: 0,
    unknownDar: 0,
    darZeroWithItem: 0,
  };
  const entries = rows.slice(1).map((row, rowIndex) => {
    const rowCells = cells(row);
    fail(rowCells.length === 11,
      `${difficulty} EP${episode} row ${rowIndex + 1}: ${rowCells.length} columns, expected 11`);
    const [monster, darRaw, ...extraMonsterLines] = lines(rowCells[0]);
    fail(monster && /^DAR: (?:\d+|\?\?\?)%$/.test(darRaw) && !extraMonsterLines.some(Boolean),
      `${difficulty} EP${episode} row ${rowIndex + 1}: invalid monster/DAR cell`);
    fail(attribute(rowCells[0], 'class').split(/\s+/).includes('drop-monster'),
      `${difficulty} EP${episode} row ${rowIndex + 1}: first column class differs`);
    const dar = darRaw.slice(5);
    const darPercent = dar === '???%' ? null : Number.parseInt(dar, 10);
    fail(darPercent === null || (darPercent >= 0 && darPercent <= 100),
      `${difficulty} EP${episode} row ${rowIndex + 1}: invalid DAR ${dar}`);
    if (darPercent === null) statistics.unknownDar++;

    const drops = sectionIds.map((sectionId, sectionIndex) => {
      const cell = rowCells[sectionIndex + 1];
      fail(attribute(cell, 'class').split(/\s+/).includes(`drop-id-${sectionId}`),
        `${difficulty} EP${episode} row ${rowIndex + 1}: ${sectionId} column class differs`);
      const [item, rate = null, ...extraLines] = lines(cell);
      fail(item && !extraLines.some(Boolean),
        `${difficulty} EP${episode} ${monster}/${sectionId}: empty or multiline drop cell`);
      statistics.cells++;
      if (item === 'No Item') {
        fail(rate === null, `${difficulty} EP${episode} ${monster}/${sectionId}: No Item has a rate`);
        statistics.noItem++;
        return { sectionId, item: null, rate: null, noItem: true };
      }
      fail(rate === null || /^1\/(?:\d+(?:\.\d+)?|\?\?\?)$/.test(rate),
        `${difficulty} EP${episode} ${monster}/${sectionId}: unexpected rate ${rate}`);
      if (rate === null) statistics.itemWithoutRate++;
      else statistics.itemWithRate++;
      if (rate === '1/???') statistics.unknownRate++;
      if (darPercent === 0) statistics.darZeroWithItem++;
      return { sectionId, item, rate, noItem: false };
    });
    statistics.rows++;
    return { monster, darRaw, dar, darPercent, drops };
  });
  return { entries, statistics };
}

async function main() {
  const tables = [];
  const sources = [];
  for (const difficulty of difficulties) {
    const sourcePath = join(directory, 'source', `drops-${difficulty.key}.html`);
    const source = await readFile(sourcePath);
    const document = parse(source.toString('utf8'));
    sources.push({
      file: relative(directory, sourcePath),
      bytes: source.length,
      sha256: createHash('sha256').update(source).digest('hex'),
    });

    let currentEpisode = null;
    const found = new Map();
    for (const node of descendants(document)) {
      if (node.tagName === 'h2') {
        const heading = textWithBreaks(node).trim();
        const match = heading.match(new RegExp(`^${difficulty.label} \\| Episode ([124])$`));
        if (match) currentEpisode = Number(match[1]);
      }
      if (node.tagName !== 'table' || !attribute(node, 'class').split(/\s+/).includes('drop-table')) continue;
      fail(currentEpisode !== null, `${difficulty.key}: drop table before episode heading`);
      fail(!found.has(currentEpisode), `${difficulty.key}: duplicate EP${currentEpisode} table`);
      const parsed = parseTable(node, difficulty.key, currentEpisode);
      found.set(currentEpisode, parsed);
      currentEpisode = null;
    }
    fail(found.size === 3 && episodes.every((episode) => found.has(episode)),
      `${difficulty.key}: expected EP1, EP2, EP4; found ${[...found.keys()].join(', ')}`);
    for (const [index, episode] of episodes.entries()) {
      const { entries, statistics } = found.get(episode);
      fail(entries.length === difficulty.expectedRows[index],
        `${difficulty.key} EP${episode}: ${entries.length} rows, expected ${difficulty.expectedRows[index]}`);
      fail(statistics.cells === entries.length * sectionIds.length,
        `${difficulty.key} EP${episode}: incomplete section cells`);
      tables.push({ difficulty: difficulty.key, episode, rows: entries, statistics });
    }
  }

  fail(tables.length === 12, `Expected 12 tables, found ${tables.length}`);
  const tableStatistics = tables.map(({ difficulty, episode, statistics }) => ({ difficulty, episode, ...statistics }));
  const totals = tableStatistics.reduce((sum, table) => {
    for (const key of ['rows', 'cells', 'noItem', 'itemWithRate', 'itemWithoutRate', 'unknownRate', 'unknownDar', 'darZeroWithItem'])
      sum[key] = (sum[key] ?? 0) + table[key];
    return sum;
  }, { tables: tables.length });
  fail(totals.cells === totals.noItem + totals.itemWithRate + totals.itemWithoutRate,
    'Drop cells do not partition into all expected states');
  const dataset = {
    schema: 'destiny-drops-v1',
    sourceUrl: 'https://playpso.net/drop-tables',
    sectionIds,
    tables: tables.map(({ difficulty, episode, rows }) => ({ difficulty, episode, rows })),
  };
  const validation = {
    valid: true,
    sources,
    expectedRows: Object.fromEntries(difficulties.map(({ key, expectedRows }) => [key, Object.fromEntries(episodes.map((episode, i) => [episode, expectedRows[i]]))])),
    tables: tableStatistics,
    totals,
    notes: [
      'The source rate string is preserved verbatim; missing rates remain null.',
      'DAR describes the monster row and is not substituted for a missing rare-drop rate.',
      'The source contains unknown DAR/rate markers (???), preserved as raw strings.',
      'No Item is an explicit empty drop cell; item names are unlinked source text.',
    ],
  };
  await writeFile(join(directory, 'drops.json'), `${JSON.stringify(dataset, null, 2)}\n`);
  await writeFile(join(directory, 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`);
  console.log(JSON.stringify(totals));
}

await main();
