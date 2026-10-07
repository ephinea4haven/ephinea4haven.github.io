import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogLanguageComponent } from '../item-catalog/catalog-language.component';
import { MonsterImageComponent } from '../monster-catalog/monster-image.component';
import index from '../generated/ep3-card-catalog/index.json';
import { CardSummary, CardEffect, Stat, changedEffectSlots, formatRawDifference, cardPath, cardList, cardPageSize, cardColumns, cardSorts, formatStat } from './card';
import { CardResult } from './ep3-card-detail.routes';
import { Ep3CardLanguageService } from './ep3-card-language.service';
const cards=index as CardSummary[];
@Component({
  selector:'haven-ep3-card-catalog',imports:[RouterLink,CatalogLanguageComponent,MonsterImageComponent],providers:[Ep3CardLanguageService],
  templateUrl:'./ep3-card-catalog.component.html',styleUrl:'./ep3-card-catalog.component.css',changeDetection:ChangeDetectionStrategy.OnPush,
})
export class Ep3CardCatalogComponent {
  readonly i18n=inject(Ep3CardLanguageService);
  private readonly route=inject(ActivatedRoute); private readonly router=inject(Router);
  private readonly document=inject(DOCUMENT); private readonly title=inject(Title);
  private readonly params=toSignal(this.route.queryParamMap,{initialValue:this.route.snapshot.queryParamMap});
  private readonly data=toSignal(this.route.data,{initialValue:this.route.snapshot.data});
  readonly result=computed(()=>this.data()['result'] as CardResult|undefined);
  readonly detail=computed(()=>this.result()?.detail);
  readonly language=computed(()=>this.i18n.language()==='ja'?'ja':'en');
  readonly otherLanguage=computed(()=>this.language()==='ja'?'en':'ja');
  readonly text=computed(()=>this.detail()?.text[this.language()]);
  readonly list=computed(()=>cardList(cards,Object.fromEntries(this.params().keys.map(key=>[key,this.params().get(key)!]))));
  readonly filters=this.list;
  readonly query=computed(()=>Object.fromEntries(this.params().keys.map(key=>[key,this.params().get(key)])));
  readonly filtered=computed(()=>this.list().filtered);
  readonly pageSize=cardPageSize;
  readonly pages=computed(()=>this.list().pages);
  readonly page=computed(()=>this.list().page);
  readonly visible=computed(()=>this.list().visible);
  readonly columns=computed(()=>cardColumns(this.list().type));
  readonly sorts=cardSorts;
  readonly filtersOpen=signal(false);
  tabLabel(type:string):string {return type==='HUNTERS_SC'?(this.i18n.language()==='ja'?'ハンターズ':'Hunters'):type==='ARKZ_SC'?(this.i18n.language()==='ja'?'アークズ':'Arkz'):this.i18n.t(type);}
  columnLabel(key:string):string {return this.statKeys.includes(key as 'hp')?key.toUpperCase():this.i18n.t(key);}
  cell(card:CardSummary,key:string):string {
    if(key==='cost') return String(card.cost.self)+(card.cost.ally?' + '+this.i18n.t('ally')+' '+card.cost.ally:'');
    if(key==='target_mode') return this.i18n.t(card.targetMode);
    if(key==='duration') return this.duration(card.assistTurns);
    return formatStat(card[key as 'hp'|'ap'|'tp'|'mv']);
  }
  clear():void {void this.router.navigate([],{relativeTo:this.route,queryParams:{type:this.list().type},replaceUrl:true});}
  readonly statKeys=['hp','ap','tp','mv'] as const;
  readonly path=cardPath; readonly stat=formatStat;
  readonly art=computed(()=>this.detail()?.images?.large ?? this.detail()?.images?.medium);
  readonly effectDiffs=computed(()=>{const diff=this.detail()?.diff.find(d=>d.field==='effects');return diff?changedEffectSlots(diff.online as CardEffect[],diff.disc as CardEffect[]):[];});
  readonly valueDiffs=computed(()=>this.detail()?.diff.filter(d=>d.field!=='effects') ?? []);
  readonly effectChanged=computed(()=>this.detail()?.diff.some(d=>d.field==='effects'));
  readonly neighbors=computed(()=>{const position=cards.findIndex(c=>c.id===this.detail()?.id);return {previous:cards[position-1],next:cards[position+1]};});
  name(card:Pick<CardSummary,'names'>):string {return card.names[this.language()];}
  difference(field:string,value:unknown):string {
    if (this.statKeys.includes(field as 'hp')) return formatStat(value as Stat);
    if (field==='target_mode') return this.i18n.t(String(value));
    return formatRawDifference(value);
  }
  duration(value:number):string {return value===90?this.i18n.t('once'):value===99?this.i18n.t('permanent'):String(value);}
  update(key:string,value:string):void {
    void this.router.navigate([],{relativeTo:this.route,queryParams:{[key]:value||null,page:null,...(key==='type'?{class:null,rank:null}:{}),...(key==='q'?{type:null}: {})},queryParamsHandling:'merge',replaceUrl:true});
  }
  goToPage(page:number):void {
    page=Number.isSafeInteger(page)?Math.max(1,Math.min(page,this.pages())):1;
    void this.router.navigate([],{relativeTo:this.route,queryParams:{page:page===1?null:page},queryParamsHandling:'merge',replaceUrl:true}).then(()=>{
      this.document.getElementById('card-results')?.scrollIntoView({block:'start'});
    });
  }
  retry():void {this.document.defaultView?.location.reload();}
  constructor(){
    effect(()=>this.title.setTitle(`${this.detail()?this.name(this.detail()!)+' | ':''}${this.i18n.t('title')} · Haven PSOBB Wiki`));
    afterRenderEffect(()=>{if(this.detail()) this.document.defaultView?.scrollTo({top:0,behavior:'instant'});});
  }
}
