import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { parse } from 'parse5';
import { createHash } from 'node:crypto';

const files = ['guide/npc.html', 'content/i18n/pages/en/guide/npc.html', 'content/i18n/pages/ja/guide/npc.html'];
const localModelIds = ['flowen', 'rico', 'ult', 'zoke', 'kroe', 'anna', 'tyrell', 'coren'];
const requiredPeople = ['donoph', 'elly', 'mome', 'ult', 'kroe', 'anna', 'leo', 'karen', 'gilliam', 'lionel', 'matha', 'hopkins', 'coren', 'claire'];
const attr = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value;
const text = (node) => (node.value || '') + (node.childNodes || []).map(text).join('');
function nodes(root) {
  return [root, ...(root.childNodes || []).flatMap(nodes)];
}

for (const file of files) {
  test(`${file}: missing story and service NPCs have sourced profiles`, async () => {
    const all = nodes(parse(await readFile(file, 'utf8')));
    for (const id of requiredPeople) {
      const card = all.find((node) => attr(node, 'id') === `npc-${id}`);
      assert.ok(card, `Missing ${id}`);
      assert.ok(nodes(card).some((node) => node.tagName === 'a' && /^https:\/\//.test(attr(node, 'href') || '')), `${id}: missing source`);
    }
    const donoph = all.find((node) => attr(node, 'id') === 'npc-donoph');
    assert.match(text(donoph), /Donoph Baz/);
    assert.ok(nodes(donoph).some((node) => attr(node, 'data-item-en') === "DB's Saber"));
    const nol = all.find((node) => attr(node, 'id') === 'npc-nol');
    assert.ok(nodes(nol).some((node) => attr(node, 'href') === 'https://wiki.pioneer2.net/w/Government'), 'Nol must retain the verified BB government-quest role');
    const bernie = all.find((node) => attr(node, 'id') === 'npc-bernie');
    assert.ok(attr(bernie, 'data-episodes').split(' ').includes('4'), 'Bernie is present in EP4');
    assert.ok(!all.some((node) => attr(node, 'id') === 'npc-mother'), 'PS Zero is outside the BB roster');
  });
}

test('NPC languages have matching rosters and working local references', async () => {
  let expected;
  for (const file of files) {
    const all = nodes(parse(await readFile(file, 'utf8')));
    const ids = all.map((node) => attr(node, 'id')).filter(Boolean);
    assert.equal(ids.length, new Set(ids).size, `${file}: duplicate IDs`);
    const roster = all.filter((node) => attr(node, 'data-npc-card') !== undefined);
    const identities = roster.map((node) => attr(node, 'id')).sort();
    assert.ok(identities.length >= 40, 'Cover the main cast, solo quest clients and recurring services');
    if (expected) assert.deepEqual(identities, expected);
    expected = identities;
    for (const card of roster) {
      assert.ok(/^[124]( [124])*$/.test(attr(card, 'data-episodes')), `${attr(card, 'id')}: invalid episode scope`);
    }
    for (const node of all) {
      const href = attr(node, 'href');
      if (href?.startsWith('#')) assert.ok(ids.includes(href.slice(1)), `${file}: broken ${href}`);
    }
  }
});

test('NPC portraits, compact cards and relationship diagram remain available in every language', async () => {
  const manifest = JSON.parse(await readFile('assets/img/npc/portraits.json', 'utf8'));
  for (const portrait of manifest) {
    await access(portrait.file);
    if (portrait.kind === 'local-model-render') {
      assert.equal(portrait.source, '/assets/img/npc/model-renders.json');
      await access(portrait.source.slice(1));
    } else {
      assert.match(portrait.source, /^https:\/\//);
    }
    const [x, y, size] = portrait.crop;
    assert.ok(x >= 0 && y >= 0 && size > 0 && x + size <= portrait.width && y + size <= portrait.height, portrait.id);
  }
  for (const id of ['ult', 'flowen', 'zoke', 'kroe']) {
    const portrait = manifest.find(entry => entry.id === id);
    assert.ok(portrait.kind && portrait.scene, `${id}: verified scene provenance is required`);
  }
  for (const file of files) {
    const all = nodes(parse(await readFile(file, 'utf8')));
    const cards = all.filter(node => attr(node, 'data-npc-card') !== undefined);
    const illustrated = cards.filter(card => nodes(card).some(node => node.tagName === 'img'));
    for (const id of localModelIds) {
      const portrait = manifest.find(entry => entry.id === id);
      const card = cards.find(node => attr(node, 'id') === `npc-${id}`);
      assert.equal(attr(nodes(card).find(node => node.tagName === 'img'), 'src'), `/assets/img/npc/${id}-model.webp`, `${id}: use the verified local model render`);
      const pattern = all.find(node => attr(node, 'id') === `graph-${id}-portrait`);
      if (id !== 'coren') {
        assert.ok(pattern, `${id}: missing relationship portrait`);
        assert.equal(attr(nodes(pattern).find(node => node.tagName === 'image'), 'href'), `/${portrait.file}`);
        assert.equal(attr(pattern, 'viewBox'), [...portrait.crop, portrait.crop[2]].join(' '));
      }
      assert.ok(nodes(card).some(node => attr(node, 'class') === 'npc-image-note'), `${id}: scene must be disclosed`);
    }
    assert.equal(illustrated.length, 46, `${file}: verified portraits must not disappear`);
    for (const card of cards) {
      assert.ok(card.childNodes.some(node => attr(node, 'class') === 'npc-body'), `${attr(card, 'id')}: compact avatar/body layout`);
      for (const img of nodes(card).filter(node => node.tagName === 'img')) await access(attr(img, 'src').slice(1));
    }
    assert.ok(all.some(node => node.tagName === 'svg' && attr(node, 'class') === 'rel-svg'));
    assert.ok(all.some(node => attr(node, 'class') === 'timeline'));
    const coren = all.find(node => attr(node, 'id') === 'npc-coren');
    assert.match(text(coren), /Section ID|セクションID/);
    assert.ok(nodes(coren).some(node => attr(node, 'href')?.endsWith('/coren-bugged-p2-p4.972/post-10033')));
    for (const id of ['ash', 'tyrell', 'rico', 'flowen', 'natasha', 'alicia', 'montague', 'elenor', 'sue', 'kireek', 'rupika']) {
      const card = cards.find(node => attr(node, 'id') === `npc-${id}`);
      const img = nodes(card).find(node => node.tagName === 'img');
      assert.notEqual(attr(img, 'src'), `/assets/img/npc/${id}.webp`, `${id}: retired artwork must not return`);
      assert.ok(manifest.some(portrait => `/${portrait.file}` === attr(img, 'src')), `${id}: replacement provenance`);
    }
  }
});

test('All requested model portraits have traceable local sources and verified face mappings', async () => {
  const provenance = JSON.parse(await readFile('assets/img/npc/model-renders.json', 'utf8'));
  assert.equal(provenance.characters.ult.template, 50);
  assert.deepEqual(provenance.characters.ult.parts[1].slots, [265, 264, 266]);
  assert.match(provenance.quests.find(q => q.quest === 'Soul of Steel [BB-E].qst').sha256, /^[a-f0-9]{64}$/);
  assert.equal(provenance.characters.zoke.template, 34);
  assert.equal(provenance.characters.kroe.template, 30);
  assert.equal(provenance.characters.anna.template, 20);
  assert.notDeepEqual(provenance.characters.kroe.appearance, provenance.characters.anna.appearance);
  for (const id of localModelIds) {
    const output = provenance.outputs[id];
    const bytes = await readFile(`assets/img/npc/${output.file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), output.sha256);
    assert.deepEqual([output.width, output.height], [900, 900]);
  }
});

test('Osto and Blant remain explicit record-only entries rather than invented portraits', async () => {
  for (const file of files) {
    const all = nodes(parse(await readFile(file, 'utf8')));
    for (const id of ['osto', 'blant']) {
      const card = all.find(node => attr(node, 'id') === `npc-${id}`);
      assert.ok(card);
      assert.ok(!nodes(card).some(node => node.tagName === 'img'));
      assert.ok(nodes(card).some(node => attr(node, 'class') === 'npc-image-note'));
    }
  }
});
