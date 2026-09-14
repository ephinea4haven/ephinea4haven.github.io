import { templates } from './item_catalog_wiki.mjs';

export const STAT_KEYS = ['hp', 'atp', 'dfp', 'mst', 'ata', 'evp', 'lck', 'efr', 'eic', 'eth', 'edk', 'elt', 'esp', 'xp'];
export const DIFFICULTIES = ['n', 'h', 'vh', 'u'];
export const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The upstream data templates use grouped, literal switch cases. Reject expressions
// rather than interpreting a missing/changed case as the template's default zero.
export function switchCases(source, discardConflicts = false) {
  const result = {};
  const conflicts = new Set();
  let pending = [];
  for (const line of source.split('<noinclude>')[0].split('\n')) {
    if (!line.startsWith('|')) continue;
    const equal = line.indexOf('=');
    if (equal < 0) { pending.push(line.slice(1).trim()); continue; }
    pending.push(line.slice(1, equal).trim());
    const value = line.slice(equal + 1).trim();
    for (const key of pending) {
      if (Object.hasOwn(result, key)) {
        if (!discardConflicts) throw new Error(`Duplicate switch key: ${key}`);
        conflicts.add(key);
      }
      result[key] = value;
    }
    pending = [];
  }
  for (const key of conflicts) delete result[key];
  return result;
}

export function extractSnapshot(pages, checkedAt) {
  const byName = new Map(pages.map(p => [p.title.toLowerCase(), p]));
  const source = name => {
    const page = byName.get(`template:${name}`.toLowerCase());
    if (!page?.revisions?.[0]) throw new Error(`Missing template: ${name}`);
    return page.revisions[0].slots.main.content;
  };
  const maps = new Map();
  const value = (table, name) => {
    if (!maps.has(table)) maps.set(table, switchCases(source(table), /jpnames/i.test(table)));
    const found = maps.get(table)[name];
    if (found === undefined && /jpnames/i.test(table)) return '';
    if (found === undefined && /droptype$/.test(table) && /\| None\s*\}\}/.test(source(table))) return 'None';
    if (found === undefined) throw new Error(`Missing ${table}: ${name}`);
    if (/[{}]/.test(found)) throw new Error(`Unsupported ${table} expression: ${name}`);
    return found;
  };
  const number = (table, name) => {
    const raw = value(table, name).replaceAll('−', '-');
    if (!/^-?\d+$/.test(raw)) throw new Error(`Non-numeric ${table}: ${name} = ${raw}`);
    return Number(raw);
  };
  const rows = templates(source('FullEnemyTable')).filter(t => t.name === 'EnemyTableRowPlain');
  const records = new Map();
  let episode = 1;
  for (const {fields: f} of rows) {
    // Full table's order provides episode context for names without an E1/E2 suffix.
    if (f.name === 'Rag Rappy (E1)') episode = 1;
    if (f.name === 'Rag Rappy (E2)') episode = 2;
    if (f.name === 'Sand Rappy (Crater)') episode = 4;
    if (!DIFFICULTIES.includes(f.diff) || !['on','off'].includes(f.onoff)) throw new Error('Unknown stat context');
    if (!records.has(f.name)) records.set(f.name, {
      id: slug(f.name), key: f.name, episode,
      page: value('EnemyPageNames', f.name),
      ultimate: value('Unames', f.name),
      ja: value('Jpnames', f.name), ultimateJa: value('Ujpnames', f.name),
      attribute: value('Attributes', f.name),
      areas: [...value('Location', f.name).matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(m => m[1]),
      stats: {},
    });
    const record = records.get(f.name);
    const key = `${f.diff}-${f.onoff}`;
    if (record.episode !== episode || record.stats[key]) throw new Error(`Duplicate or mismatched context: ${f.name} ${key}`);
    record.stats[key] = [...STAT_KEYS.map(stat => number(`${f.diff}${stat}${f.onoff}`, f.name)), number(`${f.diff}dropchance`, f.name), value(`${f.diff}droptype`, f.name)];
  }
  return { checkedAt, sources: pages.map(p => ({title:p.title, revision:p.revisions[0].revid, timestamp:p.revisions[0].timestamp})), statKeys:[...STAT_KEYS,'dar','dropType'], records:[...records.values()] };
}
