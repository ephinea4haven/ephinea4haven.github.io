import raw from '../generated/monster-catalog/index.json';
import type { LocalizedText } from '../shared/site-language.service';
import metadata from '../generated/monster-catalog/metadata.json';
export type Names = {en:string;zh:string;ja:string};
export interface Monster {
  id:string; names:Names; ultimateNames:Names; episode:number; areas:string[]; attribute:string;
  rare:boolean; boss:boolean; part:boolean; image:string|null; ultimateImage:string|null; thumbnail:string|null; ultimateThumbnail:string|null;
  values:Record<string,number[]|undefined>;
}
export interface MechanicTable {section:string;anchor:string;caption:string;context:string[];headings:string[];difficulties:string[];axis:'all'|'difficulty'|'mode'|'difficulty-mode';rows:string[][]}
export interface MonsterDetail {
  hdImage:string|null; ultimateHdImage:string|null; renderImage:string|null; ultimateRenderImage:string|null; renderAlternates:{image:string;label:LocalizedText}[];
  id:string; stats:Record<string,(number|string)[]>; notes:LocalizedText[]; tables:MechanicTable[];
  drops:Record<string,{name:string;dar:string|null;cells:(Names & {rate:string;id:string|null})[][]}>;
  dropScope:string; source:string;sourceTitle:string;revision:number;checkedAt:string;imageSource:string|null;ultimateImageSource:string|null;
}
export const MONSTERS = raw as Monster[];
export const MONSTER_BY_ID = new Map(MONSTERS.map(m => [m.id,m]));
export const METADATA = metadata;
// `label` matches the Wiki source tables; `names` are the client texts (BB unitxt, maintained Chinese localization).
export const DIFFICULTIES: {id:string;label:string;names:Names}[] = [
  {id:'n',label:'Normal',names:{en:'Normal',zh:'普通',ja:'ノーマル'}},
  {id:'h',label:'Hard',names:{en:'Hard',zh:'困难',ja:'ハード'}},
  {id:'vh',label:'Very Hard',names:{en:'Very Hard',zh:'极难',ja:'ベリーハード'}},
  {id:'u',label:'Ultimate',names:{en:'Ultimate',zh:'极限',ja:'アルティメット'}},
];
// The list browses by region: each region gathers its numbered sub-areas and its boss room.
const REGION_AREAS: Record<string,string[]> = {
  'Forest':['Forest','Under the Dome'], 'Cave':['Cave','Cave 1','Cave 2','Cave 3','Underground Channel'],
  'Mine':['Mine','Monitor Room'], 'Ruins':['Ruins','Ruins 1','Ruins 2','Ruins 3','???? (Dark Falz)'],
  'VR Temple':['VR Temple','VR Temple Final'], 'VR Spaceship':['VR Spaceship','VR Spaceship Alpha','VR Spaceship Beta','VR Spaceship Final'],
  'Central Control Area':['Central Control Area','Cliffs of Gal Da Val'], 'Control Tower':['Control Tower'],
  'Seabed':['Seabed','Test Subject Disposal Area'], 'Crater':['Crater'], 'Subterranean Desert':['Subterranean Desert','Meteor Impact Site'],
};
export const REGION_OF = new Map(Object.entries(REGION_AREAS).flatMap(([region,areas]) => areas.map(area => [area,region] as const)));
export const monsterPath = (monster:Monster) => `/data/enemies/${monster.id}.html`;
export const normalize = (value:string) => value.normalize('NFKC').toLowerCase().trim();
