// Export input: MediaWiki action=query pages (revisions with ids, timestamp and slots.main).
import fs from 'node:fs';
import { extractSnapshot } from './monster_catalog_model.mjs';
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/import_monster_catalog.mjs templates.json');
const snapshot = extractSnapshot(JSON.parse(fs.readFileSync(input)), new Date().toISOString().slice(0,10));
fs.mkdirSync('content/monster-catalog', {recursive:true});
fs.writeFileSync('content/monster-catalog/wiki.json', JSON.stringify(snapshot,null,2)+'\n');
console.log(`Imported ${snapshot.records.length} enemy contexts, ${snapshot.sources.length} source revisions.`);
