# Deployment runbook

## Release path

Production is built and deployed by `.github/workflows/pages.yml`.

1. Pull requests run dependency audit, business tests, two reproducibility
   builds, and Playwright smoke tests.
2. A `master` push runs the same gates and uploads `_site` as the Pages
   artifact.
3. The deploy job publishes that exact artifact. It does not check out or
   rebuild the repository.

Local release verification:

```bash
npm ci
npx playwright install chromium
npm run release:prepare
```

The build is expected to report 58 Angular hosts and 45 event content fragments.
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

The workflow publishes only the artifact that passed the release gates; do not
copy files directly into the deployed site.

## RBR update validation

The retired `sync-rbr.yml` workflow no longer polls the Ephinea Wiki or
publishes site data. The authoritative weekly rotation is the in-game `/rbr`
output supplied by the maintainer. The manual
`.github/workflows/validate-rbr-update.yml` workflow accepts one abbreviation
for Episodes 1, 2 and 4, validates the current Wiki and Tracker revisions, and
renders candidate Wiki changes through read-only `action=parse` requests.

The validation workflow has only `contents: read`; it does not edit Ephinea
Wiki, write `data/rbr/source.json`, commit, or deploy. Ephinea Wiki publication
requires separate explicit approval. Detailed source and validation rules are
documented in [`scripts/RBR_DATA.md`](../scripts/RBR_DATA.md).

This is a completed read-only feasibility path, not a completed two-target
publication path. It currently accepts three extracted abbreviations rather than
raw `/rbr` text. Raw-output parsing, site snapshot publication, authenticated
MediaWiki editing, revision-conflict handling, partial-failure recovery and
idempotent cross-target retries remain unimplemented. The reported local
projection and Wiki diffs are candidates, not evidence that either target was
updated.

The two targets use different publication mechanisms. Haven is a static Pages
site: a future publisher must build a complete `data/rbr/source.json` from the
observed rotation, pass the RBR and production gates, commit to `master`, and
deploy that commit. Ephinea is MediaWiki: a future publisher must authenticate,
obtain a CSRF token, reread both template revisions and timestamps, submit
conflict-protected `action=edit` requests, and validate the API results. These
targets do not share a transaction, so the publisher must record per-target
results and support safe retries after a partial failure.

## Anniversary milestone publication

`.github/workflows/sync-anniversary-milestones.yml` reads the official 2026
milestone page at `:07` and `:37` during UTC hours 23 and 00–17 while the event
is active. A changed snapshot updates the landing page and 2026 anniversary
fragment together, runs the anniversary tests and production build, commits to
`master`, and dispatches the normal Pages workflow.

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
