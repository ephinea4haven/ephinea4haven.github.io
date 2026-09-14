import { RenderMode, ServerRoute } from '@angular/ssr';
import { contentServerRoutes } from './generated/content.routes.server';
import catalog from './item-catalog/catalog.json';

export const serverRoutes: ServerRoute[] = [
  { path: 'data/items.html', renderMode: RenderMode.Prerender },
  { path: 'data/items/:item', renderMode: RenderMode.Prerender, getPrerenderParams: async () => catalog.map(({ id }) => ({ item: `${id}.html` })) },
  { path: 'data/en2chinese.html', renderMode: RenderMode.Prerender },
  { path: 'data/price_guide.html', renderMode: RenderMode.Prerender },
  { path: 'tools/chartable.html', renderMode: RenderMode.Prerender },
  { path: 'tools/status.html', renderMode: RenderMode.Prerender },
  { path: 'tools/cc.html', renderMode: RenderMode.Prerender },
  { path: 'tools/ccopm.html', renderMode: RenderMode.Prerender },
  ...contentServerRoutes,
];
