import { Routes } from '@angular/router';
import { contentRoutes } from './generated/content.routes';

/** Angular features that render every language from the URL (docs/ARCHITECTURE.md). */
const featureRoutes = (prefix = ''): Routes => [
  { path:`${prefix}data/enemies.html`, loadComponent:()=>import('./monster-catalog/monster-catalog.component').then(m=>m.MonsterCatalogComponent) },
  { path:`${prefix}data/enemies/:monster`, loadChildren:()=>import('./monster-catalog/monster-detail.routes').then(m=>m.monsterDetailRoutes) },
  {
    path:`${prefix}data/items.html`,
    loadChildren: () => import('./item-catalog/item-list.routes').then(m => m.itemListRoutes),
  },
  {
    path:`${prefix}data/cosmetics.html`,
    loadComponent: () => import('./item-catalog/cosmetics.component').then(({ CosmeticsComponent }) => CosmeticsComponent),
  },
  {
    path:`${prefix}data/items/:item`,
    loadChildren: () => import('./item-catalog/item-detail.routes').then(m => m.itemDetailRoutes),
  },
  {
    path:`${prefix}tools/status.html`,
    loadChildren: () => import('./status/status.routes').then(m => m.statusRoutes),
  },
];

export const routes: Routes = [
  ...featureRoutes(),
  ...featureRoutes('en/'),
  ...featureRoutes('ja/'),
  {
    path: 'data/en2chinese.html',
    title: '游戏物品中英对照 | Ephinea PSOBB',
    loadComponent: () => import('./item-lookup/item-lookup.component')
      .then(({ ItemLookupComponent }) => ItemLookupComponent),
  },
  {
    path: 'data/price_guide.html',
    title: '物品价格参考 | Ephinea PSOBB',
    loadComponent: () => import('./price-guide/price-guide.component').then(({ PriceGuideComponent }) => PriceGuideComponent),
  },
  {
    path: 'tools/chartable.html',
    title: '全等级人物能力表 - PSOBB Wiki',
    loadChildren: () => import('./chartable/chartable.routes').then(m => m.chartableRoutes),
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
