# scripts/

One-shot Python scrapers that pull data from `wiki.pioneer2.net` and emit JS
data files consumed by pages in this repo. Re-run when the upstream wiki
data changes; commit the regenerated output alongside the script run.

| Script | Output | Source |
|--------|--------|--------|
| `scrape_gizonde.py` | `assets/js/volopt_data.js` | Vol Opt Gizonde stunlock tables |
| `scrape_price_guide.py` | `assets/js/price_guide_data.js` | Ephinea PSO price guide |
| `build_mag_data.py` | `assets/js/mag-evolution.js`, `assets/js/mag-sim-data.js` | Mags wiki page + Mag feeding tables |
| `download_wiki_mag_assets.py` | `assets/img/mag/wiki/*.png`, `assets/img/mag/colors/*.png` | Evolution sprites + 30 Mag color-reference screenshots |
| `build_rbr_data.py` | `data/rbr/source.json` | RBR candidate pool, current rotation, quest metadata, XP and enemy counts |
| `build_rbr_tier_charts.py` | `assets/img/guide/rbr/*-tier-section-colors.svg` | Curated tier layout using the BB drop table's canonical Section ID palette |

## Usage

```bash
python3 scripts/scrape_gizonde.py > assets/js/volopt_data.js
python3 scripts/scrape_price_guide.py > assets/js/price_guide_data.js
python3 scripts/build_mag_data.py
python3 scripts/download_wiki_mag_assets.py
python3 scripts/build_rbr_data.py
python3 scripts/build_rbr_tier_charts.py
```

The data builders use Python's standard library. The Mag asset downloader also
requires Pillow to validate cached PNG files and invokes `rtk curl` for
downloads.

`build_mag_data.py` writes both of its output files only after every parse and
audit has passed, so a failed run never leaves the two data blobs out of sync.
It can also run fully offline against raw-wikitext fixtures:

```bash
python3 scripts/build_mag_data.py --offline mags.wiki \
    --offline-feed magfeedtable.wiki --offline-feed-page feedtables.wiki
```

`mag.html` presents all 30 in-game Mag colors as two groups: the 18 original
Blue Burst colors and the 12 Ephinea-exclusive colors. The color picker uses
the same generated color list. Evolution sprites have a single cyan body
material; the browser recolors only that material with a shadow/base/highlight
ramp while retaining neutral details such as eyes, seams, and specular
highlights. Run `download_wiki_mag_assets.py` to restore either the evolution
sprites or the color-reference screenshots when an asset is missing.

## Tests

Node assertion scripts using this project's plain `check(name, cond)` convention
(no test framework, no dependencies). Each verifies the shape/behaviour of one
generated data file or JS module; run after regenerating data or touching the
corresponding source.

| Script | Verifies |
|--------|----------|
| `verify_mag_data.mjs` | `assets/js/mag-evolution.js` plus the 18+12 color split, color cards, and local image references |
| `verify_mag_sim_data.mjs` | `assets/js/mag-sim-data.js` (feed tables, mag cells) |
| `test_build_rbr_data.py` | RBR wiki parsers, full-clear enemy totals and quest abbreviations |
| `test_rbr_tiers.py` | Curated RBR Tier coverage: all 58 candidates exactly once |
| `test_rbr_tier_charts.py` | Generated SVGs are current and embed the canonical drop-table palette |

```bash
node scripts/verify_mag_data.mjs
node scripts/verify_mag_sim_data.mjs
python3 -m unittest scripts/test_build_rbr_data.py
python3 -m unittest scripts/test_rbr_tiers.py
python3 -m unittest scripts/test_rbr_tier_charts.py
```
