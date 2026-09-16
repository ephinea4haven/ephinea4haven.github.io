import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);
const manifest = JSON.parse(await fs.readFile(path.join(root, 'content/item-catalog/hd-gallery.json'), 'utf8'));
const authority = JSON.parse(await fs.readFile(process.env.DROPTABLE_I18N_AUTHORITY || path.join(root, '../droptable/i18n_names.json'), 'utf8')).items;
const [first, second] = process.argv.slice(2);
const checking = first === '--check';
const sourceRoot = path.resolve(checking ? second || '' : first || '');
const outputRoot = !checking && second ? path.resolve(second) : null;
assert.ok(checking ? second : first && second,
  'Usage: node scripts/prepare_hd_gallery.mjs --check SOURCE | SOURCE OUTPUT');

function safeRelative(file) {
  assert.ok(file && !path.isAbsolute(file) && !file.split(/[\\/]/).some(part => part === '..' || part === ''), `Unsafe path: ${file}`);
}

const files = new Set(), sources = new Set();
const kinds = new Set(['item', 'shared-appearance', 'color-variant', 'model-variant', 'unresolved', 'placeholder']);
for (const asset of manifest.assets) {
  safeRelative(asset.file);
  assert.match(asset.file, /^[a-z0-9/-]+\.webp$/);
  assert.ok(!files.has(asset.file), `Duplicate output: ${asset.file}`);
  files.add(asset.file);
  assert.ok(kinds.has(asset.kind), `Unknown kind: ${asset.kind}`);
  assert.ok(asset.sources.length && asset.evidence);
  for (const id of [...asset.itemIds, ...asset.appearanceOf, ...(asset.candidateItemIds || [])]) {
    assert.ok(manifest.items[id], `Unknown item: ${id}`);
  }
  if (asset.kind === 'unresolved') assert.equal(asset.itemIds.length + asset.appearanceOf.length, 0, asset.file);
  if (asset.kind.endsWith('-variant')) assert.equal(asset.itemIds.length, 0, asset.file);
  for (const source of asset.sources) {
    safeRelative(source.path);
    assert.ok(!sources.has(source.path), `Duplicate source: ${source.path}`);
    sources.add(source.path);
    assert.equal(source.sha256, asset.sources[0].sha256, `Non-identical aliases: ${asset.file}`);
    assert.ok(source.width > 0 && source.height > 0, source.path);
  }
}
for (const item of Object.values(manifest.items)) {
  assert.equal(Boolean(authority[item.en]), item.authorityMatched, `Authority changed: ${item.en}`);
}

const inputFiles = (await fs.readdir(sourceRoot, { recursive: true })).filter(file => /\.(png|jpe?g)$/i.test(file));
assert.deepEqual(inputFiles.sort(), [...sources].sort(), 'Source inventory differs from the reviewed manifest');
let next = 0, checked = 0;
const originals = manifest.assets.flatMap(asset => asset.sources);
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < originals.length) {
    const source = originals[next++];
    const file = path.join(sourceRoot, source.path);
    assert.equal((await fs.stat(file)).size, source.bytes, `Size changed: ${source.path}`);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    assert.equal(hash.digest('hex'), source.sha256, `Source changed: ${source.path}`);
    checked++;
  }
}));
console.log(`Verified ${checked} source files → ${manifest.assets.length} unique images.`);
if (checking) process.exit(0);

assert.ok(outputRoot !== sourceRoot && !sourceRoot.startsWith(outputRoot + path.sep) && !outputRoot.startsWith(sourceRoot + path.sep), 'Keep output separate from the source collection');
await fs.mkdir(outputRoot, { recursive: true });
assert.equal((await fs.readdir(outputRoot)).length, 0, 'Use a new or empty output directory');
next = 0;
let written = 0;
const outputs = {};
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < manifest.assets.length) {
    const asset = manifest.assets[next++];
    const output = path.join(outputRoot, asset.file);
    const source = asset.sources[0];
    await fs.mkdir(path.dirname(output), { recursive: true });
    await run('cwebp', ['-quiet', '-q', '85', '-m', '6', '-resize', String(Math.min(1024, source.width)), '0', path.join(sourceRoot, source.path), '-o', output]);
    const data = await fs.readFile(output);
    outputs[asset.file] = { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
    if (++written % 100 === 0) console.log(`Prepared ${written}/${manifest.assets.length} normalized images.`);
  }
}));

