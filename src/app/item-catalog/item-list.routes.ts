import { Routes } from '@angular/router';
import { resolveItemIndex } from './catalog-index';

export const itemListRoutes: Routes = [{
  path: '', resolve: { index: resolveItemIndex }, data: { scroll: 'component' },
  loadComponent: () => import('./item-catalog.component').then(m => m.ItemCatalogComponent),
}];
