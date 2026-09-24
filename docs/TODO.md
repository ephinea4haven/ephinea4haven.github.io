# TODO

This document lists open work, ongoing maintenance requirements and completed
milestones. Detailed implementation and verification records live in the linked
documents.

## Open Work

Unchecked items remain open; listing an item here does not mean implementation
has started. Check an item only when its stated completion criteria are met.

- [ ] Extend Chinese, English and Japanese support to every public site page,
  including the homepage, guides, reference pages, tools and event archives.
  Cover navigation, page titles and metadata, body content and interactive UI;
  keep language selection consistent and preserve the selected language across
  navigation and reloads. Follow the verified PSOBB terminology and item-name
  authorities, including the [Chinese localization standard](PSOBB_CHINESE_LOCALIZATION.md).
  Complete this task when every public page has all three language versions
  reviewed for content parity and has passed language-switching and layout checks
  on desktop and mobile.
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

## Maintenance Guidelines

These are ongoing maintenance requirements, not pending tasks. Apply them when
making relevant changes.

- Maintain PB mechanics, formulas, usage guidance and examples only in
  [section G of the mechanics guide](../tools/mechanics.html#photon-blast).
  The Mag page, acronym table and project docs link there instead of maintaining
  separate explanations or formulas.
- Keep Angular and build tooling on stable, non-prerelease releases.
- For dependency or upstream-data changes, run `npm run release:prepare` locally
  and require the full CI gate, including locked installation, dependency audit
  and build reproducibility, as defined in the
  [release path](DEPLOYMENT.md#release-path) and
  [dependency update requirements](DEPLOYMENT.md#dependency-updates).
- Preserve historical public URLs and the static GitHub Pages deployment model.
- Keep generated third-party snapshots separate from Haven-owned Angular UI.

## Completed

Checked items record completion of the stated milestone, not the current
production version or authorization to publish later changes. Validation and
acceptance evidence belongs in the linked records. Deployment status follows
the successful Pages workflow for the relevant commit; see
[production verification](DEPLOYMENT.md#production-verification).

- [x] [Mag evolution chart](../tools/mag.html) colour preview and Mag detail
  images (2026-09-24): the 46 original-model renders were brightened with
  camera-relative lighting. Colour picks now tint only the model nodes the game
  client colours, using per-Mag masks in `assets/img/mag/color-mask/` on the same
  900 px renders, replacing the 64 px cyan Wiki sprites that painted the whole Mag.
  Item-catalog Mag details reuse the renders as their HD image, labelled as
  original model renders. The chart was then redesigned around the renders:
  large portraits lit by the selected Mag colour, a level timeline, trigger-rate
  bars, merged Lv.100 cards, a sticky named colour bar and phone layouts without
  horizontal page scrolling. The page nav now shows one section at a time
  (evolution chart, feeding tables, Mag colours, and triggers with synchro and
  IQ merged into a final tab); the old `#sync`, `#iq`, `#trigger` and sub-tab
  fragments still open their section. The node evidence (ItemMagEdit table, client-hardcoded
  nodes and part mapping) is recorded in bb-psov4
  `docs/psobb-mag-color-rendering.md`; in-game screenshot comparison and the
  exact colour/texture blend remain unverified. See the
  [colour mask record](../assets/img/mag/color-mask/README.md) and
  [item catalog record](ITEM_CATALOG.md#hd-detail-images-and-naming-updated-2026-09-24).

- [x] [Launcher settings guide](../guide/launcher.html) (2026-09-16): documented
  the main window, five OPTIONS pages and MORE, with seven English screenshots
  from Windows in Parallels Desktop. The Chinese guide explains save/reset
  behavior and links to the graphics guide. See the
  [capture evidence and closed review ledger](EPHINEA_LAUNCHER_EVIDENCE.md).
- [x] [Red-Wolf local archive](PSO_FRAME_ARCHIVE.md) (2026-09-16): acquired and
  hash-verified all 279 indexed files; checked image rendering on all 62 HTML
  pages and added a gallery of all 216 PNGs. Recorded 38 unavailable internal
  references and marked missing image positions. The source archive and ZIP
  remain local; gameplay verification and content-use decisions remain open.

- [x] [Mechanics guide section G](../tools/mechanics.html#photon-blast)
  (2026-09-15): consolidated all six PBs' mechanics, usage guidance, illustrations
  and worked examples. See the
  [mechanics guide review record](MECHANICS_VISUAL_EVIDENCE.md#user-acceptance-and-push-authorization).
- [x] [Monster catalog](MONSTER_CATALOG.md): a trilingual interface
  and names, difficulty and mode stats, and behavior and conditional mechanics
  tables. Ten-Section-ID drops are generated directly from droptable.
- [x] The home page shows the RBR quests from `data/rbr/source.json` and links to
  the detail page. A record not updated after the UTC Sunday rollover is clearly
  marked as pending. Cards show the tier, recommended Section ID and matching color
  from the shared rating data, with the rating date and unofficial status.
  See the [September 14, 2026 verification record](MONSTER_CATALOG.md#2026-09-14-release-verification).
- [x] All-category [item catalog](ITEM_CATALOG.md): illustrated entries,
  search/filter URLs, per-item detail pages and verified local images for ordinary
  shop weapon models. Current coverage is documented in the catalog record;
  initial validation is in the
  [September 14, 2026 release record](DEPLOYMENT.md#september-14-2026-item-catalog).
- [x] Item catalog visual refresh and zh/en/ja interface/name switching, with
  URL and local preference persistence, source-language mechanics labels and
  verified Japanese names with an explicit notice where a name is unverified.
  Chinese names use the drop-table authority. See
  [catalog coverage and interface](ITEM_CATALOG.md#coverage-and-interface).
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
  overview for weapon hearts, ring paints and ring platings, linked from the home
  page directory. Added compatibility, appearance, acquisition and reversal
  information, with matching sections and links on item and equipment pages.
  See the
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
- [x] September 10, 2026 homepage fix and dependency updates released: Angular
  patch group and deploy-pages merged, duplicate Hono PR closed, and the CI
  item-name authority path shared across business and browser tests. See the
  [verified release record](DEPLOYMENT.md#september-10-2026-release).
- [x] Standalone Mag feeder/planner deployment with legacy URL redirect.
- [x] [Challenge-map redraw and guide interface](CHALLENGE_MAP_REDRAW.md#acceptance-and-review-2026-09-16)
  (2026-09-16): all 42 EP1 and 25 EP2 areas use vector geometry and the shared
  renderer, with 201 localized SVGs, 320 anchored instructions and 44 EP2 item
  labels. Source/prose alignment and the shared navigation/map viewer are
  complete. Caption alignment, zoom anchoring and drag regressions pass;
  maintainer re-review is PASS and commit/push is authorized. The linked record
  preserves browser and live quest-event verification limits.
- [x] Standalone Chinese-language Seabed route, combat and equipment guide.
