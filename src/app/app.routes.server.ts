import { RenderMode, ServerRoute } from '@angular/ssr';
import { contentServerRoutes } from './generated/content.routes.server';
import catalog from './generated/item-catalog/index.json';
import monsters from './generated/monster-catalog/index.json';

export const serverRoutes: ServerRoute[] = [
  {path:'data/enemies.html',renderMode:RenderMode.Prerender},
  {path:'data/enemies/:monster',renderMode:RenderMode.Prerender,getPrerenderParams:async()=>monsters.map(m=>({monster:`${m.id}.html`}))},
  { path: 'data/items.html', renderMode: RenderMode.Prerender },
  { path: 'data/cosmetics.html', renderMode: RenderMode.Prerender },
  { path: 'data/items/:item', renderMode: RenderMode.Prerender, getPrerenderParams: async () => catalog.map(row => ({ item: `${row[0]}.html` })) },
  { path: 'data/en2chinese.html', renderMode: RenderMode.Prerender },
  { path: 'data/price_guide.html', renderMode: RenderMode.Prerender },
  { path: 'tools/chartable.html', renderMode: RenderMode.Prerender },
  { path: 'tools/status.html', renderMode: RenderMode.Prerender },
  { path: 'tools/cc.html', renderMode: RenderMode.Prerender },
  { path: 'tools/ccopm.html', renderMode: RenderMode.Prerender },
  ...contentServerRoutes,
];
