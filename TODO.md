# TODO

> Long-term architecture issues are tracked in [`ARCHITECTURE.md`](./ARCHITECTURE.md). This file tracks near-term, actionable work and decisions.

## Active

- [ ] **Decouple game data from `chardata.js`** (Medium)
  - Static class/stat data is hardcoded inside `chardata.js` (~2500 LOC). Extract to JSON; keep `chardata.js` focused on computation.
  - Audit consumers first (`simulator.js`, `tools/chartable.html`) to nail the data shape before splitting.
  - `combo_calc.js` has the same issue but is excluded — third-party sync, see Scope exclusions below.
  - Cross-ref: ARCHITECTURE.md issue #1.
- [ ] **Automated cache-busting** (Low)
  - Replace manual `?v=N` query strings on `<script>` / `<link>` tags with content-hash strings (e.g. md5 of file).
  - Could be a small Python script run pre-deploy, or a git pre-commit hook.
  - Cross-ref: ARCHITECTURE.md issue #2.

## Optional follow-ups

- [ ] **Extend `<page-chrome>` to support an inline langSwitch widget**
  - Two multilingual pages (`tools/status.html`, `data/protocol/index.html`) were skipped during the chrome-injection migration because their `<header>` carries an inline `#langSwitch` button row. To migrate them, extend `<page-chrome>` to either accept a `lang-switch="zh,en,ja"` attribute or render slot content inside the header.
  - Low priority — only 2 pages affected, current inline chrome works.

## Vite tooling

**Decision (2026-04-26): Vite stays dev-only.** Deployment remains `push to master` → GitHub Pages serving the repo as-is. No `vite build`, no `dist/`, no MPA entries. Vite's role is HMR + dev-time cache busting only.

Rationale:
- ~60 HTML pages would each need MPA entry registration.
- Vendor libs (jquery / bootstrap / vue / vue-multiselect / popper / marked) live as dropped-in `assets/js/*.min.js`; migrating to npm imports is significant churn.
- Site is otherwise stable static HTML; cost of full migration >> benefit.

Revisit when: cache-busting `?v=N` becomes painful enough to justify automated hashing (i.e. once "Automated cache-busting" above stops being deferrable).

## Long-term (probably won't, but documented)

- [ ] **Astro migration** — would give automated hashing, zero-JS by default, and cleaner shared layouts. But requires production build pipeline, MPA registration of ~60 pages, vendor lib migration to npm, and excluding the third-party combo calc sync. Currently overruled by the Vite dev-only decision; revisit only if multiple concrete pain points emerge.
- [ ] **TypeScript for `chardata.js`** — type safety on calculation data. No bug-driven motivation today; defer until a class/stat data bug bites or the chardata decoupling above is done (good time to add types alongside JSON extraction).

## Design follow-ups (passive)

- [ ] **Vignette / scanline fatigue check** after extended use. Current values: vignette 0.75 black, scanlines 0.08 alpha. If reading is tiring, drop to 0.55 / 0.05.
- [ ] **Periodic visual consistency review** between home (lobby image + vignette + scanlines) and subpages (vignette + scanlines, no image). If home gains design elements, sync subpage treatment accordingly.

## Scope exclusions

These are intentionally outside the refactor/cleanup scope (don't propose changes):

- `data/droptable/` — opt-out by user (dedup of `en.js` / `zh.js` 27k-line data files was previously proposed but rejected).
- `assets/js/combo_calc.js`, `tools/cc.html`, `tools/ccopm.html` — third-party combo calculator sync'd from upstream; local edits get clobbered on each sync.
