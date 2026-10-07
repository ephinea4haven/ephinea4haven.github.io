import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { generateEp3CardCatalog, cardRoutes, cardAliases } from './generate_ep3_card_catalog.mjs';
import { devRoutes } from './dev_inputs.mjs';
import { searchDocument, searchRoutes } from './build_search.mjs';
import { cardList, cardColumns, cardTypes, cardRanks, formatStat, filterCards, changedEffectSlots, formatRawDifference } from '../src/app/ep3-card-catalog/card.ts';
import { messages } from '../src/app/ep3-card-catalog/ep3-card.messages.ts';
const { index, details }=generateEp3CardCatalog();
const source=JSON.parse(fs.readFileSync('content/ep3-card-catalog/cards.json','utf8'));
test('lightweight index, individual details and artwork preserve the complete source',()=>{
  assert.equal(index.length,700);assert.equal(index.filter(c=>!c.hidden).length,662);
  assert.deepEqual(index.map(c=>c.id),source.cards.map(c=>c.id));
  assert.deepEqual(fs.readdirSync('assets/data/ep3-cards').sort(),index.map(c=>`${c.id}.json`).sort());
  for(const card of source.cards){
    assert.deepEqual(details[card.id],card);
    assert.deepEqual(JSON.parse(fs.readFileSync(`assets/data/ep3-cards/${card.id}.json`)),card);
    const summary=index.find(c=>c.id===card.id);
    assert.ok(!('text' in summary) && !('diff' in summary) && !('images' in summary));
    assert.equal(summary.thumbnail,card.images?.medium.path ?? null);
    if(card.images?.large) assert.equal(card.images.large.width,512);
  }
  assert.equal(Object.values(details).filter(c=>c.diff.length).length,66);
  assert.deepEqual(Object.values(details).filter(c=>c.diff.some(d=>d.field==='effects')).map(c=>c.id),[74,239,365,481,686,695,704,710]);
});
test('stat kinds preserve signs, blank and unknown values without numeric coercion',()=>{
  for(const [kind,prefix] of [['value',''],['plus','+'],['minus','−'],['equals','=']]) {
    assert.equal(formatStat({kind,value:0}),prefix+'0');
    assert.equal(formatStat({kind,value:3}),prefix+'3');
    assert.equal(formatStat({kind,value:null}),prefix+'?');
  }
  assert.equal(formatStat({kind:'blank',value:0}),'');
  assert.equal(formatStat(details[1].hp),'+0');assert.equal(formatStat(details[1].diff[0].disc),'−3');
});
test('filters compose, search every name independently of language, and keep hidden cards opt-in',()=>{
  const defaults={type:'',class:'',rank:'',q:'',all:false};
  assert.equal(filterCards(index,defaults).length,662);
  assert.equal(filterCards(index,{...defaults,all:true}).length,700);
  for(const [q,bossId,playerId] of [['Castor',668,702],['Pollux',669,703]]) {
    assert.deepEqual(filterCards(index,{...defaults,q}).map(c=>c.id),[bossId]);
    assert.deepEqual(filterCards(index,{...defaults,q,all:true}).map(c=>c.id),[bossId,playerId]);
  }
  for(let id=716;id<=739;id++) {
    assert.ok(filterCards(index,defaults).some(c=>c.id===id));
    assert.equal(details[id].images,undefined);
  }
  for(const q of ["Hildebear's Cane+",'ヒルデベアケイン＋','BEARS CANE +']) assert.ok(filterCards(index,{...defaults,q}).some(c=>c.id===29),q);
  assert.equal(filterCards(index,{...defaults,q:'???'}).length,0);
  assert.equal(filterCards(index,{...defaults,q:'???',all:true}).length,24);
  for(const card of index) assert.ok(filterCards(index,{...defaults,type:card.type,class:card.class,rank:card.rank,all:true}).includes(card));
  assert.equal(filterCards(index,{...defaults,type:'ITEM',class:'HU_SC'}).length,0);
  assert.equal(filterCards(index,{...defaults,q:'no-such-card'}).length,0);
});
test('all 3 list and 2100 detail routes are registered for prerender and development search',async()=>{
  const routes=cardRoutes(index),registered=await devRoutes(path.resolve('.'));
  assert.equal(routes.length,2103);assert.equal(new Set(routes).size,2103);
  assert.equal(routes.filter(r=>r.endsWith('/ep3-cards.html')).length,3);
  for(const route of routes) assert.ok(registered.includes(route),route);
  assert.deepEqual(searchRoutes(routes).sort(),routes.sort());
});
test('search documents carry English, Japanese and table aliases in all editions',()=>{
  for(const card of index) for(const prefix of ['', '/en', '/ja']) {
    const url=`${prefix}/data/ep3-cards/${card.id}.html`;
    const html=searchDocument(`<html><body><h1>Card ${card.id}</h1></body></html>`,url,cardAliases(card));
    for(const alias of cardAliases(card)) assert.ok(html.includes(alias.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')),`${url}: ${alias}`);
  }
  const template=fs.readFileSync('src/app/ep3-card-catalog/ep3-card-catalog.component.html','utf8');
  assert.ok(!template.includes('data-pagefind-body'), 'catalog must use the shared indexing body so appended aliases are indexed');
  const builder=fs.readFileSync('scripts/build_search.mjs','utf8');
  assert.match(builder,/aliases.set\(`\/data\/ep3-cards\/\$\{card.id\}.html`, cardAliases\(card\)\)/);
});
test('Chinese labels come only from the maintainer-approved terminology; all used enums have labels',()=>{
  const doc=fs.readFileSync('docs/EP3_CARD_CATALOG.md','utf8').split('## Chinese terminology')[1].split('## Tests')[0];
  const approved=doc.split('\n').filter(line=>line.startsWith('|')&&line.includes('已确认')).map(line=>line.split('|')[3].trim());
  const expanded=approved.flatMap(term=>term.includes('／')?term.split('／'):[]);
  // The confirmed paired right/top label shares its suffix.
  expanded.push('右侧连接颜色');
  for(const [key,values] of Object.entries(messages)) {
    assert.equal(values.length,3,key);
    if(/[\u3400-\u9fff]/.test(values[0])) assert.ok(approved.includes(values[0])||expanded.includes(values[0]),`${key}: ${values[0]}`);
  }
  for(const card of source.cards) for(const key of [card.type,card.class,card.targetMode]) assert.ok(messages[key],key);
});

test('confirmed Chinese utility and error labels never fall back to English',()=>{
  const expected={home:'返回主页',failed:'资料暂时无法加载',retry:'返回并重试',notFound:'未找到卡牌',missing:'暂无卡图',origin:'使用者 · 朝向 ↑'};
  for(const [key,value] of Object.entries(expected)) assert.equal(messages[key][0],value);
});

test('all eight effect diffs expose only changed slots with six fields and exact change flags',()=>{
  const expected={74:[3],239:[3],365:[2],481:[2],686:[1],695:[2],704:[1],710:[1]};
  for(const card of source.cards) {
    for(const diff of card.diff) {
      if(diff.field==='effects') {
        const slots=changedEffectSlots(diff.online,diff.disc);
        assert.deepEqual(slots.map(s=>s.slot),expected[card.id]);
        for(const slot of slots) {
          assert.deepEqual(slot.fields.slice(0,6).map(f=>f.field),['type','expr','when','arg1','arg2','arg3']);
          for(const field of slot.fields) {
            assert.equal(field.online,diff.online[slot.slot-1][field.field]);
            assert.equal(field.disc,diff.disc[slot.slot-1][field.field]);
            assert.equal(field.changed,field.online!==field.disc);
          }
        }
        if(card.id===365) assert.deepEqual(slots[0].fields.filter(f=>f.changed),[{field:'nameIndex',online:12,disc:0,changed:true}]);
        if(card.id===481) assert.deepEqual(slots[0].fields.filter(f=>f.changed),[{field:'expr',online:'d',disc:'d-1',changed:true}]);
      } else if(['right_colors','top_colors'].includes(diff.field)) {
        for(const value of [diff.online,diff.disc]) assert.equal(formatRawDifference(value),value.join(', '));
      }
    }
  }
});

test('game tabs, scoped classes and ordered ranks reflect hidden state',()=>{
  assert.deepEqual(cardList(index,{all:'1'}).counts.map(c=>c.count),[39,39,259,120,168,75]);
  assert.deepEqual(cardList(index,{}).counts.map(c=>c.count),[26,26,259,120,156,75]);
  for(const type of cardTypes) for(const all of ['','1']) {
    const state=cardList(index,{type,all});
    const category=index.filter(c=>c.type===type&&(all||!c.hidden));
    assert.deepEqual(state.classes.map(c=>c.value),[...new Set(category.map(c=>c.class))]);
    assert.equal(state.classes.reduce((sum,c)=>sum+c.count,0),category.length);
    assert.equal(state.class,state.classes[0].value);
    assert.deepEqual(state.ranks,cardRanks.filter(rank=>category.some(c=>c.rank===rank)));
    assert.ok(state.filtered.every(c=>c.class===state.class));
  }
  assert.equal(cardList(index,{}).type,'HUNTERS_SC');
  assert.equal(cardList(index,{type:'invalid',class:'invalid',rank:'invalid',sort:'invalid',page:'-5'}).page,1);
  assert.deepEqual(cardColumns('ITEM'),['cost','hp','ap','tp']);
  assert.deepEqual(cardColumns('CREATURE'),['cost','hp','ap','tp','mv']);
  assert.deepEqual(cardColumns('HUNTERS_SC'),['hp','ap','tp','mv']);
  assert.deepEqual(cardColumns('ARKZ_SC'),['hp','ap','tp','mv']);
  assert.deepEqual(cardColumns('ACTION'),['cost','target_mode']);
  assert.deepEqual(cardColumns('ASSIST'),['cost','duration']);
  for(const summary of index) for(const key of ['targetMode','assistTurns']) assert.equal(summary[key],details[summary.id][key]);
});
test('search crosses tabs and ignores class; rank, sort and page remain composable',()=>{
  const state=cardList(index,{q:'BEARS CANE +',class:'HU_SC'});
  assert.equal(state.type,'ITEM');assert.deepEqual(state.filtered.map(c=>c.id),[29]);
  assert.equal(state.counts.reduce((sum,c)=>sum+c.count,0),1);
  for(const type of cardTypes) {
    const state=cardList(index,{type,q:'a',class:'invalid',all:'1'});
    assert.deepEqual(state.filtered,index.filter(c=>c.type===type&&[c.names.en,c.names.ja,c.tableName.en].some(n=>n.toLowerCase().includes('a'))));
  }
  const ranked=cardList(index,{type:'ITEM',class:'SWORD_ITEM',rank:'N4',sort:'cost'});
  assert.ok(ranked.filtered.length);assert.ok(ranked.filtered.every(c=>c.rank==='N4'&&c.class==='SWORD_ITEM'));
  assert.deepEqual(ranked.filtered.map(c=>c.cost.self),ranked.filtered.map(c=>c.cost.self).sort((a,b)=>a-b));
  const second=cardList(index,{type:'ITEM',class:'SWORD_ITEM',page:'2'});
  assert.equal(second.page,2);assert.deepEqual(second.visible,second.filtered.slice(24,48));
  const base=index[0];const stats=[{kind:'blank',value:0},{kind:'value',value:null},{kind:'minus',value:3},{kind:'plus',value:2},{kind:'equals',value:0}];
  const fixtures=stats.map((stat,i)=>({...base,id:i+1,hp:stat,ap:stat}));
  for(const sort of ['hp','ap']) assert.deepEqual(cardList(fixtures,{sort}).filtered.map(c=>c.id),[4,5,3,1,2]);
});
