# Deployment runbook

## Release path

Production is built and deployed by `.github/workflows/pages.yml`.

1. Before an approved push, run the complete local release verification below,
   including the full Playwright suite against the production build. Record the
   result for the final release changes and obtain maintainer acceptance.
2. Pull requests and `master` pushes run a locked dependency install, dependency
   audit, business tests, one production build and `npm run test:e2e:smoke`
   with two workers. The smoke gate selects existing tests tagged `@smoke`:
   three-language homepages and search, language navigation and reload,
   representative page/resource loading, and status calculator interaction.
3. A `master` push uploads `_site` only after the smoke gate passes. The deploy
   job publishes that exact artifact without checking out or rebuilding it.
4. Run **Full verification** (`.github/workflows/full-verification.yml`) manually
   for independent CI verification. It runs business tests, dependency audit,
   two reproducible builds and all browser tests across three parallel shards
   against the same build. It never deploys and is available for independent verification or
   investigating runner-specific failures. Full local verification is required
   for every release, including framework, routing and build changes.

Full browser testing remains mandatory locally before an approved push. The
release CI smoke gate catches critical failures in its clean environment while
avoiding the full route sweep on every content release. The independent full
workflow is manual, not a scheduled task or an automatic deployment dependency;
it does not replace or defer any local pre-push check.

The build job checks out the pinned item-name authority into `droptable/` and
sets `DROPTABLE_I18N_AUTHORITY` for the entire job. Local business and browser
tests use `../droptable/i18n_names.json` by default; set
`DROPTABLE_I18N_AUTHORITY` to an absolute file path when using another checkout.

Local release verification (stop any preview server on port 4173 first):

```bash
npm run release:prepare
```

This command first removes the ignored generated outputs (`src/app/generated`,
`assets/data/items`, `assets/data/item-index.json`, `assets/data/monsters`,
`assets/data/ep3-cards`) so business tests start from the same state as a clean
CI checkout. It then performs a locked `npm ci`, dependency audit at the `low` threshold,
Chromium/system-dependency installation, all business tests, two builds and an
exact build-manifest comparison, the release CI smoke command with two workers,
and the full browser suite with four workers. Any failure stops the sequence.
Both browser stages set `CI=true` and disable retries, rejecting focused tests
and requiring a fresh production preview server. The full suite includes every
smoke case; the explicit smoke pass also verifies the CI selection command.

The local quality gate must be a superset of CI on the final release changes.
Do not push first and use CI as the first complete validation pass. GitHub
permissions, artifact upload and Pages deployment can only be verified remotely.
Local OS coverage does not prove Linux runner equivalence, which is why CI keeps
its own quality checks. If the configured npm registry needs overriding, use
`npm_config_registry=https://registry.npmjs.org npm run release:prepare`.

The September 28 build reports 3,802 prerendered Angular hosts and 135 event
content fragments across the site's Chinese, English and Japanese editions.
`_site/build-manifest.json` is the authoritative inventory. Artifact validation
rejects non-Angular application hosts, retired runtimes, missing local resources,
and operating-system metadata before `_site` is published atomically. The source
test gate separately rejects malformed HTML, unresolved relative content links
and invalid material-plan presets.

## October 6, 2026 Angular 22.2.1 review (PR #29)

Scope: upgrade the 11 direct Angular packages from 22.2.0 to 22.2.1 together,
including their four matching Angular tooling dependencies. TypeScript, RxJS,
dependency overrides, application behavior, route coverage and performance
budgets remain unchanged. The PR changes only the manifest and lockfile; local
review also aligns the declared Node floor with the installed toolchain.

