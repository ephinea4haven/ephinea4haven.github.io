# Angular Site Architecture and Migration Record

> Decision date: 2026-08-09
> Status: completed, release-validated and deployed from `master` (2026-08-10)

## Outcome

Angular 22 owns the complete public site: the landing page, error page, guides,
data references, event archives and interactive tools. All existing public URLs
remain valid, including `.html` paths and yearly event pages.

The production build currently contains 58 prerendered Angular application
hosts and 45 event content fragments. The generated build manifest is the
authoritative inventory; every application host is covered by the production
browser suite before deployment.

jQuery, Bootstrap, Vue 2 and vue-multiselect are retired from the application.
There is no compatibility runtime or parallel implementation. Angular Router is
the sole application router. Explicit redirects remain only for products that
were intentionally moved to independent sites; they are not migration fallbacks.
Git history is the rollback mechanism.

## Page model and static hosting boundary

The site remains a static GitHub Pages application. Angular Router defines the
canonical route inventory and the production build prerenders every route. A
post-build verifier maps prerendered output back to the exact historical file
path where Angular's directory convention differs, so direct navigation and
refresh never depend on a server rewrite rule.

Pages use one of two explicit models:

- content routes are repository-owned structured content rendered inside the
  shared Angular page shell and fully present in prerendered HTML;
- application routes are standalone feature components with typed state and
  lazy-loaded domain code.

Repository-owned HTML files remain content sources so large reference documents
stay easy to edit and retain their historical paths. They contain no scripts or
inline event handlers. The build converts them to standalone Angular components;
only the prerendered Angular result is published at an application URL.

Angular builds first into a temporary, ignored directory. The existing site
builder then installs its content-hashed browser assets and prerendered route
documents at the historical paths, validates all local references and includes
them in the deterministic release manifest. `_site` remains the only deployed
artifact.

## Ownership boundaries

- `src/app/`: application bootstrap, route inventory and shared page shell.
- `src/app/content/`: scoped behaviors for document-oriented Angular routes.
- `src/app/events/`: event archive and localized event views.
- `src/app/data/`: interactive data-reference views.
- `src/app/status/`: character simulator presentation, typed calculation domain
  and immutable item catalog.
- `src/app/chartable/`: level-table presentation and navigation.
- `src/app/combo/`: shared multiplayer/one-person-mode presentation.
- `src/app/generated/`: ignored modules produced from immutable build inputs.
- `assets/js/`: non-published datasets used by generators and JSON resources.
- `scripts/`: upstream synchronization, verification and release construction.

Components are standalone and zoneless. Angular Router uses lazy route entries.
State is local signals and derived values; services are used only at I/O or
domain boundaries. This keeps game rules testable without a browser and prevents
framework concepts from entering the calculation model. Pure content does not
pay for feature code.

The Status tool preserves the established three-column character, material and
equipment workflow while Angular owns all state and rendering. Its result table
uses an internal horizontal viewport on small screens, resistance codes retain
their canonical EFR/EIC/ETH/EDK/ELT names alongside localized Chinese, English
and Japanese labels, and the compact build link serializes the complete current
configuration for sharing.

## Combo upstream contract

PSOStats remains the source for Combo Calculator datasets and calculation rules.
The sync job verifies the pinned upstream revision, extracts normalized data and
checks calculation fixtures. It no longer replaces Haven HTML or framework code.
The upstream copyright notice and MIT license continue to ship with the tool.

Any upstream rule change must update normalized data or domain code together with
regression fixtures. Presentation differences are intentionally Haven-owned and
are not treated as sync drift.

## Anniversary archive contract

The anniversary route owns a fixed 2016–2026 year manifest and loads each
committed year as an event content fragment. Year navigation is a
default-collapsed overlay drawer that does not alter content geometry; its
toggle, backdrop and Escape key share the same Angular-owned state. Narrow
screens keep the drawer vertical and move the collapsed control to the lower
safe area. Every year uses the shared archive toolbar, themed hero and chapter
presentation, while section links retain the selected year instead of falling
through to the site root.

PSOStats anniversary telemetry is archived only for the upstream years that
exist: 2021, 2022, 2023 and 2025. Each of those fragments keeps its published
quest totals and complete Overall Lap TA ranking, including available MAE
splits. Missing or inconsistent upstream fields are called out rather than
copied into another year or inferred locally.

## Release gates

The migration is complete only when all of the following pass:

1. locked dependency install and `npm audit`;
2. domain/data and upstream-sync tests;
3. two byte-identical production builds;
4. route-inventory checks and representative Playwright coverage for every page
   family, plus behavior tests for every interactive route;
5. browser console/page-error rejection on every route and axe WCAG A/AA audits;
6. gzip budgets for each emitted chunk and each route's actual initial download;
7. repository search and artifact checks proving the retired runtimes are absent.

The migration was completed in working vertical slices. The complete route
inventory now uses Angular and every retirement gate passes.

The deployed production artifact is required to match the release-validated
build. A `master` deployment cannot publish unless dependency audit, business
tests, deterministic rebuild verification and the complete Playwright suite all
succeed.

Status browser coverage includes all three language variants, input and reset
flows, material-plan presets, calculation diagnostics, equipment validity,
rarity colors, special effects and the serialized build link.

The aggregate JavaScript ceiling is an artifact-health guard, not a per-user
payload target: content and feature routes are lazy chunks, so the stricter chunk
and route ceilings govern what a visitor downloads. The aggregate ceiling grows
only when additional historical routes enter the verified Angular inventory.
