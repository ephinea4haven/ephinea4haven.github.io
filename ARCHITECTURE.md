# Architecture & Optimization Notes

> Last updated: 2026-07-27
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
/event/               ← Event pages — `event.html` hub; `christmas.html` / `anniversary.html` data-driven templates; per-year fragments in matching subdirectories
/guide/               ← Guides (14 HTML files)
/tools/               ← Tool pages (13 HTML)
```

> Note: the quest editor (`pw`) is deployed separately at `pw.psohaven.com` from its own Kotlin Multiplatform repo; it is no longer part of this codebase. The landing page links out to it.

### Core JS Files

| File | Lines | Purpose |
|------|-------|---------|
| `assets/js/chardata.json` | 2500 | Per-class stat tables (pure JSON, fetched at load) |
| `assets/js/chardata.js` | 18 | Loader; sets `window.charDataReady` Promise |
| `assets/js/combo_calc.js` | 1583 | Weapon combo and damage calculation engine (third-party sync) |
| `assets/js/simulator.js` | 1066 | Character damage simulator |
| `data/droptable/shared/viewer.js` | 390 | Shared drop table rendering logic |
| `assets/js/itemdata.js` | 359 | Weapon/armor/item database |
| `assets/js/id.js` | 82 | Section ID calculator |
| `assets/js/index.js` | 111 | Landing page logic (Swatch time, RBS rotation, seasonal event highlighting) |
| `assets/js/page-chrome.js` | 30 | `<page-chrome>` custom element — injects standard subpage header + back-link |
| `assets/js/chartable.js` | 27 | Per-class stat table jump logic |

### Drop Table Data Files

| File | Lines | Notes |
|------|-------|-------|
| `data/droptable/bb/data/en.js` | 27,362 | BB English drop data |
| `data/droptable/bb/data/zh.js` | 27,362 | BB Chinese drop data |
| `data/droptable/dc/data/*.js` | — | DC variant, all languages |
| `data/droptable/ngc/data/*.js` | — | NGC variant, all languages |

---

## Landing-page seasonal highlights

The five event links in the landing page's **活动专题** group carry a `data-holiday`
identifier. `assets/js/index.js` adds `holiday-active` to links whose recurring
display window contains the visitor's local date; `assets/css/index.css` renders
that state as an animated rainbow highlight and disables animation when
`prefers-reduced-motion` is enabled. The **活动总览** link intentionally has no
identifier and is never highlighted.

| Event | Display window |
|------|----------------|
| Valentine's | February 1–28/29 |
| Easter | March 1–May 15 |
| Anniversary | August 1–September 15 |
| Halloween | October 1–November 10 |
| Christmas | December 1–January 15 |

---

## Issues & Recommendations

### 1. Manual Cache-Busting Version Numbers (Low)

**Problem:** `<script src="assets/js/index.js?v=1">` requires manual version bumps, which are easy to forget.

**Fix:** Add a simple build step (Python script or Makefile) to auto-generate content-hash query strings.

---

## Priority Summary

| Priority | Item | Expected Benefit |
|----------|------|-----------------|
| Low | Automated cache-busting | Prevent stale cache issues |
