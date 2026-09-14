# TODO

## Active

- [ ] Inventory the archived PSO FRAME slot3 (Red-Wolf) material, record version
  and provenance, and selectively restore only information that remains unique.
- [ ] Move manually versioned runtime data URLs behind the build manifest where
  this materially improves cache behavior.

## Maintenance

- Keep Angular and build tooling on stable, non-prerelease releases.
- Run the complete release gate for dependency or upstream-data changes.
- Preserve historical public URLs and the static GitHub Pages deployment model.
- Keep generated third-party snapshots separate from Haven-owned Angular UI.

## Shipped

- [x] Full [item catalog](ITEM_CATALOG.md): 1,044 items across six categories,
  524 illustrated entries, search/filter URLs and per-item detail pages. All
  57 ordinary shop weapon models have verified local images. Follow-up review
  fixes and 1,193-test local validation are recorded in the
  [September 14 release record](DEPLOYMENT.md#september-14-2026-item-catalog);
  production status follows the latest successful Pages run for `master`.
- [x] Unified 2016–2026 anniversary archive with 2026 milestones, stable overlay
  year navigation, responsive chapter navigation and shared year-themed presentation.
- [x] Full-site Angular modernization completed and release-validated; jQuery,
  Bootstrap and Vue retired from the application and production artifact.
- [x] Banner reference page based on the Ephinea Wiki banner documentation.
- [x] Canonical item-translation pipeline generated from the sole
  `droptable/i18n_names.json` authority, preserving Unitxt mixed-width names
  without a halfwidth/fullwidth selector.
- [x] Ephinea equipment-based Technique boost reference covering weapons,
  frames and barriers through the canonical translation catalog.
- [x] Landing-page seasonal highlighting with reduced-motion support; LIVE
  markers and activity panels share registered yearly dates, so expired or
  unannounced events cannot be highlighted by month alone.
- [x] September 10 homepage fix and dependency updates released: Angular
  patch group and deploy-pages merged, duplicate Hono PR closed, and the CI
  item-name authority path shared across business and browser tests. See the
  [verified release record](DEPLOYMENT.md#september-10-2026-release).
- [x] Standalone Mag feeder/planner deployment with legacy URL redirect.
- [x] Original-source high-resolution map atlas for the Episode I and II challenge guides.
- [x] Standalone Chinese Seabed route, combat and equipment guide.
