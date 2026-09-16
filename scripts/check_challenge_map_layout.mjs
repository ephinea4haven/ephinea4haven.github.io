// Check measured-map captions in all published languages.
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const problems=[];
const files=[];
for (const episode of ['ep1','ep2']) {
 const content=JSON.parse(await readFile(`content/challenge-maps/${episode}.json`,'utf8'));
 for (const [area,data] of Object.entries(content.areas)) for (const lang of ['zh','en','ja']) {
  const stem=episode==='ep1'?`area_${area.padStart(2,'0')}`:`c${data.stage}_area_${area.padStart(2,'0')}`;
  files.push(`assets/img/challenge/${episode}/maps/${lang}/${stem}.svg`);
 }
}
for (const file of files) {
 await page.setContent('<body style="margin:0">'+(await readFile(file,'utf8')).replace('<svg ', '<svg width="1000" ')+'</body>');
 const found=await page.evaluate(()=>{
  const errors=[],svg=document.querySelector('svg'),v=svg.viewBox.baseVal;
  const boxes=[...svg.querySelectorAll('[data-callout-box]')];
  const b=r=>({x:+r.getAttribute('x'),y:+r.getAttribute('y'),w:+r.getAttribute('width'),h:+r.getAttribute('height')});
  for(const [i,r] of boxes.entries()) {
   const a=b(r),id=r.parentNode.dataset.callout;
   for(const q of boxes.slice(i+1)) {const c=b(q);if(a.x<c.x+c.w&&c.x<a.x+a.w&&a.y<c.y+c.h&&c.y<a.y+a.h)errors.push(`box overlap ${id} / ${q.parentNode.dataset.callout}`)}
   for(const t of r.parentNode.querySelectorAll('text')){const tbox=t.getBBox();if(tbox.x<a.x||tbox.x+tbox.width>a.x+a.w+1||tbox.y<a.y||tbox.y+tbox.height>a.y+a.h+1)errors.push(`caption overflow ${id}`)}
   const floor=svg.querySelector('[id$="-floor"] > path');
   const inverse=floor.getCTM().inverse();
   let touches=false;
   for(let x=a.x+2;x<a.x+a.w-2;x+=5)for(let y=a.y+2;y<a.y+a.h-2;y+=5){if(floor.isPointInFill(new DOMPoint(x,y).matrixTransform(inverse)))touches=true;}
   if(touches)errors.push(`caption covers floor ${id}`);
  }
  for(const t of svg.querySelectorAll('text')){const r=t.getBBox(),m=t.getCTM();const corners=[[r.x,r.y],[r.x+r.width,r.y+r.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));if(corners.some(p=>p.x<-1||p.x>v.width+1||p.y<-1||p.y>v.height+1))errors.push(`text outside canvas ${t.textContent}`)}
  return errors;
 });
 problems.push(...found.map(e=>`${file}: ${e}`));
}
await browser.close();console.log(JSON.stringify(problems,null,2));process.exitCode=problems.length?1:0;
