import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { selectHdImages } from './item_catalog_hd.mjs';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/install_hd_gallery.mjs PREPARED_GALLERY');
const gallery = JSON.parse(fs.readFileSync('content/item-catalog/hd-gallery.json', 'utf8'));
const prepared = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
assert.deepEqual(prepared.gallery, gallery, 'Prepared gallery is out of date; regenerate it from the current naming manifest');
const images = selectHdImages(gallery);
const files = new Set(images.values());
const destination = path.resolve('assets/img/items/hd');
const sourceRoot = fs.realpathSync(source);
const destinationRoot = fs.existsSync(destination) ? fs.realpathSync(destination) : destination;
assert.ok(sourceRoot !== destinationRoot && !sourceRoot.startsWith(destinationRoot + path.sep)
  && !destinationRoot.startsWith(sourceRoot + path.sep), 'Keep prepared input separate from the installed HD directory');
// Validate all inputs before copying; ordinary site builds use the checked-in WebPs.
const verified = new Map();
for (const file of files) {
  if (!/^[a-z0-9/-]+\.webp$/.test(file) || file.split('/').includes('..')) throw new Error(`Unsafe HD path: ${file}`);
  const data = fs.readFileSync(path.join(source, file));
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`Not a WebP: ${file}`);
  assert.deepEqual(prepared.outputs?.[file], { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }, `Prepared image changed: ${file}`);
  verified.set(file, data);
}
let bytes = 0;
for (const [file, data] of verified) {
  const target = path.join(destination, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  bytes += data.length;
}
// This directory is owned by this installer. Remove retired generated images
// only after the complete current selection has passed preflight and been written.
if (fs.existsSync(destination)) for (const entry of fs.readdirSync(destination, { recursive: true, withFileTypes: true })) {
  const target = path.join(entry.parentPath, entry.name);
  const relative = path.relative(destination, target).split(path.sep).join('/');
  if (entry.isFile() && entry.name.endsWith('.webp') && !files.has(relative)) fs.unlinkSync(target);
}
console.log(`Installed ${files.size} HD images for ${images.size} item details (${bytes} bytes).`);
