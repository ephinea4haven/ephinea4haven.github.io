# scripts/

This directory contains deterministic build checks, upstream synchronizers and
data generators. Browser UI belongs to Angular; generated JavaScript datasets
are build inputs and are not copied into the published artifact.

| Script | Responsibility |
|---|---|
| `build_site.mjs` | Generate, prerender, validate and atomically publish `_site`. |
| `generate_angular_content.mjs` | Convert content sources and datasets into lazy Angular routes. |
| `generate_angular_combo.mjs` | Normalize the pinned PSOStats calculation/data boundary. |
| `verify_angular_architecture.mjs` | Reject retired runtimes, scripts and inline handlers in page sources. |
| `verify_status_domain.mjs` | Verify all character/equipment mappings and status calculation fixtures. |
| `sync_combo_calculator.mjs` | Synchronize verified PSOStats rules, data, license and provenance. |
| `scrape_gizonde.py` | Generate Vol Opt data from the Ephinea Wiki. |
| `scrape_price_guide.py` | Generate price-guide data from the Ephinea Wiki. |
| `build_mag_data.py` | Generate Mag evolution and feeding data. |
| `download_wiki_mag_assets.py` | Download and validate Mag image assets. |
| `build_rbr_data.py` | Build RBR quest and rotation source data. |
| `build_rbr_tier_charts.py` | Build RBR tier SVGs. |

Common verification:

```bash
npm test
npm run build
npm run test:e2e
npm run release:prepare
```

For Combo ownership and synchronization rules, see
[`SOP_COMBO_CALCULATOR_SYNC.md`](../SOP_COMBO_CALCULATOR_SYNC.md).

The Mag builder can operate on offline wiki fixtures:

```bash
python3 scripts/build_mag_data.py --offline mags.wiki \
  --offline-feed magfeedtable.wiki --offline-feed-page feedtables.wiki
```

Python data builders use the standard library unless their own help text states
otherwise. `download_wiki_mag_assets.py` additionally uses Pillow for image
validation.
