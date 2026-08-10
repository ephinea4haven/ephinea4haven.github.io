import { RenderMode, ServerRoute } from '@angular/ssr';
import { contentServerRoutes } from './generated/content.routes.server';

export const serverRoutes: ServerRoute[] = [
  { path: 'data/price_guide.html', renderMode: RenderMode.Prerender },
  { path: 'tools/chartable.html', renderMode: RenderMode.Prerender },
  { path: 'tools/status.html', renderMode: RenderMode.Prerender },
  { path: 'tools/cc.html', renderMode: RenderMode.Prerender },
  { path: 'tools/ccopm.html', renderMode: RenderMode.Prerender },
  ...contentServerRoutes,
];
