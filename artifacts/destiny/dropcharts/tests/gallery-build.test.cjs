const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

test('gallery rebuild needs only published image data, not rendering audit intermediates', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'destiny-gallery-'));
  try {
    const images = path.join(fixture, 'dropcharts/destiny/images');
    fs.mkdirSync(images, {recursive:true});
    fs.copyFileSync(path.resolve(__dirname, '../../build-image-gallery.mjs'), path.join(fixture, 'build-image-gallery.mjs'));
    const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data));
    write(path.join(fixture, 'catalog.json'), {dropItems:[{name:'Test Weapon'}, {name:'Unmapped Item'}]});
    write(path.join(images, 'mapping.json'), {'Test Weapon':'weapon.png'});
    write(path.join(images, 'manifest.json'), {entries:[{name:'Test Weapon'}], modelPreviews:[]});
    fs.writeFileSync(path.join(images, 'weapon.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
    execFileSync(process.execPath, [path.join(fixture, 'build-image-gallery.mjs')]);
    const html = fs.readFileSync(path.join(fixture, 'dropcharts/destiny/images.html'), 'utf8');
    assert.match(html, /Destiny Item Images/);
    assert.match(html, /images\/weapon.png/);
    const coverage = JSON.parse(fs.readFileSync(path.join(images, 'coverage.json'), 'utf8'));
    assert.equal(coverage.total, 2);
    assert.equal(coverage.mapped, 1);
    assert.equal(coverage.missing, 1);
    assert.equal(coverage.missingPreviewCount, 1);
    assert.equal(coverage.items.find(item => item.name === 'Unmapped Item').imageKind, 'missing');
  } finally {
    fs.rmSync(fixture, {recursive:true, force:true});
  }
});
