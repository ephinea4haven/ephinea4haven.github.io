# Architecture

> Last updated: 2026-09-16

## Audience and languages

Haven PSOBB Wiki is a multilingual reference for PSOBB players worldwide, focused
on Ephinea and maintained by the Haven guild. Access is open to everyone,
regardless of country, language or guild membership.

The site supports English, Japanese and Chinese. Language selection and
translation coverage are currently feature-specific: the item and monster
catalogs and challenge maps provide multilingual content, while individual
guides and source excerpts may remain in their authored language. Product copy
must reflect this scope without presenting the site as a Chinese-only resource
or promising complete translations of every page.

## System shape

Ephinea4Haven is a statically deployed Angular application. Angular 22 owns every
public page, route and interaction. GitHub Pages serves the immutable `_site`
artifact; it does not need server-side rewrites or a JavaScript backend.

The current build inventory contains 1,268 prerendered Angular application
hosts, including 1,045 item detail pages and 160 monster detail pages, and 45 year-specific event content fragments. `_site/build-manifest.json`
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
- `src/app/item-catalog/`: item search, filters, detail loading, scoped zh/en/ja
  UI state and presentation; source-language mechanics remain explicitly labeled.
- `content/item-catalog/`: committed Wiki facts, image provenance, corrections
  and reviewed mechanics notes.
- `src/app/monster-catalog/`, `content/monster-catalog/`: the trilingual bestiary,
  contextual Wiki stats/mechanics and generated ten-section drops from the sibling
  drop-table authority; see [the data contract](MONSTER_CATALOG.md).
- `src/app/generated/`: ignored build output derived from committed source data.
- `assets/`: images, CSS, fonts, JSON and immutable build inputs.
- `scripts/`: data generation, upstream synchronization, architecture checks and
  deterministic release construction.
- `third_party/`: licenses and provenance for synchronized upstream material.

`data/droptable/` is a tooling-only snapshot and is excluded from publication.
The current drop-table product is hosted independently at
`dropcharts.psohaven.com`.

The sibling `droptable/i18n_names.json` file is the sole Chinese item-name authority.
The catalog uses its Japanese names first and supplements missing Japanese names
with the committed Wiki `jp` fields; unverified names remain visibly English.
CI checks out a pinned `warmonipa/dropcharts` commit and fails if the checked-in
site dictionary differs from that immutable authority revision.
`scripts/sync_item_i18n.py` deterministically generates
`assets/js/i18n/items_i18n.js`; the generated JavaScript is a checked-in build
input and must not be edited by hand. The authority retains names outside
Unitxt and replaces matching Chinese names from `psobb-localization`'s unified
mixed-width `zh/unitxt_j.prs`. Angular consumers render those values verbatim
with one-way binding. Search uses NFKC normalization, but display never performs
a global halfwidth/fullwidth conversion and exposes no width selector.
The same synchronization command refreshes monster names and named Mag evolution nodes while
preserving their rules and source metadata. Authored item labels use
`data-item-en` and resolve at build time; structured Black Paper and Coren reward
IDs must resolve to the current authority or generation fails.

Seasonal localization covers both initial content and fetched historical
fragments, including Christmas overview and archive bodies. Exact English casing
selects item identity before any unambiguous case-insensitive lookup; Hammer and
HAMMER cannot share a translation. Anniversary currency abbreviations use their
event context, and interactive quest replies repeat the same localization after
replacing the response text.


## Content and application routes

`/guide/launcher.html` documents Ephinea Launcher 3.5.2 in Chinese with English
control labels. It is a passive content route with scoped styles in
`assets/css/launcher-guide.css` and seven native Windows screenshots in
`assets/img/launcher/`. The home directory and graphics API guide link to it.
Capture provenance, setting interpretation and review results live in
[the launcher evidence record](EPHINEA_LAUNCHER_EVIDENCE.md); the focused
`npm run test:launcher-guide` checks are included in `npm test`.

PB mechanics have one authored home: `tools/mechanics.html#photon-blast`.
Keep all six skills' effects, stat scaling, usage analysis, limits and chain roles,
along with damage, healing, support levels, parameter definitions, chain/donation
rules, worked examples and PB illustrations there. The Mag guide and acronym
reference link to that section; they do not maintain separate PB formulas.
Reuse the six existing icons in `assets/img/mag/pb/`. Project documents record
ownership, sources and completion status, rather than duplicating the guide.

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

