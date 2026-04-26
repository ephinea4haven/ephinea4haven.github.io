# TODO

> Long-term architecture issues are tracked in [`ARCHITECTURE.md`](./ARCHITECTURE.md). This file tracks near-term, actionable work.

## Refactor / Cleanup

- [ ] **Migrate 5 standalone pages to `unified-style.css`**
  - `tools/200.html` / `tools/chartable.html` / `tools/status.htm` / `data/bdp/index.html` / `data/prizelist/index.html`
  - These pages don't link `unified-style.css`; each duplicates the body / glass-container / decoration rules inline.
  - Pain point: today's background redesign had to be applied in 5 places instead of 1, and any future change repeats the cost.
- [ ] **Rename `tools/status.htm` → `tools/status.html`**
  - The only `.htm` file in the repo; align with the rest of the site.
- [ ] **Extract large inline `<style>` blocks from `data/bdp/` and `data/prizelist/`**
  - Each carries 100+ lines of inline CSS — move to dedicated files under `assets/css/`.

## Project Layout

- [ ] **`CLAUDE.md` is out of date**
  - References `/static/`, `/ch/`, `/misc/` which no longer exist.
  - Actual current structure: `assets/`, `data/`, `event/`, `guide/`, `scripts/`, `tools/`.
  - Rewrite the "Architecture" and "Directory Layout" sections.
- [ ] **Audit the `data/` vs `tools/` boundary**
  - `data/` is currently mixed: drop tables, price guide, BDP table, prize list — all read-only/lookup pages.
  - `tools/` holds calculators (status sim, mag, materialplan, combo).
  - `tools/200.html` is a static stat lookup table, more naturally a `data/` page — consider moving.
- [ ] **Decide on `scripts/` (Python tooling)**
  - Is `convert_md_to_html.py` still actively used? It will be obsolete if Astro migration happens.
  - If kept, add a short README documenting each script's purpose.

## ARCHITECTURE.md High-Priority Items (cross-referenced)

- [ ] Deduplicate drop table language files — expected ~50% data size reduction (High)
- [ ] Extract `index.html` inline CSS (Medium)
- [ ] Shared nav/header injection mechanism (Medium)
- [ ] Decouple game data from calculation JS files (Medium)
- [ ] Convert Christmas event pages to data-driven single page (Low)

## Vite Tooling

**Decision (2026-04-26): Vite stays dev-only.** Deployment remains `push to master` → GitHub Pages serving the repo as-is. No `vite build`, no `dist/`, no structural reshuffle. Vite's role is HMR + dev-time cache busting; the project layout makes no concession to it.

Rationale:
- Production build would require registering ~60 HTML pages as MPA entries, separating `assets/js/` vendor libs (jquery/bootstrap/vue) from self-authored code, and migrating those libs to npm.
- Cost of full migration today >> benefit, given the site is otherwise stable static HTML.

Revisit when: cache-busting via `?v=N` query strings becomes painful enough to justify hashing.

- [ ] **Image optimization**
  - `assets/img/bg/lobby_overlook_contrast.png` is 7MB; converting to WebP would bring it to ~200KB.
  - One-shot manual conversion (no Vite plugin needed).

## Long-term (optional)

- [ ] **Consider migrating to Astro**
  - Split HTML into reusable `Layout` / `Header` / `Nav` components (resolves ARCHITECTURE.md #4).
  - Replace `convert_md_to_html.py` with Astro's native markdown handling.
  - Zero-JS by default → significantly better page performance.
- [ ] **Consider TypeScript**
  - Convert `chardata.js` (2500 LOC) and `combo_calc.js` (1583 LOC) to `.ts`; types help guard calculation correctness.

## Design follow-ups

- [ ] **Watch for vignette / scanline fatigue over long sessions**
  - Current values: vignette 0.75 black, scanlines 0.08 alpha.
  - If reading becomes tiring, drop vignette to 0.55 and scanlines to 0.05.
- [ ] **Review home / subpage visual consistency periodically**
  - Home: lobby image + vignette + scanlines.
  - Subpages: vignette + scanlines (no image).
  - Visual language is unified; if home gains new design elements, sync the subpage treatment accordingly.
