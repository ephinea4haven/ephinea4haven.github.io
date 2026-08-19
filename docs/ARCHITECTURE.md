# Architecture

> Last updated: 2026-08-18

## System shape

Ephinea4Haven is a statically deployed Angular application. Angular 22 owns every
public page, route and interaction. GitHub Pages serves the immutable `_site`
artifact; it does not need server-side rewrites or a JavaScript backend.

The current production inventory contains 58 prerendered Angular application
hosts and 45 year-specific event content fragments. `_site/build-manifest.json`
is the source of truth for this inventory and for the JavaScript budgets applied
to each route.

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

The sibling `droptable/i18n_names.json` file is the sole item-name authority.
CI checks out `warmonipa/dropcharts` at `master` and fails if the checked-in
site dictionary differs from that authority.
`scripts/sync_item_i18n.py` deterministically generates
`assets/js/i18n/items_i18n.js`; the generated JavaScript is a checked-in build
input and must not be edited by hand. The authority retains names outside
Unitxt and replaces matching Chinese names from `psobb-localization`'s unified
mixed-width `zh/unitxt_j.prs`. Angular consumers render those values verbatim
with one-way binding. Search uses NFKC normalization, but display never performs
a global halfwidth/fullwidth conversion and exposes no width selector.

## Content and application routes

Content routes preserve the existing authored HTML as build-time content input.
The generator extracts body markup, metadata and route-specific styles, removes
no behavior at runtime, and emits lazy standalone Angular components. Interactive
routes either attach a scoped Angular directive or use a dedicated component.
Because the application-wide base URL is `/`, the generator resolves fragment,
query-only and path-relative `href`, `src`, `action` and `poster` values against
their source document and emits root-relative URLs. Generated content is rejected
if an unresolved relative link remains, so a local section jump cannot be
reinterpreted as a navigation to the home route.

Dedicated components are preferred when state changes the rendered model, such
as Combo, status, character tables and prices. Scoped directives are used for
stable document-like content whose interaction is naturally DOM-local, such as
tabs, filters and event previews.

`/data/equipment_technique_boosts.html` is the canonical equipment-based
Technique boost reference. Its weapon, frame and barrier rows follow the Ephinea
Wiki source, while every displayed equipment name resolves through
`items_i18n.js`.

Seasonal event routes own a fixed year manifest and load committed yearly HTML
fragments through root-relative URLs. The anniversary archive defaults to 2026
and presents the complete 2016–2026 manifest in a default-collapsed overlay
drawer. Opening the drawer never changes the content column geometry; it closes
through its toggle, backdrop, or Escape key. On narrow screens the collapsed
year control moves to the lower safe area while the drawer remains a vertical,
scrollable timeline. All years share the compact archive toolbar, year-themed
hero treatment, alternating chapter accents, and localized milestone tables
under stable year-specific anchors. The 2025–2026 fragments additionally use a
sticky, horizontally scrollable section navigation and numbered change cards.
Section navigation uses the full archive URL, selected year query and fragment
together so Angular routing cannot reinterpret a bare fragment as a jump to the
home route. The 2026 guide exposes only its six primary guide sections while
documenting the continuing MAE and Anniversary Badge format. Its committed
milestone table is a dated snapshot synchronized from the official Ephinea live
milestone page; that external page remains the authority for later point and
reward updates. The same synchronization pass recalculates eight visible boost
dimensions: DAR, RDR, Anniversary Badge rate, Photon Drop rate, experience,
Meseta, rare-monster rate and Hit-weapon rate. Anniversary Weekly Boost values
are fixed baselines; only unlocked milestone rewards change the calculated
totals. The landing spotlight and current-year milestone chapter render the
same Angular `PageUpdateStampComponent` from the synchronized UTC+8 snapshot
timestamp. Both surfaces preserve the same stamp scale, tilt and overlay
treatment on narrow screens: the landing stamp aligns with the second title
line (`十一周年活动`), while the milestone stamp aligns with its single-line
heading. The stamp is deliberately colocated only with live Buff, milestone and
server-point data; static event rules and historical years do not present a
live-update timestamp. Historical external
milestone archive links are not part of the UI; the localized yearly fragments
are the maintained record.
The landing page exposes active seasonal events through reusable
`current-activity` regions. `scripts/home_activity.mjs` owns the build-time
renderer, event registry and replacement contract; event-specific synchronizers
supply the title, period, internal guide links, official Ephinea Wiki detail
link, milestone progress, unlocked milestones and active boost list. Registered
events are prerendered for deterministic builds, but inactive regions use the
native `hidden` state and occupy no layout space. Each activity carries an
inclusive America/Los_Angeles visibility window; the landing-page Angular
directive reevaluates every registered region when the route is activated and
when the local calendar date changes.

