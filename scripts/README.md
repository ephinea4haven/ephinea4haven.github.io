# scripts/

One-shot Python scrapers that pull data from `wiki.pioneer2.net` and emit JS
data files consumed by pages in this repo. Re-run when the upstream wiki
data changes; commit the regenerated output alongside the script run.

| Script | Output | Source |
|--------|--------|--------|
| `scrape_gizonde.py` | `assets/js/volopt_data.js` | Vol Opt Gizonde stunlock tables |
| `scrape_price_guide.py` | `assets/js/price_guide_data.js` | Ephinea PSO price guide |

## Usage

```bash
python3 scripts/scrape_gizonde.py > assets/js/volopt_data.js
python3 scripts/scrape_price_guide.py > assets/js/price_guide_data.js
```

No external dependencies — both use only Python's stdlib (`urllib`, `html.parser`).
