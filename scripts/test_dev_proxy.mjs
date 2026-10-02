import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('development search server serves a new hash after startup and keeps missing files as 404', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'haven-dev-assets-'));
  const child = spawn(process.execPath, [fileURLToPath(new URL('./serve_site.mjs', import.meta.url)), directory, '0']);
  t.after(async () => {
    const exited = child.exitCode === null && child.signalCode === null ? once(child, 'exit') : Promise.resolve();
    child.kill('SIGTERM');
    await exited;
    await rm(directory, { recursive: true, force: true });
  });
  const origin = await new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const url = /http:\/\/127\.0\.0\.1:\d+/.exec(output)?.[0];
      if (url) resolve(url);
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited ${code}`)));
  });
  const url = `${origin}/assets/search/index/zh_new-hash.pf_meta`;
  assert.equal((await fetch(url)).status, 404);
  const bytes = Buffer.from([0x1f, 0x8b, 0x01, 0x42]);
  await mkdir(path.join(directory, 'assets/search/index'), { recursive: true });
  await writeFile(path.join(directory, 'assets/search/index/zh_new-hash.pf_meta'), bytes);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});