Review evidence: [Angular release notes](https://github.com/angular/angular/releases/tag/v22.2.1)
and [CLI release notes](https://github.com/angular/angular-cli/releases/tag/v22.2.1).
The patch affects compiler expression handling, routing, SSR and development
watching, so acceptance includes the production release gate and the separate
local development integration test.

| Requirement | Verification | Status |
| --- | --- | --- |
| Consistent dependency versions and supported peers | Manifest/lock diff, locked install, dependency tree | Passed |
| No new dependency vulnerability | Low-threshold npm audit | Passed |
| Production behavior, localization and budgets unchanged | Business suite, two matching builds, 20 smoke and 4,170 full browser cases | Passed |
| Development watching, SSR and search still work | `npm run test:dev:integration` | Passed |
| Preserve cleaned history | PR merge base is current master; no historical Claude attribution in its added commit | Verified |

Finding PR29-01 (Should-fix / Fixed): `package.json` and the lockfile declared
Node `>=24.13.1 <25`, but Angular and its tooling require `^24.15.0` on Node 24.
The previous declaration admitted unsupported installations. Both manifests and
README now specify Node 24.15.0 or newer within 24. A semver subset check failed
before the correction and passed afterward; all executable validation uses
Node 24.15.0. A final `npm ci --engine-strict` also passed with zero vulnerabilities.

Final review verdict: **PASS**, with no open findings. `npm run release:prepare`
passed all business tests, audit, two identical build manifests, all 20 smoke
cases (7.6 seconds) and all 4,170 browser cases (7.0 minutes, four workers, zero
retries). `npm ls --all` reported no dependency-tree problems. The additional
`npm run test:dev:integration` passed template refresh, generated-content error
recovery, fresh search indexing, source restoration and both server shutdowns.
Only the two dependency files, Node prerequisite wording and this review record
remain changed; the test's temporary application edits were fully restored.

Build output: 3,802 prerendered routes / 135 fragments; shared JavaScript gzip
999,141 / 1,003,000 bytes, English 527,936 and Japanese 584,539 / 700,000 each.
Manifest SHA-256:
`95fcf836eb6b2fea05bd952965e940bc6df6b43ee580d162a95ff2c33e1a53a6`.
Local validation covers the merged dependency tree. Publication still requires
the matching master revision's successful Pages workflow.

## October 6, 2026 release CI split

The release workflow now builds once and gates upload on 20 existing browser
cases selected by `@smoke`; the full 4,170-case suite remains unchanged in scope.
`npm run release:prepare` now executes every local quality gate in one command,
including the exact smoke selection and stricter zero-retry browser checks.

Final verification of that complete command passed: locked installation, zero
vulnerabilities at the low threshold, all business tests, identical production
build manifests, all 20 smoke cases and all **4,170 browser cases** (four workers,
zero retries, 6.0 minutes). These are local results, not GitHub runner timings.
Build manifest SHA-256:
`042b59f2b90f2bbb8815b526c0600f5a8777c4729697efeee1cd4a36fa42d218`.

The first full pass exposed a race in the monster-name navigation tests: the
language button could still belong to the list while the detail route loaded.
Trace evidence confirmed the interrupted navigation. Epsilon, Epsigard and Gol
Dragon tests now assert the original detail name before switching languages;
three repeated passes (nine cases) and the final complete run passed. No retry,
timeout or expected result was weakened. Controlled release-script checks also
confirmed that command failure and differing build manifests abort later stages.

YAML and dependency checks confirmed that smoke precedes Pages upload and that
the manual full workflow retains reproducibility and three shards without a
deploy job. Final review found no remaining in-scope issue. Documentation-only
finalization is outside the production build inputs.

## October 6, 2026 weapon-special explanations

The maintainer reviewed the local BB-item and mechanics previews, then requested
review, documentation alignment, commit and push. Ordinary and ES special tables
now include Chinese/English/Japanese names and descriptions; section anchors and
mechanics section I cover effect activation, reduction, Ultimate android rules,
unit modifiers and corrections. Existing HP-drain wording is corrected, and ES
Zalure is explicitly exempted from the ordinary ATA check.

The [review ledger](MECHANICS_VISUAL_EVIDENCE.md#october-6-2026-weapon-special-alignment-review)
records source checks, the CI authority-path correction and regression evidence.
Item-only cells retain their exact canonical identities with less markup; no
build budget is raised. The release also updates transitive `source-map-js` from
1.2.1 to 1.2.2 to clear GHSA-68fv-2mgg-jv7q within existing dependency ranges.

Final local validation passed: locked installation, zero vulnerabilities at the
`low` audit threshold, the complete business suite, two byte-identical build
manifests, and all **4,170** browser tests (four workers, no retries). The browser
suite uses an explicit `DROPTABLE_I18N_AUTHORITY` path, matching CI's contract.
Build output: 3,802 routes / 135 fragments, published JavaScript gzip
999,675 / 1,003,000 bytes. Manifest SHA-256:
`042b59f2b90f2bbb8815b526c0600f5a8777c4729697efeee1cd4a36fa42d218`.
All four review findings are fixed; the final review verdict is PASS. The local
browser server needed permission to listen on its loopback port. No assertion,
release gate or budget was relaxed. Documentation-only finalization is outside
the published build input directories.

Commit and push are authorized. Publication is established only by the matching
pushed revision's successful Pages workflow.

## October 5, 2026 Epsilon translation alignment

The maintainer accepted the cross-project rename and authorized documentation,
commit and push. Epsilon and its related monster part, cladding, shield and
plating use the confirmed Chinese stem `厄普西隆`. English identities, game
mechanics, drop rates and source image bytes are preserved. Historical baseline
columns and negative test inputs retain the old spelling as evidence.

The source chain is psobb-localization
`cfeb6cacde0080c57af93d18e247b8c3e1bf2f1f` → droptable
`8b9d4ce361a07f0c191e10ec9db66b7986c89303` → Haven. Both CI authority checkouts pin that
exact dropchart revision. Monster, item and dictionary tests cover the actual
source keys, including the separate `Epsigard` part and `EPSIGUARD` equipment.
The Unitxt gate and dropchart full tests/build passed; all 101 local item and
monster browser tests passed before release preparation.

Full local release validation passed: `npm ci`, zero vulnerabilities from
`npm audit --audit-level=low`, `npm test`, two production builds with identical
manifests, and all **4,164** browser tests (four workers, no retries, 5.7 minutes).
The production build has 3,802 routes and 135 fragments. Build-manifest SHA-256:
`c5b34e7b5578bfac58f7b0d3c283fa1ca1703a5eac256aeb993e8256db3fa25c`.
The documentation-only finalization must preserve that same build manifest.
Sandboxed process/port restrictions interrupted initial tool invocations; the
successful build and browser gates ran with the required execution permissions.
No test expectations or release requirements were relaxed.
No Pages deployment is claimed until the matching pushed workflow succeeds.
In-game rendering and localization installer packaging are separate work.

## October 4, 2026 price-guide internationalization

The maintainer accepted the repair and authorized documentation alignment,
commit and push on 2026-10-04, with verification of the matching CI run.

The price guide now shares whole-identity translation across Chinese and Japanese,
keeps categories separate from item identities, and translates ordinary and
compound cells. Extraction preserves blank and duplicate header columns, restores
the independently priced ES weapon and paint groups, and excludes the Wiki
navigation box. Each edition contains 62 tables and 851 body rows, including the
attribute note. Item names without authority translations remain complete English
identifiers. This is not a full market-price refresh.

The [maintenance and repair record](PRICE_GUIDE.md) documents source ownership,
translation boundaries and regressions. `npm run test:price-guide` is included in
the business gate and reads committed inputs so it can run before Angular
generation on a clean CI checkout.

Publication requires the complete local business suite, dependency audit at the
`low` threshold, matching manifests from two production builds, and the full
browser suite. CI then repeats its locked-install/build gates, all three browser
shards and Pages deployment for the pushed revision. Acceptance is complete;
deployment is not established by local tests alone.

The first full local browser pass found an existing homepage hydration race:
4,149 tests passed, but an English-language click made during startup was lost.
A deterministic regression delays Angular scripts and clicks each edition's
server-rendered language selector before hydration. The selector now uses an
Angular host event binding, which participates in event replay, rather than a
native listener installed after rendering. The original navigation assertion is
unchanged. This correction is included in the release and requires another full
local verification pass before push.
The delayed-script regression and original cross-page test both passed ten
repetitions (20 runs) with the fix.

Final local release validation passed: locked installation, zero vulnerabilities
at the `low` audit threshold, the full business suite, identical manifests from
two successful production builds, and all 4,151 browser tests. The final build
contains 3,802 routes and 135 event fragments, with 1,000,969 / 1,003,000 bytes of
published JavaScript gzip. A post-documentation build must match that same
manifest; deployment remains verified by the pushed revision's CI result.

## October 4, 2026 RBR navigation and tier-chart presentation

The maintainer reviewed the local previews and authorized documentation alignment,
commit and push on 2026-10-04. The accepted result includes:

- Home RBR cards open the corresponding recommendation row in Chinese, English
  or Japanese. All 58 candidates have anchors, including grouped recommendations;
  positioning accounts for asynchronous Tracker rendering and request failures.
- Section ID names in the guide's prose have the existing game icons alongside
  them. The two charts retain colored cells and ID names, without icons or a
  ten-color legend.
- Both charts use one seven-column layout with matching displayed widths, cell
  sizes and type sizes. Unused positions have no visible grid cells. Only this
  week's RBR quests receive the current-rotation highlight.

The published JavaScript gzip ceiling changes from 1,000,000 to 1,003,000 bytes
to accommodate the compiled anchors and inline Section ID labels in this release.
The language, individual chunk, route, inline-script and hydration ceilings remain
unchanged. No dependency or weekly rotation data changes are included.

Release gates are the complete local business suite, dependency audit at the
`low` threshold, two production builds with identical `build-manifest.json`, and
the full browser suite. Targeted checks also cover translated/mobile geometry,
Section ID icon loading, grouped anchors, reloads and failed Tracker requests.
Publication is established only by the matching commit's successful build, all
three browser-test shards and Pages deploy job in **Verify and deploy Pages**.
The [RBR maintenance documentation](../scripts/RBR_DATA.md) records ownership and
regeneration details.

The first full local browser pass exposed an existing monster-detail reload race:
4,145 tests passed, but a language/condition/anchor case failed. Instrumented
repetitions confirmed that the component first reached the requested section,
then browser history restoration moved it back to the pre-reload position after
`pageshow`. Anchored monster details now own scroll restoration while active and
restore automatic browser scrolling on cleanup, including after a reload. The original scroll assertion
is retained, with additional checks for restoration ownership and returning to
the list. This release includes that correction so the known failure is resolved
before publication rather than deferred to CI.

## October 3, 2026 Booma-family claw HD artwork

The maintainer supplied and identified replacement HD artwork for Booma's Claw
(brown), Gobooma's Claw (gold) and Gigobooma's Claw (purple), reviewed the detail
previews, and authorized documentation alignment, commit and push on 2026-10-03.
The three canonical WebPs, source provenance and identity checksums were updated.
The [item catalog record](ITEM_CATALOG.md#hd-detail-images-and-naming-updated-2026-10-03)
documents the exact source bindings and regeneration procedure.

Local `npm run release:prepare` passed all business tests, the production build
(3,802 routes, 135 fragments and 999,893 / 1,000,000 JavaScript gzip bytes), and
all 4,139 browser tests before push. Additional browser checks verified the
served image bytes, successful image decoding and HD/standard switching on all
nine item/language detail pages. Visual inspection and independent review passed.
The published HD inventory remains 409 images for 415 item details, totaling
15,358,468 bytes. Item names, standard thumbnails and application code are unchanged.

Acceptance and push authorization are complete. Publication is confirmed by the
matching revision's successful build, all three browser-test shards and Pages
deploy job; local validation alone does not establish deployment.

## October 3, 2026 paired Mechguns and three-language item names

The maintainer reviewed and accepted the desktop/mobile item list, the ES and
TypeME previews, and the Chinese-, English- and Japanese-primary layouts, then
authorized documentation alignment, commit and push on 2026-10-03.

- Mechgun, Assault, Repeater, Gatling, Vulcan, ES Mechgun and TypeME/Mechgun
  use paired original-model previews with their verified photon colors. Lists
  and related cards use small thumbnails; details default to the model preview
  and retain the existing optional HD view where available.
- Item lists show the current language's name first, with the other two below
  it. Names come from maintained catalog data, and missing Japanese names remain
  explicitly unverified. Long names wrap on phones.
- Only the list loads the new name-layout styles. No dependency or build-budget
  increase was required. Normal site builds use the checked-in WebPs and source
  manifest; game assets and Blender are needed only to regenerate the renders.

Local verification passed the full `npm test` suite (including 32 item/gallery
tests), all 55 catalog browser cases, the name-authority and Angular ownership
checks, and the production build:
3,802 routes, 135 fragments and 999,893 / 1,000,000 published JavaScript gzip
bytes under Node 24. The browser checks verify two separate complete gun
silhouettes in all fourteen images, three-language switching, long names and
mobile layouts. Two older filter assertions were updated from Wiki title casing
to exact item routes and authoritative English names, then rechecked.

Acceptance and push authorization are complete. A push to `master` starts the
normal **Verify and deploy Pages** workflow; production publication is confirmed
only when that revision's build, all three browser shards and deploy job pass.
The local screenshots and passing local build do not establish deployment.

The first publication attempt, [run 37090294678](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/37090294678)
for `21a7995`, passed the build and browser shards 1 and 2. Shard 3 passed
1,377 tests but failed the two Combo state-restoration cases, so deployment was
correctly skipped. The same failure was reproduced locally: after enabling Auto
Combo, the test observed the updated URL and captured the still-rendered manual
results before Angular painted the automatic results. The trace confirmed that
the supposed automatic baseline exactly matched the previous manual baseline.

The follow-up waits for all automatic-combo row labels and disabled attack
controls before recording the baseline, and asserts that those results differ
from the manual calculation. The original exact reload comparison remains.
Related snapshots now wait for sorted/selected Combo rows and updated Status
stat cells. No production code, calculation, timeout or retry setting changed.
All 11 state tests passed five consecutive repetitions with two workers
(55/55), followed by the complete local browser suite (4,139/4,139).
The follow-up `6480bd1` passed the build, all three browser-test shards and Pages
deployment in [run 37091667935](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/37091667935).
Live checks confirmed all seven paired Mechgun thumbnails matched the committed
bytes and all three language editions displayed primary and secondary item names.

## October 2, 2026 search, development and bug-fix release

The maintainer authorized documentation alignment, commit, push and deployment.
The publication record is the matching commit's successful **Verify and deploy
Pages** workflow, including its build, three browser-test shards and deploy job.
Local verification alone does not establish publication.

The release keeps the existing homepage layout and adds or corrects:

- Homepage navigation remains reachable on narrow screens, including keyboard
  focus after resizing; long Japanese directory tags no longer widen the page.
- Combo and Status configurations follow their URLs through edits, reloads and
  language navigation. Combo also retains supported state when changing modes.
- Commander Blade and Smartlink share a compact, wrapping checkbox row instead
  of occupying separate full-size form-grid cells. Both modes use the same fix.
- The uncropped homepage background now uses 130,106-byte mobile and
  217,020-byte desktop WebP assets instead of the 659,858-byte source image.
  The source is kept outside the published assets.
- `npm run dev` provides Angular automatic updates, content regeneration and
  background search indexing, with recovery after corrected generation errors.
- Pagefind site search loads its dialog on opening and its runtime/index on a
  query. It searches the current language edition, supports maintained aliases
  and archived event years, and keeps the existing floating page controls usable.
- Resource budgets cover cold homepage loads, responsive image selection and
  deferred search downloads. Build-time normalization of Pagefind's unordered
  filter encoding preserves result membership and deterministic output; the
  pinned format is checked before normalization.

Local evidence before the maintainer's final Combo checkbox review: `npm test`
passed, the full browser suite passed 4,119 tests, and the subsequent search and
performance verification passed all 42 cases. Independent browser comparison
confirmed identical results for all six categories in each language before and
after index normalization. The development integration check also verified
source updates, error recovery, search refresh and complete shutdown.

The final checkbox regression first failed against the old artifact's stretched
label width. After the fix, all 47 focused browser checks passed: 18 checkbox
cases (three languages, two modes, 320/390/1440px), 11 calculator-state cases and
18 homepage-performance cases. Desktop and mobile screenshots were also reviewed.
Before the CI correction below, two production builds produced byte-identical manifests; the artifact has
3,802 prerendered routes and 135 event fragment resources. Published JavaScript
gzip initially measured 994,752 bytes on the local Node 26 installation. The
first CI attempt rejected the same files at 1,005,707 bytes under Node 24's
compression library; deployment did not run. Local release builds now require
Node 24 (`nvm use`), matching CI. Terser minifies both Pagefind scripts while
preserving the worker and error diagnostics. The corrected Node 24 build measures
999,645 bytes against the unchanged 1,000,000-byte budget, and a new 19.5 KB gzip
regression limit covers the search scripts themselves.
The corrected production artifact passed all 60 focused browser cases (search,
homepage performance and Combo options); the seven search generation checks also
passed, including repeated output and modification-time comparisons.

## September 29, 2026 unpublished Destiny archive

The maintainer approved organizing and pushing the Destiny research snapshot
without opening a public entry. `artifacts/destiny/` now retains normalized
data, source evidence, render scripts and a locally viewable preview. Raw client
archives, executables, captured source pages, decoded assets, discarded forum
images and machine-specific fixture symlinks are excluded from Git.

The snapshot has 517 drop names: 271 item-specific/variant previews, including
nine equipment particle previews without a character, and 246 explicitly
labelled shared category images. This is not a claim of complete in-game item
appearances. Item names remain English.

The production build does not consume the archive. No public menu, Angular
route or sitemap entry was added. The generated `_site` was checked for both
Destiny files and entry URLs; none were present. A push still starts the normal
Pages workflow for the existing site, but does not publish the research preview.

Local archive verification passed: 15 portable viewer/gallery tests from a
clean export of the Git index, 14 cross-version viewer tests against the sibling
dropcharts checkout, and hashes of all original dependencies and images for the
nine equipment effects. Portable checks are included in `npm test`; original
client-resource validation remains a separate explicit local command.

`npm run release:prepare` passed for this change: all business checks, the
production build and all 4,018 Playwright browser tests (5.3 minutes). These are
local results; the pushed commit must still pass the normal remote Pages gates.

## September 28, 2026 dependency updates and artifact validation

The maintainer approved integrating the updates on `master`, aligning the
documentation, then committing and pushing:

- [#26](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/26): all
  eleven Angular framework/build packages move to 22.2.0.
- [#28](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/28): marked
  moves from 18.0.12 to 18.0.14. The older 18.0.13 PR #27 is already closed.

The original Angular CI failure was reproduced locally. Its new Beasties
critical-CSS activator was incorrectly rejected as `non-Angular script (inline)`.
The shared script classifier now recognizes the exact generated body without
relaxing the unknown-script gate or changing any budgets. Regression coverage
uses the installed Angular optimizer and checks stylesheet activation in all
three homepage languages.

Local verification:

- Locked Angular installation and dependency audit passed with zero
  vulnerabilities; the subsequent marked update also audited cleanly.
- Full business tests passed, including the new classifier regression, which
  failed against the old rule and passed after the correction.
- Two Angular production builds produced byte-identical manifests. The combined
  marked update produced the same manifest and all 7,741 artifact file hashes.
  There are 3,802 routes, 135 fragments and zero unrecognized inline-script
  blocks. JavaScript gzip sizes are 955,173 / 1,000,000 bytes for Chinese/shared
  code, with English 519,117 and Japanese 576,068 / 700,000 bytes each.
- The full 4,018-test browser run passed 4,017 tests and exposed one asynchronous
  dialog-close assertion. Instrumentation confirmed that the dialog hides and
  restores focus before its queued `close` handler restores body scrolling.
  The shared EP1/EP2 assertion now polls for the same required unlocked state;
  both cases passed five repetitions each after the change.
- After the marked update, all nine focused protocol, stylesheet-activation and
  dialog-close browser checks passed. The complete browser suite must also pass
  in the Pages workflow for the pushed revision.

These are local validation results. The successful Pages run for the pushed
revision establishes production publication; PR integration alone does not.

## September 20, 2026 homepage multilingual release

The maintainer reviewed the local preview and approved committing and pushing
this release. The homepage now supports Chinese, English and Japanese, including
language preference, page metadata, live status and seasonal content. Linked
pages retain their actual translation coverage; the static prerender remains
Chinese. See [the architecture contract](ARCHITECTURE.md#homepage-internationalization-2026-09-20).

Onboarding has three shared steps: installation, registration and launcher
setup. Chinese and Japanese mention IME. The Chinese patch is linked below the
steps and in the setup directory only when Chinese is selected. English hero
copy uses normal letter spacing. The obsolete homepage timezone-guide link is
removed; weekly boosts rotate at Sunday 00:00 UTC in every browser timezone.

The full release check also exposed a pre-existing monster portrait reset when
changing between Normal and Hard. The image-selection source now tracks the
computed monster/appearance identity, so only a different monster or Ultimate
appearance resets it. The regression waits for the difficulty change to finish
before checking the retained selection; the previous assertion could pass before
navigation completed. The homepage cosmetics-link assertion now includes the
selected language query parameter.

Final local verification passed `npm test`, the production build (1,268 routes
and 45 event fragments; 957,501 / 1,000,000 JavaScript gzip bytes), and all
**1,455 browser tests**. The two corrected regression scenarios also passed
three consecutive focused runs each.

Publication is established by the successful Pages run for the pushed revision,
not by the local preview or a passing local build alone.

## September 27, 2026 BB item code table release

The BB item code table correction changes only Haven page content, one test and
the per-route JavaScript budget (160 KB to 170 KB; the page is 167,171 gzip
bytes). Local verification passed `npm test`, the production build (3,802
prerendered hosts and 135 event fragment resources; 954,784 / 1,000,000
JavaScript gzip bytes) and all 4,015 browser tests.

## September 27, 2026 badge alignment and status localization release

The approved release publishes droptable first, then Haven. Haven pins
`warmonipa/dropcharts@91a9e0f03ed6beeea14247c01faef1b815969db9`, which aligns the
Weapons badge and Team Points names by item code
([record](PSOBB_CHINESE_LOCALIZATION.md#2026-09-27-weapons-badges-and-team-points-by-item-code)).
psobb-localization and the client resources are unchanged. The Haven release
also completes the status simulator localization review and adds the
TypeGU/Mechgun HD image.

Local verification passed droptable's `npm test` and Unitxt name check, Haven's
`npm test`, the production build (3,802 prerendered hosts and 135 event fragment
resources) and all 4,015 browser tests.

## September 26, 2026 handgun and shotgun terminology release

The approved release publishes psobb-localization and droptable first, then Haven.
Haven pins `warmonipa/dropcharts@085d0c2a36fded23924ed4e44ab1b1be3d02a968`, which
contains the UN-12 光枪 names and droptable's banner-highlight and monster-area
changes. The client resources changed, but no client package was built in this
release.

## September 18, 2026 localization and drop-chart release

The approved release publishes droptable first, then Haven. Haven pins
`warmonipa/dropcharts@fa878d073e4cb0d0d8d47ab4582d52f37f043e27`; both repositories
use the same confirmed UN-10/UN-11 Chinese names. The client localization resources
are unchanged and require no repackaging.

Droptable publishes Normal/Ultimate monster names and portraits, monster/item
links to Haven, readable typography and URL-preserved table context. Haven
publishes the updated item dictionary and regenerated consumers. Bulk and Death
Gunner still use documented portrait placeholders.

Local verification passed droptable's 69 tests and actual Unitxt check, Haven's
business tests and build, and 64 focused browser tests. These local checks do not
replace the full Pages gates. Verify each repository's build and deploy jobs for
the pushed commit, then check the live BB assets and Haven item detail pages.

## September 18, 2026 catalog category selection

The maintainer accepted removal of the item list's All category and the monster
list's All episodes option. Defaults are Weapons and EP1. Auxiliary All filters
remain; search, reset and detail-return behavior retain the selected category or
episode. Direct detail links return to their own category/episode by default.

Local validation passed `npm test`, `npm run build` (1,268 routes), and all 59
item/monster browser tests. The approved desktop previews were inspected before
publication. The master push still requires the standard full Pages checks and
deployment; these local results alone do not establish production publication.

## Dependency updates

Dependabot checks npm packages and GitHub Actions weekly. Angular framework and
build packages are grouped with RxJS and TypeScript so their compatibility is
validated in one update instead of a sequence of temporarily mismatched pull
requests. This group automatically proposes minor and patch releases. Framework,
RxJS and TypeScript major releases require an explicit migration plan and a
compatible version set because their compiler and runtime ranges must move
together. Security updates remain eligible independently and do not wait for the
weekly version-update batch.

Every dependency update must pass the same locked install, audit,
reproducibility, build and browser gates as an application change before it is
accepted.

## September 16, 2026 dependency updates

The maintainer authorized processing the four open Dependabot PRs. The updates
were integrated on the current `master`, preserving the launcher guide and
multilingual project copy:

- [#22](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/22): Angular
  framework/compiler packages 22.1.5 → 22.1.6; build/CLI/SSR remain 22.1.7.
- [#23](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/23):
  Playwright 1.62.1 → 1.63.0, including its matching browser binaries.
- [#24](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/24):
  marked 18.0.11 → 18.0.12. The adjacent manifest/lockfile conflict with #23
  was resolved by retaining both new versions.
- [#25](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/25):
  Pillow 12.2.0 → 12.3.0 in the map-generation requirements.

Locked installation, `npm audit --audit-level=low` (zero vulnerabilities),
the complete business tests, and two production builds passed locally. The
build manifests are byte-identical: 1,268 routes, 45 fragments and 948,815 /
1,000,000 gzip JavaScript bytes. All 1,430 browser tests passed with Playwright
1.63.0 and Chromium 153.0.8010.12.

Pillow was also checked in an isolated Python environment with the complete
pinned map requirements. `pip check` passed, and regenerating all EP1/EP2 maps
into a temporary directory produced 201 SVGs byte-identical to the committed
assets. This explicitly covers the Python image-processing path that the
normal Pages workflow's structural map tests do not exercise.

Production publication still requires the full Pages build and deploy jobs to
succeed for the pushed revision; the local results alone do not establish it.

## Actions history cleanup — September 14, 2026

At the maintainer's initial request, a one-time cleanup deleted 34 of 39 completed
workflow runs, retaining the latest five across the repository (not five per
workflow): `34816485230`, `34813347099`, `34808521958`, `34807545578`, and
`34803541649`. Later that day, the maintainer requested retaining only the latest
three. A second cleanup deleted six of the then-nine runs, retaining
`34821846682`, `34820895893`, and `34819951807` at that point. The five runs kept
by the initial cleanup were all deleted in this second cleanup. No automatic
count-based retention was configured; future runs increase the count until the
next cleanup. Workflow configuration was not changed.

Historical release results below remain contemporaneous records, but deleted
runs no longer provide accessible logs or rerun targets. Their identifiers are
retained as plain text and explicitly marked as deleted. The old checks for
open dependency PRs #22, #23 and #24 were also deleted; their current check
rollups are empty. Validate those updates against the current base before
merging; the previously reported success is not a current merge gate.

### Cleanup review-fix-loop ledger

Scope: the one-time cleanup and its affected documentation, workflow state,
open-PR check records, and current deployment. Application feature review,
dependency upgrades, and automatic retention are outside this review.

| ID | Status | Root cause and affected scope | Verification |
| --- | --- | --- | --- |
| AC1 | Should-fix / Fixed | Deleting historical runs left five dead evidence links across this runbook and `scripts/RBR_DATA.md`. Preserved the original release claims and run IDs, removed invalid links, and labeled deleted records. | Reproduced HTTP 404 for run `34004094751`; repository-wide search identified four deleted run IDs across five links. A `rtk proxy node -e` assertion over all Markdown files passed: the sole remaining run link points to a retained run and all five removed links are explicitly labeled. `rtk git diff --check` passed; full diff review found no further issue. |

After the initial cleanup, the run-list API returned exactly its five retained IDs, matching the pre-cleanup
inventory's newest entries. Pages and RBR validation workflows remain active;
anniversary synchronization remains manually disabled. At that time, run
`34816485230` for `c45d6c4` reported successful build and deploy jobs, and the
production homepage returned HTTP 200. That run was deleted in the second
cleanup. The initial PR listing confirmed #22–#24 remained open with empty
check rollups; these are historical observations, not a current PR status check.

## Production verification

GitHub Pages is configured to deploy through GitHub Actions. After a production
run completes:

1. Confirm the `build` job (including `Run release smoke tests`) and `deploy`
   succeeded for the expected `master` commit. The three full-suite shards belong
   to the separate manual **Full verification** workflow, not this release run.
2. Verify `https://www.psohaven.com/`, `404.html`, the custom domain and HTTPS.
3. Confirm a representative content route and each dedicated interactive tool
   load the content-hashed Angular assets without console or resource errors.
4. For item catalog changes, verify `/data/items.html`, a shop weapon such as
   `/data/items/saber.html`, and its local image. Confirm the item count and
   source image checksum against `content/item-catalog/coverage.json` and
   `images.json`; an earlier deployment's successful run does not verify a later fix.

The workflow publishes only the artifact that passed the release gates; do not
copy files directly into the deployed site.

### September 15, 2026 mechanics illustrations

The mechanics guide adds a C-section decision flow and three outcome
illustrations, plus an E-section knockdown threshold chart with its source
limitations. The D-section class table scrolls locally on
narrow screens. Six item-reference attributes now match the authority's exact
keys; their item identities and Chinese names are unchanged.

Local validation passed 8 item-localization unit tests, 3 focused browser tests,
the production build, localization and Angular architecture checks. The build
contains 1,265 routes and 45 fragments, with 882,022 / 1,000,000 bytes of gzip
JavaScript. These are focused local results; the full-site release gates run on
the matching `master` push. [The evidence and closed review ledger](MECHANICS_VISUAL_EVIDENCE.md)
record the commands and remaining evidence limits.

After the matching Pages build and deploy succeed, verify
`/tools/mechanics.html#incoming-physical` and `#knockdown`: check the three
outcomes, C-to-E keyboard navigation, the expandable source note, and 320 px
layout including the class table. Local verification alone does not establish
production publication.

### September 14, 2026 monster catalog and home RBR

Local verification passed `npm test`, the production build, 11 new feature
browser checks and all 1,376 full-site browser checks. The artifact's JavaScript
gzip total is 874,366 / 1,000,000 bytes, with unchanged route, chunk and hydration
budgets. [The catalog contract](MONSTER_CATALOG.md) records coverage and source
limitations. Deployment status must be checked against the matching `master`
Pages run; these local results alone do not establish publication.

For production verification, open `/data/enemies.html`, a detail such as
`/data/enemies/chaos-bringer.html?diff=u&lang=en`, and `/`. Check the ten Section ID
cards against the pinned drop-table source, the selected damage context, and
the homepage RBR cards linking to `/guide/rbr.html`. The same authority checkout
provides both item/monster names and `bb/data/en.js`; do not copy drop values
into page sources.

The subsequent review-fix loop corrected monster section links and pagination,
preserved prose-only mechanic conditions and boss-phase context, and made image
synchronization recover corrupted cache files. Local validation passed all
1,382 browser checks, business tests and the production build (874,665 bytes
JavaScript gzip). Reproduction evidence and the closed finding ledger are in
[the monster catalog review record](MONSTER_CATALOG.md#2026-09-14-review-fix-loop-log).

Further fixes in `5a772d4` and `230766c` preserve detail return pagination and
localized list titles, make area search independent of interface language, and
remove retired generated monster assets. The initially uncommitted home RBR
changes were then committed and pushed in `548e78e`; cards now show Tier,
recommended Section ID and its color using shared rating data.

[Pages run 34821846682](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/34821846682)
successfully built and deployed `548e78ec417c6918c59377d510c304436e6c6e67`.
Business tests, both production builds, their manifest comparison and all
1,386 browser tests passed. The artifact contains 1,265 routes and 45 fragments,
with 874,959 / 1,000,000 bytes of gzip JavaScript.

A live browser refresh and screenshot of `https://www.psohaven.com/` confirmed
the September 13 rotation: SR1, LDR and WoL5 each show Tier D; their recommended
IDs are Pinkal, Bluefull and Pinkal with matching borders and dots. The rating
date and unofficial label are visible. This verifies deployment and homepage
rendering; it does not reassess the ratings or independently recheck the game.

### September 10, 2026 release

Commit `186ce35fb96f772b82f45597bb797eb62c694b2e` passed both build and deployment
in Pages run `34427458809` (deleted in the September 14 history cleanup).
The run passed the locked install, dependency audit with zero vulnerabilities,
business tests, two reproducible builds and all 129 browser tests. The artifact
contains 58 prerendered Angular routes and 45 event content fragments.

- `f4f9f18` removed the landing navigation's recurring month-based event
  guesses. Navigation LIVE markers now use the same year-specific activity IDs
  and inclusive Pacific date windows as the activity panels. It also made the
  item-name authority path available to every build-job step.
- `49c03b8` upgraded the indirect Hono dependency from 4.13.1 to 4.13.7 to pass
  the dependency audit. [PR #21](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/21)
  was closed because its complete lockfile change was already on `master`.
- [PR #19](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/19)
  was merged at `abbd10d`, updating the pinned `actions/deploy-pages` action to
  5.0.1. [PR #20](https://github.com/ephinea4haven/ephinea4haven.github.io/pull/20)
  was merged at `186ce35`, updating Angular framework packages to 22.1.5 and
  Angular build, CLI and SSR packages to 22.1.7.

The homepage fix was first deployed by
Pages run `34427005202` (deleted in the September 14 history cleanup).
A live Chromium check confirmed that the anniversary archive link remained
available with no LIVE marker and no visible current-activity panels.

During local validation of the combined dependency updates, one existing
equipment-guide fragment-navigation assertion timed out. The unchanged focused
test then passed three consecutive runs, the unchanged full suite passed
129/129, and the final CI suite passed 129/129. No assertion was weakened and no
product workaround was added. If the timeout recurs, retain its Playwright
trace and investigate the navigation and viewport timing before changing code.

### September 14, 2026 item catalog

The complete catalog was deployed at `76d261cbffbe8cc372dd8b7de76123b64e69a630`
in Pages run `34801778747` (deleted in the September 14 history cleanup).
Both build and deployment succeeded. A live check verified the 1,044-item
inventory, the Saber detail page and the published image's original SHA-1.

Commit `5765cb18bf6255d6fee234d22d33e0df9b1ba9a1` fixes six reviewed issue classes:
mechanics extraction, ordinary weapon descriptions, incompatible URL filters,
Wiki markup parsing, missing Mag feeding values and image-failure messaging.
The [catalog review record](ITEM_CATALOG.md#convergence-review-log) records the causes,
affected scope and regression coverage. Its local validation passed `npm test`,
the production build, all 18 catalog browser tests and all 1,193 site browser tests.
The build contains 1,104 prerendered routes and 45 event fragments, with
825,653 / 1,000,000 gzip JavaScript bytes and a maximum item hydration state of
22,713 / 64,000 bytes.

These local checks do not assert that a later commit is already deployed.
For the fix and subsequent documentation commits, verify the latest successful
[Pages workflow](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/workflows/pages.yml)
against the expected `master` SHA. A new `master` push supersedes an unfinished
run under the workflow's concurrency policy.

### September 14, 2026 catalog language and visual update

The catalog now switches its interface and item names between Chinese, English
and Japanese, preserving URL filters and browser language preference. Detailed
mechanics retain labeled source-language notes. Japanese coverage is 817 items
(667 authority names and 150 recorded Wiki names); the other 227 explicitly
retain English. Chinese names continue to match the pinned authority.

The visual update adds cyan lighting, rare-item accents, framed screenshots and
responsive attribute panels. Validation also fixed narrow-screen text clipping,
Mag table overflow and catalog navigation scrolling. The previously recorded
equipment-guide anchor failure recurred during the full suite; retained traces
led to removing the document-wide forced smooth-scroll rule. Both affected
navigation scenarios passed 10 repeated runs with stronger destination checks.

Final local validation passed `npm test` (including 10 catalog data tests), the
production build and all **1,202 browser tests**, including 27 catalog tests.
The artifact has 1,104 routes and 45 event fragments; JavaScript gzip totals
842,140 / 1,000,000 bytes, with 153,622 bytes for the catalog's initial route,
154,993 bytes for item details, and at most 22,824 bytes of item hydration state.
All existing performance ceilings remain unchanged. Publication is confirmed
only by a successful Pages run for the pushed `master` SHA.

The first multilingual release attempt, `11e098c`, was blocked in
Pages run `34807545578` (deleted in the second September 14 history cleanup):
both production builds and their byte-identical comparison passed, but the
anniversary milestone anchor check failed twice; 1,201 other browser tests passed.
No deployment occurred. The boolean assertion did not log its coordinates.
Local reproduction with a 16.5px root font exposed the same assertion failure:
scroll offsets round to whole pixels while layout can place the heading a
fraction of a pixel above zero. The check now reports each boundary and allows
one pixel of rounding at either viewport edge, retaining full-heading visibility.
The 16px, 15.5px and 16.5px cases each passed three repeated runs. This test-only
follow-up expands the CI inventory to 1,204 tests; production code is unchanged.

## RBR update validation

The retired `sync-rbr.yml` workflow no longer polls the Ephinea Wiki or
publishes site data. The authoritative weekly rotation is the in-game `/rbr`
output supplied by the maintainer. The manual
`.github/workflows/validate-rbr-update.yml` workflow accepts one abbreviation
for Episodes 1, 2 and 4, validates the current Wiki and Tracker revisions, and
renders candidate Wiki changes through read-only `action=parse` requests.

The validation workflow has only `contents: read`; it does not edit Ephinea
Wiki, write `data/rbr/source.json`, commit, or deploy. Authenticated publication
of the two Wiki templates is a separate local command using an ignored,
mode-`600` credentials file. Detailed source, validation and publication rules
are documented in [`scripts/RBR_DATA.md`](../scripts/RBR_DATA.md).

The read-only validation path and local two-template Wiki publisher are
complete. The publisher uses authenticated `clientlogin`, CSRF protection,
revision and timestamp conflict guards, post-edit reads, and resumable handling
of either possible one-template partial state. It still accepts three extracted
abbreviations rather than raw `/rbr` text. Raw-output parsing, automated site
snapshot publication from that input and idempotent retries spanning both the
Git site and Wiki remain unimplemented. Manual Wiki snapshot synchronization,
review, Git submission and Pages deployment are available. A dry-run projection
is not evidence of publication; only the
publisher's verified revision results are.

The two targets use different publication mechanisms. Haven is a static Pages
site: a future cross-target publisher must build a complete
`data/rbr/source.json` from the observed rotation, pass the RBR and production
gates, commit to `master`, and deploy that commit. The local Ephinea publisher
already performs conflict-protected edits and verification for its two
MediaWiki templates. The Git site and Wiki do not share a transaction, so a
future cross-target publisher must record per-target results and support safe
retries after a partial failure.

When the maintainer requests synchronization from a Wiki already updated by
others, follow the manual procedure in `scripts/RBR_DATA.md`. Check the actual
snapshot diff: `--require-current` exits successfully without writing when the
mirror is pending, and skips fetching when the local snapshot is already current.
Record any maintainer-confirmed local date correction separately from the source
revision. A site correction does not edit the remote Wiki.

The September 6, 2026 rotation (`SU2 / LSR / WoL2`) was deployed at `e2c7678` in
Pages run `34004094751` (deleted in the September 14 history cleanup).
The site week was corrected to September 6; the Wiki read during synchronization
was dated September 5 and was not edited by this update. The run passed the
dependency audit, business tests, reproducibility checks and all 117 browser tests.

## Anniversary milestone publication

`.github/workflows/sync-anniversary-milestones.yml` reads the official 2026
milestone page at `:07` and `:37` during UTC hours 23 and 00–17 while the event
is active. A changed snapshot updates the 2026 anniversary fragment, runs the
anniversary tests and production build, commits to `master`, and dispatches the
normal Pages workflow. The completed event's landing spotlight is retired and
is not recreated by manual synchronization; its navigation entry remains.

GitHub scheduled events are best-effort: a scheduled run may be delayed or
dropped before a workflow run is created. A missing run therefore has no job
log to retry. Use `workflow_dispatch` for an immediate recovery run; it executes
the same fetch, validation, build, commit and deploy path.

The workflow disables itself only after the official total reaches the final
20,000-point threshold and all 16 rewards have been revealed. This ensures the
last reward is published before polling stops. A September 10 UTC sentinel
disables the schedule as an end-of-event fallback if the completion condition
never becomes publishable.

## Rollback

Preferred rollback:

1. Revert the faulty commit on `master`.
2. Let the normal workflow rebuild, test, and deploy the reverted source.
3. Verify the production URL and key pages.

Emergency rollback:

1. Open the last known-good **Verify and deploy Pages** workflow run.
2. Re-run that revision if the artifact is still retained.
3. If it is not retained, revert the faulty change on `master` or cherry-pick
   the last known-good state onto `master`, then let the normal workflow deploy.

Every rollback still passes the same build and test gates. Never copy files
directly into the deployed site. Manual runs from non-`master` refs verify the
artifact but are intentionally not allowed to deploy production.

## October 7, 2026 clean-checkout test dependency

The Pages run for `18bb3cc` (Episode III card catalog) failed in `npm test`
before building, so nothing was deployed. `test_ep3_card_catalog.mjs` checked
route registration through `devRoutes`, which reads
`src/app/generated/content.routes.server.ts` and the item and monster catalog
indexes. CI tests a clean checkout before any build, so those ignored files did
not exist. The local gate passed because files from earlier local builds were
still present.

The test now runs the item, monster and content generators before checking
routes. `release:prepare` removes the ignored generated outputs before `npm ci`,
so a test that depends on an earlier local build fails locally first. From that
clean state, `npm run release:prepare` passed: 0 vulnerabilities, all business
tests, reproducible build comparison, 21 smoke scenarios and 6,304 browser tests.