`/data/items.html` is the full item catalog; `/data/items/{slug}.html` is the
individual detail route. `scripts/generate_item_catalog.mjs` derives a compact
search index, server-only details and ignored `assets/data/items/*.json` from
committed facts. The build generates detail hosts directly from that inventory,
without maintaining an authored HTML file for every item. The browser loads
details per item, while prerendering transfers only the current item's data.
Each page has a 64,000-byte hydration-state limit; the full detail dataset is
not bundled into browser JavaScript. Filters and pagination use URL parameters.
Detail JSON requests append `?v=` with a hash of the whole generated detail set
(`src/app/generated/item-catalog/version.json`, bundled with the app), so a data
change is never served from a stale browser cache; the monster catalog does the
same with its own version file.

`/data/cosmetics.html` presents weapon hearts, ring paints and ring platings from
one generated dataset. The generator validates every heart's compatibility against
the Weapon hearts list page, resolves all targets, results and trade items to
catalog entries, and fails the build on unknown items, colors or events. Page-only
explanatory copy lives in `cosmetics-messages.ts` and shared section styles in
`catalog-sections.css`, so the list and detail bundles do not carry them.

All current catalog images come from Ephinea Wiki and are stored locally with
source URLs and SHA-1 checksums. The 57 ordinary shop weapon models have images
and variable-special descriptions. Mag feeding and evolution reuse the maintained
Mag datasets; item names use the canonical translation authority. Missing images,
unresolved names and unknown item codes are explicit coverage states. See
[the item catalog contract](ITEM_CATALOG.md) for counts, import steps and regression evidence.

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
totals. The current-year milestone chapter renders its synchronized UTC+8
snapshot timestamp through Angular's `PageUpdateStampComponent`. The stamp is
deliberately colocated only with the archived Buff, milestone and server-point
snapshot; static event rules and historical years do not present an update
timestamp. Historical external
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
on each clock tick. Holiday navigation links carry the same year-specific
activity IDs and derive their LIVE state from those active regions. Archived
or unannounced events cannot become active based on the month alone.
`tests/e2e/home-activities.spec.mjs` covers the retired anniversary link,
year-specific activation, cross-year Christmas dates and Pacific start/end
boundaries while the browser uses an Asia/Shanghai timezone. The boundary test
keeps the page open to verify that panels and navigation update together.

The landing page (`index.html` with `assets/css/index.css`) is a standalone
design: a sticky top bar with in-page anchors, a hero that pairs the site
positioning and primary calls to action with the live server panel (.beat
clock, Galatine ATP window, weekly RBS boost), the build-time weekly RBR
cards, the seasonal activity spotlight, a four-step onboarding strip and an
eight-card content directory grouped by topic. The onboarding strip is the
only home for the install, registration, localization and IME entries; the
directory's 安装与故障排除 (Installation & Troubleshooting) card covers post-install problems and does not
repeat them. Cards, buttons, spacing and
type share one token set in `index.css`; the activity spotlight uses the same
card surface with a static gradient top rule and a faint cyan grid, and
`prefers-reduced-motion` disables the remaining motion through the site-wide
reduced-motion contract. The content pipeline keeps only the page body and
local stylesheet links, so the landing page cannot rely on `<head>` font
links; the Orbitron display face is self-hosted from `assets/fonts/` via
`@font-face`, and body text uses the system Chinese font stack. Because the
Angular route host lays its children out as a centered flex column, the
full-bleed bands (top bar, hero, footer) declare `width: 100%` explicitly.

The completed 2026 anniversary spotlight is retired from the landing page; the
stable 周年活动 (Anniversary Event) navigation link remains the entry to its yearly archive. The
anniversary synchronizer owns only the 2026 archive fragment, so a manual
snapshot refresh cannot recreate the retired landing spotlight. Future active
seasonal events reuse the registry and renderer
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

The challenge guides publish 42 Episode I and 25 Episode II localized SVG maps
in Chinese, English and Japanese. All Episode I areas use authored routes,
mechanisms and instructions in `content/challenge-maps/ep1.json`, with measured
floor contours in `ep1-c1-geometry.json` through `ep1-c9-geometry.json`.
`build_challenge_map_atlas.py` renders those contours through the shared
`scripts/challenge_maps.py`; obsolete table renderers and the custom Area 05
path have been removed. Floor, interior walls, dark rooms, routes and captions
are separate layers. C1–C8 add 179 local instructions; the accepted C9 retains
its 31. Each stores source evidence, three translations, an anchor and a caption
box. Numeric puzzle insets, equipment quantities, distinct trap types and
wrong-choice markers preserve operating details. See the
[EP1 alignment ledger](CHALLENGE_EP1_ALIGNMENT.md) and
[C9 annotation audit](CHALLENGE_C9_ANNOTATION_AUDIT.md) for source disagreements
and scope limits.

