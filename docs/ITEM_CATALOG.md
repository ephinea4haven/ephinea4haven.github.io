# Item Catalog

The primary selector contains six categories with no All option and defaults to
Weapons. The subcategory has no All option either: browsing shows one
subcategory, the category's first by default (Sabers for Weapons). Weapon
subcategories follow the Ephinea Wiki weapon list: common and rare weapons by
type, then an option group for the ES and TypeM series. Series membership comes
from the Wiki's `ES weapons` and `TypeM weapons` list pages (30 each) and is
carried as the last column of the list index; those weapons appear only under
their series in the list, while rows and detail pages keep their weapon type
(TypeRI/Rifle is still a rifle). Each option shows its item count. A search
covers the whole selected category, and the subcategory selector is disabled
while a query is present. Clearing auxiliary filters keeps the category and
returns to its first subcategory. Class and rarity keep their All options. There
is no availability-status filter; obsolete and unobtainable entries keep their
row badges.
A directly opened detail page returns to its item's category when no originating
category is specified.

The catalog lives at `/data/items.html`, with one detail page per item at
`/data/items/{slug}.html`. It extends the approved MVP layout into a full catalog covering all six categories.

## Coverage and interface

The snapshot contains 1,045 entries: 419 weapons, 88 frames, 107 barriers, 100
units, 84 Mags and 247 other items. The list shows images for 549 entries: Wiki
images for 547, drawn from 478 PNG files totaling about 4.9 MB, plus two TypeM
weapons derived from the game's ItemKT textures. Detail pages additionally offer
HD images for 414 entries from the HD gallery, 47 of which previously had no
Wiki image, plus original-model renders for 83 of the 84 Mags (all but Stealth,
which has no model), bringing detail image coverage to 594 entries. The snapshot was taken on 2026-09-14;
the cosmetic item pages and 21 excerpt fixes were re-merged on 2026-09-15 at
unchanged Wiki revisions, and those records carry their own check date.
Independent models such as manufacturing year, manufacturer and genuine versus
replica are listed separately. Cosmetic modifications are listed on the base model's detail page.
Technique disks are catalogued as a single item family rather than counting each
level again.

Search accepts Chinese, English, Japanese and verified item codes. Filters cover
category, subcategory, class, star rating and image presence.
Results sort by name, rarity or maximum base ATP and show 24 items per page.
Previous / next buttons with the page count sit in the results toolbar, and the
full pager with page jump sits below the list; changing page scrolls to the top
of the results, so the top buttons stay within reach. Filters, sorting and page number are written to the
URL, and returning from a detail page restores both the query and the scroll
position. On phones the categories scroll horizontally, filters collapse, and
entries show in a single column.

