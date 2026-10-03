import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { slug } from './item_catalog_model.mjs';
import { selectHdImages } from './item_catalog_hd.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const gallery = read('content/item-catalog/hd-gallery.json');
const records = new Map(read('content/item-catalog/wiki.json').records.map(record => [slug(record.title), record]));
const authority = read(process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json').items;
const from = source => gallery.assets.find(asset => asset.sources.some(entry => entry.path === source));

test('Booma-family claw HD artwork matches the maintainer-supplied identities', () => {
  for (const [id, sourcePath, sourceSha256, publishedSha256] of [
    ['boomas-claw', 'User-provided corrections/2026-10-03/4ec9aec551130f34bc0c62c4c64712b8.png', 'df7749e3a362471ce4759c4aa3be8184a8ca369dd95cc64d579423282e654cf5', '22ba1d0c79be83fc61594f78fa2b8a19824bab9f5110a9628afedba79ee84593'],
    ['goboomas-claw', 'User-provided corrections/2026-10-03/da606bc27414598e7a276102e7aabef3.png', '054f8224d17675ef39ad470d1336e55ea12f9ed78ec92cde70ce54ad5a3cae55', '1f54307d5f7b32e001605a698dc8183786866a8e50cef0923359095503ae3c01'],
    ['gigoboomas-claw', 'User-provided corrections/2026-10-03/fa3bbcf2d994d956587ade19ef6e2542.png', '39c2954cded60b3b0e3737d45992bd45b4641cb25ed6b2a99ebb1d77b0ce29da', '707d3b1e2d2ab81c563369680be23ba0ebe97f8c6e3c236fe10e98be3c2659c8'],
  ]) {
    const file = `items/${id}.webp`;
    const asset = gallery.assets.find(asset => asset.file === file);
    assert.deepEqual(asset.itemIds, [id]);
    assert.equal(asset.sources[0].path, sourcePath, id);
    assert.equal(asset.sources[0].sha256, sourceSha256, id);
    assert.equal(selectHdImages(gallery).get(id), file, id);
    const published = fs.readFileSync(path.join('assets/img/items/hd', file));
    assert.equal(createHash('sha256').update(published).digest('hex'), publishedSha256, id);
  }
});

test('published HD images use only direct identities and resolve alternate views consistently', () => {
  const images = selectHdImages(gallery);
  assert.deepEqual(selectHdImages({...gallery, assets: [...gallery.assets].reverse()}), images);
  assert.equal(images.get('wok-of-akikos-shop'), 'items/wok-of-akikos-shop.webp');
  for (const [id, file] of images) {
    const asset = gallery.assets.find(asset => asset.file === file);
    assert.ok(asset.itemIds.includes(id));
    assert.ok(['item', 'shared-appearance'].includes(asset.kind));
  }
  const published = fs.readdirSync('assets/img/items/hd', {recursive: true}).filter(file => file.endsWith('.webp')).map(file => file.split(path.sep).join('/'));
  assert.deepEqual(published.sort(), [...new Set(images.values())].sort());
});

test('HD naming accounts for the entire collection and merges only identical files', () => {
  assert.equal(gallery.assets.length, 554);
  const sources = gallery.assets.flatMap(asset => asset.sources);
  assert.equal(sources.length, 608);
  assert.equal(new Set(sources.map(source => source.path)).size, sources.length);
  assert.equal(new Set(gallery.assets.map(asset => asset.file)).size, gallery.assets.length);
  assert.equal(new Set(gallery.assets.map(asset => asset.sources[0].sha256)).size, gallery.assets.length);
  for (const asset of gallery.assets) {
    assert.match(asset.file, /^[a-z0-9/-]+\.webp$/);
    assert.ok(!asset.file.split('/').includes('..'));
    assert.ok(asset.evidence);
    for (const source of asset.sources) {
      assert.match(source.sha256, /^[0-9a-f]{64}$/);
      assert.equal(source.sha256, asset.sources[0].sha256);
      assert.ok(source.width > 0 && source.height > 0 && source.bytes > 0);
    }
    for (const id of [...asset.itemIds, ...asset.appearanceOf, ...(asset.candidateItemIds || [])]) {
      assert.ok(records.has(id), `${asset.file}: ${id}`);
      assert.ok(gallery.items[id], id);
    }
  }
  for (const { en, authorityMatched } of Object.values(gallery.items)) {
    assert.equal(Boolean(authority[en]), authorityMatched, en);
  }
});

test('numbered weapon identities distinguish ordinary, TYPE and ES models and photon colors', () => {
  for (const [number, id] of Object.entries({
    '009': 'sword', '013': 'calibur', '017': 'dagger', '021': 'ripper',
    '022': 'blade-dance', '049': 'mechgun', '050': 'assault', '051': 'repeater',
    '052': 'gatling', '053': 'vulcan', '180': 'yasminkov-3000r',
    '183': 'branch-of-pakupaku', '184': 'heart-of-poumn',
    '196': 'photon-launcher', '197': 'guilty-light', '198': 'red-scorpio',
    '204': 'viridia-card', '207': 'bluefull-card', '210': 'redria-card', '211': 'oran-card',
  })) {
    assert.ok(from(`WEAPON/EP1+2/${number}.png`).itemIds.includes(id), `${number}: ${id}`);
  }
  assert.ok(from('WEAPON/EP4/229.png').itemIds.includes('daisy-chain'));
  assert.ok(from('WEAPON/EP4/289.png').itemIds.includes('izmaela'));
  assert.ok(from('WEAPON/EP4/290.png').itemIds.includes('kunai'));
  assert.ok(from("WEAPON/EP1+2/NEL'S CLAW.png").itemIds.includes('neis-claw-replica'));
  assert.ok(from('WEAPON/EP1+2/222.png').itemIds.includes('neis-claw'));
});

test('NGC aliases preserve shared color variants without inventing TYPE equipment', () => {
  for (let i = 1; i <= 7; i++) {
    const asset = from(`WEAPON/NGC 加强版/TypeBL ${String(i).padStart(2, '0')}.png`);
    assert.equal(asset, from(`WEAPON/WEAPON SKIN/TWIN CHAKRAM ${String(i + 5).padStart(2, '0')}.png`));
    assert.deepEqual(asset.appearanceOf, ['twin-chakram']);
    assert.deepEqual(asset.itemIds, []);
    assert.equal(asset.kind, 'color-variant');
  }
  assert.equal(from('WEAPON/NGC 加强版/TypeDS 04.png'), from('WEAPON/TYPE WEAPON/D.SABER.png'));
  assert.equal(from('WEAPON/NGC 加强版/TypeGU 02.png'), from('WEAPON/WEAPON SKIN/SUPPRESSED GUN 09.png'));
  assert.equal(from('WEAPON/NGC 加强版/TWIN ANCIENT SABER.png').kind, 'model-variant');
  assert.equal(from('WEAPON/NGC 加强版/TypeME 01.png').kind, 'model-variant');
  for (const asset of gallery.assets.filter(asset => asset.kind.endsWith('-variant'))) {
    assert.equal(asset.itemIds.length, 0, asset.file);
    assert.ok(asset.appearanceOf.length > 0 && asset.variant, asset.file);
  }
});

test('uncertain identities remain explicit and cannot become item bindings', () => {
  const unresolved = gallery.assets.filter(asset => asset.kind === 'unresolved');
  assert.equal(unresolved.length, 18);
  for (const asset of unresolved) {
    assert.ok(asset.file.startsWith('unresolved/'));
    assert.equal(asset.itemIds.length + asset.appearanceOf.length, 0, asset.file);
  }
  for (const source of ['SHIELD/SECRET FEET.png', 'WEAPON/EP1+2/AGITO.png', 'WEAPON/TYPE WEAPON/TWIN CLAW.png']) {
    assert.equal(from(source).kind, 'unresolved');
  }
  const agito = from('WEAPON/EP1+2/102.png');
  assert.equal(agito.kind, 'shared-appearance');
  assert.equal(agito.appearanceOf.filter(id => id.startsWith('agito-')).length, 6);
  assert.equal(agito.itemIds.some(id => id.startsWith('agito-')), false);
});
