import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { slug } from './item_catalog_model.mjs';
import { selectHdImages } from './item_catalog_hd.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const gallery = read('content/item-catalog/hd-gallery.json');
const records = new Map(read('content/item-catalog/wiki.json').records.map(record => [slug(record.title), record]));
const authority = read(process.env.DROPTABLE_I18N_AUTHORITY || '../droptable/i18n_names.json').items;
const from = source => gallery.assets.find(asset => asset.sources.some(entry => entry.path === source));

test('published HD images use only direct identities and resolve alternate views consistently', () => {
  const images = selectHdImages(gallery);
  assert.deepEqual(selectHdImages({...gallery, assets: [...gallery.assets].reverse()}), images);
  assert.equal(images.get('wok-of-akikos-shop'), 'items/wok-of-akikos-shop.webp');
  for (const [id, file] of images) {
    const asset = gallery.assets.find(asset => asset.file === file);
    assert.ok(asset.itemIds.includes(id));
    assert.ok(['item', 'shared-appearance'].includes(asset.kind));
  }
  const published = fs.readdirSync('assets/img/items/hd', {recursive: true}).filter(file => file.endsWith('.webp'));
  assert.deepEqual(published.sort(), [...new Set(images.values())].sort());
});

test('HD naming accounts for the entire collection and merges only identical files', () => {
  assert.equal(gallery.assets.length, 552);
  const sources = gallery.assets.flatMap(asset => asset.sources);
  assert.equal(sources.length, 606);
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
  assert.equal(unresolved.length, 22);
  for (const asset of unresolved) {
    assert.ok(asset.file.startsWith('unresolved/'));
    assert.equal(asset.itemIds.length + asset.appearanceOf.length, 0, asset.file);
  }
  for (const source of ['SHIELD/Fire.png', 'SHIELD/SECRET FEET.png', 'WEAPON/EP1+2/AGITO.png', 'WEAPON/TYPE WEAPON/TWIN CLAW.png']) {
    assert.equal(from(source).kind, 'unresolved');
  }
  const agito = from('WEAPON/EP1+2/102.png');
  assert.equal(agito.kind, 'shared-appearance');
  assert.equal(agito.appearanceOf.filter(id => id.startsWith('agito-')).length, 6);
  assert.equal(agito.itemIds.some(id => id.startsWith('agito-')), false);
});
