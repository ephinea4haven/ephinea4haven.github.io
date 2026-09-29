# Equipment images

Armor, shield and unit cards no longer depend solely on the Wiki infobox image.
The old generator ignored the existing equipment HD gallery and the reviewed
Destiny exports, leaving 285 of 295 equipment records without a list image.

## Selection rules

`scripts/item_catalog_images.mjs` selects the image at generation time:

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

`content/item-catalog/equipment-images.json` records exact item codes, titles,
image kinds, full-size images, thumbnails, checksums and source evidence.
The normal site build needs only that checked-in manifest and its local images;
it does not depend on a client installation or ignored Destiny artifacts.

- 51 equipment entries use existing HD gallery images with 256px-wide WebP thumbnails.
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
- Secure Feet uses a reviewed model render. Its model/texture slots match the
  vanilla item reference, and both compressed AFS entries match the reference
  BB client's bytes. Existing Wiki/gallery shield pictures take precedence.
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

## Acceptance scope

All 295 armor/shield/unit records now have a list image:

| Category | Screenshot | Effect | Illustration | Model | Box |
| --- | ---: | ---: | ---: | ---: | ---: |
| Armor | 0 | 13 | 1 | 0 | 74 |
| Shield | 52 | 0 | 0 | 1 | 54 |
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
image (corner alpha 255 instead of 0). Browser coverage checks all 26 particle
images, the normal/additive display modes, and the WD/DP image switches.
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
