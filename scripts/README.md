# scripts/

This directory contains deterministic build checks, upstream synchronizers and
data generators. Browser UI belongs to Angular; generated JavaScript datasets
are build inputs and are not copied into the published artifact.

| Script | Responsibility |
|---|---|
| `build_site.mjs` | Generate, prerender, validate and atomically publish `_site`. |
| `generate_angular_content.mjs` | Convert content sources and datasets into lazy Angular routes. |
| `sync_item_i18n.py` | Generate the site's item dictionary from the sole authority, sibling `droptable/i18n_names.json`. |
| `generate_angular_combo.mjs` | Normalize the pinned PSOStats calculation/data boundary. |
| `import_challenge_source_maps.py` | Import the original Episode I map images embedded in the archived PSO World PDFs. |
| `build_challenge_map_atlas.py` | Build the localized Episode I challenge-map atlas. |
| `build_ep2_challenge_map_atlas.py` | Build the localized Episode II atlas from pinned Ephinea Wiki source maps. |
| `verify_angular_architecture.mjs` | Reject retired runtimes, scripts and inline handlers in page sources. |
| `verify_challenge_maps.mjs` | Verify original challenge-map inventories, dimensions and page references. |
| `verify_status_domain.mjs` | Verify all character/equipment mappings and status calculation fixtures. |
| `sync_combo_calculator.mjs` | Synchronize verified PSOStats rules, data, license and provenance. |
| `sync_anniversary_milestones.mjs` | Synchronize the official 2026 milestone snapshot, shared UTC+8 timestamp and eight boost dimensions, and report when the final threshold and all rewards are complete. |
| `scrape_gizonde.py` | Generate Vol Opt data from the Ephinea Wiki. |
| `scrape_price_guide.py` | Generate price-guide data from the Ephinea Wiki. |
| `build_mag_data.py` | Generate Mag evolution and feeding data. |
| `download_wiki_mag_assets.py` | Download and validate Mag image assets. |
| `build_rbr_data.py` | Build an RBR diagnostic snapshot from Wiki data; `--require-current` rejects a stale or inconsistent Wiki mirror. |
| `plan_rbr_update.py` | Validate three abbreviations extracted from `/rbr`, render both candidate Wiki templates and a local projection, and preview them without publishing either target. |
| `build_rbr_tier_charts.py` | Build RBR tier SVGs. |

Common verification:

```bash
npm test
npm run build
npm run test:e2e
npm run release:prepare
```

For Combo ownership and synchronization rules, see
[`SOP_COMBO_CALCULATOR_SYNC.md`](../docs/SOP_COMBO_CALCULATOR_SYNC.md).
For RBR source ownership and the manual weekly validation flow, see
[`RBR_DATA.md`](RBR_DATA.md).

The Mag builder can operate on offline wiki fixtures:

```bash
python3 scripts/build_mag_data.py --offline mags.wiki \
  --offline-feed magfeedtable.wiki --offline-feed-page feedtables.wiki
```

Python data builders use the standard library unless their own help text states
otherwise. `download_wiki_mag_assets.py` uses Pillow for image validation.
`import_challenge_source_maps.py` requires Poppler's `pdfimages` command and
extracts the embedded Episode I map images without rendering or resampling.
The imported PNG files are committed, so production builds do not require the
source PDFs or Poppler. Episode II retains the archived JPEGs for provenance,
but the published atlas is generated from the pinned high-resolution Ephinea
Wiki PNGs under `assets/img/challenge/ep2/original/wiki/`.
