import pageRoutes from '../content/page-routes.json' with { type: 'json' };

export { pageRoutes };
export const detailFamilies = { items: 'items', enemies: 'enemies', 'ep3-cards': 'cards' };

export function contentRoute(source) {
  if (!Object.hasOwn(pageRoutes, source)) throw new Error(`Content has no public route: ${source}`);
  return pageRoutes[source];
}

/** Source references are resolved only during compilation, never at runtime. */
export function publicHref(href) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const [, language = '', pathname, suffix = ''] = /^(\/(?:en|ja)(?=\/|$))?([^?#]*)(.*)$/.exec(href);
  const source = pathname.replace(/^\//, '');
  const key = Object.hasOwn(pageRoutes, source) ? source : `${source.replace(/\/$/, '')}/index.html`;
  if (Object.hasOwn(pageRoutes, key)) {
    const route = pageRoutes[key];
    return `${language}/${route}${route && route !== '404.html' ? '/' : ''}${suffix}`;
  }
  const detail = /^data\/(items|enemies|ep3-cards)\/([^/]+)\.html$/.exec(source);
  if (detail) return `${language}/${detailFamilies[detail[1]]}/${detail[2]}/${suffix}`;
  return href;
}

/** Hosting adapter: Angular route -> document; source filenames play no role. */
export function routeDocument(route) {
  const pathname = route.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return pathname === '404.html' ? pathname : pathname ? `${pathname}/index.html` : 'index.html';
}

export function isPageHref(href) {
  const plain = href.replace(/^\/(en|ja)(?=\/|$)/, '').split(/[?#]/)[0].replace(/^\/|\/$/g, '');
  return Object.values(pageRoutes).includes(plain) || /^(items|enemies|cards)\/[^/]+$/.test(plain);
}

export function publicPageKey(source) {
  if (source.endsWith('/') && detailFamilies[source.slice(5, -1)]) return `${detailFamilies[source.slice(5, -1)]}/`;
  return publicHref(`/${source}`).replace(/^\/|\/$/g, '') || 'index.html';
}
