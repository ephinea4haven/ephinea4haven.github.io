import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { MONSTER_BY_ID, MonsterDetail } from './monster';
import { MonsterDataService } from './monster-data.service';
export interface MonsterResult {detail:MonsterDetail|null;failed:boolean}
const resolve:ResolveFn<MonsterResult> = async route => {
  const service = inject(MonsterDataService);
  const id = (route.paramMap.get('monster') || '').replace(/\.html$/,'');
  if (!MONSTER_BY_ID.has(id)) return {detail:null,failed:false};
  try {return {detail:await service.load(id),failed:false};} catch {return {detail:null,failed:true};}
};
export const monsterDetailRoutes:Routes = [{path:'',resolve:{result:resolve},loadComponent:()=>import('./monster-catalog.component').then(m=>m.MonsterCatalogComponent)}];
