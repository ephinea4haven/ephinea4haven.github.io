# Deployment runbook

## Release path

Production is built and deployed by `.github/workflows/pages.yml`.

1. Pull requests run dependency audit, business tests, two reproducibility
   builds, and Playwright smoke tests.
2. A `master` push runs the same gates and uploads `_site` as the Pages
   artifact.
3. The deploy job publishes that exact artifact. It does not check out or
   rebuild the repository.

The build job checks out the pinned item-name authority into `droptable/` and
sets `DROPTABLE_I18N_AUTHORITY` for the entire job. Business tests and browser
tests must read the same checked-out authority; setting this variable only on
the business-test step leaves browser tests looking for the local sibling path
`../droptable/i18n_names.json`, which does not exist in CI.

Local release verification:

```bash
npm ci
npx playwright install chromium
npm run release:prepare
```

The September 14 build reports 1,104 Angular hosts (including 1,044 item detail
pages) and 45 event content fragments.
`_site/build-manifest.json` is the authoritative inventory. Artifact validation
rejects non-Angular application hosts, retired runtimes, missing local resources,
and operating-system metadata before `_site` is published atomically. The source
test gate separately rejects malformed HTML, unresolved relative content links
and invalid material-plan presets.

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

## Production verification

GitHub Pages is configured to deploy through GitHub Actions. After a production
run completes:

1. Confirm both the `build` and `deploy` jobs succeeded for the expected
   `master` commit.
2. Verify `https://www.psohaven.com/`, `404.html`, the custom domain and HTTPS.
3. Confirm a representative content route and each dedicated interactive tool
   load the content-hashed Angular assets without console or resource errors.
4. For item catalog changes, verify `/data/items.html`, a shop weapon such as
   `/data/items/saber.html`, and its local image. Confirm the item count and
   source image checksum against `content/item-catalog/coverage.json` and
   `images.json`; an earlier deployment's successful run does not verify a later fix.

The workflow publishes only the artifact that passed the release gates; do not
copy files directly into the deployed site.

### September 10, 2026 release

Commit `186ce35fb96f772b82f45597bb797eb62c694b2e` passed both build and deployment
in [Pages run 34427458809](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/34427458809).
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
[Pages run 34427005202](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/34427005202).
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
in [Pages run 34801778747](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/34801778747).
Both build and deployment succeeded. A live check verified the 1,044-item
inventory, the Saber detail page and the published image's original SHA-1.

Commit `5765cb18bf6255d6fee234d22d33e0df9b1ba9a1` fixes six reviewed issue classes:
mechanics extraction, ordinary weapon descriptions, incompatible URL filters,
Wiki markup parsing, missing Mag feeding values and image-failure messaging.
The [catalog review record](ITEM_CATALOG.md#收敛审查记录) records the causes,
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
[Pages run 34004094751](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/34004094751).
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
