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
RxJS and TypeScript major releases require an explicit migration branch because
their compiler and runtime compatibility ranges must move together. Security
updates remain eligible independently and do not wait for the weekly
version-update batch.

Every dependency update must pass the same locked install, audit,
reproducibility, build and browser gates as an application change before it is
accepted.

## One-time activation

After the workflow is present on `master`:

1. Open repository **Settings → Pages**.
2. Change **Build and deployment → Source** from **Deploy from a branch** to
   **GitHub Actions**.
3. Run **Verify and deploy Pages** manually.
4. Verify `https://www.psohaven.com/`, `404.html`, the custom domain, HTTPS,
   and the key pages covered by `tests/e2e/site-smoke.spec.mjs`.

Do not switch the Pages source before the workflow has reached `master`.

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
