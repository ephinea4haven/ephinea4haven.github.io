# Destiny recovery — 2026-09-29

Recovered after `git clean -df` removed the untracked project. Git contained no recoverable Destiny tree. Scripts were reconstructed from the four 2026-09-28 Codex session records, including subsequent edits; generated outputs were rebuilt from source resources.

## Source provenance

- Normal drop-table HTML: retained local archive from yesterday.
- Weapons database: yesterday's retained browser DOM.
- Hard, Very Hard, Ultimate and Armor, Shields, Units, Mags: recaptured from the official website on 2026-09-29 after browser verification. These are data sources, never image sources. Matching structural counts do not prove byte-for-byte equality with yesterday.
- Thirteen inventoried client resources were recopied from the installed Destiny client and matched yesterday's recorded sizes and SHA-256 hashes. The client was not modified.
- Captured ItemPMT.prs was retained in the adjacent psobb-sniffers project. Its 1,756 records passed the existing dual-parser checks.

## Rebuilt result

- 12 drop tables, 494 rows, 4,940 cells; 517 distinct drop names.
- 1,022 database rows; 940 confirmed client-name correlations and 816 unresolved PMT names. Candidate identity is not runtime verification.
- 952 ItemKT images exported. Unsupported ItemKTep4 entry 45 remains documented.
- All published artwork uses client ItemKT or client model renders. The builder checks additional model/texture archive and entry hashes, PNG hashes and image type, and rejects website screenshots.
- 258 names have individual or variant previews; 259 have explicitly labelled shared category renders. Shared category art is not an individual item appearance. Four opaque ring previews were rejected.
- Judgement Blade now uses its client model render. Five additional approved model candidates include its recovered render, M&A85 Fury, Last Emperor, Twin Cyclone and Berserk Needle.
- Historical strict supplemental decoder failures remain in stage diagnostics; recovered candidates are recorded separately in the completion manifests.

## Validation and preservation

24 viewer/gallery tests passed, including rejection of official-screenshot input and complete image-source accounting. The final image and gallery builds succeeded with zero pending model visual reviews. The Python candidate-audit regression also passed. Browser verification confirmed the gallery counts, search filtering and the loaded 800-pixel Judgement Blade render. git clean -nd reports no removal candidates. Fresh contact sheets were visually reviewed and approvals bind the rebuilt PNG hashes.

This restores the functioning preview, source resources and build scripts; it does not claim every deleted experimental intermediate file was recovered byte-for-byte. No push or deployment was performed.

The repository .gitignore now excludes artifacts/destiny/ to protect it from ordinary git clean -df. It does not protect against git clean -xdf or manual deletion. A separate archive is saved at /private/tmp/destiny-recovered-20260929.tar.gz; move it to durable backup storage because temporary storage may be cleaned by the system.

## Subsequent image pass

The four ring source models were rendered at 800px and reviewed as static source-material previews. Their opaque source surfaces remain visible; they are not claimed to reproduce game runtime appearance. This supersedes the earlier assumption that missing graphical ring helpers explained their geometry. The current gallery has 262 individual/variant previews and 255 shared category images. Shared images are counted as missing individual appearances. Current evidence and source hashes are in `resources/completeness/red-ring-experiment/` and `completeness/remaining-appearance-audit.json`.

The subsequent image pass passed all 25 viewer/gallery tests and a fresh source/hash review. Browser checks verified the 255-item missing-appearance filter and all four new images loaded at 800px. Full ItemKT → supplemental model → additional model → gallery regeneration succeeded. No push or deployment.


## Armor particle preview pass

Added nine source-derived armor effect previews (five type 0, four type 1) with deterministic simulations and reviewed 800px PNGs. Each binds Destiny particle/texture inputs, stock rule metadata, simulator and renderer hashes. These are fixed-emitter-frame previews without a character, not Destiny runtime screenshots. No website pictures were downloaded or used in this pass.

Full KT → model → additional model/effect → gallery → missing audit regeneration passed. Current coverage: 271 item-specific/variant previews including nine equipment effects, 246 shared category images. `coverage.json` now uses `previewCount`, `missingPreviewCount`, and `effectCount`; it does not claim complete in-game appearance. Fresh review caught and fixed stale-preview cleanup potentially deleting a newer KT mapping; regression covers that sequence. All 29 viewer/gallery tests passed after regeneration. Browser verified the 271/517 header, 246 missing filter and loaded 800px Flame Garment image. Nine effect source/code/particle bindings and every dependency hash were independently reviewed. No push or deployment.


## Versioned research archive

The maintainer approved committing and pushing the reviewed snapshot while keeping it out of the public site. The directory now has a selective `.gitignore`: normalized JSON, research scripts/evidence and the ready-to-view Destiny preview are versioned; original client archives, raw captured pages, extracted binaries, experiment images and fixture symlinks remain local. Fifteen portable preview tests passed from an export of the Git index; the fourteen upstream-fixture tests also passed. Source hashes remain checked by `verify-effect-sources.mjs` with local resources. The production `_site` contains no Destiny files or entry URLs. This section supersedes prior statements that the entire directory is ignored; earlier recovery entries describe their original milestones.

Archive release validation: `npm run release:prepare` passed, including business checks, production build and all 4,018 browser tests. The research preview remains excluded from that production output.
