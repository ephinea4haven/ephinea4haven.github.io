import raw from '../generated/monster-catalog/index.json';
import metadata from '../generated/monster-catalog/metadata.json';
export type Names = {en:string;zh:string;ja:string};
export interface Monster {
  id:string; names:Names; ultimateNames:Names; episode:number; areas:string[]; attribute:string;
  rare:boolean; boss:boolean; part:boolean; image:string|null; ultimateImage:string|null;
  values:Record<string,number[]|undefined>;
}
export interface MechanicTable {section:string;anchor:string;caption:string;context:string[];headings:string[];difficulties:string[];axis:'all'|'difficulty'|'mode'|'difficulty-mode';rows:string[][]}
export interface MonsterDetail {
  hdImage:string|null; ultimateHdImage:string|null;
  id:string; stats:Record<string,(number|string)[]>; notes:string[]; tables:MechanicTable[];
  drops:Record<string,{name:string;dar:string|null;cells:(Names & {rate:string;id:string|null})[][]}>;
  dropScope:string; source:string;sourceTitle:string;revision:number;checkedAt:string;imageSource:string|null;ultimateImageSource:string|null;
}
export const MONSTERS = raw as Monster[];
export const MONSTER_BY_ID = new Map(MONSTERS.map(m => [m.id,m]));
export const METADATA = metadata;
export const DIFFICULTIES = [{id:'n',label:'Normal'},{id:'h',label:'Hard'},{id:'vh',label:'Very Hard'},{id:'u',label:'Ultimate'}];
export const monsterPath = (monster:Monster) => `/data/enemies/${monster.id}.html`;
export const normalize = (value:string) => value.normalize('NFKC').toLowerCase().trim();
