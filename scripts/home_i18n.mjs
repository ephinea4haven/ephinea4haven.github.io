import { parse, serialize } from 'parse5';

// Annotate individual text nodes so translating a label preserves its icons,
// links and emphasis. Missing translations fail the build, including hidden events.
export function localizeHome(source, messages) {
  const document = parse(source);
  const translations = zh => {
    const entry = messages[zh];
    if (!entry?.en || !entry?.ja) throw new Error(`Missing homepage translation: ${zh}`);
    return {zh,...entry};
  };
  let title, description, language;
  const attrs = node => Object.fromEntries((node.attrs || []).map(a=>[a.name,a.value]));
  const scan = node => {
    const attributes = attrs(node);
    if(node.tagName==='title') title=translations(node.childNodes[0].value);
    if(node.tagName==='meta' && attributes.name==='description') description=translations(attributes.content);
    if(attributes.id==='home-language') language=node;
    for(const child of node.childNodes || []) scan(child);
  };
  scan(document);
  if(!language || !title || !description) throw new Error('Missing homepage language controls or metadata');
  for(const [key,values] of Object.entries({title,description})) for(const [lang,value] of Object.entries(values)) language.attrs.push({name:`data-${key}-${lang}`,value});
  const walk = node => {
    const attributes=attrs(node);
    if(attributes.id==='home-language' || 'data-home-i18n' in attributes || 'data-home-live' in attributes) return;
    for(const attribute of node.attrs || []) if(['aria-label','title','alt'].includes(attribute.name) && /[\u3400-\u9fff]/.test(attribute.value)) {
      for(const [lang,value] of Object.entries(translations(attribute.value))) node.attrs.push({name:`data-home-${attribute.name}-${lang}`,value});
    }
    node.childNodes=(node.childNodes || []).flatMap(child=>{
      if(child.nodeName==='#text' && /[\u3400-\u9fff]/.test(child.value)) {
        const zh=child.value.trim();const values=translations(zh);
        const span={nodeName:'span',tagName:'span',namespaceURI:'http://www.w3.org/1999/xhtml',attrs:[{name:'data-home-i18n',value:''},...Object.entries(values).map(([lang,value])=>({name:`data-${lang}`,value}))],parentNode:node,childNodes:[]};
        const lead=child.value.match(/^\s*/)[0],tail=child.value.match(/\s*$/)[0];
        span.childNodes=[{nodeName:'#text',value:zh,parentNode:span}];
        return [{nodeName:'#text',value:lead,parentNode:node},span,{nodeName:'#text',value:tail,parentNode:node}];
      }
      walk(child);return [child];
    });
  };
  const body=document.childNodes.find(n=>n.tagName==='html').childNodes.find(n=>n.tagName==='body');
  walk(body);
  return serialize(document);
}
