# PSOStats Combo Calculator upstream synchronization SOP

## Purpose

Synchronize calculation rules and data from
[`phelix-/psostats-client`](https://github.com/phelix-/psostats-client) while
keeping Haven's Angular pages, static deployment, and license provenance
auditable.

The UI framework used by the upstream pages is not a runtime dependency of this
project. The synchronization process extracts only rules and data. It must not
reintroduce jQuery, Bootstrap, Vue, upstream HTML, or compatibility layers.

## File ownership

`npm run sync:combo` generates and updates:

- `assets/js/combo_calc.js`: an upstream calculation-rules snapshot with a
  license reference;
- `assets/js/combo_calc_multi_data.js`: the multiplayer data snapshot;
- `assets/js/combo_calc_opm_data.js`: the one-person-mode data snapshot;
- `third_party/psostats-combo/LICENSE`: the MIT license;
- `third_party/psostats-combo/upstream.json`: source URLs, commit, and SHA-256
  records.

These files are non-published build inputs, not browser entry points. Do not edit
them directly. The Angular build generator converts the data and calculation
boundary into temporary TypeScript modules under `src/app/generated/combo/`.
`src/app/combo/` independently owns templates, styles, state, and accessibility.

## Compatibility boundary

Here, compatibility means routine data and calculation-rule updates can continue
to use Haven's Angular presentation layer. It does not mean accepting arbitrary
upstream structural changes unconditionally.

| Upstream change | Expected result |
|---|---|
| Values or entries change inside the existing five datasets | Synchronize automatically while both modes remain valid JSON. |
| Calculation rules change within the existing domain-function boundary | Synchronize when the Angular adapter still applies and the complete release gate passes. |
| Upstream UI framework, HTML, or styles change | Exclude them from production; they affect synchronization only if they also break the data-extraction boundary. |
| Dataset names or count, extraction markers, function signatures, or browser dependencies change | Synchronization or generation must fail closed; update the adapter and regression tests explicitly. |
| The deployed script differs from the GitHub commit, or upstream content changes during synchronization | Stop synchronization and do not generate a mixed-source snapshot. |

Structural incompatibilities must not be bypassed by publishing upstream HTML,
restoring jQuery, Bootstrap, or Vue, or adding compatibility layers.

## Standard procedure

1. Inspect other working-tree changes. Do not use `reset` or `restore` to remove
   unconfirmed work.
2. Install locked dependencies and synchronize:

   ```bash
   npm ci
   npm run sync:combo
   ```

3. Review changes to `third_party/psostats-combo/upstream.json`, the three
   snapshots, and the license.
4. Verify that synchronization remains reproducible:

   ```bash
   npm run sync:combo -- --check
   ```

5. Run the complete release gate:

   ```bash
   npm run release:prepare
   npm audit --audit-level=low
   ```

6. Commit only reviewed snapshots, provenance records, the license, and any
   necessary generator or test changes.

## Required invariants

- The deployed script matches the recorded GitHub commit.
- Data for each mode contains `weapons`, `frames`, `classStats`,
  `enemyNameSort`, and `enemies`.
- The complete upstream license is published at
  `/third_party/psostats-combo/LICENSE`.
- Both historical URLs are served by the same Haven Angular component.
- The production artifact contains no jQuery, Bootstrap, or Vue runtime.
- All four enemy types, class switching, Shifta, sorting, removal, clearing, and
  mobile layout continue to work.
- Pages have no console errors, local-resource errors, or automated WCAG A/AA
  audit errors.
- Build budgets and determinism checks pass.

`scripts/sync_combo_calculator.mjs` identifies UI dependencies declared by the
upstream source to record provenance changes, not to install or copy those
dependencies. If an upstream template change makes the data boundary
unrecognizable, synchronization must fail. Update the extractor and regression
tests explicitly.

## Common failures

| Symptom | Resolution |
|---|---|
| Network or DNS failure | Retry after connectivity is restored; do not mix snapshots from different times. |
| Upstream commit and deployed script differ | Wait for the upstream deployment to stabilize, then retry. |
| Data boundary or required fields change | Update the extractor against the upstream source and add corresponding tests. |
| `--check` reports stale files | Synchronize again and review every new difference. |
| Provenance hash verification fails | Remove manual modifications and regenerate from the same source. |
| The Angular page no longer produces results | Fix the adapter boundary and regression tests; do not restore the retired framework. |

If a production regression is discovered, use `git revert` for a synchronization
commit with a clear boundary, rerun the release gate, and deploy. Do not manually
combine scripts and data from different versions.
