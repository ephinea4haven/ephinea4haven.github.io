# PSOStats Combo Calculator

The Combo Calculator is synchronized from
[`phelix-/psostats-client`](https://github.com/phelix-/psostats-client), which is
licensed under the MIT License.

Run `npm run sync:combo` to refresh the per-mode data snapshots, calculation
snapshot, license and provenance metadata. The upstream application injects its
weapon, frame, class and enemy data from a Go server, so the synchronizer reads
the two rendered upstream pages to extract data only. The sync verifies that the
deployed calculation script exactly matches the recorded GitHub commit; rendered
page sources are tracked separately by hashes.

Haven-specific behavior belongs in `scripts/sync_combo_calculator.mjs`. The
adapter verifies upstream provenance and extracts the calculation/data boundary.
Do not edit the generated snapshots directly; the next sync replaces them.

Haven owns the calculator presentation in `src/app/combo/`. Angular components
provide the Multiplayer and OPM views, accessible controls and interaction state.
jQuery, Bootstrap, Vue and upstream HTML are not application dependencies and
are never copied into the published artifact. Upstream dependency versions are
recorded only as provenance so a source-boundary change causes synchronization
to fail explicitly. Playwright exercises both modes and runs axe WCAG A/AA
audits after real enemy-selection and removal interactions.

## Compatibility contract

Compatibility means that routine upstream data and calculation updates can be
adopted without replacing Haven's Angular presentation. It does not mean that
arbitrary upstream structural changes are accepted silently.

| Upstream change | Expected result |
|---|---|
| Values change inside the five existing datasets | Synchronizes automatically when both modes remain valid JSON. |
| Calculation rules change behind the existing domain function boundary | Synchronizes when the Angular adapter still applies and the complete release gate passes. |
| Upstream UI framework, markup or styling changes | Ignored by the published application unless the data-extraction boundary also changes. |
| Dataset names/count, extraction markers, function signatures or browser dependencies change | Synchronization or generation fails closed; update the adapter and regression tests explicitly. |
| The deployed script differs from the recorded GitHub commit, or upstream content changes during a sync | Synchronization stops to prevent a mixed-source snapshot. |

An incompatible update must never be worked around by publishing upstream HTML
or restoring jQuery, Bootstrap, Vue or another compatibility runtime.

The generated calculation and data snapshots contain an attribution banner but
are build inputs, not browser entry points. The Angular generator converts them
to temporary TypeScript modules, and the build publishes this directory's
`LICENSE` at `/third_party/psostats-combo/LICENSE`.

The complete update, review, validation, failure-handling, and rollback
procedure is documented in
[`SOP_COMBO_CALCULATOR_SYNC.md`](../../docs/SOP_COMBO_CALCULATOR_SYNC.md).
