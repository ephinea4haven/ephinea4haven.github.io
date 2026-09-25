import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseFragment } from 'parse5';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
execFileSync(process.execPath, ['scripts/generate_angular_content.mjs'], { cwd: root });
const events = ['anniversary', 'christmas', 'easter', 'halloween', 'valentines'];
const years = events.flatMap((event) => readdirSync(path.join(root, 'event', event))
  .filter((file) => /^\d{4}\.html$/.test(file)).map((file) => `event/${event}/${file}`));
function nodes(html) {
  const result = [];
  const visit = (node) => { result.push(node); for (const child of node.childNodes ?? []) visit(child); };
  visit(parseFragment(html));
  return result;
}
const attribute = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value;
const ids = (html) => nodes(html).map((node) => attribute(node, 'id')).filter(Boolean).sort();
const visible = (html) => nodes(html).filter((node) => node.nodeName === '#text').map((node) => node.value).join('');

test('all 45 event years compile in English and Japanese with their anchors and interactions intact', () => {
  assert.equal(years.length, 45);
  for (const relative of years) {
    const original = read(relative);
    for (const language of ['en', 'ja']) {
      const html = read(`src/app/generated/event-fragments/${language}/${relative}`);
      assert.deepEqual(ids(html), ids(original), `${language}/${relative}: anchors`);
      for (const marker of ['data-quest-response', 'data-quest-panel-target', 'data-preview-image']) {
        assert.equal(nodes(html).filter((node) => attribute(node, marker) !== undefined).length,
          nodes(original).filter((node) => attribute(node, marker) !== undefined).length,
          `${language}/${relative}: ${marker}`);
      }
      assert.doesNotMatch(html, /data-item-en="[^"]*"><\/span>/, `${language}/${relative}: unresolved item`);
      if (language === 'en') assert.doesNotMatch(html, /\p{Script=Han}/u, relative);
      for (const node of nodes(html)) {
        if (node.tagName === 'page-update-stamp') assert.equal(attribute(node, 'language'), language);
        const href = attribute(node, 'href');
        if (href?.startsWith('/event/')) assert.fail(`${language}/${relative}: Chinese archive link ${href}`);
        if (href?.includes('anniversary.html?year=')) assert.ok(href.startsWith(`/${language}/event/`));
      }
    }
  }
});

test('each translated overview embeds its own default-year fragment and language-specific year links', () => {
  for (const language of ['en', 'ja']) {
    for (const event of events) {
      const file = read(`src/app/generated/pages/event__${event}.${language}.ts`);
      const template = JSON.parse(file.match(/  template: (".*"),\n/)[1]);
      const parsed = nodes(template);
      const masthead = parsed.find((node) => attribute(node, 'data-event') === event);
      assert.ok(masthead, `${language}/${event}: runtime entry point`);
      const year = attribute(masthead, 'data-default-year');
      const fragment = read(`src/app/generated/event-fragments/${language}/event/${event}/${year}.html`);
      // Angular escapes template control characters, but the visible words and
      // item labels must come from exactly the same edition as the fetch resource.
      for (const id of ids(fragment)) assert.ok(ids(template).includes(id), `${language}/${event}: ${id}`);
      const firstHeading = nodes(fragment).find((node) => ['h2', 'h3'].includes(node.tagName));
      assert.ok(visible(template).includes(visibleFromNode(firstHeading)), `${language}/${event}: default content`);
      const links = parsed.map((node) => attribute(node, 'href')).filter((href) => href?.includes(`${event}.html?year=`));
      assert.ok(links.length > 0);
      assert.ok(links.every((href) => href.startsWith(`/${language}/event/`)));
      if (language === 'en') assert.doesNotMatch(visible(template), /\p{Script=Han}/u);
    }
  }
});

function visibleFromNode(node) {
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes ?? []).map(visibleFromNode).join('');
}

test('complete item identities do not confuse the replica claw, toy hammer or anniversary badges', () => {
  const english = read('src/app/generated/event-fragments/en/event/anniversary/2026.html');
  assert.match(english, /TOY HAMMER/);
  assert.match(english, />Hammer</);
  assert.doesNotMatch(english, /Toy <span/);
  const japanese = read('src/app/generated/pages/event__easter.ja.ts');
  assert.match(japanese, /Nei's Claw \(Replica\)/);
  assert.doesNotMatch(japanese, /ネイクロー.*Replica/);
  for (const language of ['en', 'ja']) {
    const html = read(`src/app/generated/event-fragments/${language}/event/anniversary/2025.html`);
    assert.doesNotMatch(html, /WEAPONS/);
  }
});
