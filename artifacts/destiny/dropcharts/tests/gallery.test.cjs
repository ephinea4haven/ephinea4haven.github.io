const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {tmpdir} = require('node:os');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../destiny');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('gallery accounts for every drop name, including missing artwork', () => {
  const catalog = JSON.parse(fs.readFileSync(path.resolve(root, '../../catalog.json'), 'utf8'));
  const coverage = read('images/coverage.json');
  const mapping = read('images/mapping.json');
  assert.deepEqual(coverage.items.map(item => item.name).sort(), catalog.dropItems.map(item => item.name).sort());
  assert.equal(coverage.mapped, Object.keys(mapping).length);
  assert.equal(coverage.missing, coverage.items.filter(item => !item.image && !item.variants.some(code => code.image)).length);
  const html = fs.readFileSync(path.join(root, 'images.html'), 'utf8');
  assert.equal((html.match(/<figure /g) || []).length, coverage.total);
  for (const item of coverage.items) {
    assert.equal(item.image, mapping[item.name] || null);
    assert.ok(item.explanation);
    for (const code of item.variants) if (code.image) assert.ok(fs.statSync(path.join(root, 'images', code.image)).size > 0);
    if (item.image) assert.ok(fs.statSync(path.join(root, 'images', item.image)).size > 0);
  }
});

test('candidate models stay labelled and images retain their reviewed bytes', () => {
  const manifest = read('images/manifest.json');
  const coverage = new Map(read('images/coverage.json').items.map(item => [item.name, item]));
  for (const preview of manifest.modelPreviews) {
    const bytes = fs.readFileSync(path.join(root, 'images', preview.image));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), preview.imageSha256);
    assert.equal(preview.visualQa, 'passed');
    if (preview.sourceStatus !== 'source_matched') assert.match(coverage.get(preview.name).explanation, /candidate/);
  }
});

test('all drop names have a visual, with shared pickup models counted separately', () => {
  const manifest = read('images/manifest.json');
  const coverage = read('images/coverage.json');
  assert.equal(coverage.total, 517);
  assert.equal(coverage.missing, 0);
  assert.equal(coverage.individual + coverage.category + coverage.variantOnly, 517);
  assert.equal(coverage.category, manifest.categoryPreviews.length);
  assert.equal(coverage.previewCount, coverage.individual + coverage.variantOnly);
  assert.equal(coverage.missingPreviewCount, coverage.total - coverage.previewCount);
  assert.ok(coverage.missingPreviewCount >= coverage.category);
  const html = fs.readFileSync(path.join(root, 'images.html'), 'utf8');
  assert.match(html, /shared pickup boxes do not count as completed item images/);
  assert.match(html, /status.value==='missing'\?\['category','missing'\]/);
  const byName = new Map(coverage.items.map(item => [item.name, item]));
  for (const category of manifest.categoryPreviews) {
    assert.equal(category.individualAppearance, false);
    assert.equal(byName.get(category.name).imageKind, 'category');
    assert.match(byName.get(category.name).explanation, /Shared category image/);
  }
  for (const image of [...manifest.categoryPreviews, ...manifest.additionalArtwork, ...(manifest.effectPreviews || [])]) {
    const bytes = fs.readFileSync(path.join(root, 'images', image.image));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), image.imageSha256);
  }
});

test('published artwork has only client ItemKT, model or particle provenance', () => {
  const manifest = read('images/manifest.json');
  const accounted = new Set();
  for (const entry of manifest.entries) {
    assert.equal(entry.archive, 'ItemKTep4.afs');
    assert.match(entry.entrySha256, /^[a-f0-9]{64}$/);
    accounted.add(entry.name);
  }
  for (const entry of manifest.modelPreviews) {
    assert.ok(entry.modelEntrySha256 || entry.modelEvidence?.compressedSha256);
    assert.ok(entry.textureEntrySha256 || entry.textureEvidence?.compressedSha256);
    accounted.add(entry.name);
  }
  for (const entry of manifest.additionalArtwork) {
    assert.equal(entry.kind, 'model_candidate');
    assert.ok(entry.source.model.archiveSha256 && entry.source.texture.archiveSha256);
    assert.equal(entry.sourceUrl, undefined);
    accounted.add(entry.name);
  }
  for (const entry of manifest.effectPreviews || []) {
    assert.equal(entry.scope, 'offline_equipment_effect_preview');
    assert.equal(entry.runtimeVerified, false);
    assert.equal(entry.visualQa, 'passed');
    assert.equal(entry.sourceUrl, undefined);
    const roles = new Set(entry.dependencies.map(resource => resource.role));
    for (const role of ['particle_data', 'texture_data', 'stock_client', 'simulator', 'renderer', 'simulation']) assert.ok(roles.has(role));
    for (const resource of entry.dependencies) assert.match(resource.sha256, /^[a-f0-9]{64}$/);
    assert.match(read('images/coverage.json').items.find(item => item.name === entry.name).explanation, /Equipment effect preview.*runtime unverified/);
    accounted.add(entry.name);
  }
  for (const entry of manifest.categoryPreviews) {
    assert.equal(entry.representation, 'shared_client_pickup_model');
    accounted.add(entry.name);
  }
  for (const entry of manifest.sharedAppearance) accounted.add(entry.name);
  for (const entry of manifest.variants) {
    assert.ok(entry.codes.some(code => code.image));
    accounted.add(entry.name);
  }
  assert.deepEqual([...accounted].sort(), read('images/coverage.json').items.map(item => item.name).sort());
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'images.html'), 'utf8'), /official.*screenshot|historical screenshots/i);
});

