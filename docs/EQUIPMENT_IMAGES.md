# Equipment images

Armor, shield and unit cards no longer depend solely on the Wiki infobox image.
The old generator ignored the existing equipment HD gallery and the reviewed
Destiny exports, leaving 285 of 295 equipment records without a list image.

## Selection rules

`scripts/generate_item_catalog.mjs` first selects an explicit model/shield
preview; `scripts/item_catalog_images.mjs` handles the remaining equipment:

1. Units use category boxes, with the same 9★ rarity boundary as other equipment.
2. Armor and shields use a reviewed effect preview when available; character
   transparency can use an explicitly labelled illustration.
3. Otherwise use the item's Wiki screenshot, existing HD gallery image, or
   verified original-model preview, in that order. A Wiki screenshot can retain
   its detail-page alternative while the list uses a small gallery thumbnail.
4. Without an available individual preview, use red for 9★ and above and blue
   below 9★. These are the maintained Ephinea Wiki star values, not equip levels.
   Unknown rarity fails generation instead of silently inventing a classification.

The 9★ boundary agrees with `ItemParameterTable::is_item_rare` in newserv and
the stock BB pickup-selection audit in
`artifacts/destiny/resources/category-previews/README.md`.
Ephinea's maintained snapshot already lists the colored Barriers as 9★; do not
substitute another server's PMT rarity values.

