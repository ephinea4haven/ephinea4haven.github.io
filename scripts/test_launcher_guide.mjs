import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'parse5';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(path.join(root, 'guide/launcher.html'), 'utf8');
const document = parse(source);
function nodes(node) {
  return [node, ...(node.childNodes || []).flatMap(nodes)];
}
const elements = nodes(document);
const attr = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value;
const text = (node) => node.nodeName === '#text'
  ? node.value
  : (node.childNodes || []).map(text).join('');
function setting(label) {
  const row = elements.find((node) => node.tagName === 'tr'
    && text(node.childNodes.find((child) => child.tagName === 'td') || {}).startsWith(label));
  assert.ok(row, `Missing setting: ${label}`);
  return text(row);
}

test('minimap documentation distinguishes internal zoom from HUD box size', () => {
  const description = setting('NO MINIMAP SCALE');
  assert.match(description, /视野/);
  assert.match(description, /图标/);
  assert.match(description, /不是.*HUD.*大小/);
  assert.doesNotMatch(description, /避免小地图随 HUD 缩放一起变小/);
});

test('classic intro explains both playback paths rather than a movie on/off switch', () => {
  const description = setting('CLASSIC INTRO FMV');
  assert.match(description, /开启.*PAE/);
  assert.match(description, /关闭.*新版.*播放/);
  assert.doesNotMatch(description, /控制是否播放经典开场影片/);
  assert.ok(elements.some((node) => attr(node, 'href')?.includes('post-190564')));
});

test('reset documentation warns about language and distinguishes reset from saving', () => {
  const description = setting('RESET ALL');
  assert.match(description, /English/);
  assert.match(description, /CUSTOM/);
  assert.match(description, /尚未保存/);
  assert.match(description, /未覆盖/);
  assert.match(setting('REVERT'), /已保存/);
  assert.match(setting('MORE'), /先保存/);
  assert.match(setting('ENGLISH / 日本語 / CUSTOM'), /保存.*更新检查/);
});

test('capture evidence and review ledger are not silently excluded from Git', () => {
  const relative = 'docs/EPHINEA_LAUNCHER_EVIDENCE.md';
  const evidence = readFileSync(path.join(root, relative), 'utf8');
  assert.match(evidence, /Review-fix ledger/);
  assert.match(evidence, /--current-user/);
  const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', relative], { cwd: root });
  assert.equal(result.status, 1, `Evidence must be eligible for tracking: ${result.stderr}`);
});

test('all seven native PNGs exist with the declared uncropped-window dimensions', () => {
  const images = elements.filter((node) => node.tagName === 'img');
  const expected = ['main', 'page1', 'page2', 'page3', 'page4', 'page5', 'more'];
  assert.deepEqual(images.map((node) => path.basename(attr(node, 'src'), '.png')), expected);
  for (const image of images) {
    const src = attr(image, 'src');
    const png = readFileSync(path.join(root, src.slice(1)));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', src);
    const actual = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.deepEqual(actual, src.endsWith('/more.png') ? [1192, 570] : [1600, 1200], src);
    assert.deepEqual(actual, [Number(attr(image, 'width')), Number(attr(image, 'height'))], src);
    assert.ok(attr(image, 'alt'), src);
    assert.equal(attr(image.parentNode, 'href'), src, 'Each screenshot must link to its full-size asset');
  }
});

test('page anchors, referenced local guides and both entry points resolve', () => {
  const ids = elements.map((node) => attr(node, 'id')).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['main-window', 'page1', 'page2', 'page3', 'page4', 'page5', 'more', 'scope']) {
    assert.ok(ids.includes(id), `Missing section: ${id}`);
  }
  for (const link of elements.filter((node) => node.tagName === 'a')) {
    const href = attr(link, 'href');
    if (!href?.startsWith('/') && !href?.startsWith('#')) continue;
    const url = new URL(href, 'https://local.test/guide/launcher.html');
    const target = readFileSync(path.join(root, url.pathname.slice(1)));
    if (url.hash) {
      assert.ok(nodes(parse(target.toString())).some((node) => attr(node, 'id') === url.hash.slice(1)), href);
    }
  }
  for (const file of ['index.html', 'guide/d3d.html']) {
    const entry = nodes(parse(readFileSync(path.join(root, file), 'utf8')));
    assert.ok(entry.some((node) => attr(node, 'href') === '/guide/launcher.html'), file);
  }
});
