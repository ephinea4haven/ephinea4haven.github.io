import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generatedFiles } from './generated_files.mjs';

export const cardRoutes = cards => ['', 'en/', 'ja/'].flatMap(prefix => [
  `/${prefix}data/ep3-cards.html`, ...cards.map(card => `/${prefix}data/ep3-cards/${card.id}.html`),
]);
// Pagefind 1.5.2 queries segment CJK words, then remove NFD combining marks.
// Index matching search tokens too: game names contain voiced kana and fullwidth
// symbols which otherwise remain attached in the index. Display names stay exact.
export function cardAliases(card) {
  const tokens = ['zh', 'ja'].map(language => [...new Intl.Segmenter(language, { granularity: 'word' })
    .segment(card.names.ja.normalize('NFKC'))].map(({ segment }) => segment.normalize('NFD').replace(/\p{M}/gu, '')).join(' '));
  return [...new Set([card.names.en, card.names.ja, card.tableName.en, ...tokens])];
}
export function generateEp3CardCatalog() {
  const { cards } = JSON.parse(fs.readFileSync('content/ep3-card-catalog/cards.json', 'utf8'));
  const index = [], details = {};
  const output = generatedFiles();
  const hash = createHash('sha256');
  output.clean('assets/data/ep3-cards');
  for (const card of cards) {
    const { id, names, tableName, type, class: cardClass, rank, cost, hp, ap, tp, mv, hidden, targetMode, assistTurns } = card;
    if (details[id]) throw new Error(`Duplicate card ${id}`);
    for (const image of Object.values(card.images ?? {})) {
      if (!fs.existsSync(image.path.slice(1))) throw new Error(`Missing artwork: ${image.path}`);
    }
    index.push({ id, names, tableName, type, class: cardClass, rank, cost, hp, ap, tp, mv, hidden, targetMode, assistTurns,
      thumbnail: card.images?.medium.path ?? null });
    details[id] = card;
    const json = JSON.stringify(card);
    output.write(`assets/data/ep3-cards/${id}.json`, json);
    hash.update(`${id}\n${json}\n`);
  }
  for (const [name, data] of Object.entries({ index, 'details.server': details, version: { details: hash.digest('hex').slice(0, 12) } })) {
    output.write(`src/app/generated/ep3-card-catalog/${name}.json`, JSON.stringify(data));
  }
  output.commit();
  console.log(`Generated ${index.length} Episode III cards (${cardRoutes(index).length} routes).`);
  return { index, details };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) generateEp3CardCatalog();