test('image build rejects an approved website screenshot before copying it', () => {
  const temp = fs.mkdtempSync(path.join(tmpdir(), 'destiny-client-only-'));
  try {
    const write = (file, value) => {
      const target = path.join(temp, file);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, JSON.stringify(value));
    };
    write('dropcharts/destiny/images/mapping.json', {});
    write('dropcharts/destiny/images/manifest.json', {});
    write('completeness/item-families.json', {items: Array.from({length:517}, (_, i) => ({name:`item-${i}`}))});
    write('resources/category-previews/manifest.json', {entries: []});
    write('completeness/approved-images.json', {entries:[{
      name:'item-0', visualQa:'passed', kind:'official_screenshot', path:'website.png'
    }]});
    fs.copyFileSync(path.resolve(root, '../../build-complete-images.mjs'), path.join(temp, 'build-complete-images.mjs'));
    const result = spawnSync(process.execPath, [path.join(temp, 'build-complete-images.mjs')], {encoding:'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /only client model renders are allowed/);
    assert.equal(fs.existsSync(path.join(temp, 'dropcharts/destiny/images/website.png')), false);
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
});

for (const failure of ['existing KT', 'new KT with old effect', 'modified source', 'texture only']) {
  test(`effect build rejects ${failure} without replacing image mappings`, () => {
    const temp = fs.mkdtempSync(path.join(tmpdir(), 'destiny-effect-'));
    try {
      const write = (file, value) => {
        const target = path.join(temp, file);
        fs.mkdirSync(path.dirname(target), {recursive:true});
        fs.writeFileSync(target, JSON.stringify(value));
      };
      const mapping = failure.includes('KT') ? {'item-0':'kt.png'} : {};
      write('dropcharts/destiny/images/mapping.json', mapping);
      write('dropcharts/destiny/images/manifest.json', failure === 'new KT with old effect' ? {effectPreviews:[{name:'item-0',image:'old-effect.png'}]} : {});
      write('completeness/item-families.json', {items:Array.from({length:517}, (_,i)=>({name:`item-${i}`}))});
      write('resources/category-previews/manifest.json', {entries:[]});
      write('completeness/approved-images.json', {entries:[]});
      const source = path.join(temp, 'source.bin');
      fs.writeFileSync(source, 'changed source');
      const roles = failure === 'texture only' ? ['texture_data'] : ['particle_data', 'texture_data', 'stock_client', 'simulator', 'renderer', 'simulation'];
      write('resources/completeness/armor-effects/render-manifest.json', {items:[{
        name:'item-0', scope:'offline_equipment_effect_preview', runtimeVerified:false,
        visualQa:'passed', dependencies:roles.map(role=>({role,path:source,sha256:'0'.repeat(64)}))
      }]});
      fs.copyFileSync(path.resolve(root, '../../build-complete-images.mjs'), path.join(temp, 'build-complete-images.mjs'));
      const result = spawnSync(process.execPath, [path.join(temp, 'build-complete-images.mjs')], {encoding:'utf8'});
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, failure.includes('KT') ? /would replace an existing preview/ : failure === 'modified source' ? /effect source changed/ : /missing effect provenance/);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temp, 'dropcharts/destiny/images/mapping.json'), 'utf8')), mapping);
    } finally {
      fs.rmSync(temp, {recursive:true, force:true});
    }
  });
}
