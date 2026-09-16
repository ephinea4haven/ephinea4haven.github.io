# Challenge Map Redraw

Implementation status and design reference for the Episode I and Episode II
challenge-mode maps (`guide/ep1ch.html`, `guide/ep2ch.html`).

## Current implementation (2026-09-16)

This section describes the code in this change. Sections 1–10 retain the
original design and acceptance targets; their measurements describe the
design investigation, and their phase table is not a completion record.

| Scope | Current behavior |
|---|---|
| EP1 C1, Areas 1–2 | Measured vector floor, complete source warp/switch groups and nine local callouts in zh/en/ja. See [stage alignment ledger](CHALLENGE_EP1_ALIGNMENT.md). |
| EP1 C9, Areas 41–45 | Source-measured vector contours in `content/challenge-maps/ep1-c9-geometry.json` replace pixel-based floor extraction. Narrow corridors, side rooms, inner walls, octagonal pillars and dark-room boundaries are preserved. Routes, paired warps, individual mechanisms, badges and zh/en/ja notes are authored in `ep1.json`. The legacy C9 tables and raster-derived route rendering have been removed. Each map includes its own mechanism legend. |
| EP1 C2, Areas 4–8 | Measured contours, authored routes/mechanisms and 21 local instructions in all three languages. The old C2 tables and custom Area 05 renderer are removed. |
| EP1 C3, Areas 9–13 | Measured contours, 25 captions, individual safe/unsafe mechanisms and entrance-view puzzle insets. Legacy C3 tables removed. |
| EP1 C4, Areas 14–18 | Measured contours, 26 local instructions and the complete eight-pad relay. Multiple warp entrances can share one return destination. Legacy C4 tables removed. |
| EP1 C5–C8, Areas 20–40 excluding 30 | Measured contours and 98 local instructions: turret handling, equipment counts, warp choices, timed relays and four-player duties. All legacy EP1 tables/renderers are removed. |
| All 25 EP2 areas | Source-measured vector floors, separate mechanism artwork, authored routes, 110 three-language local instructions and 44 localized item labels. No embedded rasters. See [EP2 ledger](CHALLENGE_EP2_ALIGNMENT.md). |
| Page legends | EP1 uses 12 entries; EP2 uses 9 entries with original letter-paired warps and separate source-symbol explanations on each map. |
| Structural tests | `test_challenge_maps.py` covers all 42 EP1 JSON areas and measured contours, using the standard library, PNG headers and SVG XML. C9 checks include source landmarks, absent annotation noise, pillar holes, dark-room connectivity and identical geometry in all three languages. EP2 adds five tests covering all areas, localized item/caption inventories, critical operations, contour landmarks and complete route segments. |
| Asset verifier | Checks inventories, source dimensions and pins, attribution and page references. Every authored area in both episodes must contain a main route; EP2 must contain no embedded raster. |

All 42 EP1 areas now use measured floors. The generator samples every route
segment at 1 px intervals (2 px boundary tolerance), requires at least 95% of
source red dashes to be covered, and validates symbol anchors, warp pairing
and numbered-note/badge alignment. An explicit `fidelity` reason records
additional return paths and reviewed source deviations. Area 16's source ink
between warp platforms is recorded separately as teleport-connector ink, not
a walking route. The old wall-crossing consistency gate belongs to the
historical raster extraction investigation below; EP1 no longer uses it.

C1–C8 contain 179 local instructions in all three languages, alongside C9's
31. Their source-by-source decisions and discrepancies are recorded in the
[alignment ledger](CHALLENGE_EP1_ALIGNMENT.md). Source fidelity is not proof of
PSOBB quest-event behavior. EP2 now has its own [source and prose alignment ledger](CHALLENGE_EP2_ALIGNMENT.md);
all 25 areas have implementation and validation coverage. Acceptance is recorded
below; automated checks do not establish live quest-event behavior.

### Acceptance and review (2026-09-16)

The maintainer supplied a **PASS** re-review and then explicitly requested:
“那对齐文档，然后提交推送 挑战模式相关资源”. This accepts the current
challenge-mode scope and authorizes its commit and push. Production deployment
is established by the Pages workflow for that commit, not by this record.

Delivered scope: 42 EP1 and 25 EP2 areas, 201 localized SVGs, 320 anchored
instructions, 44 EP2 fixed-item labels, source/prose alignment, and the shared
reading interface. Both pages provide episode/stage/area navigation, collapsible
strategy and legends, localized captions and a map viewer.

The two findings from the initial conditional review are closed:

- Removed the obsolete figure grid rules. All 67 captions span the figure's
  inner width, with the open-map button aligned to the right.
- Zoom preserves the visible center. Mouse/pen dragging pans the canvas and
  stops on release; touch retains native scrolling. Image dimensions preserve
  aspect ratio. Escape, focus return and page scroll restoration pass.

Validation evidence:

- Local `npm test` and `npm run build` passed; the build produced 1,267 routes
  and 45 event fragments within the gzip budget (934,900 / 1,000,000 bytes).
- The final local focused browser run passed 14 checks spanning viewer
  regressions, navigation, language selection, inventories and accessibility.
- The maintainer-supplied re-review reports eight viewer regression tests,
  22 challenge-related smoke tests and all `npm test` checks passing.
- Browser verification covered Chromium 151 at 390 px and 1,440 px widths.
  `tests/e2e/challenge-viewer.spec.mjs` protects caption width/button alignment,
  zoom center, drag displacement and stopping after release.

