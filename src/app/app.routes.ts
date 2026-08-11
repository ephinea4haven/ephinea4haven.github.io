import { Routes } from '@angular/router';
import { contentRoutes } from './generated/content.routes';

export const routes: Routes = [
  {
    path: 'data/price_guide.html',
    title: '物品价格参考 | Ephinea PSOBB',
    loadComponent: () => import('./price-guide/price-guide.component').then(({ PriceGuideComponent }) => PriceGuideComponent),
  },
  {
    path: 'tools/chartable.html',
    title: '全等级人物能力表 - PSOBB Wiki',
    loadComponent: () => import('./chartable/chartable.component')
      .then(({ ChartableComponent }) => ChartableComponent),
  },
  {
    path: 'tools/status.html',
    title: '角色属性模拟器 | Ephinea PSOBB',
    loadComponent: () => import('./status/status.component')
      .then(({ StatusComponent }) => StatusComponent),
  },
  {
    path: 'tools/cc.html',
    title: 'Combo Calculator - PSOStats',
    loadComponent: () => import('./combo/combo-multiplayer-page.component')
      .then(({ ComboMultiplayerPageComponent }) => ComboMultiplayerPageComponent),
  },
  {
    path: 'tools/ccopm.html',
    title: 'Combo Calculator - PSOStats',
    loadComponent: () => import('./combo/combo-opm-page.component')
      .then(({ ComboOpmPageComponent }) => ComboOpmPageComponent),
  },
  ...contentRoutes,
];
