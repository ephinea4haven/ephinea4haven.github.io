# scripts/

One-shot Python scrapers that pull data from `wiki.pioneer2.net` and emit JS
data files consumed by pages in this repo. Re-run when the upstream wiki
data changes; commit the regenerated output alongside the script run.

| Script | Output | Source |
|--------|--------|--------|
| `scrape_gizonde.py` | `assets/js/volopt_data.js` | Vol Opt Gizonde stunlock tables |
| `scrape_price_guide.py` | `assets/js/price_guide_data.js` | Ephinea PSO price guide |
| `build_mag_data.py` | `assets/js/mag-evolution.js`, `assets/js/mag-sim-data.js` | Mags wiki page + Mag feeding tables |

## Usage

```bash
python3 scripts/scrape_gizonde.py > assets/js/volopt_data.js
python3 scripts/scrape_price_guide.py > assets/js/price_guide_data.js
python3 scripts/build_mag_data.py
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