Remaining validation limits: Safari and Firefox were not tested; some aria-labels
remain English or Chinese regardless of selected language; the home link is
26 px high, below the recommended 44 px touch target. Live PSOBB quest-event
and inherited boss-advice verification remain outside this source-alignment pass.
The full site-wide browser suite was not rerun for this acceptance.

Reproduce the final review checks after building (run test and build sequentially,
since both regenerate shared data):

```sh
npm test
npm run build
npx playwright test tests/e2e/challenge-viewer.spec.mjs
npx playwright test tests/e2e/site-smoke.spec.mjs -g 'challenge|EP1|EP2|C[0-9]'
```

### C9 floor correction (2026-09-16)

The old C9 extractor discarded near-black wall pixels, removed small wall
components and then flood-filled through the resulting gaps. It also treated
grey room fills and annotation edges as walls. This produced missing floors,
broken narrow passages, filled-in pillars and unrelated outline fragments.
The newer automatic tracer was also checked against C9: it still absorbed
warp symbols and cut the long Area 41 corridor, so it is not used for these
five floors.

C9 now uses closed, straight-sided contours measured in the coordinates of
the checked-in PSO World scans. The floor uses even-odd filling so the Area
43 and 45 pillars remain holes. Interior wall loops are separate from those
holes: an enclosed platform containing a box/warp is not deleted from the
floor. Dark rooms have their own clipped fill, hatching and source boundary;
Area 43's H-shaped dark room includes its narrow connecting strip. Wall
segments obscured by source labels/icons continue between their visible
endpoints. Sakura GIFs are a secondary topology reference, not the coordinate
system. Annotation pixels never enter the floor contours.

Regenerate this scope with:

```bash
python3 scripts/build_challenge_map_atlas.py --area 41 --area 42 --area 43 --area 44 --area 45
npm run test:challenge-maps
node scripts/verify_challenge_maps.mjs
```

The maintainer accepted the background on 2026-09-16 ("底图可以 继续").
The accepted geometry file is unchanged during overlay work (SHA-256
`0d7d4345b91f4d0f6371f967f7feaf012137ca7b1c8fe58ab3631440cbff0dca`).

### C9 overlay pass (2026-09-16)

| Area | Authored overlay checks |
|---|---|
| 41 | Three warp pairs; four individual shooting switches around the platform; Mag light pad; cyan pair and gate; trap corridor and optional box branches. |
| 42 | Four warp pairs; three-player main route and solo rock route; left arrival switches; timed switch, cage traps and two jar traps. |
| 43 | Three warp pairs; four cyan switches and their gate; central trap pad; Mag/light switches; split route and shooting light-switch spur. The main route bends through the actual H-room connector. |
| 44 | Four warp pairs; central hold switch; west solo and east group routes return via 2 and 3; southern switch/gate; rock and platform supplies. |
| 45 | One warp pair; southern switch detour; both equipment-pad sets; optional shortcut; colored switch/gate pairs; light switches, rocks, healing point and final boxes. |

