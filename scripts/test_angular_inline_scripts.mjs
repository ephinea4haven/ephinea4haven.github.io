import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { parse } from 'parse5';
import { isAngularInlineScript } from './angular_inline_scripts.mjs';

const require = createRequire(import.meta.url);
// Exercise the installed Angular optimizer, so dependency changes cannot silently
// invalidate a hand-written fixture of its generated script.
const { inlineCriticalCss } = require(path.join(
  path.dirname(require.resolve('@angular/build/package.json')),
  'src/utils/index-file/inline-critical-css.js',
));

function scripts(html) {
  const result = [];
  function visit(node) {
    if (node.tagName === 'script') result.push(node);
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(html));
  return result;
}

function accepted(node) {
  return isAngularInlineScript(node, new Map(node.attrs.map(({ name, value }) => [name, value])));
}

async function optimizedHtml() {
  return inlineCriticalCss(
    '<html><head><link rel="stylesheet" href="styles.css"></head><body><p>Test</p></body></html>',
    '/build', '', true,
    async () => 'p{color:red}.unused{color:blue}',
  );
}

test('accepts the deferred stylesheet activator emitted by the locked Angular build', async () => {
  const { content, errors } = await optimizedHtml();
  assert.deepEqual(errors, []);
  assert.match(content, /data-beasties-media="all"/);
  const generated = scripts(content);
  assert.equal(generated.length, 1);
  assert.ok(accepted(generated[0]));
});

test('rejects modified CSS activators, unrelated scripts, and external lookalikes', async () => {
  const { content } = await optimizedHtml();
  const source = scripts(content)[0].childNodes[0].value;
  for (const html of [
    `<script>${source};alert(1)</script>`,
    `<script>${source.replace('l.removeAttribute', 'window.otherFunction')}</script>`,
    `<script id="other">${source}</script>`,
    `<script type="application/json">${source}</script>`,
    `<script src="/other.js">${source}</script>`,
    '<script>window.pageRuntime = true</script>',
  ]) {
    assert.equal(accepted(scripts(html)[0]), false, html);
  }
});

test('continues to recognize Angular hydration and event replay scripts', () => {
  for (const html of [
    '<script id="ng-state" type="application/json">{"__nghData__":[]}</script>',
    '<script id="ng-event-dispatch-contract" type="text/javascript">contract</script>',
    '<script>window.__jsaction_bootstrap(document.body,"ng",["click"],[]);</script>',
  ]) {
    assert.ok(accepted(scripts(html)[0]), html);
  }
});
