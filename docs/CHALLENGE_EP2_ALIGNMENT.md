# EP2 stage alignment

Reviewed on 2026-09-16. Scope: C1–C5, 25 areas, 75 localized SVGs,
110 anchored instructions and 44 localized fixed-item labels. This is a
source-alignment pass, not a live quest-event or boss-mechanics verification.
The maintainer accepted the scope and authorized commit/push on 2026-09-16;
see the [final acceptance record](CHALLENGE_MAP_REDRAW.md#acceptance-and-review-2026-09-16).

## Source register

- [Challenge / Strategy](https://wiki.pioneer2.net/w/Challenge#Strategy), revision
  40590: the index of stage walkthroughs supplied by the maintainer.
- Ephinea walkthroughs:
  [C1](https://wiki.pioneer2.net/w/Episode_2:_Stage_1/Guide) (43051),
  [C2](https://wiki.pioneer2.net/w/Episode_2:_Stage_2/Guide) (43052),
  [C3](https://wiki.pioneer2.net/w/Episode_2:_Stage_3/Guide) (43053),
  [C4](https://wiki.pioneer2.net/w/Episode_2:_Stage_4/Guide) (43054),
  [C5](https://wiki.pioneer2.net/w/Episode_2:_Stage_5/Guide) (43055).
  These were readable through the browser retrieval tool; direct HTTP requests
  returning 403 were not counted as successful retrievals.
- Pinned maps in `assets/img/challenge/ep2/original/wiki/`: source coordinates,
  floor outlines, walls, room numbers, colored mechanisms, lettered warps,
  healing points, timers and box counts. The existing verifier pins remain intact.
- Sakura / PSOびより:
  [C1](https://www.ne.jp/asahi/mihara/sakura/pso/ep2_challenge/c1/index.html),
  [C2](https://www.ne.jp/asahi/mihara/sakura/pso/ep2_challenge/c2/index.html),
  [C3](https://www.ne.jp/asahi/mihara/sakura/pso/ep2_challenge/c3/index.html),
  [C4](https://www.ne.jp/asahi/mihara/sakura/pso/ep2_challenge/c4/index.html).
  Their text and checked-in JPGs provide a second reference for operations.
  No Sakura C5 reference was obtained; C5 attribution does not claim one.
- PSO-World was not serving a usable live walkthrough during this pass.
  Previously present combat advice remains identified as historical advice;
  it does not count as a fresh independent confirmation.
- Item identities were checked against `../droptable/i18n_names.json` and
  `npm run sync:i18n`. Item labels keep the English identity and authoritative
  Chinese name. Where the authority has no Japanese name, the English identifier
  remains instead of inventing a translation.

## Stage ledger

| Stage | Areas | Captions | Operational coverage |
|---|---|---:|---|
| C1 | 1–6 | 31 | South/west/north trap order; gate holder waits; north/south split; right/left/right two-player relay; four mandatory branches; shootable target; bridge holders; 50/100 fixed-damage stompers; optional supplies. |
| C2 | 8–13 | 23 | Separate starts and warp chains; shoot left door switch; required gatekeepers; timed switches; held lighting; poison controls; wait for all six Dubchics; northeast/southwest warp choices. |
| C3 | 15–19 | 15 | Four switches with three held gates; dark branch; required mini-bosses; fixed Resta 3 and four-slot frames; direct Area 18 exit route; optional equipment warps and menu use. |
| C4 | 21–26 | 27 | Four starting positions; active/inactive Recobox distinctions; bridge blocker; west-wall auto-warp; shoot terminal; solo gate relay; poison switch; barriers; menu-assisted corridors; boss supplies. |
| C5 | 28–29 | 14 | Separate floor segments; ascent/descent direction; paired warps across gaps; skip floors; required gatekeepers; healing and fixed units; Epsilon completion. |

Each caption in `ep2.json` stores a source description, source-space anchor,
three translations and a shared layout box. Room and warp identifiers agree
with the pinned maps. Walking routes stop at warps; empty space between tower
floors is never treated as a walkable connection. There are 118 authored warp
endpoints for route topology; the original letter artwork is the visible label.

## Corrections and source disagreements

- C3 Area 15: the fourth orange switch has floor traps, not a fourth pressure
  gate. Both map and page now distinguish it from the first three.
- C3 Area 17: use the authoritative name 圣泉术 for Resta; the fixed level is 3.
  Two fixed Soul Frames have four slots. Separate player starts are retained.
- C3 Area 18: both teams can head directly to the northwest exit room and defeat
  Gibbles. The eastern collection circuit is optional, not the main route.
- C3 Area 19: Wiki prose says General/Body, while the pinned map and inventory
  identify Warrior/Body (the inventory spells it `Warrior/Boby`). The map follows
  the pinned item identity; the disagreement is disclosed on the guide page.
- C4 Area 22: the exit-side hidden Scape Doll is included using the Sakura
  location reference and the Wiki inventory, even though the Wiki walkthrough
  does not describe the pickup operation.
- C5 west 7F: Ogre/Power ×2 and General/Body ×2 agree with the pinned map and
  Wiki inventory. The old page's General/Power claim was corrected.
- C5 east 1F and west 3F are skippable. The page now states the selected-enemy
  gate conditions; it does not tell players to clear every enemy on every floor.
- The Challenge index excludes Moon Atomizers; old recovery prose suggesting
  their use was removed. Scape Doll uses the authoritative 替身人偶 name.
- Boss movement, advanced invulnerability tricks and some C5 positioning advice
  inherited from the old page were not freshly verified against quest scripts
  or live play. The source note explicitly distinguishes that historical advice.

## Geometry and rendering

The old EP2 runtime floor extraction and its two embedded raster layers are
removed. `ep2-c1-geometry.json` through `ep2-c5-geometry.json` hold source-space
floor contours, dark/poison boundaries and separately traced mechanism artwork.
The initial contours were derived from source colors, then inspected with
targeted restoration beneath annotation plates and across obstructed thin
passages. This is not a claim that every polygon was hand-drawn.

Reviewed passage restoration covers Areas 1, 3, 4, 8, 10, 15, 18, 19, 23, 24
and 26. Pillar holes and disconnected warp platforms remain empty. Small
source annotation components are excluded from the floor; mechanisms remain
in their separate vector layer. These contours are committed data, so a future
build does not need the one-off extraction or path-fitting tools.

All output is SVG paths and text; no PNG is embedded. Floor, dark/poison fill,
route, source mechanism and authored label/caption layers have separate ownership.
Fixed-item names are native localized text replacing tiny raster lettering.
The shared renderer supports multiple starts, adjustable terminal labels and a
finish marker. EP1 uses the same defaults as before this pass.

Page prose now includes stage-specific operations with inline links to the
matching Guide and Sakura page, plus the Strategy index. The maps and their
captions support Chinese, English and Japanese. The existing long-form page
walkthrough remains Chinese; full page translation is a separate repository task.

## Validation

- The generator samples complete walking segments at 1 px intervals, allowing
  2 px contour-edge tolerance; warp jumps require paired endpoints.
- 24 structural tests cover both episodes, including all 25 EP2 areas, localized
  instructions/items, floor landmarks/holes, selected critical operations and
  full route segments. The tests do not depend on the image tracing toolchain.
- `check_challenge_map_layout.mjs` checks all 201 SVGs for clipped text,
  overlapping callout boxes and captions covering the floor.
- All 25 Chinese outputs were rendered and inspected by stage; dense source
  details remain zoomable vector artwork. Labels at multi-player starts were
  moved to avoid overlap and fixed-item occlusion.
- Regenerating EP1 after moving the renderer preserved all 126 accepted outputs
  byte for byte against the pre-EP2 snapshot, including C9.
- At the map/prose checkpoint, `npm test` and `npm run build` passed. Seven
  browser checks passed:
  five EP2 stage/language/mobile cases, guidance-language persistence and the
  complete challenge/Seabed map inventories. All 75 EP2 production SVGs match
  their source assets byte for byte. Subsequent shared UI fixes, final review
  results and acceptance are recorded in the [final acceptance record](CHALLENGE_MAP_REDRAW.md#acceptance-and-review-2026-09-16).

Reproduce:

```sh
npm run generate:challenge-maps:ep2
npm run test:challenge-maps
node scripts/verify_challenge_maps.mjs
node scripts/check_challenge_map_layout.mjs
npm test
npm run build
npx playwright test tests/e2e/site-smoke.spec.mjs --grep 'challenge|EP1 C|EP2 C'
```

## 2C4 auto-warp research handoff (2026-09-20)

A separate [2C4 auto-warp and branch analysis](CHALLENGE_2C4_AUTO_WARP.md)
now records the local BB quest evidence, a zoomed map and all 26 point coordinates.
The analysis labels A/B correspond to the guide's E/F: **E has 12 auto-warps;
F has 14**. Their onward routes differ: E continues through room 7 and G;
F takes H/I to the unnumbered side room (Delbiter → two Sinow Zoa → three
Deldepth) and returns through J. Both approaches converge at room 8.
Identical event references at room 6 entrances do not establish identical
onward routes or combat requirements.

This is a documentation/data handoff from `pso-quest-master` commit `a2194c4`,
not a change to the published guide or the accepted 2026-09-16 map outputs.
The local sample labels this layout Area 24 while the guide calls it Area 23;
retain that discrepancy until the deployed server quest has been checked.
