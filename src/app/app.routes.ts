import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

/** Angular features that render every language from the URL (docs/ARCHITECTURE.md). */
const titleFor = (prefix: string, zh: string, en: string, ja: string) => (
  prefix === 'en/' ? `${en} | Haven PSOBB Wiki` : prefix === 'ja/' ? `${ja} | Haven PSOBB Wiki` : `${zh} | Ephinea PSOBB`
);

const featureRoutes = (prefix = ''): Routes => [
  {
    path: `${prefix}prices`,
    title: titleFor(prefix, '物品价格参考', 'Item price guide', 'アイテム価格ガイド'),
    loadComponent: () => import('./price-guide/price-guide.component').then(({ PriceGuideComponent }) => PriceGuideComponent),
  },
  {
    path: `${prefix}item-names`,
    title: titleFor(prefix, '物品名称对照（中日英）', 'Item names (Chinese, Japanese, English)', 'アイテム名対照表（中日英）'),
    loadComponent: () => import('./item-lookup/item-lookup.component').then(({ ItemLookupComponent }) => ItemLookupComponent),
  },
  {
    path: `${prefix}character-growth`,
    loadChildren: () => import('./chartable/chartable.routes').then(m => m.chartableRoutes),
  },
  { path:`${prefix}cards`, loadComponent:()=>import('./ep3-card-catalog/ep3-card-catalog.component').then(m=>m.Ep3CardCatalogComponent) },
  { path:`${prefix}cards/:card`, loadChildren:()=>import('./ep3-card-catalog/ep3-card-detail.routes').then(m=>m.ep3CardDetailRoutes) },
  { path:`${prefix}enemies`, loadComponent:()=>import('./monster-catalog/monster-catalog.component').then(m=>m.MonsterCatalogComponent) },
  { path:`${prefix}enemies/:monster`, loadChildren:()=>import('./monster-catalog/monster-detail.routes').then(m=>m.monsterDetailRoutes) },
  {
    path:`${prefix}items`,
    loadChildren: () => import('./item-catalog/item-list.routes').then(m => m.itemListRoutes),
  },
  {
    path:`${prefix}cosmetics`,
    loadComponent: () => import('./item-catalog/cosmetics.component').then(({ CosmeticsComponent }) => CosmeticsComponent),
  },
  {
    path:`${prefix}items/:item`,
    loadChildren: () => import('./item-catalog/item-detail.routes').then(m => m.itemDetailRoutes),
  },
  {
    path:`${prefix}character-stats`,
    loadChildren: () => import('./status/status.routes').then(m => m.statusRoutes),
  },
  {
    path: `${prefix}combo-calculator`,
    loadComponent: () => import('./combo/combo-multiplayer-page.component')
      .then(({ ComboMultiplayerPageComponent }) => ComboMultiplayerPageComponent),
  },
  {
    path: `${prefix}combo-calculator/one-person`,
    loadComponent: () => import('./combo/combo-opm-page.component')
      .then(({ ComboOpmPageComponent }) => ComboOpmPageComponent),
  },
];

export const routes: Routes = [
  // Pages serves explicit index documents too. Normalize them in the app without
  // registering source-filename aliases for individual pages.
  {
    matcher: segments => segments.at(-1)?.path === 'index.html' ? { consumed: segments } : null,
    redirectTo: ({ url, queryParams, fragment }) => {
      const path = '/' + url.slice(0, -1).map(segment => segment.path).join('/');
      return inject(Router).createUrlTree([path === '/' ? path : path + '/'], { queryParams, fragment: fragment ?? undefined });
    },
  },
  ...featureRoutes(),
  ...featureRoutes('en/'),
  ...featureRoutes('ja/'),
  // Content pages (every language version) load their route table lazily, so the
  // initial bundle doesn't grow with each translated page.
  { path: '', loadChildren: () => import('./generated/content.routes').then((m) => m.contentRoutes) },
];
