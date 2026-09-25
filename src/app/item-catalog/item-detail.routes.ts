import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { ItemDetail } from './catalog';
import { ItemDataService } from './item-data.service';

export interface DetailResult { detail: ItemDetail | null; failed: boolean }
const resolveDetail: ResolveFn<DetailResult> = async route => {
  const service = inject(ItemDataService);
  const id = (route.paramMap.get('item') || '').replace(/\.html$/, '');
  try { return { detail: await service.load(id), failed: false }; }
  catch { return { detail: null, failed: true }; }
};
export const itemDetailRoutes: Routes = [{
  path: '', resolve: { result: resolveDetail },
  loadComponent: () => import('./item-detail.component').then(m => m.ItemDetailComponent),
}];