const labels = { item: '道具', 'shared-appearance': '共用外观', 'color-variant': '颜色变体', 'model-variant': '造型变体', unresolved: '待确认', placeholder: '占位图' };
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const cards = manifest.assets.map(asset => {
  const names = [...new Set([...asset.itemIds, ...asset.appearanceOf])].map(id => {
    const en = manifest.items[id].en;
    return authority[en]?.zh ? `${authority[en].zh} · ${en}` : en;
  });
  const sourceNames = asset.sources.map(source => source.path);
  return `<article data-kind="${asset.kind}" data-search="${escape([asset.file, ...names, ...sourceNames].join(' ').toLowerCase())}">
    <a href="${asset.file}" target="_blank" rel="noopener"><img src="${asset.file}" width="320" height="240" loading="lazy" alt="${escape(names.join(' / ') || sourceNames[0])}"></a>
    <div class="body"><span class="tag">${labels[asset.kind]}</span><h2>${escape(names.join(' / ') || sourceNames[0])}</h2><code>${escape(asset.file)}</code>
    <details><summary>原文件 · ${sourceNames.length}</summary><ul>${sourceNames.map(name => `<li>${escape(name)}</li>`).join('')}</ul><p lang="en">${escape(asset.evidence)}</p></details></div>
  </article>`;
}).join('\n');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>高清图库名称对照</title>
<style>body{margin:0;background:#0c1522;color:#dfebf4;font:15px/1.6 system-ui,sans-serif}header,main{max-width:1440px;margin:auto;padding:24px}header{position:sticky;top:0;background:#0c1522f5;z-index:1;border-bottom:1px solid #33475b}h1{font-size:24px;margin:0 0 8px}p{margin:8px 0;color:#bbcad7}form{display:flex;gap:12px;flex-wrap:wrap}input,select{font:inherit;padding:8px 12px;border:1px solid #526b81;border-radius:6px;background:#17283c;color:inherit}input{flex:1;min-width:180px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px}article{border:1px solid #33475b;border-radius:8px;overflow:hidden;min-width:0}article[hidden]{display:none}img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:contain;background:black}.body{padding:14px}.tag{color:#9ae0d3;font-size:12px}h2{font-size:15px;line-height:1.5;margin:8px 0}code{font-size:12px;overflow-wrap:anywhere;color:#b0c7db}summary{cursor:pointer;margin-top:12px}li,p{overflow-wrap:anywhere}ul{padding-left:18px}#count{align-self:center;white-space:nowrap}</style>
<header><h1>高清图库名称对照</h1><p>${sources.size} 个原文件，按 SHA-256 合并为 ${manifest.assets.length} 张图片。变体按外观归类，不代表站内存在同名装备；待确认图片尚未绑定道具。</p>
<form onsubmit="return false"><input id="search" type="search" aria-label="搜索道具或文件名" placeholder="搜索中文、英文、旧文件名或新文件名"><select id="kind" aria-label="图片分类"><option value="">全部分类</option>${Object.entries(labels).map(([kind,label])=>`<option value="${kind}">${label}</option>`).join('')}</select><output id="count" aria-live="polite"></output></form></header><main>${cards}</main>
<script>const cards=[...document.querySelectorAll('article')],search=document.querySelector('#search'),kind=document.querySelector('#kind'),count=document.querySelector('#count');function filter(){let visible=0;const q=search.value.trim().toLowerCase();for(const card of cards){card.hidden=Boolean(kind.value&&card.dataset.kind!==kind.value)||!card.dataset.search.includes(q);if(!card.hidden)visible++;}count.textContent=visible+' 张';}search.addEventListener('input',filter);kind.addEventListener('change',filter);filter();</script></html>`;
await fs.writeFile(path.join(outputRoot, 'index.html'), html);
await fs.writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify({ gallery: manifest, outputs }, null, 2) + '\n');
console.log(`Review gallery: ${path.join(outputRoot, 'index.html')}`);