Every catalog page is prerendered in each language at its own URL: Chinese at
`/data/items…`, English and Japanese under `/en/` and `/ja/` (see
[Languages and URLs](ARCHITECTURE.md#languages-and-urls)). The zh / EN / ja switch
opens the same page in another language and keeps filters, sorting, page number
and the open detail section; links stay in the current language. Titles,
navigation, filters, status text, stat labels and structured values, item names,
Mag food items and related items are all localized. Mechanics notes, acquisition
text and summaries are written in all three languages (below); only Wiki excerpts
and set descriptions keep their original English, labeled as such. Game
identifiers such as classes, Section IDs, difficulties and quest or shop names
keep their source-data names.

Japanese names come from the existing dictionary first. Missing ones are filled
from the `jp` field in the same Wiki revision: 667 come from the dictionary and
150 from the Wiki, for 817 in total. The remaining 227 keep their English name
and show a notice that the Japanese name is unverified. The supplementary names
are searchable in Japanese and never modify the Chinese authority. The visual
refresh uses a cyan-to-blue gradient, a ring background, gold markers for rare
entries, a screenshot frame and stat cards. Hover feedback respects the system's
reduced-motion preference.

Detail pages show, by category, base stats, maximum grind, target count, combo,
attack range, resistances, classes, special effects, technique boosts, sets,
modification branches, Mag evolution, activation and feeding tables, item stack
size and use, Wiki drop tables and source revisions. All 84 Mags show the
DEF / POW / DEX / MIND / synchro / IQ change for each food item, reusing the data
from the Mag training tool. Failed data loads offer a retry. Failed image loads
and uncatalogued images show different notices, and unknown addresses show a
clear empty state.

Ordinary shop weapons are identified by item code: 12 series and 57 base models,
all with images. They include seven five-star models, Calibur, Ripper, Gungnir,
Diska, Laser, Vulcan and Arms, so the count cannot stop at zero to four stars.
Special attacks are marked as variable and the weapon shop is added as an
acquisition source. Random combinations of special attack and Hit are not listed
as separate models.

## Sources and limits

- The item list is cross-checked against the Ephinea Wiki category indexes and
  the weapon, Frames, Barriers, Units, Mags, Tools and ES / TypeM lists. The
  category indexes alone miss Mag evolution items and some event and modification
  entries.
- `content/item-catalog/wiki.json` stores each page's revision ID, stats and table
  facts. It does not store or copy full Wiki articles. Supplementary English
  excerpts are limited to 25 words per page, and unique special attacks and common
  items also have Chinese notes.
- `notes.json` holds mechanics notes verified against their context, each written
  in Chinese, English and Japanese (`{ zh, en, ja }`); item names inside a note are
  `{item:English name}` placeholders filled from the name authority. Review them
  again whenever the Wiki snapshot is updated.
- Generated sentences (tool uses, Mag evolution and cells, cosmetics, periodic
  effects, acquisition sources, summaries) come from keyed `items.*` templates in
  `content/i18n/messages/{zh,en,ja}.json`, built by `scripts/localized_text.mjs`.
  Detail JSON carries `summary`, `effects` and `availability` as `{ zh, en, ja }`.
  Acquisition entries must be a known source, a kept proper name or a Wiki heading
  that is not a source; anything else fails the build. Base ATP does not use the
  Wiki's fully-ground hint text, which may contain typos; it is calculated from the
  base range and grind.
- Periodic effects keep their sign and the "while moving" condition, and HP cost
  and HP recovery are shown separately. The importer strips Wiki links before
  detecting recovery, attack speed and technique levels, so link syntax or
  phrasing differences do not drop a unit's core stats. Template positions keep
  their original offsets, and file captions are kept out of body excerpts.
- Mag evolution, activation and evolution-item conditions reuse the site's
  verified `mag-evolution.js` and `mag-sim-data.js`, so the catalog and the
  training tool never diverge into two rule sets.
- Chinese display names come from the generated `ITEM_TRANSLATIONS`, and
  `../droptable/i18n_names.json` remains the sole authority. Thirty ES weapons and
  the Nei's Claw replica have no reliable independent name and stay in English;
  they never borrow the translation of a same-named ordinary weapon or the genuine
  item.
- A missing star rating displays as unrated rather than zero stars. Conflicting or
  missing codes display as unverified. `corrections.json` records two class-flag
  corrections and four conflicting codes. The full review list is in
  `coverage.json`, currently 29 codes including the technique disk family.
- Historical and unobtainable entries are labeled separately. The "current
  catalog" does not promise that an event or NPC supplies an item at any given
  time. Drop rates are the baseline values of the cited revision and exclude live
  multipliers.
- List and related-item images come from Ephinea Wiki: item infoboxes, plus the in-game
  screenshot on each ring paint and plating page, which shows a Red Ring after
  use. Red Paint shows the original Red Ring. Deep Plating and Delsaber Plating
  have only multi-megabyte animated GIFs on the Wiki, so they use the first frame
  saved as a PNG; their `images.json` entries point to the GIF and record its
  SHA-1 and frame under `derivedFrom`. The
  seven KT GIFs used by the MVP have been removed. `images.json` records the
  original URL, source page, dimensions and SHA-1. Original files are stored byte for byte, and missing
  images show an explicit placeholder. Models that share an appearance may share
  one image. 418 of the 419 weapons have images; an entry without an image does
  not mean no screenshot exists elsewhere.
- TypeRI/Rifle and TypeSH/Shot name `TypeRI-Rifle.png` and `TypeSH-Shot.png` in
  their Wiki infoboxes, but those files were never uploaded. Their list images
  come from `scripts/derive_itemkt_images.py`, which reads BB `ItemKTep4.afs`
  (SHA-256 checked) and applies the rule every TypeM image on the Wiki follows:
  the base weapon's first colour variant, with the pixels that differ across its
  five colour variants (the photon) replaced by their luminance. Reproducing
  existing TypeM Wiki images with this rule matches 94–98% of pixels within ±3.
  The result is enlarged 2× with Lanczos resampling. BB ItemPMT gives both the
  base weapon's skin (Rifle 6, Shot 8); the archive entries (Rifle 146–150, Shot
  138–142) were identified by comparing against the Wiki's Rifle and Shot images,
  because skin numbers do not index ItemKT directly.
  `content/item-catalog/itemkt-images.json` records the archive, entries and
  output checksums, and details carry `imageOrigin: "itemkt"` so the caption
  names the game texture rather than Ephinea Wiki.

## Updating the data

### HD detail images and naming (updated 2026-09-24)

`content/item-catalog/hd-gallery.json` accounts for 607 source images: the original
606-image 高清图库 collection with four images replaced by the supplied 替换.zip
artwork and 14 shield images replaced by the supplied 盾牌替换 collection,
plus one subsequently supplied SOF image. Later individual corrections replace
the Silence Claw, Gi Gue Bazooka and Red Dagger sources as recorded below.
SHA-256 comparison reduces these to 553 unique assets; the manifest records the current source paths,
dimensions, sizes and checksums.
The detail generator consumes only verified direct `itemIds`: 408 optimized
images cover 414 details. The `hdImage` field is emitted only in per-item detail
data; HD gallery images never appear in the searchable list.
Details default to HD when available and offer HD / standard image buttons when both
images exist; the standard image is the Wiki image, or the ItemKT image above. Mag details use the original-model renders in
`assets/img/mag/default/` as their HD image (`hdSource: model-render`, captioned as
an original model render rather than the HD gallery); the generator fails if a
render has no matching catalog Mag or a Mag also has a gallery image. The folder's
manifest lists 79 rendered models: the Mag evolution chart's 46 plus 33 rendered
on 2026-09-26 with the same pipeline. Its `aliases` let Mag*, Varuna*, Kalki*
and Vritra*, which use exactly the same model and texture slots as their base
Mags, reuse those renders. Stealth has no model and keeps only its Wiki image.
The 33 additions come from the Ephinea client: its AFS archives plus the per-slot
override files in `data/ephinea/default/{model,texture}/`, which replace Sonic's
model and textures and append the Present* and Saraswati models. Their cameras
were fitted to the in-game 64px Mag icons in `ItemKTep4.afs`, the same images the
chart's 46 references came from; Sonic, whose icon predates Ephinea's model, and
Present* and Saraswati, which have no icon, use chosen three-quarter views. The
manifest's `extra_sources` records this, and the reproduction scripts
(`extract-extra.py`, `build-extra.py`, `fit-extra.py`, `render-extra.py`,
`publish-extra.py`) sit beside the originals in the local
`artifacts/hd-gallery/mag-default/` workspace. The displayed source and full-size image link follow the selected image.
Navigating to another item resets the choice to HD. Single-source details show
their available image without a switch. List rows and related-item cards show
the rendered Mags as thumbnails from `assets/img/mag/thumbs/`, made by
`scripts/make_mag_thumbnails.py`: each render is trimmed to the model and fitted
into a 256 × 192 WebP (about 4–14 KB). The generator fails if a thumbnail is
missing. Every other list and card image is the item's standard detail image.

On 2026-09-19 the maintainer supplied and identified the SOF image, bound to
`slicer-of-fanatic`. The 1280 × 938 PNG is recorded as
`SUPPLIED/51ad1493c22ac2388491fd999e3df93f_720.png` in the source inventory;
its 1024 × 750 WebP is 18,548 bytes. The existing Wiki image remains available
through the detail page's image switch.

Output names use the catalog's stable English item IDs. `itemIds` are direct
equipment identities, while `appearanceOf` records a shared model or a visual
variant without claiming it is the same game item. Chinese names in the local
review page are read from `../droptable/i18n_names.json`, never invented from
filenames. ES names and Nei's Claw (Replica) retain the existing catalog English
where the authority lacks that exact entry.

The numbered weapon files have been visually compared with the existing named
Wiki images. Similarity candidates were corrected manually for common weapon
colors, Section ID cards and other misclassifications. Number 102 cannot identify
an Agito year and remains shared artwork. S RANK DAGGER and HANDGUN correspond
to the catalog's ES Blade and ES Gun respectively.

NGC labels are not assumed to be Ephinea item identities. In particular, the
seven `NGC 加强版/TypeBL` images are byte-identical to `TWIN CHAKRAM 06–12` in
the skin directory, and are grouped as Twin Chakram color variants. TypeDS and
TypeGU also contain exact aliases. Paired weapons are model variants, not mere
color changes. Different files are not merged just because they look similar.

Eighteen assets remain unresolved: 12 numbered armor effects, two shield
images, the unqualified named AGITO image, and three TYPE model images. They have
source-derived names under `unresolved/`, no item bindings, and explicit reasons
and candidates where available. Do not promote these candidates to item names.
Armor effect descriptions alone cannot securely bind an unlabeled screenshot;
for example the Wiki documents similar effects for
[Love Heart](https://wiki.pioneer2.net/w/Love_Heart) and Dress Plate. Likewise,
[Secure Feet](https://wiki.pioneer2.net/w/Secure_Feet) and
[Secret Gear](https://wiki.pioneer2.net/w/Secret_Gear) are distinct identities,
so `SECRET FEET.png` is not automatically renamed to either one.

Generate a local searchable review gallery and normalized 1024-pixel WebP copies
with the installed `cwebp` tool. The source directory is read-only for this task;
the destination must be separate and empty. This checks every original hash
before creating images and records each output's size and SHA-256 alongside the
exact naming manifest in the prepared `manifest.json`. The generated review
folder is ignored by Git and is outside the site's published asset directories.
For a full regeneration, assemble a separate working copy of the original
collection and add the supplied SOF PNG at the exact `SUPPLIED/` path above.
In that working copy, remove the four old files listed below and extract their
replacements from `替换.zip` into a `替换/` subdirectory. Keep the original archive
and original collection unchanged.

| Remove old source from working copy | Add replacement source | Detail item |
| --- | --- | --- |
| `WEAPON/EP1+2/136.png` | `替换/136.png` | Red Dagger |
| `WEAPON/EP4/234.png` | `替换/234.png` | Vivienne |
| `WEAPON/EP1+2/GIGUE BAZOOKA.png` | `替换/GIGUE BAZOOKA.png` | Gi Gue Bazooka |
| `WEAPON/TYPE WEAPON/SWORDS.png` | `替换/SWORDS.png` | TypeSS/Swords |

The maintainer confirmed the TypeSS/Swords identity on 2026-09-19, enabling its
previously unbound HD detail image. The other three images replace existing HD
images. All four replacement PNGs are 5444 × 3989; the published WebPs are
1024 × 750. The inventory check requires exactly 607 sources, including these
replacements and the SOF image. Leaving the four old files in the working copy
or omitting the replacements will fail the inventory check. Pass this assembled
working copy as the source directory in the commands below.

On 2026-09-20 the maintainer supplied 14 replacement shield PNGs, all
5444 × 3989, under `盾牌替换/`. For full regeneration, replace the 14
same-named `SHIELD/` sources with these files in the working copy. The source
inventory remains 607 files. Eleven replace existing detail images; the
maintainer confirmed `Fire.png` as Foie Merge, `Ice.png` as Barta Merge and
`Zonde.png` as Zonde Merge, resolving three previously unbound images.
Anti, Shifta and Deband retain their corresponding Merge identities.
`02.png` retains Tripolic Shield; the other files retain DB's Shield,
Shield of Delsaber, Rico's Earring, Rico's Glasses and WEAPONS Copper/Silver/Gold
Shield. All 14 published WebPs are 1024 × 750, totaling 340,700 bytes.
The existing Wiki images and list thumbnails are unchanged.
Local validation passed all 23 item tests, the production build and three HD
browser checks. All 14 generated detail bindings match the reviewed manifest.

On 2026-09-22 the maintainer supplied a replacement for Silence Claw and
explicitly corrected the initial S-Rank Claw label. The green-photon image is
bound to Silence Claw only; the ES Claw asset is unchanged. The supplied PNG is
1280 × 938 and the published WebP is 1024 × 750 (30,492 bytes), encoded with
`cwebp -q 85 -m 6 -resize 1024 0`. For full regeneration, remove
`WEAPON/EP1+2/095.png` from the assembled working copy and place the supplied
PNG at `User-provided corrections/2026-09-22/ed763d830550db0a304d405f18a03b50_720.png`.
The manifest records its exact dimensions, byte count and SHA-256; the source
inventory remains 607 files. Local validation passed 23 item tests and the
production build (1,268 routes and 45 event fragments). The maintainer approved
commit and push; deployment status is tracked separately by the Pages workflow.
Seven focused item/monster HD browser checks also passed.

On 2026-09-24 the maintainer supplied a new Gi Gue Bazooka image explicitly
identified by item name. The supplied PNG is 1280 × 938 (710,245 bytes);
the published WebP is 1024 × 751 (63,454 bytes), encoded with
`cwebp -q 85 -m 6 -resize 1024 0`. For full regeneration, replace
`替换/GIGUE BAZOOKA.png` in the assembled working copy with
`User-provided corrections/2026-09-24/09cf5fb96e7a409fccea3041cfc661ff_720.png`.
The manifest records the new source checksum and dimensions; the source
inventory remains 607 files. Visual inspection of the encoded image, all 23
item/gallery tests and the production build passed (1,268 routes and 45 event
fragments). Browser tests were not rerun for this image-only replacement.
The maintainer approved commit and push; deployment status is tracked separately
by the Pages workflow.

Later on 2026-09-24 the maintainer supplied a new Red Dagger image explicitly
identified by item name. The supplied PNG is 1280 × 938 (1,120,323 bytes);
the published WebP is 1024 × 751 (34,606 bytes), encoded with
`cwebp -q 85 -m 6 -resize 1024 0`. For full regeneration, replace
`替换/136.png` in the assembled working copy with
`User-provided corrections/2026-09-24/b93ba0b7a9763caa51639b014dba70e4_720.png`.
The manifest records the new source checksum and dimensions; the source
inventory remains 607 files.
Visual inspection of the encoded image, all 23 item/gallery tests and the
production build passed (1,268 routes and 45 event fragments). Browser tests
were not rerun for this image-only replacement. The maintainer approved commit
and push; deployment status is tracked separately by the Pages workflow.

Also on 2026-09-24, Mag details gained HD images from the Mag evolution chart's
46 original-model renders in `assets/img/mag/default/`, reused in place rather
than copied into the HD gallery. The generator binds each render to the catalog
Mag with the same exact title and marks it `hdSource: model-render`, so the
caption reads "original model render" instead of "HD gallery"; the gallery
manifest and its 414 details are unchanged. The Mag entry used by the
single-source browser case became switchable, so that case now uses Chu Chu,
which has only a Wiki image. `npm test` (23 item/gallery checks), the production
build (1,268 routes and 45 event fragments) and the full browser regression
(1,457 tests, including a new Mag detail case) passed. The maintainer approved
commit and push; deployment status is tracked separately by the Pages workflow.

```sh
node scripts/prepare_hd_gallery.mjs --check /path/to/高清图库
node scripts/prepare_hd_gallery.mjs /path/to/高清图库 artifacts/hd-gallery
node scripts/install_hd_gallery.mjs artifacts/hd-gallery
npm run test:items
```

The installer copies only images selected by `scripts/item_catalog_hd.mjs` into
`assets/img/items/hd/`; those WebPs are checked in, so CI and ordinary builds do
not need the downloaded collection or `cwebp`. Installation rejects stale naming
manifests or changed output bytes before writing any images, then removes retired
WebPs from its owned destination directory. Regenerate the prepared gallery after
changing the naming manifest; do not rename prepared files manually.
They preserve aspect ratio at 1024-pixel width with lossy WebP quality 85,
totaling 15,338,314 bytes. The detail frame displays them at up to 512 CSS pixels,
providing enough pixels for a 2× display at that size. This is optimized web
artwork, not a lossless archival copy; enlarging it cannot retain the detail of
the original roughly 5,000-pixel images. Downloaded originals are unchanged.
The canonical named view wins when an item
has alternate screenshots. `appearanceOf`, photon/model variants, unresolved
images and placeholder records never create direct detail bindings.

Missing and failed images use the supplied NO DATE artwork optimized separately
to `assets/img/items/no-image.webp` (512 × 376, 41,500 bytes); failures retain an
explicit notice. The supplied Section ID icons have no visual quality advantage:
nine are byte-identical to the existing PNGs and Whitill has identical RGBA
pixels. Existing Section ID assets remain in use.

Validation of the original 2026-09-16 collection: `npm run test:items` passed 23 tests;
`npx playwright test tests/e2e/item-catalog.spec.mjs --workers=4` passed 38 tests;
`npm run build` passed with 1,267 prerendered routes. The installer regressions
cover stale mappings, changed/truncated/missing output, checksum omissions,
retired files and repeated installation. Re-conversion verified all 606 source
hashes and reproduced all 552 prepared images byte for byte, including the 403
installed images. This validation covers the image changes, not unrelated work.

Validation of the 2026-09-19 SOF addition: all 23 item/gallery tests passed,
detail generation succeeded, and the converted image was visually inspected.
The gallery inventory test now normalizes Windows path separators before
comparing published paths. The build and browser suite were not rerun for this
asset addition.

### Wiki data

Export the MediaWiki pages with
`action=query&prop=revisions&rvslots=main&rvprop=ids|timestamp|content&formatversion=2`
(organized by title) and the original image bytes from the matching `imageinfo`,
then run:

```sh
node scripts/import_item_catalog.mjs /path/to/pages.json /path/to/image-bytes.json
npm run sync:i18n
npm run test:items
npm run build
npm run test:e2e
```

A full import replaces the snapshot and requires the `List of weapons which
cannot combo` page. To refresh or add specific pages without re-importing the
catalog, pass `--merge` first: the exported records, index pages and images are
upserted, every other record stays byte-identical, and merged records get their
own `checkedAt`.

```sh
node scripts/import_item_catalog.mjs --merge /path/to/pages.json /path/to/image-bytes.json
```

The image export is an array with the fields `title` (with the `File:` prefix),
`url`, `descriptionurl`, `sha1`, `width`, `height` and `base64`. The importer
verifies original checksums. The Wiki's CDN serves recompressed copies of cached
images, so download originals with a query string that is unique to each request
(for example a timestamp). That bypasses the cache and returns bytes that match
the recorded SHA-1; a repeated query string can itself be cached and recompressed.
An image entry may carry `derivedFrom: { sha1, frame }` for a still frame of an
animated original; its `sha1` is then that of the stored PNG. Network downloads stay in a temporary working
directory and never enter the site. The update date must match the actual fetch
date. New fields, categories or entries require updates to the matching checks and
docs; nothing may be dropped silently.

`generate_item_catalog.mjs` builds the search index, server-side details and
per-item JSON from the versioned snapshot. The generated directory is not
committed. The build never depends on a live Wiki response, so CI can regenerate
identical content offline.

## Cosmetic items

`/data/cosmetics.html` (外观道具 on the home page) covers every Ephinea item that
changes appearance without changing performance. Each item's detail page carries
the same structured facts, and each weapon or the Red Ring lists the cosmetics
that apply to it.

| Kind | Count | Facts | Source |
| --- | --- | --- | --- |
| Weapon hearts | 31 | Compatible weapons, resulting appearance, Photon Filter combinations and starting color, drops | Each heart page's Compatible equipment section, checked against the Weapon hearts list page, revision 43368 |
| Ring paints | 14 | Color, Christmas Present or Anniversary Badge Shop source; Red Paint is free and reverts any skin | Each paint page and the Red Ring page, revision 43083 |
| Ring platings | 9 | Resulting barrier appearance and the complete The Forge trade recipe | Each plating page |

- The importer stores a heart's compatibility from its own page. The list page has
  rowspans and two incomplete lists (Blade Dance, Partisan of Lightning), so the
  generator requires both sources to agree and fails the build otherwise.
- Weapon heart rules come from the Weapon hearts and Neutralizer pages: grind is
  reset, the weapon gains `*` and a `Skin:` line, a Neutralizer reverts it without
  returning the heart, and a Mille Marteaux or Heaven Punisher with a Divine or
  Lock-on Filter needs two Neutralizers. Photon Filters only work on the seven
  combinations the list page names.
- Paint and plating rules come from the Red Ring page: both keep Red Ring
  performance, and Red Paint removes either kind while the paint or plating is
  lost. A paint's color label is taken from its authoritative item name.
- The Neutralizer was missing from every Wiki list page the catalog inventory is
  built from; it was added through `--merge` with notes on its free quest sources.

Verification for this addition: 11 catalog data tests, including a cosmetics test
that checks all 54 items, list-page agreement, targets, results, trade recipes,
color names against the authority and full image coverage. The catalog browser suite
covers the overview, item detail sections, versioned JSON requests, and
accessibility plus overflow at 390 and 1280 px in all three languages. Axe found
links inside sentences distinguished only by color, which are now underlined.

The same change fixed two existing problems. Tall screenshots overflowed the
item image frame and were cropped to their top, because the image's 100% height
resolved against a grid row that grew with it; the image is now absolutely
positioned inside the frame. English excerpts in 21 records included raw headings
and table markup when a table followed prose without a blank line; the importer
now starts a new paragraph at each heading or table, and those pages were
re-merged at their unchanged revisions.

## Pages and performance

Pages carry only the item data they show. The item list fetches the searchable
index (about 224 KB of raw JSON with each item's Chinese and Japanese names) as the
versioned data file `assets/data/item-index.json`, cached independently of code
releases and not bundled into script; prerendering reads the generated file
through `ITEM_INDEX_LOADER`, and the index is not transferred through page HTML.
Each detail file carries its related items and the localized names of the items
it references, and the cosmetics overview carries the items it shows, so neither
page needs the index or the full name table. The browser requests only the current item's JSON, while
server prerendering reads the generated snapshot through a separately injected
data loader. TransferState carries the current entry so a directly opened page
hydrates without a duplicate request, and the full set of details never ships in
client JavaScript. The list uses native form events and does not load Angular
Forms for these simple inputs.

Detail HTML is generated directly from the catalog list, so there are no thousand
duplicate empty HTML source files to maintain. The build checks every generated
detail page's references, hydration metadata and links. A 64 KB hydration data
budget applies per page. Since 2026-09-25, route budgets count statically imported
chunks too; before the data split the list, detail and cosmetics routes measured
185–188 KB against the 160 KB route budget; afterwards the list route is about
122 KB, detail routes at most 123 KB and the cosmetics route 132 KB (gzip script,
excluding the separately cached index data). Inline scripts not managed by Angular are still
measured and validated separately.

## Verification

Data tests cover the full catalog against its intersection with 26 lists,
independent names and models, unique codes, every image checksum, template
nesting, random ranges, Mag activation, synthesis relationships and output data
consistency. Browser tests cover every static detail page, page jumps, filter
combinations, failure retry, on-demand requests, section navigation, and
accessibility and overflow checks at 390, 820 and 1280 px.

2026-09-14 convergence review: fixed the sign of periodic effects, missing unit
effects, special attacks and shop sources for ordinary weapons, category links
carrying a class parameter, template comment positions and image failure notices,
and completed the Mag feeding tables. The new browser cases reproduced each
original problem against the pre-fix build.

Verification for that review: `npm test` passed, including 8 catalog data
regressions. The build produced 1,104 prerendered routes with 825,653 / 1,000,000
bytes of gzip JavaScript. The largest per-page item hydration data was 22,713 /
64,000 bytes. All 18 catalog browser checks and the full 1,193-test site browser
regression passed.

Verification for the same day's trilingual and visual update: `npm test` passed,
including 10 catalog data checks, and 27 catalog browser checks passed. The new
checks cover authority and Wiki sources for Japanese names, structured field text,
independence of language and filters, direct open, refresh and return to list,
unavailable preference storage, source-language labels, reduced motion, and
phone, tablet and desktop layouts in all three languages. The English feeding
table initially widened the phone detail page; fixing the grid children's minimum
width made the overflow and accessibility checks pass.

The first full-site regression finished with 1,201 passed and 1 failed, exposing a
scroll race in related-item navigation on detail pages. The site-wide
`scroll-behavior: smooth` affected programmatic positioning, so a detail swap could
stop 265 px from the top. Detail and section positioning and list scroll
restoration now jump immediately. The related tests were extended to all three
languages and confirm the target URL before checking the top position; they
passed 10 consecutive runs. The English missing-image notice in small thumbnails
was also corrected after visual review, with text-boundary assertions added at
three screen widths.

A later full-site run reproduced the equipment guide anchor failure already
recorded in the deployment docs, while every catalog case passed. After keeping
the trace, the smooth scrolling that `unified-style.css` forced on the whole
document was removed, so ordinary anchors use the browser's default positioning.
The equipment guide test now also checks round trips between near and far class
sections.

Final verification: both navigation scenarios passed 10 consecutive runs each, and
the full-site browser regression passed **1,202 / 1,202**, including 27 catalog
cases. The name sync produced no authority differences, and the build and all
resource budgets passed.

The trilingual version still produces 1,104 routes. Gzip JavaScript totals
842,140 / 1,000,000 bytes; the list's initial load is 153,622 / 160,000 bytes and
the detail page's is 154,993 / 160,000 bytes. The largest per-item hydration data
is 22,824 / 64,000 bytes. No performance budget was raised.

## Convergence review log

The review covered the MVP in `88b50fe`, the full expansion in `76d261c`, and the
import, generation, build, routing, list, detail and image components with their
tests. The fixes landed in `5765cb1`. Every issue below was fixed and re-reviewed,
and no Blocking or Should-fix issues remain.

| ID | Root cause and scope | Regression evidence | Status |
| --- | --- | --- | --- |
| R1 | The regular expressions ignored effect direction and Wiki link and phrasing variants. They read HP loss while moving on 7 items as recovery, and missed some attack speed, technique level and recovery unit effects. The check was extended to every periodic effect and unit series. | Checks the 7 HP-draining items, 17 positive periodic effects and every attack speed and technique level unit, and adds notes for conditional stat units. | Fixed |
| R2 | Blank special attacks in ordinary weapon infoboxes were dropped, and acquisition notes omitted the shop. Counting only zero to four stars also missed 7 five-star models whose image files already existed. | Enumerates all 57 models across 12 series by item code and checks image sources, variable special attacks and shop notes. | Fixed |
| R3 | The class condition reset only when a category was clicked, so opening another item list with a class parameter directly gave empty results and a disabled class control. | Direct-open and refresh tests confirm results, disabled controls and detail return parameters. | Fixed |
| R4 | After comments were removed, the original text was still sliced with offsets from the shortened text, and thumbnail parameters from file links leaked into excerpts. | Position checks before and after comments and in nested templates, with file captions stripped. The full generated output has no leftover templates or image markup. | Fixed |
| R5 | Mag detail pages showed only the feeding table number, not the promised feeding values. | The 11 feeding value rows for all 84 Mags match the existing training data, with phone table, accessibility and overflow checks. | Fixed |
| R6 | Missing images and network load failures shared the same "no screenshot" notice. | Aborting an existing Saber image request confirms the load-failure notice and that the original image link is kept. | Fixed |

The original tests focused on sample values and did not cover the sign of periodic
effects or every ordinary weapon model. The new browser tests reproduced R1 and R3
against the pre-fix build and then passed in the full post-fix regression. The
first extended R1 check also found another phrasing for HP / TP Resurrection,
which was fixed and added to the test scope before the issue was closed.

The data limits remain the missing images, 31 unverified Chinese names and 29
unverified codes recorded above, plus 227 unverified Japanese names from the
trilingual update. No names or codes were invented from similar models.
Implementation verification and production release evidence are recorded in the
[deployment docs](DEPLOYMENT.md#september-14-2026-item-catalog).