The event spotlight has its own annual-event visual layer: an animated
cyan-blue-magenta-gold perimeter, restrained edge scan, energy corner marks and
dashboard depth. These selectors remain scoped to the activity component so the
existing landing-page navigation and information cards retain their original
presentation. `prefers-reduced-motion` disables the repeating motion through the
site-wide reduced-motion contract.

The anniversary sync updates the landing regions in the same atomic pass as the
2026 fragment, so the landing page never carries a separately maintained
milestone snapshot. The GitHub synchronization workflow commits both generated
surfaces and their shared minute-precise UTC+8 update timestamp together. Future seasonal events reuse the registry and renderer
instead of adding event-specific landing-page markup or behavior.
The registry follows Ephinea's five documented server-wide event families:
Valentine's, Easter, Anniversary, Halloween and Christmas. Ephinea explicitly
does not prescribe exact annual start dates, so registry windows must come from
an announced yearly event page; historical timing is never projected onto an
unannounced future event.
PSOStats quest telemetry belongs to the matching yearly fragment and is only
published for upstream archives that actually exist: 2021, 2022, 2023 and
2025. Each supported year also preserves its complete published Overall Lap TA
ranking and available MAE splits. Known upstream gaps are preserved and
explained instead of inferred.

The Episode I challenge guide publishes the original high-resolution map
images embedded in the archived PSO World PDFs. `import_challenge_source_maps.py`
uses Poppler to extract those images without rendering or resampling. Episode
II publishes the original JPEG maps from the historical web archive. Language
selection changes the page guidance and legend without duplicating or altering
the source artwork. `verify_challenge_maps.mjs` enforces the exact inventories,
minimum source dimensions and page references.

The Seabed guide is a dedicated Chinese content route covering all eight Upper
and Lower map variants. It keeps route media, gameplay advice and server-specific
provenance together so readers can distinguish general PSOBB mechanics from
Ultima-specific equipment and timing recommendations. Angular explicitly owns
the eight-route accordion after hydration, publishes a readiness contract, and
keeps exactly one variant open for both pointer and keyboard activation.

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
All 47 material-plan links are parsed as calculator inputs and checked for known
fields, numeric form, Mag and material limits, and class-compatible equipment.

## Build and release

`npm run build` performs the following transaction:

1. regenerate Angular modules from committed datasets;
2. build and prerender the Angular application;
3. copy the maintained static-resource trees into a temporary directory while
   excluding build-only inputs, retired trees and operating-system metadata;
4. install every prerendered route at its historical path;
5. reject any unexpected non-Angular HTML host, missing resource, retired runtime
   asset, operating-system metadata, or route/chunk budget violation;
6. write a deterministic manifest and atomically publish `_site`.

`npm run release:prepare` runs source/data checks, the production build and the
Playwright suite. CI additionally performs `npm ci`, dependency audit and a
second byte-identical build before deploying the exact tested artifact.

The release gates cover:

- no jQuery, Bootstrap, Vue or vue-multiselect package/runtime/assets;
- no scripts or inline event handlers in repository-owned page sources;
- valid authored HTML, with the intentional event-fragment doctype omission as
  the only fragment-specific exception;
- no unresolved relative content links or operating-system metadata in `_site`;
- Angular ownership of every public application host;
- browser console, page and local-resource errors on every route;
- representative behavior and WCAG A/AA checks;
- per-chunk, per-route and aggregate gzip budgets;
- Status calculation fixtures, exhaustive character/equipment compatibility and
  all material-plan presets;
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
