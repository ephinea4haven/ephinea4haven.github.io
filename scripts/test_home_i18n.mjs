import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {localizeHome} from './home_i18n.mjs';
const fixture=body=>`<!DOCTYPE html><html><head><title>标题</title><meta name="description" content="说明"></head><body><div id="home-language"></div>${body}</body></html>`;
const messages={'标题':{en:'Title',ja:'タイトル'},'说明':{en:'Description',ja:'説明'},'链接':{en:'Link',ja:'リンク'},'导航':{en:'Navigation',ja:'ナビゲーション'}};
const nodes=html=>{const result=[];const walk=n=>{result.push(n);for(const c of n.childNodes||[])walk(c);};walk(parse(html));return result;};
test('homepage localization preserves icons, links, spaces and prelocalized item names',()=>{
 const output=localizeHome(fixture('<a href="/target" aria-label="导航"><svg><path d="M0 0"></path></svg> 链接 <b>↗</b></a><span data-home-i18n data-en="Galatine">词典名称</span>'),messages);
 assert.match(output,/<svg><path d="M0 0"><\/path><\/svg> <span data-home-i18n/);
 assert.match(output,/href="\/target"/);assert.match(output,/data-home-aria-label-en="Navigation"/);
 assert.match(output,/data-title-ja="タイトル"/);assert.match(output,/data-description-en="Description"/);
 assert.equal(nodes(output).filter(n=>n.attrs?.some(a=>a.name==='data-home-i18n')).length,2);
 assert.match(output,/>词典名称<\/span>/);
});
test('untranslated homepage content fails the build even inside hidden event panels',()=>{
 assert.throws(()=>localizeHome(fixture('<section hidden>新增活动</section>'),messages),/Missing homepage translation: 新增活动/);
 assert.throws(()=>localizeHome(fixture('<nav aria-label="新增导航"></nav>'),messages),/Missing homepage translation: 新增导航/);
 assert.throws(()=>localizeHome(fixture('链接'),{...messages,'链接':{en:'Link'}}),/Missing homepage translation: 链接/);
});
