import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [guide, index] = await Promise.all([
  readFile(path.join(root, 'guide/d3d.html'), 'utf8'),
  readFile(path.join(root, 'index.html'), 'utf8'),
]);

for (const expected of [
  '<title>渲染与图形 API 指南 | Ephinea PSOBB</title>',
  'id="api-comparison"',
  'id="d3d12-vulkan"',
  'id="versions"',
  'id="device-lost"',
  'D3D9On12 只改变 D3D9 下面的实现',
  'Timeline Semaphore 最接近 D3D12 Fence',
  '1.860 是功能引入版本，不是建议固定安装的当前版本',
  'NVIDIA 上不要把 dgVoodoo D3D12 当作首选排障路径',
  'NVIDIA 不建议首选此路径',
  'AMD：D3D11 出现纯色多边形等纹理错误',
  '优先使用 <strong>D3D11 2.87.1</strong>；不要用 D3D9On12 代替',
  'LiveKernelEvent 117/141',
  'Display 4101',
]) {
  assert.ok(guide.includes(expected), `graphics API guide is missing ${JSON.stringify(expected)}`);
}

assert.ok(
  index.includes('<a href="/guide/d3d.html" target="_blank">PSOBB 渲染与图形 API</a>'),
  'home page is missing the renamed graphics API guide link',
);

const ids = [...guide.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'graphics API guide contains duplicate IDs');

const idSet = new Set(ids);
for (const [, target] of guide.matchAll(/href="#([^"]+)"/g)) {
  assert.ok(idSet.has(target), `graphics API guide links to missing anchor #${target}`);
}

assert.ok(
  !guide.includes('客户端 DLL 1.860 加入了多版本选择'),
  'graphics API guide presents rollout DLL 1.860 as an unsuperseded current version',
);
assert.ok(
  !index.includes('/guide/launcher_d3d.html'),
  'home page still references the launcher-limited legacy page name',
);
await assert.rejects(
  access(path.join(root, 'guide/launcher_d3d.html')),
  (error) => error?.code === 'ENOENT',
  'launcher-limited legacy source page still exists',
);
assert.ok(
  !guide.includes('<tr><td>D3D11 纹理错误或明显卡顿</td><td>试 <strong>Direct3D 12'),
  'graphics API guide recommends dgVoodoo D3D12 without accounting for the GPU vendor',
);
assert.ok(
  !guide.includes('要规避传统 Device Lost,应使用 dgVoodoo 的 D3D11/12'),
  'graphics API guide retains an unconditional D3D12 recommendation in the FAQ',
);

console.log('PSOBB graphics API guide contract verified.');
