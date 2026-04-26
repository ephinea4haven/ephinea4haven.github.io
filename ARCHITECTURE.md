# Architecture & Optimization Notes

> Last updated: 2026-04-26
> The following are intentionally outside the refactor/cleanup scope per user direction (don't propose changes):
> - `data/droptable/` — opt-out by user
> - `assets/js/combo_calc.js`, `tools/cc.html`, `tools/ccopm.html` — third-party combo calculator, sync'd from upstream

## Overview

Pure static site — no build system, no package manager — served directly via GitHub Pages.

### Directory Structure

```
/                     ← Landing page (index.html)
/assets/js/           ← Core JS (~6 files)
/assets/css/          ← Stylesheets (~7 CSS files)
/data/droptable/      ← Drop tables (bb/dc/ngc/cn/en variants)
/data/                ← Misc data pages (14 HTML files)
/event/               ← Event pages, e.g. Christmas (12 HTML files)
/guide/               ← Guides (14 HTML files)
/tools/               ← Tool pages (13 HTML)
```

> Note: the quest editor (`pw`) is deployed separately at `pw.psohaven.com` from its own Kotlin Multiplatform repo; it is no longer part of this codebase. The landing page links out to it.

### Core JS Files

| File | Lines | Purpose |
|------|-------|---------|
| `assets/js/chardata.js` | 2500 | Character class definitions and stat data |
| `assets/js/combo_calc.js` | 1583 | Weapon combo and damage calculation engine |
| `assets/js/simulator.js` | 1056 | Character damage simulator |
| `assets/js/itemdata.js` | 359 | Weapon/armor/item database |
| `assets/js/index.js` | 121 | Landing page logic (Swatch time, RBS rotation, event tracking) |
| `data/droptable/shared/viewer.js` | 298 | Shared drop table rendering logic |

### Drop Table Data Files

| File | Lines | Notes |
|------|-------|-------|
| `data/droptable/bb/data/en.js` | 27,362 | BB English drop data |
| `data/droptable/bb/data/zh.js` | 27,362 | BB Chinese drop data |
| `data/droptable/dc/data/*.js` | — | DC variant, all languages |
| `data/droptable/ngc/data/*.js` | — | NGC variant, all languages |

---

## Issues & Recommendations

### 1. No Shared HTML Template — Nav/Header Duplicated Everywhere (Medium)

**Problem:** Every HTML page independently manages its `<head>`, back link, and header. Changing navigation requires editing dozens of files.

**Fix:** Inject shared nav/header via JS, or introduce a lightweight SSG (e.g. Eleventy).

---

### 2. Game Data and Logic Mixed in chardata.js (Medium)

**Problem:** Static game data is hardcoded directly inside `chardata.js`, tightly coupling data with calculation logic.

**Fix:** Extract static data to JSON files; keep `chardata.js` focused on computation only.

(`combo_calc.js` has the same problem but is excluded — see top-of-file scope note.)

---

### 3. Manual Cache-Busting Version Numbers (Low)

**Problem:** `<script src="assets/js/index.js?v=1">` requires manual version bumps, which are easy to forget.

**Fix:** Add a simple build step (Python script or Makefile) to auto-generate content-hash query strings.

---

### 4. Christmas Event Pages Created Annually (Low)

**Problem:** `event/christmas20xx.html` is duplicated every year — 12 files so far, all nearly identical in structure.

**Fix:** Single data-driven page with year selection via URL parameter (`?year=2025`).

---

## Priority Summary

| Priority | Item | Expected Benefit |
|----------|------|-----------------|
| Medium | Shared nav injection via JS | Lower maintenance cost |
| Medium | Decouple game data from JS logic | Improved maintainability |
| Low | Automated cache-busting | Prevent stale cache issues |
| Low | Data-driven Christmas event page | Eliminate annual file duplication |
