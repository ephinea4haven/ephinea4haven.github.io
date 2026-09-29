const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const upstream = path.resolve(__dirname, '../../../../../droptable');
function viewer(version = 'bb', query = '') {
  const nodes = new Map();
  const element = () => ({innerHTML: '', value: '', children: [], style: {setProperty() {}}, dataset: {}, appendChild(child) {this.children.push(child);}});
  const document = {documentElement: {}, body: element(), addEventListener() {}, createElement: element,
    getElementById(id) {if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id);}, querySelectorAll() {return [];}};
  const window = {location: new URL('https://dropcharts.psohaven.com/'+version+'/'+query), addEventListener() {}};
  window.history = {replaceState(_state, _title, url) {window.location = new URL(url);}};
  const context = vm.createContext({window, document, URL, URLSearchParams, XMLHttpRequest: class {open() {} send() {}}});
  for (const file of [`${version}/data/en.js`, `${version}/data/ja.js`, `${version}/data/zh.js`, 'bb/data/monsters.js', 'shared/i18n.js', 'shared/viewer.js']) {
    vm.runInContext(fs.readFileSync(path.join(file.startsWith('shared/') ? root : upstream, file), 'utf8'), context);
  }
  window.initViewer({version, languages: ['en','ja','zh'], episodes: version === 'dc' ? null : version === 'bb' ? ['Episode 1','Episode 2','Episode 4'] : ['Episode 1','Episode 2'], hasTypes: version === 'bb', hasRateToggle: version === 'bb'});
  return {window, document, nodes, html: () => document.getElementById('content').innerHTML};
}
test('every BB row uses the selected form and locally available artwork in all languages and difficulties', () => {
  for (const lang of ['en','ja','zh']) for (const diff of ['Normal','Hard','Very Hard','Ultimate']) {
    const app = viewer('bb', `?lang=${lang}&diff=${diff}`);
    const names = [...app.html().matchAll(/class="mob-name">([^<]*)</g)].map(match => match[match.length - 1]);
    const expected = [];
    for (const [episode, rows] of Object.entries(app.window.DROP_DATA_EN.data[diff].monsters)) for (const row of rows) {
      const profile = app.window.BB_MONSTERS[episode][row.name];
      const variant = profile[diff === 'Ultimate' ? 'ultimate' : 'normal'];
      expected.push(variant.names[lang]);
      if (variant.image) {
        assert.ok(fs.existsSync(path.join(upstream, 'bb/images/monsters', variant.image)));
        assert.ok(variant.source.startsWith('https://wiki.pioneer2.net/'));
      }
    }
    assert.deepEqual(names, expected);
    const previews = [...app.html().matchAll(/class="monster-tooltip-img" src="images\/monsters\/([^"<>]+)"/g)].map(match => match[match.length - 1]);
    const expectedPreviews = Object.entries(app.window.DROP_DATA_EN.data[diff].monsters).flatMap(([episode, rows]) =>
      rows.map(row => app.window.BB_MONSTERS[episode][row.name][diff === 'Ultimate' ? 'ultimate' : 'normal'].image).filter(Boolean));
    assert.deepEqual(previews, expectedPreviews);
    assert.doesNotMatch(app.html(), /class="monster-icon/);
    assert.equal(app.document.documentElement.lang, lang);
  }
});
test('table context is restored after reload or returning from a detail page', () => {
  const app = viewer();
  app.nodes.get('difficultyBtns').children.find(button => button.dataset.diff === 'Ultimate').onclick();
  app.nodes.get('langBtns').children.find(button => button.dataset.lang === 'zh').onclick();
  app.window._viewer.setEpisode('Episode 2');
  app.window._viewer.setRateFormat('fraction');
  app.document.getElementById('searchBox').value = 'Gilchich';
  app.window.onSearch();
  const params = app.window.location.searchParams;
  assert.equal(params.get('diff'), 'Ultimate');
  assert.equal(params.get('lang'), 'zh');
  assert.equal(params.get('ep'), 'Episode 2');
  assert.equal(params.get('rate'), 'fraction');
  assert.equal(params.get('q'), 'Gilchich');
  const restored = viewer('bb', app.window.location.search);
  assert.equal(restored.html(), app.html());
  assert.equal(restored.document.getElementById('searchBox').value, 'Gilchich');
  app.document.getElementById('searchBox').value = '';
  app.window.onSearch();
  app.window._viewer.setType('boxes');
  assert.equal(app.window.location.searchParams.get('type'), 'boxes');
  assert.equal(viewer('bb', app.window.location.search).html(), app.html());
});
test('unsupported URL context cannot hide tables or apply BB-only controls to legacy versions', () => {
  for (const version of ['bb','dc','ngc']) {
    for (const invalid of ['invalid', '__proto__', 'constructor', 'toString']) {
      const app = viewer(version, `?diff=${invalid}&lang=${invalid}&ep=${invalid}&type=${invalid}&rate=${invalid}`);
      assert.equal(app.html(), viewer(version).html());
    }
    if (version !== 'bb') {
      const legacy = viewer(version, '?type=boxes&rate=fraction');
      assert.equal(legacy.html(), viewer(version).html());
      assert.equal(legacy.window.location.search, '');
    }
  }
});
test('generated Chinese names match authority and Wiki episode-specific Japanese labels remain explicit', () => {
  const app = viewer();
  const authority = JSON.parse(fs.readFileSync(path.join(upstream, 'i18n_names.json'), 'utf8')).monsters;
  for (const profiles of Object.values(app.window.BB_MONSTERS)) for (const profile of Object.values(profiles)) {
    for (const variant of [profile.normal, profile.ultimate]) {
      assert.equal(variant.names.zh, authority[variant.names.en].zh);
    }
  }
  // Ephinea Wiki /w/Gillchic, checked 2026-09-18: the source itself has
  // different Japanese Ultimate labels in EP1 and EP2. Do not flatten them.
  assert.equal(app.window.BB_MONSTERS['Episode 1']['Gilchic/Gilchich'].ultimate.names.ja, 'ギルチッチ');
  assert.equal(app.window.BB_MONSTERS['Episode 2']['Gilchic/Gilchich'].ultimate.names.ja, 'ギルチック');
});
test('alternate form and language searches survive difficulty changes', () => {
  const app = viewer();
  app.document.getElementById('searchBox').value = '紫魔龟';
  app.window.onSearch();
  assert.match(app.html(), /class="mob-name">Booma</);
  app.nodes.get('difficultyBtns').children.find(button => button.dataset.diff === 'Ultimate').onclick();
  assert.match(app.html(), /class="mob-name">Bartle</);
  assert.doesNotMatch(app.html(), /class="mob-name">Booma</);
  app.nodes.get('langBtns').children.find(button => button.dataset.lang === 'ja').onclick();
  assert.match(app.html(), /class="mob-name">バートル</);
});
test('box rows retain their location names and have no monster portraits', () => {
  const app = viewer();
  app.window._viewer.setType('boxes');
  assert.doesNotMatch(app.html(), /class="monster-tooltip-img/);
  for (const rows of Object.values(app.window.DROP_DATA_EN.data.Normal.boxes)) for (const row of rows) {
    assert.ok(app.html().includes(row.name.replaceAll('/', '<br>')));
  }
});
test('DC and GameCube render without the BB identity map', () => {
  for (const version of ['dc', 'ngc']) {
    const app = viewer(version, '?diff=Ultimate');
    delete app.window.BB_MONSTERS;
    app.window.onSearch();
    assert.match(app.html(), /class="mob-name"/);
    assert.doesNotMatch(app.html(), /class="monster-tooltip-img/);
  }
});
test('every BB monster and item links to its Wiki identity with the selected context', () => {
  for (const lang of ['en', 'ja', 'zh']) for (const diff of ['Normal', 'Hard', 'Very Hard', 'Ultimate']) {
    const app = viewer('bb', `?lang=${lang}&diff=${diff}`);
    for (const kind of ['monsters', 'boxes']) {
      app.window._viewer.setType(kind);
      const monsterLinks = [...app.html().matchAll(/class="monster-link monster-label" href="([^"]+)"/g)].map(m => m[1]);
      const itemLinks = [...app.html().matchAll(/class="item-name[^"]*" href="([^"]+)"/g)].map(m => m[1]);
      const expectedMonsters = [], expectedItems = [];
      for (const [episode, rows] of Object.entries(app.window.DROP_DATA_EN.data[diff][kind])) for (const row of rows) {
        if (kind === 'monsters') {
          const profile = app.window.BB_MONSTERS[episode][row.name];
          const code = {Normal:'n', Hard:'h', 'Very Hard':'vh', Ultimate:'u'}[diff];
          expectedMonsters.push(`https://www.psohaven.com/data/enemies/${profile.id}.html?diff=${code}&amp;lang=${lang}`);
        }
        for (const cell of row.drops) for (const drop of cell.items || [cell]) {
          if (drop.item) {
            assert.ok(app.window.BB_ITEMS[drop.item], drop.item);
            expectedItems.push(`https://www.psohaven.com/data/items/${app.window.BB_ITEMS[drop.item]}.html?lang=${lang}`);
          }
        }
      }
      assert.deepEqual(monsterLinks, expectedMonsters);
      assert.deepEqual(itemLinks, expectedItems);
    }
  }
});
// Area expectations reviewed against Ephinea Wiki; see docs/monster-area-review.md.
const reviewedAreas = {
  'Episode 1': {
    Forest: 'Booma|Gobooma|Gigobooma|Rag Rappy|Al Rappy|Mothmant|Monest|Savage Wolf|Barbarous Wolf|Hildebear|Hildeblue|Dragon',
    Cave: 'Evil Shark|Pal Shark|Guil Shark|Poison Lily|Nar Lily|Grass Assassin|Nano Dragon|Pofuilly Slime|Pouilly Slime|Pan Arms|Migium|Hidoom|De Rol Le',
    Mine: 'Gilchic|Dubchic|Canadine|Canane|Sinow Beat|Sinow Gold|Garanz|Vol Opt',
    Ruins: 'Dimenian|La Dimenian|So Dimenian|Delsaber|Claw|Bulk|Bulclaw|Dark Belra|Dark Gunner|Death Gunner|Chaos Sorcerer|Chaos Bringer|Dark Falz',
  },
  'Episode 2': {
    'VR Temple': 'Dimenian|La Dimenian|So Dimenian|Rag Rappy|Love Rappy|Egg Rappy|Halo Rappy|St. Rappy|Hildebear|Hildeblue|Mothmant|Monest|Grass Assassin|Poison Lily|Nar Lily|Dark Belra|Barba Ray',
    'VR Spaceship': 'Dubchic|Gilchic|Savage Wolf|Barbarous Wolf|Pan Arms|Migium|Hidoom|Garanz|Delsaber|Chaos Sorcerer|Gol Dragon',
    'Central Control Area': 'Ul Gibbon|Zol Gibbon|Merillia|Meriltas|Gee|Sinow Berill|Sinow Spigell|Mericarol|Merikle|Mericus|Gibbles|Gi Gue|Gal Gryphon',
    Seabed: 'Dolmolm|Dolmdarl|Recon|Morfos|Sinow Zoa|Sinow Zele|Deldepth|Delbiter|Olga Flow',
    Tower: 'Ill Gill|Del Lily|Epsilon',
  },
  'Episode 4': {
    Crater: 'Boota|Ze Boota|Ba Boota|Astark|Dorphon|Dorphon Eclair',
    'Crater / Subterranean Desert': 'Sand Rappy|Del Rappy|Satellite Lizard|Yowie|Zu|Pazuzu',
    'Subterranean Desert': 'Goran|Pyro Goran|Goran Detonator|Merissa A|Merissa AA|Girtablulu|Saint Million|Shambertin|Kondrieu',
  },
};

test('all BB rows render under reviewed areas in every language and difficulty', () => {
  for (const lang of ['en', 'ja', 'zh']) for (const diff of ['Normal', 'Hard', 'Very Hard', 'Ultimate']) {
    const app = viewer('bb', `?lang=${lang}&diff=${diff}`);
    const expected = [];
    for (const [ep, rows] of Object.entries(app.window.DROP_DATA_EN.data[diff].monsters)) {
      const areas = new Map(Object.entries(reviewedAreas[ep]).flatMap(([area, names]) => names.split('|').map(name => [name, area])));
      const visited = new Set();
      let previous;
      for (const row of rows) {
        const area = areas.get(row.name.split('/')[0]);
        assert.ok(area, `${ep}: ${row.name}`);
        if (area !== previous) {
          assert.ok(!visited.has(area), `split area: ${ep}/${area}`);
          visited.add(area);
          previous = area;
        }
        expected.push(area);
      }
    }
    const actual = [];
    let area;
    for (const match of app.html().matchAll(/class="area-label">([^<]+)<|class="mob-name">/g)) {
      if (match[1]) area = match[1];
      else actual.push(area);
    }
    assert.deepEqual(actual, expected);
  }
});

test('every version and difficulty resolves each monster without inheriting the previous area', () => {
  const context = vm.createContext({window: {}});
  const source = fs.readFileSync(path.join(root, 'shared/viewer.js'), 'utf8');
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.testAreaFor = areaFor; })();'), context);
  for (const version of ['bb', 'dc', 'ngc']) {
    vm.runInContext(fs.readFileSync(path.join(upstream, version, 'data/en.js'), 'utf8'), context);
    for (const [diff, types] of Object.entries(context.window.DROP_DATA_EN.data)) {
      for (const [ep, rows] of Object.entries(types.monsters)) {
        const visited = new Set();
        let previous;
        for (const row of rows) {
          const area = context.window.testAreaFor(ep, row.name);
          assert.ok(area, `${version}/${diff}/${ep}: ${row.name}`);
          if (area !== previous) {
            assert.ok(!visited.has(area), `${version}/${diff}/${ep}: repeated ${area}`);
            visited.add(area);
            previous = area;
          }
        }
      }
    }
  }
  assert.equal(context.window.testAreaFor('Episode 2', 'Recon'), 'Seabed');
  assert.equal(context.window.testAreaFor('Episode 1', 'Dark Falz?'), 'Ruins');
  assert.equal(context.window.testAreaFor('Episode 2', 'Olga Flow?'), 'Seabed');
  assert.equal(context.window.testAreaFor('Episode 2', 'Hildelt'), 'VR Temple');
});

test('BB banner colors and localized Hit conditions follow drop metadata', () => {
  for (const lang of ['en', 'ja', 'zh']) {
    const app = viewer('bb', `?lang=${lang}&diff=Ultimate`);
    const html = app.html();
    assert.doesNotMatch(html, /bannerHitHint|bannerNoHitHint|bannerRainbow|bannerGold|bannerRules|drop-legend/);
    const hintPrefix = {en: 'Banner requirement:', ja: '全体告知条件：', zh: '公告条件：'}[lang];
    assert.ok(html.includes('title="' + hintPrefix));
    const allDrops = Object.values(app.window.DROP_DATA_EN.data.Ultimate.monsters)
      .flatMap(rows => rows.flatMap(row => row.drops.flatMap(cell => cell.items || [cell])));
    assert.equal([...html.matchAll(/class="item-name banner-hit-item"/g)].length, allDrops.filter(d => d.bannerHit).length);
    assert.equal([...html.matchAll(/class="item-name ss-rare-item"/g)].length, allDrops.filter(d => d.ss).length);
    const gold = [...html.matchAll(/<a class="item-name banner-hit-item"[^>]+>/g)].map(m => m[0]);
    assert.ok(gold.length > 0);
    assert.ok(gold.every(tag => tag.includes('title="') && tag.includes('aria-label="')));
    assert.ok(gold.some(tag => tag.includes('frozen-shooter.html') && tag.includes('≥ 30%')));
    assert.ok(gold.some(tag => tag.includes('spread-needle.html') && tag.includes('≥ 40%')));
    assert.ok(!html.includes('ss-rare-item banner-hit-item'));
    app.window._viewer.setType('boxes');
    assert.doesNotMatch(app.html(), /banner-hit-item/);
  }
  for (const version of ['dc', 'ngc']) {
    const app = viewer(version, '?diff=Ultimate');
    assert.doesNotMatch(app.html(), /banner-hit-item|drop-legend|wiki\.pioneer2\.net\/w\/Banners/);
    assert.match(app.html(), /ss-rare-item/);
  }
});
test('DC and GameCube percentages are shortened to three significant digits', () => {
  const ngc = viewer('ngc', '?diff=Ultimate').html();
  // Only percentage-shaped source values are reformatted; malformed source text is left visible.
  const rates = [...ngc.matchAll(/class="drop-rate( has-rdr)?"[^>]*>([^<]*%)</g)].map(match => match[match.length - 1]);
  assert.ok(rates.length > 0);
  for (const rate of rates) assert.ok(rate.replace(/[<>%]/g, '').replace(/^0\.0*/, '').replace('.', '').length <= 3, rate);
  assert.ok(rates.includes('0.00992%'));
  assert.ok(rates.includes('1.56%'));
  const dc = viewer('dc', '?diff=Ultimate').html();
  assert.match(dc, />0\.000119%</);
});
test('Section ID headers show the canonical icon beside each localized name', () => {
  const canonical = ['Viridia', 'Greenill', 'Skyly', 'Bluefull', 'Purplenum', 'Pinkal', 'Redria', 'Oran', 'Yellowboze', 'Whitill'];
  for (const version of ['bb', 'dc', 'ngc']) for (const lang of ['en', 'ja', 'zh']) {
    const app = viewer(version, `?lang=${lang}`);
    const header = app.html().match(/<thead>.*?<\/thead>/)[0];
    const icons = [...header.matchAll(/section-ids\/([A-Za-z]+)\.png/g)].map(match => match[1]);
    assert.deepEqual(icons, canonical, `${version}/${lang}`);
    const labels = [...header.matchAll(/height="22">([^<]+)<\/span>/g)].map(match => match[1]);
    assert.deepEqual(labels, [...app.window[`DROP_DATA_${lang.toUpperCase()}`].sectionIds], `${version}/${lang}`);
  }
  for (const name of canonical) assert.ok(fs.existsSync(path.join(root, 'shared/images/section-ids', `${name}.png`)));
});
test('empty drop cells keep the full Section ID background and fade only the dash', () => {
  const html = viewer('ngc', '?lang=zh').html();
  const empty = html.match(/<td class="drop-cell empty" style="([^"]*)">(.*?)<\/td>/);
  assert.ok(empty);
  assert.match(empty[1], /^background-color:#[0-9A-F]{6};color:#(000|fff)$/);
  assert.equal(empty[2], '<span class="empty-mark">—</span>');
  const css = fs.readFileSync(path.join(root, 'shared/style.css'), 'utf8');
  for (const rule of css.matchAll(/([^{}]*\.drop-cell[^{}]*)\{([^}]*)\}/g)) {
    if (/opacity/.test(rule[2])) assert.doesNotMatch(rule[1], /\.drop-cell(\.empty)?\s*$/, rule[1]);
  }
});
