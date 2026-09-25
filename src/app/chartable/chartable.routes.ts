import { Routes } from '@angular/router';
import { resolveCharacterData } from '../status/character-data';

export const chartableRoutes: Routes = [{
  path: '', resolve: { characterData: resolveCharacterData },
  loadComponent: () => import('./chartable.component').then(m => m.ChartableComponent),
}];
