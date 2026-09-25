import { Routes } from '@angular/router';

/** Angular features that render every language from the URL (docs/ARCHITECTURE.md). */
const titleFor = (prefix: string, zh: string, en: string, ja: string) => (
  prefix === 'en/' ? `${en} | Haven PSOBB Wiki` : prefix === 'ja/' ? `${ja} | Haven PSOBB Wiki` : `${zh} | Ephinea PSOBB`
);

const featureRoutes = (prefix = ''): Routes => [
  {
    path: `${prefix}data/price_guide.html`,
    title: titleFor(prefix, '物品价格参考', 'Item price guide', 'アイテム価格ガイド'),
    loadComponent: () => import('./price-guide/price-guide.component').then(({ PriceGuideComponent }) => PriceGuideComponent),
  },
  {
    path: `${prefix}data/item-names.html`,
    title: titleFor(prefix, '物品名称对照（中日英）', 'Item names (Chinese, Japanese, English)', 'アイテム名対照表（中日英）'),
    loadComponent: () => import('./item-lookup/item-lookup.component').then(({ ItemLookupComponent }) => ItemLookupComponent),
  },
  {
    path: `${prefix}tools/chartable.html`,
    loadChildren: () => import('./chartable/chartable.routes').then(m => m.chartableRoutes),
  },
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
  {
    path: `${prefix}tools/cc.html`,
    loadComponent: () => import('./combo/combo-multiplayer-page.component')
      .then(({ ComboMultiplayerPageComponent }) => ComboMultiplayerPageComponent),
  },
  {
    path: `${prefix}tools/ccopm.html`,
    loadComponent: () => import('./combo/combo-opm-page.component')
      .then(({ ComboOpmPageComponent }) => ComboOpmPageComponent),
  },
];

export const routes: Routes = [
  ...featureRoutes(),
  ...featureRoutes('en/'),
  ...featureRoutes('ja/'),
  // Content pages (every language version) load their route table lazily, so the
  // initial bundle doesn't grow with each translated page.
  { path: '', loadChildren: () => import('./generated/content.routes').then((m) => m.contentRoutes) },
];