Sources: the checked-in PSO World PNGs provide coordinates and color groups;
[Sakura](https://www.ne.jp/asahi/mihara/sakura/pso/capture/challenge_mode/index.html)
provides route duties and additional location notes. The
[PSO World C9 walkthrough](https://www.pso-world.com/sections.php?artid=296&op=viewarticle)
and [PSO Palace C9 walkthrough](https://psopalace.sylverant.net/cmode_stage9.html)
were cross-checked for warp order and switch behavior. PSO World's text was
available through the search index, not a successful live-page fetch. Older-platform-specific
crash advice from PSO Palace is not carried into this PSOBB guide.

Sakura's Area 45 label describes four weapons and four shields per gate;
its arrows identify the two sets. PSO World's eight weapons/eight shields
is the combined cost. The rendered notes give the combined cost and the
regular route remains the main route. Area 41's Mag pad lights the dark room
within Area 41; "next area" is not translated as a different numbered area.

Warp labels on the scans sometimes extend outside the walls. Their route
anchors are placed inside the corresponding platform; no walking segment
is drawn across a teleport gap. Internal platform outlines remain separate
from floor holes. Symbols group repeated rubble/boxes rather than claiming
one icon per destructible object. Color groups are retained from the primary
scan; the map legend explains symbol shapes rather than assigning gameplay
meaning to arbitrary route colors.

The source-dash coverage for Areas 41–45 is 99.9%, 100.0%, 99.6%, 100.0%,
and 99.7%. The reverse score is lower because authored split/optional routes
include paths absent from the red dashes; this reason is recorded in each
area's data. Those scores do not prove in-game collision or event behavior.
At the overlay checkpoint, only the background had maintainer acceptance.
The later annotation pass and final acceptance above supersede that checkpoint.

Validation for this pass: `npm test`, `npm run build`, the two challenge-guide
Playwright tests (language persistence and mobile inventory), and
`git diff --check` pass. All 15 C9 SVGs were checked in Chromium for text
outside the SVG bounds; none was found. The standalone review page compares
each localized map with either original reference or the accepted floor.

### C9 annotation pass (2026-09-16)

The overlay pass missed local instructions. The follow-up restores 31 sourced
callouts across the five maps in all three languages. Captions preserve hazard
types, switch order, retreat timing, class duties, safe/trapped boxes and
equipment quantities. Jar traps have a distinct glyph; Area 43's cyan switches
carry steps 1–4; Area 45's equipment pads each show 4 and the three forbidden
shooting targets have crossed markers. Leaders render behind all caption boxes.

Each `callouts[]` record stores a stable `id`, source-image anchor `at`,
1000-unit canvas `box: [x, y, width]`, `tone`, `source` and trilingual `text`.
The [annotation audit](CHALLENGE_C9_ANNOTATION_AUDIT.md) maps every caption to
evidence and records source availability, dependence and version limitations.
The accepted floor hash is unchanged. Structural tests now also guard the
caption inventory, visible generated translations and the critical numbered
mechanisms. Chromium checks all 15 maps for caption overlap, floor occlusion
and text overflow; the refreshed comparison page is `/tmp/ep1c9-callouts/index.html`.

Final source review adds four explicitly crossed floor switches (distinct from
the three do-not-shoot targets), removes the unsupported walking leg into Area
42's teleport-accessed cage, and aligns the remaining English/Japanese details.
The source map does not locate that unnumbered optional warp pair; its access
and hazard remain a visible instruction, without invented endpoints. All 13
map tests, asset verification, production build and three scoped browser checks
pass. All 15 built C9 assets match the generated SVGs. The five-map redraw and
documented source alignment are complete locally, accepted by the maintainer for use as the remaining stages’ standard;
this does not establish in-game BB event behavior. Commit/push authorization
is recorded in the final acceptance section above.

### Regeneration and preview

Install the project dependencies with `npm ci`. Install `potrace` on `PATH`
for EP1, then install the pinned Python rendering dependencies:

```bash
python3 -m pip install -r scripts/requirements-maps.txt
npm run generate:challenge-maps
npm run generate:challenge-maps:ep2
```

Both generators accept repeatable area filters:

```bash
npm run generate:challenge-maps -- --area 1 --area 2
npm run generate:challenge-maps:ep2 -- --area 1
```

Generated SVGs are committed under `assets/img/challenge/ep1/maps/` and
`assets/img/challenge/ep2/maps/`, with `zh`, `en` and `ja` directories. The
normal site build consumes these files without regenerating them.

Render selected maps as PNGs for review (the output directory is created):

```bash
npx playwright install chromium
node scripts/render_challenge_maps.mjs .tmp-map-review assets/img/challenge/ep1/maps/zh/area_01.svg assets/img/challenge/ep2/maps/zh/c1_area_01.svg
npm run test:challenge-maps
node scripts/verify_challenge_maps.mjs
npm run release:prepare
```

The preview tool produces individual PNG files, not contact sheets. The
structural tests and asset verifier need no `potrace`, numpy or scipy.

### Local validation (2026-09-15)

- The business checks passed individually. RBR's 55 tests ran under WSL
  because its mode-600 credentials test requires Unix file permissions.
- Validation used the raw authority files from CI's pinned droptable commit
  `8fbbde4fe3a65819067f6037da7a8d6562e8956a`. Windows CRLF conversion changes
  byte hashes; the Combo source fixtures likewise used their original LF
  bytes for hash verification.
- With Node 24.21.0, `npm run build` passed: 1,267 prerendered routes and
  45 event fragments.
- The full browser suite passed 1,398 tests and failed one item-catalog
  language/filter test. That test passed on a focused rerun. The challenge
  guide tests passed in the full run; the initial suite was not wholly green.
- `git diff --cached --check` passed. This historical run preceded the
  2026-09-16 acceptance recorded above.

## 1. Original findings before the redraw

Evidence: the generated SVGs, the generator scripts, a re-run of the EP1
tracing with coverage measurement, and the current render of EP1 Area 45.

1. **Rooms are missing, not faint.** The floor group is an empty `<path d=""/>`
   in 7 of 42 EP1 SVGs (Areas 1, 32, 35, 37, 38, 42, 44) and a single dot in
   Area 45. Measured coverage of the source's enclosed white area: Area 1 and
   Area 45 = 0 %, Area 36 = 5 %, the best map (Area 28) = 93 %. Cause:
   `source_layers` uses `boundary_floor = 45 if area >= 20 else 105`, while
   the PSO World wall colour is `(35, 31, 32)`, so on every area ≥ 20 the wall
   lines are excluded from the flood barrier; the 1 px barrier expansion and
   the 9×9 closing then erode what remains.
2. **Routes are traced pixels, not drawn lines.** Every red pixel of the scan
   is vectorized with potrace. The source route is dashed, so the result is
   hundreds of disconnected dots (Area 45: 283 red components, median 7 px).
   Dots break wherever a symbol or label sits on the route; nothing shows
   direction.
3. **Source mechanisms are dropped.** Coloured switches, door bars, warps,
   boxes, traps and rocks are filtered out with the geometry. A handful of
   hand-placed `*_SYMBOLS` entries replace them, and because the rooms they
   belong to are missing (finding 1) they appear to float in empty space.
4. **Dark rooms are rendered as highlights.** Grey source fill `(174, 176, 178)`
   marks dark rooms on about ten maps; the generator paints those cyan with no
   legend meaning.
5. **Bespoke code paths.** EP1 Area 05 is a fully hand-written SVG in
   `area_05()`. EP2 zh Area 1 is skipped by `main()` and patched by
   `inline_approved_area_one()`; its notes, badges and route exist only inside
   the committed `assets/img/challenge/ep2/maps/zh/c1_area_01.svg`, so it never
   regenerates. Areas 15–18 and Area 28 have hard-coded tracing exceptions.
6. **EP2 has no routes and no en/ja notes.** 24 of 25 EP2 maps show only the
   wiki geometry. `AREA_NOTES_ZH` has one Chinese sentence per area; en and ja
   share one generic sentence across all 25 areas.
7. **Geometry is traced three times per map.** `main()` calls `traced_map`
   inside the language loop, so `source_layers` and its three potrace runs
   execute once per language.
8. **Undocumented toolchain.** The generator needs the `potrace` binary and
   Pillow; neither is listed in the README. `docs/ARCHITECTURE.md` still says
   EP1 "publishes the original high-resolution map images", which is not true.

## 2. Conventions adopted from the references

| Source | Convention we adopt |
|---|---|
| Sakura (`ne.jp/asahi/mihara/sakura`; all 42 EP1 area GIFs are already in `assets/img/challenge/ep1/`) | One continuous solid route line; mechanisms drawn at their real positions; START / BOSS terminals; notes anchored to the spot. |
| Ragol (`ragol.co.uk`) | Filled rooms with a bright outline on a darker ground; separate continuous lines per role (main, split, solo); numbered markers referenced by the text; a legend. |
| Ephinea Wiki (EP2 sources) | Rooms numbered in route order; mechanism icons on the map. |

Roles of the inputs:

- **PSO World scans** (`assets/img/challenge/ep1/original/*.png`) are the
  geometry and coordinate system for EP1. Their red dashed line is the route
  reference.
- **Sakura GIFs** are the reading reference for routes, mechanisms and notes,
  and the visual target. They are low resolution (for example 664 × 456) and
  drawn in a different projection, so their coordinates are not reused. They
  stay in the repository as declared inputs.
- **Ephinea Wiki PNGs** are geometry, coordinates and labels for EP2.

When PSO World and Sakura disagree on a route, the drawn route follows Sakura
(the notes already do), and the area's `fidelity` field records the reason
(see 5.3).

Kept from the current site: numbered badges tied to the notes panel, three
languages, the page legend, historical URLs and file names.

## 3. Visual specification

Layer order, bottom to top:

1. Background.
2. Floor fill and outline (EP1: traced vector; EP2: wiki raster base layer).
3. Dark-room overlay (hatched) where the source marks a dark room.
4. Route halo, then routes in order main → split → solo → optional.
5. Mechanism symbols.
6. EP2 wiki label layer (room numbers and icons, raster).
7. Numbered badges, start and exit terminals.
8. Route key strip and notes panel.

### 3.1 Palette

| Token | Value | Use |
|---|---|---|
| background | `#071a31` | canvas |
| floor | `#1f5a8c` | room and corridor fill |
| floor-outline | `#4fe3ff`, 3 px | room edge |
| dark-room | 45° hatch `#4fe3ff` at 25 % over floor | dark rooms |
| route-main | `#ffd23f` | all players (Sakura's yellow) |
| route-split | `#f5f7ff` | second group after a split |
| route-solo | `#b48cff` | single player (Force, android, runner) |
| route-optional | `#c9d6e8`, dashed `14 10` | pickup branches off the critical path |
| route-halo | `#071a31` at 85 %, +5 px | separation from outlines |
| start | `#39d6ff` | start terminal |
| exit | `#ff5ca8` | exit / next area / boss terminal |
| badge | `#ff9f43` square, dark border and digit | numbered notes |

Rules: floor against background differs by at least 25 L*. Route colours
differ from floor, outline and each other. Mechanisms take their colour from
the source (red, green, blue, yellow, pink, orange, purple all occur) and are
distinguished from routes by shape: every mechanism is a small filled glyph
with a dark ring; routes are long strokes. Yellow is shared by the main
route and yellow source mechanisms (switches, `sequence` discs) on purpose;
badges leave yellow so the only numbered yellow things on a map are
`sequence` discs. Badge orange is used by no route; orange source
mechanisms (rocks, orange bars) are unnumbered glyphs, so a numbered orange
square is unambiguous. Exit pink is not a route colour.

### 3.2 Routes

| Role | Width | Style | End |
|---|---|---|---|
| main | 7 px | solid, round joins and caps | arrowhead at the last point of the last leg |
| split | 5 px | solid | arrowhead |
| solo | 5 px | solid | arrowhead |
| optional | 4 px | dashed | none |

Widths descend in draw order so a narrower line stays visible on top of a
wider one when roles share a corridor. No parallel-offset geometry.

A route is a list of **legs**. Each leg is a hand-authored polyline in
source-pixel coordinates. A route with several legs is one that passes
through a warp: leg 1 ends at warp *n*, leg 2 starts at warp *n′*. No
connector is drawn between legs (Sakura convention); the numbered warp
symbols carry the link. Polylines are drawn as straight segments with round
joins; no curves, no pathfinding.

### 3.3 Mechanism symbols

One vocabulary for both episodes. Colour comes from the source symbol so a
switch and the door it opens share a colour, as in the PSO World legend.

| kind | Glyph | Fields | Replaces today's |
|---|---|---|---|
| `switch` | circle r 9, dark ring | `color`, optional `label` (short, e.g. `×4`) | `switch` |
| `timed-switch` | `switch` with clock tick | `color` | — |
| `door` | bar 6 × 34 across the corridor | `color`, `angle` | — |
| `warp` | inverted triangle with number | `n`, `color` | — |
| `box` | rounded square with lid line | optional `label` | — |
| `trap` | triangle with "!" | optional `variant` | `hazard` (traps) |
| `turret` | circle with barrel | — | `hazard` (turrets) |
| `rocks` | boulder cluster | — | `rocks` |
| `heal` | circle with "+" | — | `heal` |
| `target` | crosshair | — | — |
| `console` | small screen glyph | — | — |
| `press` | piston glyph | — | — |
| `false-wall` | dashed wall segment | `angle` | — |
| `sequence` | row of numbered discs | `count` | `sequence`, `sequence8` |
| `dark-room` | hatched polygon (layer 3) | `points` | — |

In P0 the implementer makes one pass over the 42 scans, the Sakura GIFs and
the 25 wiki maps and extends this table with any mechanism not listed; the
extended table is appended to this document in the P0 commit and is final
from P1 on.

Every symbol drawn in the source map appears in the data at the source
position. A symbol anchor must lie within 12 px of the floor mask (targets
sit above doors, doors sit on walls); the build fails otherwise. Start and
exit anchors are exempt because the source draws them as label boxes off the
floor.

### 3.4 Terminals, badges, key strip, notes

- Start and exit terminals keep the current marker design and localized
  labels (`起点`, `前往下一区`, and `BOSS` where the source says "TO BOSS").
- Notes are of two kinds. **Numbered** notes refer to a location and have a
  badge at that location; badge count equals numbered-note count in every
  language or the build fails. **General** notes (stage advice, "this area is
  short") render first in the panel without a badge. Today C1 Area 2 has
  three notes and two badges and C3 Area 12 has one note and no badge; both
  are resolved during migration by adding the badge or marking the note
  general.
- Route key strip: one row under the map listing only the roles present on
  that map, localized. Maps with only a main route show no strip.
- Notes panel: unchanged layout (`notes_panel`). Content order is: the
  stage note from `stages` (EP2 only, as today), then the area's general
  notes in file order, then the numbered notes. `<desc>` is the same
  sequence joined by spaces.
- No other free text inside the map. Everything else stays in the notes so
  the three languages never collide with geometry.

## 4. Data model

All per-area content moves out of the Python scripts into
`content/challenge-maps/ep1.json` and `content/challenge-maps/ep2.json`,
matching how `content/` already holds curated facts for the catalogs. The
generators become renderers.

```json
{
  "strings": {
    "zh": { "area": "区域 {n}", "start": "起点", "next": "前往下一区", "boss": "BOSS",
            "tips": "关键提醒", "main": "主路线", "split": "分队路线",
            "solo": "单人路线", "optional": "可选回收",
            "sources": "提示依据：PSO World · Sakura 攻略" },
    "en": { "...": "..." },
    "ja": { "...": "..." }
  },
  "areas": {
    "45": {
      "stage": 9,
      "source": "area_45.png",
      "start": [1138, 843],
      "exit": [45, 246],
      "exit_kind": "boss",
      "routes": [
        { "role": "main",
          "legs": [
            [[1138, 826], [1138, 706], [975, 706], [975, 596], [1097, 596], [1097, 250], [924, 250], [924, 214]],
            [[662, 56], [662, 240], [590, 240], [590, 246], [110, 246]]
          ] },
        { "role": "optional", "legs": [[[1097, 470], [1097, 300], [1240, 300]]] }
      ],
      "symbols": [
        { "kind": "warp", "at": [918, 214], "n": 1, "prime": false, "color": "#f5a3a6" },
        { "kind": "warp", "at": [662, 45], "n": 1, "prime": true, "color": "#f5a3a6" },
        { "kind": "door", "at": [1140, 178], "angle": 90, "color": "#ff4d4d" },
        { "kind": "switch", "at": [1201, 131], "color": "#39a0ff" },
        { "kind": "dark-room", "points": [[928, 560], [1030, 560], [1030, 632], [928, 632]] }
      ],
      "badges": [[1, 1000, 763], [2, 1050, 434], [3, 930, 205]],
      "notes": {
        "zh": { "general": [], "numbered": ["…", "…", "…"] },
        "en": { "general": [], "numbered": ["…", "…", "…"] },
        "ja": { "general": [], "numbered": ["…", "…", "…"] }
      },
      "fidelity": null
    }
  }
}
```

The example's coordinates are illustrative and abbreviated to the first
bends of each leg; the authored file holds the full polylines and every
mechanism. The rules below apply to it as to any area.

Rules:

- Coordinates are source-image pixels. The build validates that every point
  lies inside the source bounds and that every route point and symbol anchor
  lies on or within 12 px of the floor mask. Start and exit are exempt
  (the source draws them as label boxes off the floor). `dark-room` has
  `points` instead of `at` and is validated as a polygon with at least 95 %
  of its area on the floor.
- The first point of the main route's first leg is the floor point nearest
  the start anchor, not the anchor itself; the arrowhead sits at the last
  point of the last leg.
- Warps carry `n` and `prime`. A leg that ends at a warp ends within 12 px of
  the `prime: false` warp *n*; the next leg starts within 12 px of the
  `prime: true` warp *n*. Each `n` in an area has exactly one of each.
- `exit_kind` is `next` (label `strings.next`) or `boss` (label
  `strings.boss`).
- `fidelity` is `null` or a short reason string (see 5.3).
- `strings` replaces `LANGUAGES`. Keys kept: `area`, `start`, `next`, `tips`,
  `sources`. Keys added: `boss`, `main`, `split`, `solo`, `optional`. Keys
  deleted: `route` (today's `<desc>` text on the 41 traced maps; `<desc>`
  becomes the joined notes, general then numbered, as EP2 already does),
  and the Area 05 keys `ignore`, `branch`, `switch`, `warp`, `tip_a_title`,
  `tip_a`, `tip_b_title`, `tip_b`, `tip_c_title`, `tip_c`. The `sources`
  string must keep containing `PSO World` and `Sakura` (EP1) or
  `Ephinea Wiki` (EP2) because the verifier asserts those. `area` takes
  `{n}`, zero-padded to two digits as today (`区域 05`); in `ep2.json` it
  also takes `{stage}`, unpadded (`"EP2 C{stage} 区域 {n}"`), replacing the
  string composition in `build_ep2_challenge_map_atlas.py`.
- EP2 areas use the same shape. `ep2.json` alone has a top-level `stages`
  block (`{"1": {"zh", "en", "ja"}, …}`) holding today's `STAGE_NOTES`;
  `ep1.json` has none. The per-area `notes.general` holds today's
  `AREA_NOTES_ZH` sentence and its new en/ja translations; `notes.numbered`
  and `badges` are new.
- EP2 zh Area 1's migration source is the committed
  `assets/img/challenge/ep2/maps/zh/c1_area_01.svg` (its route path, notes and
  badges); the en/ja files for that area are generated today and carry
  nothing extra.
- No per-area geometry overrides exist after P0. The Area 28 filter and the
  Areas 15–18 no-outline rendering are both deleted (5.1). If the P0 coverage
  table shows a map that the common rules cannot handle, that is reported to
  the maintainer as a design question, not fixed with a per-map knob.

## 5. Generation pipeline

### 5.1 Geometry (P0, before anything else)

EP1 keeps the colour-threshold, flood-fill and trace approach, but the
tracing is fixed first, because seven maps have no floor at all. The rules
below were measured across all 42 scans during design review; the only
configuration that reached the coverage floor treats coloured pixels as
barriers, because the exterior flood otherwise leaks through the yellow
START / TO BOSS label boxes at corridor ends and through coloured door bars
drawn across wall lines.

- Pixel classes. *V* is the maximum RGB channel. `neutral` means
  max − min ≤ 10. `white` is V ≥ 240. Neutral pixels with V in 201–239 are
  free space (not barrier, not white, not dark room).
- Barrier mask = (`neutral` and V ≤ 200) or not `neutral`. The
  `boundary_floor` split by area number is deleted. The dark-room mask is
  **not** subtracted from the barrier; subtracting it reopens walls through
  their antialias halos.
- `dark-room` = connected components of (`neutral` and V in 120–200) that
  are ≥ 400 px **and** fill ≥ 25 % of their bounding box. The grey differs
  per scan (Area 45 `(174,176,178)`, Area 38 `(159,161,164)`, Area 24
  `(131,131,131)`), so no single colour is matched; the bounding-box test
  separates solid fills (0.29–0.94) from antialias curves along walls
  (0.01–0.07). Measured, this marks exactly nine maps: Areas 22, 24, 36, 37,
  38, 40, 41, 43, 45. The build prints the detected dark-room area per map
  so a missed dark room is visible; coverage cannot catch it because grey is
  not white.
- Exterior = flood from the image border across non-barrier pixels after a
  radius-1 binary closing of the barrier. Interior = not exterior and not
  barrier.
- Hole filling. Barrier components that do not touch the exterior are holes
  inside rooms. A hole is filled back into the floor when it contains any
  non-neutral pixel (coloured icons, red route dashes, label boxes with
  their digits) or any `dark-room` pixel. A hole made only of other neutral
  pixels stays (pillars, inner walls; Area 45's 346 px octagonal pillar is
  the reference case).
- Floor = interior ∪ filled holes. Dark rooms are therefore floor by way of
  hole filling and get the hatched overlay over the `dark-room` mask.
  Measured end to end with these rules: minimum coverage 96.5 %, median
  99.3 %, no map below 95 %.

*Implementation refinements (P0/P1, EP1 C1).* Rendering C1 showed four
artefacts the rules above do not handle; `scripts/challenge_maps.py` adds:

- **Ink.** Ink = non-neutral pixels plus black (V ≤ 60) neutral pixels within
  2 px of them, so the black borders of label boxes and door bars belong to
  the annotation, not the wall. Ink components that do not touch the exterior
  become floor. Ink that crosses a wall line (a START box over a corridor
  end, a door bar across a corridor) is added to the floor only where a
  radius-9 closing of the floor covers it, i.e. where floor lies on both
  sides; the part of a label box outside the walls stays exterior.
- **Text.** Enclosed neutral holes that touch the floor are filled when they
  are at most 24 px tall and either at most 24 px wide or at least 5 px in
  both directions (letters, digits, runs of touching letters). Thin long
  inner walls and pillars stay.
- **Letter counters.** Enclosed free-space components no larger than
  24 × 24 px are not rooms (the inside of O, 0 and © in exterior text).
  After text filling, non-floor islands of that size fully inside the floor
  are filled.
- **Map crop.** The rendered map is cropped to the floor, symbols, badges
  and terminals plus 24 px, so blank source margins do not become blank
  canvas.

Measured with the refined rules on all 42 scans: minimum coverage 97.0 %.
Dark rooms are still detected on exactly the nine maps listed above.
- Outline = `neutral` barrier pixels within 2 px of the floor. Non-neutral
  barrier pixels (label boxes, coloured door bars, icons) are never traced;
  they exist only as symbols. Exterior-side text such as "© 2003 PSO World"
  is not within 2 px of floor and is therefore never traced either.
- Coverage gate. Reference = `white` pixels not connected to the image border
  through `white` pixels (label boxes stop that flood, so it does not leak).
  Coverage = |floor ∩ reference| / |reference| per map; the build prints a
  per-area table (coverage %, uncovered px, floor components) and fails below
  *T*. *T* is set in P0 from the measured minimum minus 1 point and must be
  at least 95. If P0 cannot reproduce the measured minimum above, the
  tracing is not fixed.
- Tracer: keep the `potrace` binary. `potracer` (PyPI) is a pure-Python port
  that is roughly 500× slower and emits no SVG, so it is not a swap. The
  binary is listed in the README prerequisites and the build fails with a
  clear message when it is missing.
- Areas 15–18 lose their special no-outline rendering and go through the
  same floor + outline pipeline. Area 28's `MinFilter(7)` (a 3 px floor
  dilation against the orange maze grid's antialiasing) is deleted: the
  orange grid is non-neutral and is already barrier under the new rule.
- Geometry, dark-room overlay and the fidelity check run once per area and
  are reused for the three languages.
- Libraries: `numpy` and `scipy.ndimage` (labelling, binary closing, distance
  transform for the 10 px and 12 px proximity tests) are added next to
  Pillow and pinned in `scripts/requirements-maps.txt`. This replaces the
  hand-written BFS in `remove_small_components`. No scikit-image.

EP2 keeps `floor_mask` and `label_layer` from the wiki PNGs and the
two-embedded-PNG structure the verifier expects. Anchor validation for EP2
uses the exact-colour floor mask before the 21 px closing, so the 12 px
tolerance is real.

### 5.2 Routes

Routes are hand-authored polylines (3.2). The author reads the PSO World red
line and the Sakura yellow line, writes the waypoints in PSO World pixel
coordinates, renders, and adjusts. The renderer draws each leg as one `<path>`
with `data-role`, a halo path beneath, and an arrowhead marker on the last
leg.

### 5.3 Fidelity check (EP1)

The PSO World red dashed pixels are extracted (existing predicate) and used
as a check, not as geometry. Red components of 40 px or fewer are dashes;
larger ones are red symbols (door bars, boss markers) and are excluded.
Measured across all 42 scans the largest dash is 39 px and the smallest
symbol 41 px, so the fixed cut is correct everywhere with 1 px of margin;
that margin is a known risk and the build prints the largest dash and
smallest symbol per map so a future scan that breaks it is visible.

- ≥ 85 % of dash pixels lie within 10 px of the drawn route union.
- ≥ 90 % of drawn route points lie within 10 px of a dash pixel.

*Implementation refinements (P1).* PSO World draws split routes as orange
dashes (for example `(252, 137, 18)`), so dash pixels are red **or** orange
(R ≥ 230, 110 ≤ G ≤ 200, B ≤ 100), with the same 40 px component cut. Warp
triangles and switch rings are outlined in the same reds; dash pixels within
20 px of a declared symbol anchor are excluded. The second percentage is
measured over non-optional routes. C1 results: Area 1 89.0 % / 96.2 %,
Area 2 97.3 % / 91.2 %.

The build prints both per area and fails below threshold unless `fidelity`
holds a reason (for example "Sakura route skips the north room; notes
follow Sakura").

### 5.4 EP2 routes

Wiki maps number rooms in route order. The main route is authored from start
through the numbered rooms to the exit, with legs split at warps (Area 9:
rooms 1–4, warp B → B′, rooms 5–6). Several coloured STARTs become one
`split` route per extra group, merging where the Ephinea Wiki stage guide,
the Sakura EP2 pages (`ep2_challenge/c1..c4`) or the PSO World Stage 3–5
guides say the groups regroup. Where these sources do not state a path, the
route follows the numbering and the general note says so.

### 5.5 Removed code

`area_05()`, `inline_approved_area_one()`, `accepted_area_one_route()`, the
`(language, stage, area) == ("zh", 1, 1)` skip, `remove_small_components` as
a room filter, the per-area `boundary_floor` split, and every
`LANGUAGES / STAGE_NOTES / AREA_NOTES_ZH / AREA_GENERIC / C*_NOTES / C*_BADGES /
C*_TERMINALS / C*_SYMBOLS` dict are deleted once their content lives in the
JSON. Both scripts share one module for symbols, routes, badges, panels and
validation.

## 6. Page and legend changes

- The legend `<aside>` in both pages groups symbol kinds rather than listing
  each: main route, split route, solo route, optional pickup, start, exit,
  warp, switch / door (same colour = same pair), trap / turret, box, other
  mechanisms (rocks, heal, target, console, press, false wall, sequence),
  dark room, rooms and corridors. The final item count is fixed in P5 after
  the P0 vocabulary pass, and the e2e assertion is updated to that count.
  `.challenge-legend ul` changes from three fixed columns to
  `repeat(auto-fit, minmax(180px, 1fr))`, and the two `@media` overrides
  (`max-width: 600px` → `1fr 1fr`, `max-width: 420px` → `1fr`) are deleted
  because auto-fit makes them obsolete. Swatches use the palette in 3.1.
- The intro sentence in `.challenge-language` keeps its meaning; EP1 keeps
  the phrase "independently redrawn" because the e2e test asserts it.
- `alt` texts are unchanged. No new markup or Angular behaviour.

## 7. Verification

Deltas against what exists:

- **New** `scripts/test_challenge_maps.py` (unittest, wired into `npm test`):
  JSON schema; coordinates inside source bounds; valid roles, kinds and
  `exit_kind`; each warp `n` has exactly one `prime: false` and one
  `prime: true`; numbered-note count equals badge count in all three
  languages; the set of areas in each JSON equals the generator's area list.
  Page references stay the verifier's job (below).
- **New build-time gates** (Python, in the generators): coverage gate (5.1),
  anchor-on-floor rule (3.3), fidelity check (5.3). All print per-area tables.
- **`scripts/verify_challenge_maps.mjs`**, kept as is: EP1 exact inventory,
  source resolution floor (≥ 220 px each side and ≥ 65 000 px²), no
  `<image>` / `data:image/`, `PSO World` and `Sakura` present; EP2 pinned
  SHA-1 sources with a ≥ 750 × 750 floor, `Ephinea Wiki` present, exactly
  two base64 PNG layers with source dimensions, no `../`, exact per-language
  inventory with no stray PNGs; every per-language SVG path referenced by
  its page. Added: every SVG contains at least one `data-role="main"` path.
  The `#071a31` substring check stays as it is.
- **`tests/e2e/site-smoke.spec.mjs`**: legend item count 7 → the final count
  from P5, and the new legend texts.
- **Visual review tool** `scripts/render_challenge_maps.mjs`: renders selected
  SVGs to PNG with the project's Playwright Chromium into a directory given
  on the command line. Requires `npx playwright install chromium`.
  Not part of `npm test`.
- Acceptance run: `npm test`, `npm run build`, `npm run test:e2e` green.

Toolchain to install locally before P0: `potrace` binary, the pinned
`scripts/requirements-maps.txt` (Pillow, numpy, scipy), Playwright Chromium.

## 8. Work plan

Original review plan: each phase ends with a local commit on `master` and a
contact sheet of the affected maps for review. Phase completion and visual
acceptance must be recorded separately. The maintainer explicitly requested
documentation alignment, commit and push for the earlier implementation on
2026-09-15. The separate 2026-09-16 acceptance above covers the current scope;
the original phase table below is retained as design history.

| Phase | Deliverable | Done when |
|---|---|---|
| P0 | Floor tracing fix (5.1 rules), coverage table, once-per-area geometry, `requirements-maps.txt`, render tool, README prerequisites, symbol vocabulary pass | Coverage ≥ 95 % on all 42 EP1 maps with the table in the commit message; hole filling verified on Area 45 (pillar kept, box icons filled); dark-room area printed per map and non-zero on exactly Areas 22, 24, 36, 37, 38, 40, 41, 43, 45; final symbol table appended to this document; render tool produces PNGs. |
| P1 | JSON data model, shared renderer module, EP1 C1 (Areas 1–2) and Area 05 migrated; bespoke code deleted | Three maps rendered with solid routes, symbols, dark rooms, key strip. Maintainer reviews the three renders before P2. |
| P2 | Fidelity check, anchor rule, unit tests | C1 maps pass every gate. |
| P3 | EP1 C2–C9 authored stage by stage | Every stage: data authored from the scan and the Sakura GIF, gates pass, contact sheet reviewed against both. |
| P4 | EP2 all 25 areas: routes, badges, en/ja notes (50 new translations following `docs/PSOBB_CHINESE_LOCALIZATION.md`) | Routes on every map; zh Area 1 regenerates from JSON; renders reviewed. |
| P5 | Legends, CSS, e2e, verifier delta, README and `docs/ARCHITECTURE.md` | `npm test`, build and e2e green. |
| P6 | Final review | Contact sheet of 67 zh maps plus spot checks of en/ja; maintainer acceptance. |

## 9. Acceptance checklist per map

- Inventory every source annotation separately from geometry and routes: action,
  trigger, order, role, hazard type, quantity and optional pickup. Each must map
  to a visible caption, symbol or note. C9's source-by-source record is in
  [CHALLENGE_C9_ANNOTATION_AUDIT.md](CHALLENGE_C9_ANNOTATION_AUDIT.md).
- One continuous line per role and per leg; no dots, gaps or stray fragments.
- The line stays inside corridors and rooms and follows the reference route.
- Every mechanism in the source is on the map at the right spot, with the
  source colour; nothing floats outside the floor.
- Rooms read as solid shapes; dark rooms are visibly different and explained
  by the legend.
- Badge numbers match the numbered notes; start and exit are labelled.
- The three languages render without text overlapping geometry.

## 10. Risks and non-goals

- **Route currency.** PSO World routes date from 2003 and Sakura's are TA
  routes of the same era. Record conflicts, source availability and version
  scope; neither old guide automatically overrides verified BB behavior.
  A modern deviation needs a `fidelity` reason and a note. The C9 pass uses
  repository copies and indexed text for PSO World, whose live guide could
  not be read during verification.
- **EP2 route inference.** Numbering gives order, not always the corridor
  choice. Ambiguities are recorded in the general note rather than guessed.
- **Not in scope.** Rewriting the guide prose; new page layout; any change to
  historical URLs; the non-map Sakura files (`boss_1.jpg`, `c3_*.jpg`, …)
  under `assets/img/challenge/ep1/`, which stay untouched.
