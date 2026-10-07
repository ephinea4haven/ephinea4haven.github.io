export interface Stat { kind:'blank'|'value'|'plus'|'minus'|'equals'; value:number|null }
export interface CardSummary {
  id:number; names:{en:string;ja:string}; tableName:{en:string}; type:string; class:string; rank:string;
  cost:{self:number;ally:number}; hp:Stat; ap:Stat; tp:Stat; mv:Stat; hidden:boolean; thumbnail:string|null; targetMode:string; assistTurns:number;
}
export interface CardImage { path:string; width:number; height:number }
export interface CardText { header:string[]; tags:{kind:'ability'|'note'|'status';name:string;body:string}[] }
export interface CardDetail extends Omit<CardSummary,'thumbnail'> {
  range:{entireField:boolean;grid:boolean[][]}; targetMode:string; assistTurns:number;
  cannotMove:boolean; cannotAttack:boolean; text:{en:CardText;ja:CardText};
  diff:{field:string;online:unknown;disc:unknown}[]; images?:{medium:CardImage;large?:CardImage};
}
export function formatStat(stat:Stat):string {
  if (stat.kind==='blank') return '';
  return ({value:'',plus:'+',minus:'−',equals:'='}[stat.kind])+(stat.value===null?'?':String(stat.value));
}
export const normalize = (value:string) => value.normalize('NFKC').toLocaleLowerCase().trim();
export function filterCards(cards:CardSummary[], filters:{type:string;class:string;rank:string;q:string;all:boolean}):CardSummary[] {
  const q=normalize(filters.q);
  return cards.filter(card => (filters.all || !card.hidden)
    && (!filters.type || card.type===filters.type) && (!filters.class || card.class===filters.class)
    && (!filters.rank || card.rank===filters.rank)
    && (!q || [card.names.en,card.names.ja,card.tableName.en].some(name=>normalize(name).includes(q))));
}
export const cardPath = (id:number) => `/data/ep3-cards/${id}.html`;

export const effectFields = ['type','expr','when','arg1','arg2','arg3'] as const;
export type CardEffect = Record<typeof effectFields[number]|'effectNum'|'applyCriterion'|'nameIndex',string|number>;
export function changedEffectSlots(online:CardEffect[],disc:CardEffect[]) {
  return online.map((effect,index)=>({slot:index+1,fields:[...effectFields, ...(['effectNum','applyCriterion','nameIndex'] as const).filter(field=>effect[field]!==disc[index][field])].map(field=>({
    field,online:effect[field],disc:disc[index][field],changed:effect[field]!==disc[index][field],
  }))})).filter(slot=>slot.fields.some(field=>field.changed));
}
export function formatRawDifference(value:unknown):string {
  return Array.isArray(value)?value.join(', '):String(value);
}

export const cardTypes = ['HUNTERS_SC','ARKZ_SC','ITEM','CREATURE','ACTION','ASSIST'];
export const cardRanks = ['N1','N2','N3','N4','R1','R2','R3','R4','S','SS','E'];
export const cardSorts = ['id','cost','hp','ap'];
export const cardPageSize=24;

export function cardList(cards:CardSummary[], params:Record<string,string>) {
  const all=params['all']==='1', q=params['q']||'';
  const pool=filterCards(cards,{all,q,type:'',class:'',rank:''});
  const counts=cardTypes.map(type=>({type,count:pool.filter(c=>c.type===type).length}));
  const type=cardTypes.includes(params['type'])?params['type']:(normalize(q)?counts.find(c=>c.count)?.type:undefined)||cardTypes[0];
  const category=cards.filter(c=>c.type===type&&(all||!c.hidden));
  const classes=[...new Set(category.map(c=>c.class))].map(value=>({value,count:category.filter(c=>c.class===value).length}));
  const cardClass=classes.some(c=>c.value===params['class'])?params['class']:classes[0]?.value||'';
  const ranks=cardRanks.filter(rank=>category.some(c=>c.rank===rank));
  const rank=ranks.includes(params['rank'])?params['rank']:'';
  const sort=cardSorts.includes(params['sort'])?params['sort']:'id';
  const numeric=(stat:Stat)=>stat.kind==='blank'||stat.value===null?null:(stat.kind==='minus'?-stat.value:stat.value);
  const filtered=pool.filter(c=>c.type===type&&(normalize(q)||c.class===cardClass)&&(!rank||c.rank===rank)).sort((a,b)=>{
    if(sort==='id') return a.id-b.id;
    const av=sort==='cost'?a.cost.self:numeric(a[sort as 'hp'|'ap']);
    const bv=sort==='cost'?b.cost.self:numeric(b[sort as 'hp'|'ap']);
    return (av===null?(bv===null?0:1):bv===null?-1:sort==='cost'?av-bv:bv-av)||a.id-b.id;
  });
  const pages=Math.max(1,Math.ceil(filtered.length/cardPageSize));
  const page=Math.min(pages,Math.max(1,Number.parseInt(params['page']||'1',10)||1));
  return {type,class:cardClass,rank,q,all,sort,counts,classes,ranks,filtered,pages,page,visible:filtered.slice((page-1)*cardPageSize,page*cardPageSize)};
}
export function cardColumns(type:string):string[] {
  if(type==='ACTION') return ['cost','target_mode'];
  if(type==='ASSIST') return ['cost','duration'];
  return [...(['ITEM','CREATURE'].includes(type)?['cost']:[]),'hp','ap','tp',...(type==='ITEM'?[]:['mv'])];
}
