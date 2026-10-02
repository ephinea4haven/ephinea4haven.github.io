import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import watcher from '@parcel/watcher';
import { DevelopmentSearch } from './dev_search.mjs';
import {
  devRoutes, externalGenerationInputs, generatorModules, generators,
  ignoredOutputs, isGenerationInput, isSearchInput,
} from './dev_inputs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { port: { type: 'string', default: '5173' }, host: { type: 'string', default: '127.0.0.1' } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid --port');
const origin = `http://${values.host === '0.0.0.0' ? '127.0.0.1' : values.host}:${port}`;
const searchOutput = path.join(root, 'dist/dev-search/assets/search');
const proxyConfig = path.join(root, '.angular/dev-search-proxy.json');
const children = new Set();
const subscriptions = [];
let modules = await generatorModules(root);
let pendingGeneration = false;
let generation;
let generationTimer;
let server;
let rootWatcher;
let closing = false;

function childProcess(args, options = {}) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', ...options });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function runGenerator(script) {
  return new Promise((resolve, reject) => {
    const child = childProcess([script]);
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${script} exited ${signal || code}`)));
  });
}

async function startSearchServer() {
  // Angular's asset manifest is fixed at compilation time. Proxy to the existing
  // static server so Pagefind's newly hashed files are available immediately.
  const child = childProcess(['scripts/serve_site.mjs', 'dist/dev-search', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const target = await new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const address = /http:\/\/127\.0\.0\.1:\d+/.exec(output)?.[0];
      if (address) resolve(address);
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Search asset server exited ${code}`)));
  });
  child.once('exit', code => { if (!closing) void stop(code || 1); });
  await mkdir(path.dirname(proxyConfig), { recursive: true });
  await writeFile(proxyConfig, JSON.stringify({ '/assets/search/**': { target } }));
  console.log(`[dev] Search assets served at ${target}.`);
}

async function* searchDocuments(signal) {
  const routes = await devRoutes(root);
  console.log(`[dev] Refreshing search from ${routes.length} current SSR pages…`);
  // Bound concurrency so search indexing never takes over the development server.
  for (let start = 0; start < routes.length; start += 4) {
    const documents = await Promise.all(routes.slice(start, start + 4).map(async url => {
      const response = await fetch(`${origin}${url}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
      if (!response.ok) throw new Error(`Search source ${url}: HTTP ${response.status}`);
      return { url, html: await response.text() };
    }));
    yield* documents;
  }
}

const search = new DevelopmentSearch(async signal => {
  // Load current indexing code too; Node otherwise caches an edited module.
  const { buildSearchFromDocuments } = await import(`${pathToFileURL(path.join(root, 'scripts/build_search.mjs'))}?dev=${Date.now()}`);
  return buildSearchFromDocuments({ documents: searchDocuments(signal), outputDirectory: searchOutput });
}, {
  ready: result => console.log(`[dev] Search ready: ${result.pages} pages.`),
  failed: error => console.error(`[dev] Search refresh failed: ${error.message}. Fix the source; the next edit retries.`),
});

function startServer() {
  if (server || closing) return;
  server = childProcess([
    'node_modules/@angular/cli/bin/ng.js', 'serve', 'haven-tools',
    '--host', values.host, '--port', String(port),
    '--proxy-config', proxyConfig,
  ], { stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env, NG_BUILD_MAX_WORKERS: '1' } });
  let buffer = '';
  const output = (stream, chunk) => {
    stream.write(chunk);
    buffer += chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.includes('Changes detected.') || line.includes('Building...')) search.compiling();
      if (line.includes('Application bundle generation complete.') || /(?:Page reload|Stylesheet update|Component update) sent to client/.test(line)) search.compiled();
      if (line.includes('Local:')) search.listening();
    }
  };
  server.stdout.on('data', chunk => output(process.stdout, chunk));
  server.stderr.on('data', chunk => output(process.stderr, chunk));
  server.once('error', error => { console.error(error); void stop(1); });
  server.once('exit', code => { if (!closing) void stop(code || 1); });
}

function regenerate() {
  if (closing || generation) return;
  clearTimeout(generationTimer);
  generation = (async () => {
    while (pendingGeneration && !closing) {
      pendingGeneration = false;
      search.generating();
      console.log('[dev] Regenerating Angular content and data…');
      try {
        for (const script of generators) {
          if (closing) return;
          await runGenerator(script);
        }
        modules = await generatorModules(root);
        console.log('[dev] Content generated; Angular will refresh the browser.');
        startServer();
        search.generated(true);
      } catch (error) {
        search.generated(false);
        if (!closing) console.error(`[dev] Generation failed: ${error.message}. Watching for a correction…`);
      }
    }
  })().finally(() => { generation = undefined; });
}

function changed(files, external = false) {
  if (closing) return;
  const inputs = files.map(file => path.relative(root, file).split(path.sep).join('/'));
  const needsGeneration = external || inputs.some(file => isGenerationInput(file, modules));
  const needsCompilation = inputs.some(file => file.startsWith('assets/')
    || (file.startsWith('src/') && !file.startsWith('src/app/generated/')));
  if (external || inputs.some(file => isSearchInput(file, modules))) {
    search.invalidate(needsCompilation);
  }
  if (needsGeneration) {
    search.generating();
    pendingGeneration = true;
    clearTimeout(generationTimer);
    generationTimer = setTimeout(regenerate, 100);
  }
}

async function stop(code = 0) {
  if (closing) return;
  closing = true;
  clearTimeout(generationTimer);
  rootWatcher?.close();
  const stoppedSearch = search.stop();
  await Promise.all(subscriptions.map(subscription => subscription.unsubscribe()));
  await Promise.all([...children].map(child => new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    const force = setTimeout(() => child.kill('SIGKILL'), 5_000);
    child.once('exit', () => clearTimeout(force));
  })));
  await Promise.allSettled([generation, stoppedSearch]);
  process.exitCode = code;
  console.log('[dev] Stopped watchers and development processes.');
}

process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
try {
  await mkdir(searchOutput, { recursive: true });
  await startSearchServer();
  // Watch input trees, not the whole checkout: Pagefind and build output can
  // contain thousands of files and must not flood native filesystem events.
  rootWatcher = watch(root, (_event, name) => {
    if (!name) changed(['index.html', '404.html'].map(file => path.join(root, file)));
    else if (['index.html', '404.html'].includes(String(name))) changed([path.join(root, String(name))]);
  });
  rootWatcher.on('error', error => { console.error(error); void stop(1); });
  for (const directory of ['content', 'assets', 'data', 'event', 'guide', 'tools', 'scripts', 'src']) {
    if (closing) break;
    const subscription = await watcher.subscribe(path.join(root, directory), (error, events) => {
      if (error) { console.error(error); void stop(1); return; }
      changed(events.map(event => event.path));
    }, { ignore: ignoredOutputs.map(output => path.join(root, output)) });
    if (closing) await subscription.unsubscribe();
    else subscriptions.push(subscription);
  }
  const externalInputs = new Set(await externalGenerationInputs(root));
  for (const directory of new Set([...externalInputs].map(file => path.dirname(file)))) {
    if (closing) break;
    const subscription = await watcher.subscribe(directory, (error, events) => {
      if (error) { console.error(error); void stop(1); return; }
      if (events.some(event => externalInputs.has(event.path))) changed([], true);
    });
    if (closing) await subscription.unsubscribe();
    else subscriptions.push(subscription);
  }
  pendingGeneration = true;
  regenerate();
} catch (error) {
  console.error(error);
  await stop(1);
}
