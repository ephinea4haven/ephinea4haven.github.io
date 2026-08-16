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

## Automated RBR publication

`.github/workflows/sync-rbr.yml` checks the Ephinea Wiki every hour on UTC
Sunday. It publishes at most one verified RBR snapshot per UTC week:

1. The current-rotation template must name the current UTC Sunday and contain
   one eligible quest for Episodes 1, 2 and 4.
2. The RBR Tracker current markers must match those three quests.
3. The generator and all RBR data tests must pass.
4. A changed `data/rbr/source.json` is committed directly to `master`, then the
   normal Pages workflow builds, tests and deploys that commit.

An incomplete Wiki update is a normal no-change result and is checked again by
the next scheduled run. Network, parsing and validation errors fail the run
without replacing the last verified snapshot. `workflow_dispatch` runs the same
gates for an immediate retry; it does not bypass source validation. Detailed
source and data-contract rules are documented in
[`scripts/RBR_DATA.md`](../scripts/RBR_DATA.md).

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
