# PSOStats Combo Calculator

The Combo Calculator is synchronized from
[`phelix-/psostats-client`](https://github.com/phelix-/psostats-client), which is
licensed under the MIT License.

Run `npm run sync:combo` to refresh the generated calculator pages, per-mode
data scripts, calculation script, license, and provenance metadata. The upstream application injects its
weapon, frame, class, and enemy data from a Go server, so this repository takes
snapshots of the two rendered pages as well as the deployed JavaScript. The
sync verifies that the deployed calculation script exactly matches the recorded
GitHub commit; rendered page data is tracked separately by deployment hashes.

Haven-specific behavior belongs in `scripts/sync_combo_calculator.mjs`. The
adapter removes the PSOStats navigation, rewrites the Multiplayer/OPM links,
uses this site's vendored CSS and JavaScript dependencies, and adds local page
metadata. Do not edit the generated files directly; the next sync replaces
them.

The calculator shares the site's single jQuery 4.0.0 slim and Bootstrap 5.3.8
CSS assets. Their exact npm versions are pinned in `package.json` and copied by
`npm run sync:frontend`. Bootstrap JavaScript and Popper are intentionally not
published because none of the local or upstream calculator behavior uses a
Bootstrap JavaScript plugin. The sync migrates the upstream Bootstrap 4 form
markup to Bootstrap 5, supplies accessible names for upstream controls, and
replaces hidden-but-focusable enemy tag icons with accessible removal buttons.
Static verification rejects legacy markup or missing accessibility overlays;
Playwright runs both calculator modes through axe WCAG A/AA audits after real
enemy selection and removal interactions.

The generated JavaScript and pages contain an attribution banner. The build
publishes this directory's `LICENSE` at `/third_party/psostats-combo/LICENSE`.

The complete update, review, validation, failure-handling, and rollback
procedure is documented in
[`SOP_COMBO_CALCULATOR_SYNC.md`](../../SOP_COMBO_CALCULATOR_SYNC.md).
