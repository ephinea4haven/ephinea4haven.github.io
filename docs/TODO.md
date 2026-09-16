# TODO

## Active

- [ ] Finish the [challenge-map redraw](CHALLENGE_MAP_REDRAW.md): migrate the
  remaining 40 EP1 areas, remove the old renderer, extend structural tests to
  EP2, and complete per-map visual acceptance. EP1 Areas 1–2 and all 25 EP2
  areas currently use JSON data.
- [ ] Complete the claim-level audit of archived PSO FRAME slot3 (Red-Wolf)
  material. The [archive inventory and acquisition record](PSO_FRAME_ARCHIVE.md) (2026-09-16)
  locates readable Wayback captures, records 61 HTML page addresses plus the
  frame root and 217 image/icon addresses, and compares the major topics with
  Haven. All 279 indexed files are now downloaded to the local archive;
  38 additional internal references remain unavailable in the queried indexes.
  Content-use decisions await maintainer review. Individual gameplay claims,
  image content and BB applicability remain unverified.
  Restore information only when it adds content missing from those
  pages and its applicability to Ephinea PSOBB is verified. Complete this task
  when every inventoried topic has a documented restore/skip decision and reason,
  and every selected restoration has a destination link and has passed the
  relevant content and localization checks. Unresolved source or applicability
  questions must remain explicitly open.

## Maintenance

- PB mechanics text is maintained only in
  [section G of the mechanics guide](../tools/mechanics.html#photon-blast). It
  gathers each of the six skills' mechanism, stat effects, use cases and limits
  and chain role, together with parameters, damage, recovery and support formulas,
  chaining and donation, icons and worked examples. The Mag page, acronym table and
  project docs only link to it and never keep a separate copy of formulas or
  guides.
- Keep Angular and build tooling on stable, non-prerelease releases.
- Run the complete release gate for dependency or upstream-data changes.
- Preserve historical public URLs and the static GitHub Pages deployment model.
- Keep generated third-party snapshots separate from Haven-owned Angular UI.

## Shipped

- [x] [Red-Wolf local archive](PSO_FRAME_ARCHIVE.md) (2026-09-16): acquired and
  hash-verified all 279 indexed files; checked image rendering on all 62 HTML
  pages and added a gallery of all 216 PNGs. Recorded 38 unavailable internal
  references and marked missing image positions. The source archive and ZIP
  remain local; gameplay verification and content-use decisions remain open.

- [x] [Mechanics guide section G](../tools/mechanics.html#photon-blast): all six
  PBs have their game icon, a mechanism sketch, stat effects, use cases and limits,
  chain role and formulas. Added first-caster character and Mag parameter values,
  step-by-step truncation, light resistance, damage examples and a same-conditions
  comparison. Leilla's recovery amount, Mylla & Youlla's support levels, and the
  rules for donation, effective chain count and adjacent-repeat overwrites are each
  explained. Compiled from
  [Ephinea Photon Blasts](https://wiki.pioneer2.net/w/Photon_Blasts) without
  claiming in-game testing. The build, Chinese and architecture checks, 10 focused
  browser tests and desktop and phone display checks passed. The user accepted the
  work on 2026-09-15 and explicitly authorized commit and push; see the
  [mechanics guide review record](MECHANICS_VISUAL_EVIDENCE.md#user-acceptance-and-push-authorization).
- [x] [Monster catalog](MONSTER_CATALOG.md): 160 entries, a trilingual interface
  and names, difficulty and mode stats, and behavior and conditional mechanics
  tables. Ten-Section-ID drops are generated directly from droptable.
- [x] The home page shows the RBR quests from `data/rbr/source.json` and links to
  the detail page. A record not updated after the UTC Sunday rollover is clearly
  marked as pending. Cards show the tier, recommended Section ID and matching color
  from the shared rating data, with the rating date and unofficial status.
  `548e78e` is deployed and passed
  [production verification](MONSTER_CATALOG.md#2026-09-14-release-verification).

- [x] Full [item catalog](ITEM_CATALOG.md): 1,044 items across six categories,
  524 illustrated entries, search/filter URLs and per-item detail pages. All
  57 ordinary shop weapon models have verified local images. Follow-up review
  fixes and 1,193-test local validation are recorded in the
  [September 14 release record](DEPLOYMENT.md#september-14-2026-item-catalog);
  production status follows the latest successful Pages run for `master`.
- [x] Item catalog visual refresh and zh/en/ja interface/name switching, with
  URL and local preference persistence, source-language mechanics labels and
  817 verified Japanese item names. The remaining 227 show an explicit English
  name notice; Chinese names still use the drop-table authority.
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
- [x] [Cosmetic items](../data/cosmetics.html) (2026-09-15): one trilingual
  overview for all 31 weapon hearts, 14 ring paints and 9 ring platings, linked
  from the home page directory as 外观道具. Hearts list their compatible weapons,
  resulting appearance, Photon Filter combinations, drops, and Neutralizer
  reversal; paints and platings list their color or appearance, event, shop or
  The Forge trade sources, and Red Paint reversal. Item detail pages gained the
  same structured sections, equipment pages list the cosmetics that apply to them,
  and the Neutralizer joined the catalog. See the
  [item catalog record](ITEM_CATALOG.md#cosmetic-items).
- [x] Automatic cache busting (2026-09-15): content-page asset URLs marked with a
  bare `?v` are stamped with a content hash at build time, manual `?v=N` numbers
  are rejected, and item and monster detail JSON requests carry a dataset version
  bundled with the app.
- [x] Project documentation in English (2026-09-15): root README added, and all
  maintained docs translated. The docs contain no reverse-engineering material;
  the localization standard keeps the Chinese terms it defines.
- [x] Landing page redesign (2026-09-15): sticky top bar, hero with live server
  panel, onboarding steps, topic directory cards, self-hosted Orbitron; the
  RBR, activity and live-info contracts and their browser tests are unchanged.
- [x] Landing-page seasonal highlighting with reduced-motion support; LIVE
  markers and activity panels share registered yearly dates, so expired or
  unannounced events cannot be highlighted by month alone.
- [x] September 10 homepage fix and dependency updates released: Angular
  patch group and deploy-pages merged, duplicate Hono PR closed, and the CI
  item-name authority path shared across business and browser tests. See the
  [verified release record](DEPLOYMENT.md#september-10-2026-release).
- [x] Standalone Mag feeder/planner deployment with legacy URL redirect.
- [x] Original-source high-resolution map atlas for the Episode I and II challenge guides.
- [x] Standalone Chinese-language Seabed route, combat and equipment guide.
