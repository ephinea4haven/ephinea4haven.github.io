import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogLanguageComponent } from '../item-catalog/catalog-language.component';
import { MonsterLanguageService } from './monster-language.service';
import { DIFFICULTIES, METADATA, MONSTERS, MONSTER_BY_ID, MechanicTable, Monster, REGION_OF, monsterPath, normalize } from './monster';
import { MonsterResult } from './monster-detail.routes';
import { MonsterImageComponent } from './monster-image.component';
type PortraitSource='render'|`render-${number}`|'hd'|'wiki';

@Component({
  selector:'haven-monster-catalog',imports:[RouterLink,CatalogLanguageComponent,MonsterImageComponent],providers:[MonsterLanguageService],
  templateUrl:'./monster-catalog.component.html',styleUrl:'./monster-catalog.component.css',changeDetection:ChangeDetectionStrategy.OnPush,
})
export class MonsterCatalogComponent {
  readonly i18n=inject(MonsterLanguageService);
  private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);private readonly document=inject(DOCUMENT);private readonly title=inject(Title);
  private readonly params=toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
  private readonly data=toSignal(this.route.data,{initialValue:this.route.snapshot.data});
  private readonly fragment=toSignal(this.route.fragment,{initialValue:this.route.snapshot.fragment});
  readonly result=computed(()=>this.data()['result'] as MonsterResult|undefined);
  readonly detail=computed(()=>this.result()?.detail);
  readonly monster=computed(()=>this.detail() ? MONSTER_BY_ID.get(this.detail()!.id)! : null);
  readonly difficulty=computed(()=>DIFFICULTIES.some(d=>d.id===this.params().get('diff')) ? this.params().get('diff')! : 'n');
  readonly hdImage=computed(()=>this.difficulty()==='u' ? this.detail()?.ultimateHdImage : this.detail()?.hdImage);
  readonly renderImage=computed(()=>this.difficulty()==='u' ? this.detail()?.ultimateRenderImage : this.detail()?.renderImage);
  // Portrait sources in order of preference: model render, HD gallery. The Wiki screenshot is
  // offered only when neither exists, as the sole portrait.
  readonly portraitSources=computed(()=>{
    const m=this.monster();
    const alternates=(this.detail()?.renderAlternates ?? []).map((alternate,index)=>[`render-${index}`,alternate.image] as const);
    const candidates:(readonly [PortraitSource,string|null|undefined])[]=[['render',this.renderImage()],...alternates,['hd',this.hdImage()]];
    const sources=candidates.filter((source):source is readonly [PortraitSource,string]=>!!source[1]);
    const wiki=m ? this.image(m) : null;
    return sources.length || !wiki ? sources : [['wiki',wiki] as const];
  });
  readonly imageMode=linkedSignal({
    source:computed(()=>`${this.monster()?.id}:${this.difficulty()==='u' ? 'ultimate':'normal'}`),
    computation:(): PortraitSource=>'render',
  });
  readonly portraitSource=computed(()=>this.portraitSources().find(([mode])=>mode===this.imageMode()) ?? this.portraitSources()[0]);
  readonly portraitImage=computed(()=>this.portraitSource()?.[1] ?? null);
  readonly mode=computed(()=>this.params().get('mode')==='off' ? 'off':'on');
  readonly context=computed(()=>`${this.difficulty()}-${this.mode()}`);
  readonly query=computed(()=>Object.fromEntries([...this.params().keys.map(k=>[k,this.params().get(k)]),['ep',this.episode()]]));
  readonly q=computed(()=>this.params().get('q') || '');
  readonly episode=computed(()=>['1','2','4'].includes(this.params().get('ep')||'') ? this.params().get('ep')! : String(this.monster()?.episode ?? 1));
  // Browsing shows one region, the episode's first by default; a search covers the whole episode.
  readonly area=computed(()=>this.areas().includes(this.params().get('area')||'') ? this.params().get('area')! : this.areas()[0]);
  readonly kind=computed(()=>['rare','boss','part','regular'].includes(this.params().get('kind')||'') ? this.params().get('kind')! : '');
  readonly sort=computed(()=>this.params().get('sort')==='hp'?'hp':'');
  readonly areas=computed(()=>[...new Set(MONSTERS.filter(m=>m.episode===Number(this.episode())).flatMap(m=>m.areas.map(a=>REGION_OF.get(a)!)))]);
  readonly filtered=computed(()=>{
    const q=normalize(this.q()); const kind=this.kind();
    const list=MONSTERS.filter(m=>(m.episode===Number(this.episode())) && (!!q || m.areas.some(a=>REGION_OF.get(a)===this.area())) && (!kind || (kind==='regular' ? !m.rare&&!m.boss&&!m.part : m[kind as 'rare'|'boss'|'part'])) && (!q || normalize([...Object.values(m.names),...Object.values(m.ultimateNames),...m.areas.flatMap(a=>[a,this.i18n.area(a,'zh'),this.i18n.area(a,'ja')])].join(' ')).includes(q)));
    return this.sort()==='hp' ? list.sort((a,b)=>(b.values[this.context()]?.[0]??-1)-(a.values[this.context()]?.[0]??-1)) : list;
  });
  readonly pages=computed(()=>Math.max(1,Math.ceil(this.filtered().length/24)));
  readonly page=computed(()=>Math.min(this.pages(),Math.max(1,Number.parseInt(this.params().get('page')||'1',10)||1)));
  readonly visible=computed(()=>this.filtered().slice((this.page()-1)*24,this.page()*24));
  readonly stats=computed(()=>this.detail()?.stats[this.context()]);
  readonly drops=computed(()=>this.detail()?.drops[this.difficulty()]);
  readonly tables=computed(()=>this.detail()?.tables.filter(t=>{
    const difficulty=this.difficulties.find(d=>d.id===this.difficulty())!.label;
    const mode=this.mode()==='on'?'Normal':'One Person';
    if(t.difficulties.length && !t.difficulties.includes(difficulty)) return false;
    if(t.axis==='difficulty-mode') return t.context[0]===difficulty && t.context[1]===mode;
    if(t.axis==='difficulty') return t.context[0]===difficulty;
    if(t.axis==='mode') return t.context[0]===mode;
    return true;
  }) || []);
  private readonly sourceLabels={render:'模型渲染',hd:'高清图片'} as const;
  private readonly sourceCaptions={render:'图片来源：原始模型渲染',hd:'图片来源：高清图库',wiki:'图片来源：Ephinea Wiki'} as const;
  sourceLabel(source:PortraitSource):string {
    const alternate=source.startsWith('render-') ? this.detail()?.renderAlternates[Number(source.slice(7))] : undefined;
    return alternate ? alternate.label[this.i18n.language()] : this.i18n.t(this.sourceLabels[source as 'render'|'hd']);
  }
  sourceCaption(source:PortraitSource):string {return this.i18n.t(this.sourceCaptions[source.startsWith('render') ? 'render' : source as 'hd'|'wiki']);}
  readonly count=MONSTERS.length;readonly metadata=METADATA;readonly difficulties=DIFFICULTIES;readonly path=monsterPath;
  readonly statLabels=['生命值','攻击力','防御力','精神力','命中','回避','运气','火抗性','冰抗性','雷抗性','暗抗性','光抗性','异常抗性','经验','DAR','普通掉落类型'];
  readonly sectionLabels=['深绿','黄绿','天蓝','蓝','紫','粉','红','橙','黄','白'];
  name(m:Monster):string {return this.i18n.name(this.difficulty()==='u'?m.ultimateNames:m.names);}
  image(m:Monster):string|null {return this.difficulty()==='u'?m.ultimateImage:m.image;}
  thumbnail(m:Monster):string|null {return (this.difficulty()==='u'?m.ultimateThumbnail:m.thumbnail) ?? this.image(m);}
  tableContext(table:MechanicTable):string {
    const mode=this.i18n.t(table.context.at(-1)==='Normal'?'多人模式':'单人模式');
    return table.axis==='difficulty-mode' ? `${table.context[0]} / ${mode}` : table.axis==='mode' ? mode : table.context.join(' / ');
  }
  update(key:string,value:string):void {
    void this.router.navigate([],{relativeTo:this.route,queryParams:{[key]:value||null,...(key==='page'||this.result()?{}:{page:null}),...(key==='ep'?{area:null}:{})},queryParamsHandling:'merge',preserveFragment:true,replaceUrl:true}).then(navigated=>{
      // Paging returns to the results heading, whose previous / next buttons stay in reach.
      if(navigated && key==='page') this.document.getElementById('monster-results-heading')?.scrollIntoView({behavior:'instant',block:'start'});
    });
  }
  clear():void {void this.router.navigate([],{relativeTo:this.route,queryParams:{ep:this.episode(),diff:this.difficulty(),mode:this.mode()},replaceUrl:true});}
  retry():void {this.document.defaultView?.location.reload();}
  constructor(){
    effect(()=>this.title.setTitle(`${this.monster()?this.name(this.monster()!)+' | ':''}${this.i18n.t('怪物图鉴')} · Ephinea PSOBB`));
    afterRenderEffect(()=>{
      if(!this.monster()) return;
      const fragment=this.fragment();
      if(fragment) this.document.getElementById(fragment)?.scrollIntoView({behavior:'instant'});
      else this.document.defaultView?.scrollTo({top:0,behavior:'instant'});
    });
  }
}
