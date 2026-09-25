import { Routes } from '@angular/router';
import { resolveItemIndex } from './catalog-index';

export const itemListRoutes: Routes = [{
  path: '', resolve: { index: resolveItemIndex },
  loadComponent: () => import('./item-catalog.component').then(m => m.ItemCatalogComponent),
}];
