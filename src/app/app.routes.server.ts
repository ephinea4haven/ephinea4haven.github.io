import ep3Cards from './generated/ep3-card-catalog/index.json';
import { RenderMode, ServerRoute } from '@angular/ssr';
import { contentServerRoutes } from './generated/content.routes.server';
import catalog from './generated/item-catalog/index.json';
import monsters from './generated/monster-catalog/index.json';

const featureServerRoutes = (prefix: string): ServerRoute[] => [
  { path: `${prefix}prices`, renderMode: RenderMode.Prerender },
  { path: `${prefix}item-names`, renderMode: RenderMode.Prerender },
  { path: `${prefix}character-growth`, renderMode: RenderMode.Prerender },
  {path:`${prefix}enemies`,renderMode:RenderMode.Prerender},
  {path:`${prefix}cards`,renderMode:RenderMode.Prerender},
  {path:`${prefix}cards/:card`,renderMode:RenderMode.Prerender,getPrerenderParams:async()=>ep3Cards.map(c=>({card:`${c.id}`}))},
  {path:`${prefix}enemies/:monster`,renderMode:RenderMode.Prerender,getPrerenderParams:async()=>monsters.map(m=>({monster:`${m.id}`}))},
  { path: `${prefix}items`, renderMode: RenderMode.Prerender },
  { path: `${prefix}cosmetics`, renderMode: RenderMode.Prerender },
  { path: `${prefix}items/:item`, renderMode: RenderMode.Prerender, getPrerenderParams: async () => catalog.map(row => ({ item: `${row[0]}` })) },
  { path: `${prefix}character-stats`, renderMode: RenderMode.Prerender },
  { path: `${prefix}combo-calculator`, renderMode: RenderMode.Prerender },
  { path: `${prefix}combo-calculator/one-person`, renderMode: RenderMode.Prerender },
];

export const serverRoutes: ServerRoute[] = [
  ...featureServerRoutes(''),
  ...featureServerRoutes('en/'),
  ...featureServerRoutes('ja/'),
  ...contentServerRoutes,
];
