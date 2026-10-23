import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseFragment } from 'parse5';
import systems from '../content/external-systems.json' with { type: 'json' };

execFileSync(process.execPath, ['scripts/generate_angular_content.mjs']);
function anchors(page, language) {
  const source = readFileSync(`src/app/generated/pages/${page}${language === 'zh' ? '' : `.${language}`}.ts`, 'utf8');
  const body = parseFragment(JSON.parse(source.match(/  template: (".*"),\n/)[1]));
  const links = [];
  const visit = node => {
    if (node.tagName === 'a') links.push(Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value])));
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(body);
  return links;
}

test('compilation preserves bare fragments as native links in every edition', () => {
  for (const language of ['zh', 'en', 'ja']) {
    const prefix = language === 'zh' ? '' : `/${language}`;
    for (const [source, route] of [['bdp', 'black-paper-deal'], ['prizelist', 'corens-prizes']]) {
      const link = anchors(`data__${source}__index`, language).find(link => link.class === 'back-to-top');
      assert.equal(link.href, `${prefix}/quests/${route}/#`);
      assert.equal(link.routerlink, undefined);
    }
  }
});

test('external system references compile to native URLs with language and query intact', () => {
  for (const language of ['zh', 'en', 'ja']) {
    const links = anchors('index', language);
    const external = links.filter(link => Object.values(systems).some(origin => link.href?.startsWith(origin + '/')));
    assert.equal(external.length, 7);
    for (const link of external) {
      assert.equal(link['data-external-system'], undefined);
      assert.equal(link.routerlink, undefined);
      assert.equal(link.target, '_blank');
      const url = new URL(link.href);
      if (url.origin === systems.dropCharts) {
        assert.equal(url.searchParams.get('lang'), language);
        assert.equal(url.searchParams.get('diff'), 'Ultimate');
      }
    }
  }
});