All 25 Episode II maps use `content/challenge-maps/ep2.json` and five measured
geometry files (`ep2-c1-geometry.json` through `ep2-c5-geometry.json`). The same
renderer produces vector floors, source mechanism artwork, routes, 110 anchored
instructions and 44 localized item labels without embedded raster layers. Multiple
starts, letter-paired warps and tower completion are explicit. The page prose
links each stage to Ephinea and available Sakura references; see the
[EP2 alignment ledger](CHALLENGE_EP2_ALIGNMENT.md) for disagreements and limits.

`test_challenge_maps.py` checks both episode inventories, contour intersections,
complete route segments, source instruction inventory, mechanism requirements
and identical geometry across languages without the rendering toolchain.
EP1 generation samples each route segment at 1 px intervals with a 2 px floor
tolerance and requires at least 95% source-dash coverage. Reviewed teleport
connector ink exclusions are separate from walking routes. The shared
validators check symbols, warp endpoints and badge alignment.
`check_challenge_map_layout.mjs` checks every EP1 and EP2 caption in all three languages
for clipping, overlap and floor occlusion. Browser tests load every stage in
all guidance languages on mobile. `verify_challenge_maps.mjs` checks inventories,
source pins, dimensions and page references. Generation remains separate from
the production site build. See [Challenge Map Redraw](CHALLENGE_MAP_REDRAW.md)
for commands and the historical design investigation.

Both challenge guides share the `challenge-guide` page layout: episode links,
sticky stage anchors, per-stage area links, collapsible strategy and map legends,
and labeled figures. `ChallengeGuideBehavior` owns scroll position highlighting
and the native-dialog map viewer, with zoom around the visible center,
fit-to-width, mouse/pen drag panning, keyboard dismissal and focus return.
Touch retains native scrolling. The existing language behavior updates each map's source,
alt text and reserved image height together to prevent lazy-loading layout shifts.
The viewer opens the currently selected language. These behaviors are attached
through the content generator; page HTML contains no inline scripts. Map assets
and authored strategy content remain independent of the reading interface.
`challenge-viewer.spec.mjs` guards full-width captions, right-aligned buttons,
zoom-center preservation and drag/release behavior at mobile and desktop widths.
See the [final acceptance record](CHALLENGE_MAP_REDRAW.md#acceptance-and-review-2026-09-16) for review results and remaining limits.

The Seabed guide is a dedicated Chinese content route covering all eight Upper
and Lower map variants. It keeps route media, gameplay advice and server-specific
provenance together so readers can distinguish general PSOBB mechanics from
Ultima-specific equipment and timing recommendations. Angular explicitly owns
the eight-route accordion after hydration, publishes a readiness contract, and
keeps exactly one variant open for both pointer and keyboard activation.

The mechanics guide keeps its C/E explanatory figures in `tools/mechanics.html`
with page-scoped styles in `assets/css/mechanics.css`. Semantic HTML, decorative
inline SVG and native links/details provide the flow, outcome comparisons and
knockdown threshold without an additional JavaScript runtime. The D-section
class table scrolls within its own keyboard-focusable region on narrow screens.
`tests/e2e/mechanics.spec.mjs` checks exact authored item-authority keys before
display normalization, six viewport widths, keyboard interaction and scoped
accessibility. [The mechanics illustration record](MECHANICS_VISUAL_EVIDENCE.md)
lists the sources, verification results and review history for these figures,
including where the page's threshold wording differs from the Wiki summary.

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
Chinese equipment options, result names and named item effects come from the
canonical item dictionary at build time. Catalog unit modifiers remain attached
to their translated base names; catalog codes and shared presets stay unchanged.
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

Content sources never carry hand-maintained cache numbers. A root-relative asset
URL written with a bare `?v` (for example `/assets/img/guide/rbr/chart.svg?v`) is
stamped with the first 12 hex digits of the file's SHA-256 when content routes are
generated; a missing file or a manual `?v=N` fails generation. Stylesheets linked
from content sources are compiled into hashed Angular bundles and need no marker.

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
