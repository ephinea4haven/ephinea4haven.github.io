import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import index from '../generated/ep3-card-catalog/index.json';
import type { CardDetail } from './card';
import { Ep3CardDataService } from './ep3-card-data.service';
export interface CardResult {detail:CardDetail|null;failed:boolean}
const ids=new Set(index.map(card=>String(card.id)));
const resolve:ResolveFn<CardResult> = async route => {
  const service=inject(Ep3CardDataService);
  const id=(route.paramMap.get('card') || '').replace(/\.html$/,'');
  if (!ids.has(id)) return {detail:null,failed:false};
  try {return {detail:await service.load(id),failed:false};} catch {return {detail:null,failed:true};}
};
export const ep3CardDetailRoutes:Routes=[{path:'',resolve:{result:resolve},loadComponent:()=>import('./ep3-card-catalog.component').then(m=>m.Ep3CardCatalogComponent)}];
