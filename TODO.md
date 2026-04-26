# TODO

> Long-term architecture issues are tracked in [`ARCHITECTURE.md`](./ARCHITECTURE.md). This file tracks near-term, actionable work.

## ARCHITECTURE.md High-Priority Items (cross-referenced)

- [ ] Shared nav/header injection mechanism (Medium)
- [ ] Decouple game data from calculation JS files (Medium)

## Vite Tooling

**Decision (2026-04-26): Vite stays dev-only.** Deployment remains `push to master` → GitHub Pages serving the repo as-is. No `vite build`, no `dist/`, no structural reshuffle. Vite's role is HMR + dev-time cache busting; the project layout makes no concession to it.

Rationale:
- Production build would require registering ~60 HTML pages as MPA entries, separating `assets/js/` vendor libs (jquery/bootstrap/vue) from self-authored code, and migrating those libs to npm.
- Cost of full migration today >> benefit, given the site is otherwise stable static HTML.

Revisit when: cache-busting via `?v=N` query strings becomes painful enough to justify hashing.

## Long-term (optional)

- [ ] **Consider migrating to Astro**
  - Split HTML into reusable `Layout` / `Header` / `Nav` components (resolves ARCHITECTURE.md "No Shared HTML Template").
  - Zero-JS by default → significantly better page performance.
- [ ] **Consider TypeScript**
  - Convert `chardata.js` (2500 LOC) to `.ts`; types help guard calculation correctness. (`combo_calc.js` is excluded — third-party sync, see ARCHITECTURE.md scope note.)

## Design follow-ups

- [ ] **Watch for vignette / scanline fatigue over long sessions**
  - Current values: vignette 0.75 black, scanlines 0.08 alpha.
  - If reading becomes tiring, drop vignette to 0.55 and scanlines to 0.05.
- [ ] **Review home / subpage visual consistency periodically**
  - Home: lobby image + vignette + scanlines.
  - Subpages: vignette + scanlines (no image).
  - Visual language is unified; if home gains new design elements, sync the subpage treatment accordingly.
