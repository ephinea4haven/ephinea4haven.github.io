# Architecture & Optimization Notes

> Last updated: 2026-04-26

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

### 1. Drop Table Language Files Are Nearly Identical (High)

**Problem:** `en.js` and `zh.js` are both 27,362 lines with almost identical structure — differing only in item names.

**Fix:**
- Extract shared base data (drop rates, enemies, areas) into one file
- Language packs store only name mappings: `{ item_id: "Item Name" }`
- Expected reduction: ~50% in total data size

---

### 2. Inline CSS on Landing Page (Medium)

**Problem:** `index.html` has a large `<style>` block while all other pages use `unified-style.css`, creating inconsistency.

**Fix:** Move landing page styles into `unified-style.css` or a dedicated `index.css`.

---

### 3. No Shared HTML Template — Nav/Header Duplicated Everywhere (Medium)

**Problem:** Every HTML page independently manages its `<head>`, back link, and header. Changing navigation requires editing dozens of files.

**Fix:** Inject shared nav/header via JS, or introduce a lightweight SSG (e.g. Eleventy).

---

### 4. Game Data and Logic Mixed in JS Files (Medium)

**Problem:** Static game data is hardcoded directly inside `chardata.js` and `combo_calc.js`, tightly coupling data with calculation logic.

**Fix:** Extract static data to JSON files; keep JS files focused on computation only.

---

### 5. Manual Cache-Busting Version Numbers (Low)

**Problem:** `<script src="assets/js/index.js?v=1">` requires manual version bumps, which are easy to forget.

**Fix:** Add a simple build step (Python script or Makefile) to auto-generate content-hash query strings.

---

### 6. Christmas Event Pages Created Annually (Low)

**Problem:** `event/christmas20xx.html` is duplicated every year — 12 files so far, all nearly identical in structure.

**Fix:** Single data-driven page with year selection via URL parameter (`?year=2025`).

---

## Priority Summary

| Priority | Item | Expected Benefit |
|----------|------|-----------------|
| High | Deduplicate drop table language files | ~50% reduction in data size |
| Medium | Extract landing page inline CSS | Code consistency |
| Medium | Shared nav injection via JS | Lower maintenance cost |
| Medium | Decouple game data from JS logic | Improved maintainability |
| Low | Automated cache-busting | Prevent stale cache issues |
| Low | Data-driven Christmas event page | Eliminate annual file duplication |
