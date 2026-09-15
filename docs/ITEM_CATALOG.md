# Item Catalog

The catalog lives at `/data/items.html`, with one detail page per item at
`/data/items/{slug}.html`. It extends the approved MVP layout into a full,
all-category catalog.

## Coverage and interface

The snapshot contains 1,045 entries: 419 weapons, 88 frames, 107 barriers, 100
units, 84 Mags and 247 other items. 547 entries have images, drawn from 478
PNG files totaling about 4.9 MB. The snapshot was taken on 2026-09-14;
the cosmetic item pages and 21 excerpt fixes were re-merged on 2026-09-15 at
unchanged Wiki revisions, and those records carry their own check date.
Independent models such as manufacturing year, manufacturer and genuine versus
replica are listed separately. Cosmetic modifications are listed on the base model's detail page.
Technique disks are catalogued as a single item family rather than counting each
level again.

Search accepts Chinese, English, Japanese and verified item codes. Filters cover
category, subcategory, class, star rating, availability status and image presence.
Results sort by name, rarity or maximum base ATP, show 24 items per page and
support jumping to a page. Filters, sorting and page number are written to the
URL, and returning from a detail page restores both the query and the scroll
position. On phones the categories scroll horizontally, filters collapse, and
entries show in a single column.

A zh / EN / ja switch at the top right of both the list and detail pages changes
the whole interface: titles, navigation, filters, status text, stat labels and
structured values, item names, Mag food items and related items. Detailed
mechanics and acquisition notes keep their original Chinese, and Wiki excerpts
and set descriptions keep their original English; each is labeled with its
language. Game identifiers such as classes, Section IDs, difficulties and
monster or area names keep their source-data names.

`lang=zh|en|ja` sets the language of a shared link and takes precedence over the
browser preference. An explicit switch is saved to `haven.catalog.language`.
Without a language parameter the saved preference is used, first visits default
to Chinese, and the URL still switches languages when storage is unavailable.
Static HTML is prerendered in Chinese; after hydration the URL or preference is
applied, and the page title and `html.lang` are updated. Switching languages
never clears filters, sorting, page number or the open detail section, and detail
and back links carry the language.

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
- `notes.json` holds Chinese mechanics notes verified against their context. Review
  them again whenever the Wiki snapshot is updated. Base ATP does not use the
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
- All current images come from Ephinea Wiki: item infoboxes, plus the in-game
  screenshot on each ring paint and plating page, which shows a Red Ring after
  use. Red Paint shows the original Red Ring. Deep Plating and Delsaber Plating
  have only multi-megabyte animated GIFs on the Wiki, so they use the first frame
  saved as a PNG; their `images.json` entries point to the GIF and record its
  SHA-1 and frame under `derivedFrom`. The
  seven KT GIFs used by the MVP have been removed. `images.json` records the
  original URL, source page, dimensions and SHA-1. Original files are stored byte for byte, and missing
  images show an explicit placeholder. Models that share an appearance may share
  one image. 416 of the 419 weapons have images; an entry without an image does
  not mean no screenshot exists elsewhere.

## Updating the data

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

The search index is about 191 KB of raw JSON and is lazy-loaded with its feature
route. Only Japanese names missing from the dictionary are added, to avoid
bundling duplicates. The browser requests only the current item's JSON, while
server prerendering reads the generated snapshot through a separately injected
data loader. TransferState carries the current entry so a directly opened page
hydrates without a duplicate request, and the full set of details never ships in
client JavaScript. The list uses native form events and does not load Angular
Forms for these simple inputs.

Detail HTML is generated directly from the catalog list, so there are no thousand
duplicate empty HTML source files to maintain. The build checks every generated
detail page's references, hydration metadata and links. Existing JavaScript gzip
budgets for the total, chunks and routes are unchanged, and a new 64 KB hydration
data budget applies per page. Inline scripts not managed by Angular are still
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
