import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { DevelopmentSearch } from './dev_search.mjs';

async function eventually(predicate) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await delay(5);
  assert.ok(predicate());
}

test('a compilation that finishes during generation still schedules the completed input', async () => {
  let builds = 0;
  const search = new DevelopmentSearch(async () => ++builds, { delay: 1 });
  search.generating();
  search.listening();
  search.compiled();
  await delay(10);
  assert.equal(builds, 0);
  search.generated(true);
  await eventually(() => builds === 1);
  await search.stop();
});

test('search-only edits refresh without an Angular compilation event', async () => {
  let builds = 0;
  const search = new DevelopmentSearch(async () => ++builds, { delay: 1 });
  search.listening();
  search.compiled();
  search.generated(true);
  await eventually(() => builds === 1);
  search.invalidate();
  await eventually(() => builds === 2);
  await search.stop();
});

test('a later compiler rebuild invalidates an already finished index', async () => {
  let builds = 0;
  const search = new DevelopmentSearch(async () => ++builds, { delay: 1 });
  search.listening();
  search.compiled();
  search.generated(true);
  await eventually(() => builds === 1 && !search.job);
  search.compiling();
  await delay(10);
  assert.equal(builds, 1);
  search.compiled();
  await eventually(() => builds === 2);
  await search.stop();
});

test('a queued failed generation never indexes partial output, and a correction recovers', async () => {
  let builds = 0;
  const search = new DevelopmentSearch(async () => ++builds, { delay: 1 });
  search.listening();
  search.generating();
  search.compiled();
  search.generated(true);
  // A second edit arrived during the first pass; its generation then fails.
  search.generating();
  search.generated(false);
  await delay(10);
  assert.equal(builds, 0);
  search.generating();
  search.generated(true);
  await eventually(() => builds === 1);
  await search.stop();
});

test('new compilation cancels an outdated index and stop releases the running job', async () => {
  const signals = [];
  const search = new DevelopmentSearch(signal => {
    signals.push(signal);
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  }, { delay: 1 });
  search.listening();
  search.compiled();
  search.generated(true);
  await eventually(() => signals.length === 1);
  search.compiling();
  await eventually(() => signals[0].aborted);
  await delay(10);
  assert.equal(signals.length, 1);
  search.compiled();
  await eventually(() => signals.length === 2);
  await search.stop();
  assert.equal(signals[1].aborted, true);
  search.invalidate();
  search.compiled();
  await delay(10);
  assert.equal(signals.length, 2);
});