AddSlot (`030F00`) also uses the red shared box, through the manifest's explicit
`toolBoxes` binding. [Ephinea Wiki](https://wiki.pioneer2.net/w/AddSlot) identifies
it as a rare tool. Its unreported star count remains unknown; the binding does
not assign boxes to other tools or reuse Destiny's generic green-tool fallback.

Box images are category illustrations, not claims about individual appearance
or exact runtime drop color. A box also does not imply the equipment has no effect:
some effects still lack a verified picture. The appearance-only filter excludes
boxes and includes screenshots, models and effect previews.

## Assets and evidence

The 2026-10-04 update covers all 107 shields, including all 16 Technique
Merges, through
`content/item-catalog/shield-images.json`. `scripts/render_shield_models.py`
records PMT/reference mappings and verifies each compressed model and texture
entry against the installed Ephinea client. The renderer normalizes XJ's
on-disk BGRA vertex colors and encodes additive surfaces with explicit coverage.
`scripts/import_shield_models.mjs` imports 65 model previews and 42 block-effect
bindings. Model rendering suppresses back faces and separates coincident
environment overlays by 0.01% of model extent so the ray tracer retains the base
texture beneath the reflection pass. The separation is recorded in the recipe.
Lists and details share these previews; existing HD alternatives remain available.
The five Technique Barriers use a separately labelled block-effect preview,
not an equipped-model claim. The inspected PMT/reference mappings contain no
independent persistent model for these five items; this is resource evidence,
not an in-game verification or a claim that they have no visible appearance.
Their PMT BlockEffect 6 maps through
`itemshieldentry.dat` to particle `0x1D1` and texture `700533`. The source files
match the extracted `PSOBB-Haven/data/data.gsl` entries. The fixed-seed preview
omits player/bone positioning and is not a runtime screenshot. Its renderer is
`scripts/render_shield_effects.py`; hashes and the sampled frame are recorded in
the image manifest. The other model-less slots use the same traced block-effect
path, covering 22 distinct effect records. Group 18 additionally includes the
type-2 attraction streaks traced through client functions 0051145C, 0051095C and
00511004. Previews omit character pose and runtime animation. The maintainer
authorized commit and push on 2026-10-04 after reviewing the local result and
the distinction between persistent models and block effects.

`content/item-catalog/equipment-images.json` records exact item codes, titles,
image kinds, full-size images, thumbnails, checksums and source evidence.
The normal site build needs only that checked-in manifest and its local images;
it does not depend on a client installation or ignored Destiny artifacts.

- The original equipment manifest contains 51 HD gallery bindings with 256px-wide
  thumbnails. Shield bindings are now superseded by the shield manifest above;
  the detail-page HD gallery remains available as an alternative.
- Stealth Suit uses the site's transparent FOnewearl character art displayed at
  35% CSS opacity, labelled as a stealth illustration in all three languages.
  This illustrates character transparency; it is not a particle render or a
  claim about the client's exact opacity. The original gallery screenshot is
  available through the detail switch. Both list and detail remove the solid
  image backdrop and shadow. Source art and checksums are in the manifest.
- Thirteen armor particle previews use audited offline renders. The source
  `particleentry.dat`, `effect_nt.xvm` and stock executable hashes match the local
  `PSOBB-Haven` reference. The images omit the character and are explicitly
  labelled as offline effect previews; they are not runtime screenshots.
  All full-size images and thumbnails have transparent backgrounds. Smoking
  Plate preserves source alpha for black smoke; the other effects preserve
  additive light and use CSS `plus-lighter` against the page's display area.
  Particle image components also remove their solid backdrop and box shadow;
  transparent files alone would otherwise still appear on a rectangular tile.
  No viewing background is baked into the images.
  Wedding Dress uses particle `0x192`; Dress Plate, Love Heart and Sweetheart
  use `0x1BE`. Their source audit records the equip paths and the heart effect's
  conditional one-shot emission. Wedding Dress and Dress Plate default to the
  effect preview; their previously imported HD gallery images remain optional.
- Secure Feet now uses the shield manifest's reviewed model render, with the
  same original-resource identity checks as the other 64 shield models.
  Explicit shield previews take precedence over Wiki/gallery pictures.
- Blue and red boxes use the reviewed Destiny pickup-model renders. Their
  provenance remains labelled as shared illustrations.

To re-import on a machine with the source artifacts and reference resources:

```sh
rtk mkdir -p /tmp/haven-equipment-gsl
rtk ../newserv/build/newserv extract-gsl ../PSOBB-Haven/data/data.gsl /tmp/haven-equipment-gsl/
rtk node scripts/import_equipment_images.mjs ../PSOBB-Haven /tmp/haven-equipment-gsl
rtk node scripts/generate_item_catalog.mjs
```

The importer also requires `cwebp` and the existing vanilla reference at
`../bb-psov4/ref/custom_item_assets/reference/vanilla-item-model-texture.tsv`.
It checks source hashes and model identity before accepting a render.

Shield regeneration additionally uses the workstation renderer and particle
helpers described in [the local rendering SOP](PSO_LOCAL_MODEL_RENDERING.md),
the installed Ephinea client for AFS entry comparison, Blender, Pillow, NumPy
and pefile. Raw extracted resources and intermediate PNGs stay in ignored
`artifacts/shield-renders/`; only the WebPs and evidence manifest are site inputs.

```sh
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/render_shield_models.py
rtk proxy python3 scripts/render_shield_effects.py
rtk node scripts/import_shield_models.mjs
rtk node scripts/generate_item_catalog.mjs
```

The effect script requires the `/tmp/haven-equipment-gsl/` extraction above.
Its sampled frame is measured from the first block burst, not from equipping.
Neither an absent Wiki screenshot nor an empty independent model slot is used
as a claim that an item has no visible appearance or effect.

## Acceptance scope

All 295 armor/shield/unit records now have a list image:

| Category | Screenshot | Effect | Illustration | Model | Box |
| --- | ---: | ---: | ---: | ---: | ---: |
| Armor | 0 | 15 | 1 | 0 | 72 |
| Shield | 0 | 42 | 0 | 65 | 0 |
| Unit | 0 | 0 | 0 | 0 | 100 |

The 100 units comprise 52 rare red boxes and 48 nonrare blue boxes. List rows,
detail pages and related cards use the same selection. Regression coverage
includes Angel/Luck (8★), Cure/Confuse (9★) and God/Power.

Tests cover the 8/9★ boundary, high equip level versus rarity, rare units,
effect/screenshot/model selection, image integrity, related-card consistency,
appearance filtering, three-language descriptions and failed-image behavior.
For visual acceptance inspect Aura Field, Secure Feet, Dress Plate, Hunter Field,
Celestial Armor and God/Power on desktop and mobile. Item-name tiers are
documented in [the catalog rules](ITEM_CATALOG.md#coverage-and-interface): rare
boxes and gold text share the 9★ boundary, while Banner rules supplement name
classification and do not change the image selection.

The transparency regression fails against the former opaque Smoking Plate
image (corner alpha 255 instead of 0). Browser coverage checks full-size and
thumbnail transparency for all 57 armor/shield effect bindings, the
normal/additive display modes, and the WD/DP image switches.
Source-render tests also check black-smoke alpha, additive compositing against
two backgrounds, and the heart burst's emission and lifetime:

```sh
rtk proxy python3 artifacts/destiny/resources/completeness/armor-effects/test_render.py
```

Local validation on 2026-09-29 passed: 3 source-render regressions, 31 item/gallery
tests, 15 Destiny tests, 53 item-catalog browser tests, Angular ownership and Chinese
localization checks, and the production build (3,802 routes). Desktop SP/WD/DP
and mobile SP screenshots were visually inspected. The browser checks verify
both file alpha and removal of the component backdrop/shadow. A pre-existing
language test captured the unfiltered prerendered list before hydration; it now
waits for the requested second page before comparing language navigation.
Stealth Suit's list/detail alpha, CSS opacity, backdrop removal and HD switch
also pass browser regression coverage; desktop/mobile screenshots were inspected.
The maintainer accepted the result and authorized commit and push on 2026-09-29.
This acceptance record does not by itself confirm a successful site deployment.

Local validation on 2026-10-04 passed the full business suite, dependency audit
(zero vulnerabilities), two production builds with identical build manifests
(3,802 routes), and all 4,157 browser tests. Shield regressions cover all 16 Merges,
the five Technique Barriers, the restored Red Ring appearance, the copper shield
emblem and the ring silhouette. The complete model/effect contact sheets were
visually reviewed. Final desktop screenshots of Foie Merge, Red Barrier and
Yellow Ring, the three replacement HD images, and the mobile Ragol Ring guide
were also inspected. The maintainer authorized commit and push on 2026-10-04.
These local results and publication authorization do not themselves claim
remote CI success or successful deployment.

## Additional armor audit (2026-10-04, pending acceptance)

`content/item-catalog/armor-appearance-audit.json` records all 88 armor identities,
PMT Type/Skin selectors, FlagsType and current preview coverage. All Type/Skin
selectors are `0xFFFF`; this rules out a mapped standalone equipment model in
this PMT, not scripted visual effects or every possible runtime appearance.
The remaining 72 category illustrations must not be described as proof of no
appearance. Stealth Suit retains its explicitly labelled transparency illustration.

The previous thirteen-effect inventory omitted Chu Chu Fever and Virus Armor:
Lafuteria. Both have FlagsType 2, like the established particle-effect armors.
The stock selector at `005E0FE8` indexes table `0092D1C4` by group minus `0x29`:
group `0x2C` selects particle `0x17D` (`chu_chu`, texture `760251`), and group
`0x2F` selects `0x6B` (`rafute`, texture `750461`). The Wiki independently
describes aesthetic effects for [Chu Chu Fever](https://wiki.pioneer2.net/w/Chu_Chu_Fever)
and [Lafuteria](https://wiki.pioneer2.net/w/Virus_Armor:_Lafuteria).

`scripts/render_missing_armor_effects.py` reuses the audited type-0 simulation
with seed `0x51BB`, frame 40 and origin zero. Chu Chu uses ordinary source-alpha
blending and a single texture frame; Lafuteria uses additive blending and a
16-frame atlas. The PNGs were visually inspected before marking the offline
manifest's `visualQa` as `passed` for import. These are body-free previews of
one emitter; player pose, global RNG, helper retrigger cycles and runtime camera
culling are not reproduced. Site captions retain the offline-preview wording.

Regenerate with the workstation dependencies described above:

```sh
rtk proxy python3 scripts/render_missing_armor_effects.py
# Inspect both PNGs in artifacts/armor-renders/, then mark visualQa passed.
rtk node scripts/import_equipment_images.mjs ../PSOBB-Haven /tmp/haven-equipment-gsl
rtk node scripts/generate_item_catalog.mjs
```

The two new previews bring armor coverage to 15 particle previews, one
transparency illustration and 72 category boxes. They have not yet been accepted
for commit or publication.

Local verification for this addition passed the full business suite, 37 item
tests, three particle compositor regressions, all 62 catalog browser tests and
the 3,802-route production build. Both final detail pages were visually inspected;
mobile regression covers list thumbnails, the appearance filter, detail image,
blend mode, offline caption and overflow. No commit or publication is authorized
for this subsequent armor addition yet.

The final combined armor / Dark Falz validation passed all 4,159 browser tests,
the full business suite and a zero-vulnerability dependency audit. Two production
build manifests were identical (3,802 routes and 135 event fragments). This is
local validation only; maintainer acceptance and publication remain pending.

Maintainer acceptance (2026-10-04): the maintainer reviewed the local results
and approved this batch for commit and push. The pending statements above record
the pre-acceptance state; deployment is determined by the release workflow.
