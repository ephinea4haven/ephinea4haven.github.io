import { Routes } from '@angular/router';
import { resolveCharacterData } from './character-data';

export const statusRoutes: Routes = [{
  path: '', resolve: { characterData: resolveCharacterData },
  loadComponent: () => import('./status.component').then(m => m.StatusComponent),
}];
