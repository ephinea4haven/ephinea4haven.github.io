# scripts/

One-shot Python scrapers that pull data from `wiki.pioneer2.net` and emit JS
data files consumed by pages in this repo. Re-run when the upstream wiki
data changes; commit the regenerated output alongside the script run.

| Script | Output | Source |
|--------|--------|--------|
| `scrape_gizonde.py` | `assets/js/volopt_data.js` | Vol Opt Gizonde stunlock tables |
| `scrape_price_guide.py` | `assets/js/price_guide_data.js` | Ephinea PSO price guide |
| `build_mag_data.py` | `assets/js/mag-evolution.js`, `assets/js/mag-sim-data.js` | Mags wiki page + Mag feeding tables |
| `build_rbr_data.py` | `data/rbr/source.json` | RBR candidate pool, current rotation, quest metadata, XP and enemy counts |
| `build_rbr_tier_charts.py` | `assets/img/guide/rbr/*-tier-section-colors.svg` | Curated tier layout using the BB drop table's canonical Section ID palette |

## Usage

```bash
python3 scripts/scrape_gizonde.py > assets/js/volopt_data.js
python3 scripts/scrape_price_guide.py > assets/js/price_guide_data.js
python3 scripts/build_mag_data.py
python3 scripts/build_rbr_data.py
python3 scripts/build_rbr_tier_charts.py
```

No external dependencies — every script uses only Python's stdlib (`urllib`,
`html.parser`, `subprocess`+`curl`).

`build_mag_data.py` writes both of its output files only after every parse and
audit has passed, so a failed run never leaves the two data blobs out of sync.
It can also run fully offline against raw-wikitext fixtures:

```bash
python3 scripts/build_mag_data.py --offline mags.wiki \
    --offline-feed magfeedtable.wiki --offline-feed-page feedtables.wiki
```

## Tests

Node assertion scripts using this project's plain `check(name, cond)` convention
(no test framework, no dependencies). Each verifies the shape/behaviour of one
generated data file or JS module; run after regenerating data or touching the
corresponding source.

| Script | Verifies |
|--------|----------|
| `verify_mag_data.mjs` | `assets/js/mag-evolution.js` (evolution graph data) |
| `verify_mag_sim_data.mjs` | `assets/js/mag-sim-data.js` (feed tables, mag cells) |
| `verify_mag_sim.mjs` | `assets/js/mag-sim-engine.js` (feeding/evolution engine) |
| `verify_mag_sim_planner.mjs` | `assets/js/mag-sim-planner.js` (reverse-search planner, intermediate fourth-evolution checkpoints, Cell evolution steps, and full engine replay) |
| `test_build_rbr_data.py` | RBR wiki parsers, full-clear enemy totals and quest abbreviations |
| `test_rbr_tiers.py` | Curated RBR Tier coverage: all 58 candidates exactly once |
| `test_rbr_tier_charts.py` | Generated SVGs are current and embed the canonical drop-table palette |

```bash
node scripts/verify_mag_data.mjs
node scripts/verify_mag_sim_data.mjs
node scripts/verify_mag_sim.mjs
node scripts/verify_mag_sim_planner.mjs
python3 -m unittest scripts/test_build_rbr_data.py
python3 -m unittest scripts/test_rbr_tiers.py
python3 -m unittest scripts/test_rbr_tier_charts.py
```
