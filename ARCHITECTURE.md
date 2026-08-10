# Architecture

> Last updated: 2026-08-10

## System shape

Ephinea4Haven is a statically deployed Angular application. Angular 22 owns every
public page, route and interaction. GitHub Pages serves the immutable `_site`
artifact; it does not need server-side rewrites or a JavaScript backend.

The historical URLs are part of the product contract. The Angular build
prerenders routes and `scripts/build_site.mjs` installs each result at its
existing `.html` path. Directory-index aliases remain available where they
already existed. Year-specific event HTML files are content fragments loaded by
their Angular event route, not independent application hosts.

There is one browser runtime:

- standalone Angular components and directives;
- Angular Router with lazy route entries;
- zoneless change detection;
- signals for local feature state;
- SSR/SSG for meaningful initial HTML;
- typed or explicitly bounded domain/data modules.

jQuery, Bootstrap, Vue, vue-multiselect and the old `page-chrome` custom element
runtime are retired. They must not appear in package dependencies or the
published artifact. Repository-owned HTML sources contain content and styling,
but no scripts or inline event handlers; Angular owns behavior.

## Ownership

- `src/app/`: bootstrap, routing and application features.
- `src/app/content/`: shared behaviors for content-oriented routes.
- `src/app/shared/`: the Angular page shell and common presentation.
- `src/app/combo/`, `status/`, `chartable/`, `price-guide/`: dedicated tools.
- `src/app/events/`, `data/`, `mag/`, `rbr/`: specialized interactive content.
- `src/app/generated/`: ignored build output derived from committed source data.
- `assets/`: images, CSS, fonts, JSON and immutable build inputs.
- `scripts/`: data generation, upstream synchronization, architecture checks and
  deterministic release construction.
- `third_party/`: licenses and provenance for synchronized upstream material.

`data/droptable/` is a tooling-only snapshot and is excluded from publication.
The current drop-table product is hosted independently at
`dropcharts.psohaven.com`.

## Content and application routes

Content routes preserve the existing authored HTML as build-time content input.
The generator extracts body markup, metadata and route-specific styles, removes
no behavior at runtime, and emits lazy standalone Angular components. Interactive
routes either attach a scoped Angular directive or use a dedicated component.

Dedicated components are preferred when state changes the rendered model, such
as Combo, status, character tables and prices. Scoped directives are used for
stable document-like content whose interaction is naturally DOM-local, such as
tabs, filters and event previews.

Build-input JavaScript datasets are never copied to `_site`. Generators evaluate
or normalize them into Angular modules. The PSOStats Combo snapshot remains an
audited upstream boundary. The character simulator is Haven-owned TypeScript:
`status-domain.ts` is a pure calculation module and `item-data.js` is an immutable
catalog behind an explicit TypeScript declaration. Neither depends on the DOM or
an obsolete browser runtime.

The Status component owns presentation separately from that calculation domain.
It retains the established character/material/equipment editing layout, provides
a mobile-scrolling result table with a sticky stat column, displays canonical
resistance codes with Chinese, English and Japanese labels, and exposes the
current configuration through a serialized share link. Browser tests cover these
language and interaction contracts in addition to the exhaustive domain checks.

## Build and release

`npm run build` performs the following transaction:

1. regenerate Angular modules from committed datasets;
2. build and prerender the Angular application;
3. copy the explicit static-resource allowlist into a temporary directory;
4. install every prerendered route at its historical path;
5. reject any unexpected non-Angular HTML host, missing resource, retired
   runtime asset, or route/chunk budget violation;
6. write a deterministic manifest and atomically publish `_site`.

`npm run release:prepare` runs source/data checks, the production build and the
Playwright suite. CI additionally performs `npm ci`, dependency audit and a
second byte-identical build before deploying the exact tested artifact.

The release gates cover:

- no jQuery, Bootstrap or Vue package/runtime/assets;
- no scripts or inline event handlers in repository-owned page sources;
- Angular ownership of every public application host;
- browser console, page and local-resource errors on every route;
- representative behavior and WCAG A/AA checks;
- per-chunk, per-route and aggregate gzip budgets;
- Status calculation fixtures and exhaustive character/equipment compatibility;
- Combo provenance, license and calculation-data integrity;
- deterministic output.

## Development commands

```bash
npm ci
npm test
npm run build
npm run test:e2e
npm run dev
npm run preview
```

Use current stable, non-prerelease dependencies and commit exact direct versions.
Dependency updates are accepted only after the complete release gate passes.
