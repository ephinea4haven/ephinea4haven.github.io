import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'dropcharts/destiny');
const mapping = JSON.parse(await readFile(join(root, 'images/mapping.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'images/manifest.json'), 'utf8'));
const directory = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(await readFile(join(directory, 'catalog.json'), 'utf8'));
const modelByName = new Map((manifest.modelPreviews || []).flatMap(item => item.dropNames.map(name => [name, item])));
const categoryByName = new Map((manifest.categoryPreviews || []).map(item => [item.name,item]));
const additionalByName = new Map((manifest.additionalArtwork || []).map(item => [item.name,item]));
const effectByName = new Map((manifest.effectPreviews || []).map(item => [item.name,item]));
function explanation(name) {
  if (effectByName.has(name)) return 'Equipment effect preview · no character · Destiny runtime unverified';
  const category = categoryByName.get(name);
  if (category) return 'Shared category image · ' + (category.family === 'unknown' ? 'category unconfirmed' : category.family) + (category.categoryEvidence.tier === 'unitxt_candidate_category' ? ' (provisional)' : '');
  const added = additionalByName.get(name);
  if (added) return (added.identityStatus === 'source_matched' ? 'Model preview' : 'Model preview · candidate identity') + (added.previewNote ? ' · ' + added.previewNote : '');
  const model = modelByName.get(name);
  if (model) return model.sourceStatus === 'source_matched' ? 'Model preview' : 'Model preview · candidate identity';
  if (mapping[name]) return (manifest.entries || []).some(item => item.name === name) ? 'Client icon' : 'Client resource preview · identity unverified';
  return 'No image is available in the current preview.';
}
const escape = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const variantByName = new Map((manifest.variants || []).map(item => [item.name,item]));
const variantImages = (manifest.variants || []).flatMap(item => item.codes.filter(code => code.image).map(code => [item.name,code.image]));
const variantNames = new Set(variantImages.map(([name]) => name).filter(name => !mapping[name]));
const entries = Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b));
for (const [, file] of [...entries, ...variantImages]) {
  if (file !== file.split('/').pop() || file.includes('\\')) throw new Error(`Invalid image filename: ${file}`);
  await access(join(root, 'images', file));
}
const allItems = catalog.dropItems.toSorted((a,b) => a.name.localeCompare(b.name));
const individualCount = entries.length - categoryByName.size;
const previewCount = individualCount + variantNames.size;
const missingPreviewCount = allItems.length - previewCount;
const coverage = allItems.map(({name}) => ({name, image: mapping[name] || null, imageBlend: effectByName.get(name)?.displayBlend || 'normal', variants: variantByName.get(name)?.codes || [], imageKind: categoryByName.has(name) ? 'category' : variantNames.has(name) ? 'variants' : mapping[name] ? 'individual' : 'missing', explanation: variantNames.has(name) ? 'Distinct variants; drop table does not identify the version.' : explanation(name)}));
await writeFile(join(root, 'images/coverage.json'), JSON.stringify({total: allItems.length, mapped: entries.length, individual: individualCount, category: categoryByName.size, variantOnly: variantNames.size, effectCount: effectByName.size, previewCount, missingPreviewCount, missing: allItems.length - entries.length - variantNames.size, items: coverage}, null, 2) + '\n');
const cards = allItems.map(({name}) => {
  const file = mapping[name];
  const model = modelByName.get(name);
  const status = categoryByName.has(name) ? 'category' : !file ? (variantNames.has(name) ? 'variant' : 'missing') : (model && model.sourceStatus !== 'source_matched') || (additionalByName.get(name)?.kind === 'model_candidate' && additionalByName.get(name)?.identityStatus !== 'source_matched') ? 'candidate' : 'available';
  const effectStyle = effectByName.has(name) ? ` style="background:transparent;mix-blend-mode:${effectByName.get(name).displayBlend === 'additive' ? 'plus-lighter' : 'normal'}"` : '';
  let media = file ? `<a href="images/${encodeURIComponent(file)}" target="_blank" rel="noopener"><img src="images/${encodeURIComponent(file)}" alt="${escape(name)}" loading="lazy"${effectStyle}></a>` : '<div class="no-image">No verified image</div>';
  const variant = (manifest.variants || []).find(item => item.name === name);
  if (variant && !file) {
    media = variant.codes.map(code => `<div>${code.image ? `<a href="images/${encodeURIComponent(code.image)}" target="_blank" rel="noopener"><img src="images/${encodeURIComponent(code.image)}" alt="${escape(name)} ${code.code}" loading="lazy"></a>` : '<div class="no-image">No verified image</div>'}<small>Variant ${escape(code.code)}</small></div>`).join('');
  }
  return `<figure data-name="${escape(name.toLowerCase())}" data-status="${status}">${media}<figcaption>${escape(name)}<br><small>${escape(variantNames.has(name) ? 'Distinct variants; drop table does not identify the version.' : explanation(name))}</small></figcaption></figure>`;
}).join('\n');
await writeFile(join(root, 'images.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Destiny Item Images</title><link rel="stylesheet" href="../shared/style.css">
<style>main{max-width:1280px;margin:24px auto;padding:0 20px}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}figure{margin:0;padding:14px;background:#131b2b;border:1px solid #2d3748;border-radius:6px;text-align:center}figure img{width:100%;height:132px;object-fit:contain}figcaption{font-size:12px;line-height:1.5;margin-top:12px}figure[hidden]{display:none}input{margin:12px 0 24px;width:min(100%,480px)}a{color:#9ac5ff}small{color:#aab8ce}.no-image{height:132px;display:grid;place-items:center;color:#8493aa;background:#101725;border-radius:4px}select{background:#131b2b;color:#eee;padding:8px;border:1px solid #43506b;margin:12px}</style></head>
<body><main><a href="./">← Destiny Drop Charts</a><h1>Destiny Item Images</h1><p>${previewCount} / ${allItems.length} drop names have an item-specific or variant preview (${effectByName.size} equipment effect previews without a character). ${missingPreviewCount} still lack an item-specific preview; shared pickup boxes do not count as completed item images.</p><p>Shared category images show client pickup boxes, not the individual item appearance or its guaranteed in-game box colour. Images use client ItemKT textures, client models or reconstructed client particle effects. Candidate identities are labelled. Offline previews do not reproduce the complete in-game appearance. Equipment effect previews show particles without a character.</p><label for="filter">Find an item</label><br><input id="filter" class="search-box" type="search" placeholder="Item name"><label for="status">Show</label><select id="status"><option value="all">All items</option><option value="individual">Individual previews & variants</option><option value="category">Shared category images</option><option value="variant">Distinct variants</option><option value="candidate">Candidate identities</option><option value="missing">Missing item-specific previews</option></select><p id="result-count" aria-live="polite"></p><div class="gallery">${cards}</div></main>
<script>const search=document.getElementById('filter'),status=document.getElementById('status');function filter(){let count=0;const query=search.value.trim().toLowerCase();document.querySelectorAll('figure').forEach(card=>{const matches=status.value==='all'||(status.value==='missing'?['category','missing'].includes(card.dataset.status):status.value==='individual'?['available','candidate','variant'].includes(card.dataset.status):card.dataset.status===status.value);card.hidden=!matches||!card.dataset.name.includes(query);if(!card.hidden)count++;});document.getElementById('result-count').textContent=count+' items shown';}search.addEventListener('input',filter);status.addEventListener('change',filter);filter();</script></body></html>\n`);
console.log(`Image gallery: ${entries.length + variantNames.size}/${allItems.length} covered; ${individualCount + variantNames.size} individual/variant, ${categoryByName.size} shared category`);
