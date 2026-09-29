const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sectionIds = ['Viridia', 'Greenill', 'Skyly', 'Bluefull', 'Purplenum',
  'Pinkal', 'Redria', 'Oran', 'Yellowboze', 'Whitill'];
const sectionColors = ['#00A562', '#76FE43', '#59F9F9', '#4488FF', '#CC00FF',
  '#FF87CB', '#F70F0F', '#F7830F', '#F7F715', '#FFFFFF'];

function fixture() {
  const data = {};
  for (const difficulty of ['Normal', 'Hard', 'Very Hard', 'Ultimate']) {
    data[difficulty] = {monsters: {}};
    for (const episode of ['Episode 1', 'Episode 2', 'Episode 4']) {
      data[difficulty].monsters[episode] = [{
        name: 'Booma',
        dropRate: episode === 'Episode 4' ? '???' : '0%',
        drops: [
          {item: 'Test Sword', rate: null},
          {item: 'Test Shield', rate: '1/100'},
          {item: 'Test Unit', rate: '1/???'},
          ...Array.from({length: 7}, () => ({item: null, rate: null}))
        ]
      }];
    }
  }
  return {sectionIds, sectionColors, data};
}

function viewer(query = '', version = 'destiny', data = fixture(),
  mapping = version === 'destiny' ? {'Test Shield': 'destiny-shield.png'} : {'Test Sword': 'stock.png'},
  coverage = {items: [{name: 'Test Shield', explanation: 'Model preview · candidate identity'}]}) {
  const nodes = new Map();
  const element = () => ({innerHTML: '', value: '', children: [], dataset: {},
    style: {setProperty() {}}, appendChild(child) {this.children.push(child);}});
  const document = {documentElement: {}, body: element(), addEventListener() {},
    createElement: element, querySelectorAll() {return [];},
    getElementById(id) {if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id);}};
  const window = {DROP_DATA_EN: data, location: new URL('https://example.com/' + version + '/' + query), addEventListener() {}};
  window.history = {replaceState(_state, _title, url) {window.location = new URL(url);}};
  const requests = [];
  const context = vm.createContext({window, document, URL, URLSearchParams,
    XMLHttpRequest: class {
      open(_method, url) {this.url = url;}
      send() {
        requests.push(this.url);
        this.status = mapping === null ? 404 : 200;
        this.responseText = JSON.stringify(this.url === 'images/coverage.json' ? coverage : mapping);
        if (this.onload) this.onload();
      }
    }});
  for (const file of ['shared/i18n.js', 'shared/viewer.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  window.initViewer({version, languages: ['en'],
    episodes: ['Episode 1', 'Episode 2', 'Episode 4'], hasTypes: false,
    rateFormat: 'fraction', hasRateToggle: true});
  return {window, document, nodes, requests, html: () => document.getElementById('content').innerHTML};
}

test('Destiny renders missing rates and zero DAR without Ephinea links', () => {
  const app = viewer();
  assert.equal(app.document.title, 'Destiny PSOBB Drop Charts');
  assert.equal((app.html().match(/DAR 0%/g) || []).length, 2);
  assert.equal((app.html().match(/Rate unavailable/g) || []).length, 7);
  assert.doesNotMatch(app.html(), /NaN|Infinity/);
  assert.match(app.html(), /Test Shield/);
  assert.match(app.html(), /1\.00%/);
  assert.doesNotMatch(app.html(), /psohaven\.com\/data\/(items|enemies)/);
  assert.equal(app.nodes.get('typeGroup').style.display, 'none');
});

test('Destiny episode, difficulty, search, and rate controls work together', () => {
  const app = viewer('?diff=Ultimate&ep=Episode%202&rate=fraction');
  assert.equal((app.html().match(/class="episode-title"/g) || []).length, 1);
  assert.match(app.html(), /1\/100/);
  assert.doesNotMatch(app.html(), /NaN|Infinity/);
  app.window._viewer.setRateFormat('percent');
  assert.match(app.html(), /1\.00%/);
  app.document.getElementById('searchBox').value = 'Test Sword';
  app.window.onSearch();
  assert.match(app.html(), /class="drop-option highlight"/);
  app.document.getElementById('searchBox').value = 'missing';
  app.window.onSearch();
  assert.match(app.html(), /No results/);
  assert.equal(app.window.location.searchParams.get('diff'), 'Ultimate');
  assert.equal(app.window.location.searchParams.get('ep'), 'Episode 2');
});

test('Destiny uses only its own explicit image mapping', () => {
  const destiny = viewer();
  assert.deepEqual(destiny.requests, ['images/mapping.json', 'images/coverage.json']);
  assert.match(destiny.html(), /Candidate image identity; inspect image gallery/);
  assert.match(destiny.html(), /item-tooltip-img" src="images\/destiny-shield\.png/);
  assert.doesNotMatch(destiny.html(), /stock\.png|\.\.\/shared\/images\/destiny-shield/);
  assert.equal((destiny.html().match(/item-tooltip-img/g) || []).length, 3);

  const unmapped = viewer('', 'destiny', fixture(), null);
  assert.deepEqual(unmapped.requests, ['images/mapping.json']);
  assert.doesNotMatch(unmapped.html(), /item-tooltip-img/);

  const gameCube = viewer('', 'ngc');
  assert.deepEqual(gameCube.requests, ['../shared/images/mapping.json']);
  assert.match(gameCube.html(), /item-tooltip-img.*stock\.png/);
});

test('unmapped Destiny monsters get an explicit area boundary in source order', () => {
  const data = fixture();
  const custom = {...data.data.Normal.monsters['Episode 1'][0], name: 'Custom Destiny Monster'};
  data.data.Normal.monsters['Episode 1'].push(custom, {...custom, name: 'Gobooma'});
  const app = viewer('?ep=Episode%201', 'destiny', data);
  const html = app.html();
  assert.ok(html.indexOf('Booma') < html.indexOf('Custom Destiny Monster'));
  assert.ok(html.indexOf('Custom Destiny Monster') < html.indexOf('Gobooma'));
  assert.match(html, /Forest[\s\S]*Booma[\s\S]*Area not specified[\s\S]*Custom Destiny Monster[\s\S]*Forest[\s\S]*Gobooma/);
});


test('Destiny category artwork and ambiguous variants remain explicit', () => {
  const app = viewer('', 'destiny', fixture(), {'Test Unit': 'box.png'}, {items: [
    {name:'Test Unit', explanation:'Shared category image · unit', variants:[]},
    {name:'Test Sword', explanation:'Distinct variants', variants:[{code:'000001',image:'one.png'},{code:'000002',image:'two.png'}]}
  ]});
  assert.match(app.html(), /Shared category image/);
  assert.match(app.html(), /data-caption="Shared category image · unit"/);
  assert.match(app.html(), /Distinct item variants/);
  assert.match(app.html(), /src="images\/one.png" data-caption="Variant 000001"/);
  assert.match(app.html(), /src="images\/two.png" data-caption="Variant 000002"/);
});
