import { RenderMode, ServerRoute } from '@angular/ssr';
import { contentServerRoutes } from './generated/content.routes.server';
import catalog from './generated/item-catalog/index.json';
import monsters from './generated/monster-catalog/index.json';

const featureServerRoutes = (prefix: string): ServerRoute[] => [
  { path: `${prefix}data/price_guide.html`, renderMode: RenderMode.Prerender },
  { path: `${prefix}data/item-names.html`, renderMode: RenderMode.Prerender },
  { path: `${prefix}tools/chartable.html`, renderMode: RenderMode.Prerender },
  {path:`${prefix}data/enemies.html`,renderMode:RenderMode.Prerender},
  {path:`${prefix}data/enemies/:monster`,renderMode:RenderMode.Prerender,getPrerenderParams:async()=>monsters.map(m=>({monster:`${m.id}.html`}))},
  { path: `${prefix}data/items.html`, renderMode: RenderMode.Prerender },
  { path: `${prefix}data/cosmetics.html`, renderMode: RenderMode.Prerender },
  { path: `${prefix}data/items/:item`, renderMode: RenderMode.Prerender, getPrerenderParams: async () => catalog.map(row => ({ item: `${row[0]}.html` })) },
  { path: `${prefix}tools/status.html`, renderMode: RenderMode.Prerender },
  { path: `${prefix}tools/cc.html`, renderMode: RenderMode.Prerender },
  { path: `${prefix}tools/ccopm.html`, renderMode: RenderMode.Prerender },
];

export const serverRoutes: ServerRoute[] = [
  ...featureServerRoutes(''),
  ...featureServerRoutes('en/'),
  ...featureServerRoutes('ja/'),
  ...contentServerRoutes,
];
