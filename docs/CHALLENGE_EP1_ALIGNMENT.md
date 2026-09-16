# EP1 stage alignment

Scope: apply the accepted C9 source-alignment standard to C1–C8, in order.
A stage is complete only after floor, routes, local operating instructions,
three languages and generated-map checks are finished. Source coverage is
not proof of game event behavior. The maintainer accepted the completed scope
and authorized commit/push on 2026-09-16; see the [final acceptance record](CHALLENGE_MAP_REDRAW.md#acceptance-and-review-2026-09-16).

| Stage | Areas | Status |
|---|---|---|
| C1 | 1–2 | Complete: geometry, 9 captions, three-language layout and production mobile-page checks pass. |
| C2 | 4–8 | Complete: 21 captions, three-language layout and production mobile-page checks pass. |
| C3 | 9–13 | Complete: 25 captions, puzzle insets, three-language layout and production mobile-page checks pass. |
| C4 | 14–18 | Complete: 26 captions, three-language layout and production mobile-page checks pass. |
| C5 | 20–24 | Complete: 20 captions, three-language layout and production mobile-page checks pass. |
| C6 | 25–29 | Complete: 23 captions, three-language layout and production mobile-page checks pass. |
| C7 | 31–35 | Complete: 25 captions, three-language layout and production mobile-page checks pass. |
| C8 | 36–40 | Complete: 30 captions, three-language layout and production mobile-page checks pass. |
| C9 | 41–45 | Complete and accepted as the standard. See C9 annotation audit. |

## C1 evidence and corrections

Sources:

- Checked-in PSO World `original/area_01.png` and `area_02.png`: map coordinates,
  switch colors, numbered warp pairs and enemy-skip labels. This does not claim
  the original site is currently serving its walkthrough.
- [Sakura challenge guide](https://www.ne.jp/asahi/mihara/sakura/pso/capture/challenge_mode/index.html):
  local GIFs for both areas; waiting duty, ignoring enemies, turning back after
  a warp and clearing enemies before assigning the switch holder.
- [PSO Palace C1](https://psopalace.sylverant.net/cmode_stage1.html): retrieved
  historical walkthrough; pressure-pad duties, switch order and return path.
  Platform-specific boss statistics/advice are outside this map pass.
- [Ephinea C1 guide](https://wiki.pioneer2.net/w/Episode_1:_Stage_1/Guide):
  detailed Area 1 room instructions; Area 2 prose covers only its opening rooms.
  It independently clarifies the two-player optional boxes and held blue pad.

| Area | Local instruction inventory |
|---|---|
| 1 | Two-player optional boxes; expose and hold the blue pad while another player presses red; leave one player at the purple gate; skip central and eastern enemies; pink-switch runner returns while the party waits. |
| 2 | Clear enemies before holding/retriggering the timed switch; after 1→1′ turn back into 2, then press purple at 2′; skip forward warp 4 when racing the clock. |

The previous optional-box note incorrectly suggested a solo collector. Both
players’ duties now appear in all three languages. Colored gate strokes and
source labels are excluded from the floor. Hidden floor beneath start/warp
labels is restored; Area 2 retains its actual central void and separate warp
island. Area 1’s bent blue barrier uses two segments. Every numbered warp pair
is retained (1 in Area 1; 4 in Area 2). No warp connector is drawn as walking.

The nine captions store their evidence, source anchor and translations in
`ep1.json`; the floor is maintained in `ep1-c1-geometry.json`. A right-side
caption column keeps these wide forest maps unobstructed. Source-dash coverage
is 96.2% / 97.9%; all complete route segments stay within 2 px of the floor.
Sakura’s purple-gate wording is not treated as evidence that the gate should
be closed: Palace’s walkthrough explains opening the party’s route.

Validation: structural/contour/route tests and all six localized C1 Chromium
layout checks pass. The shared renderer reproduces all 15 accepted C9 SVGs
byte for byte. The permanent browser layout checker is
`scripts/check_challenge_map_layout.mjs`.

## C2 evidence and corrections

Sources: checked-in PSO World Areas 04–08, corresponding Sakura GIFs, and
[PSO Palace C2](https://psopalace.sylverant.net/cmode_stage2.html). The Palace
page was retrieved successfully. The Ephinea C2 raw page could not be fetched;
it is not counted as a completed cross-check. Search results titled “Stage 2
Level Maps” with Mines/Spaceship content belong to Episode II and were excluded.

| Area | Local instruction inventory |
|---|---|
| 4 | Timer runner and respawns; two fixed Handgun boxes; shoot above the supply door; one-weapon pad and recovery; left rock and healing ring. |
| 5 | Ignore enemies and use the north false wall; hold the right pad and coordinate supply collection; collector returns to release waiting teammates. |
| 6 | Shoot above the supply door; four weapons in the room; fixed armor; traps before breaking crescent-room rocks. |
| 7 | Optional first-room false wall; high rock in the dark room; entrance-left rock exposes gate switch; retrieve four shields beyond the exit. |
| 8 | One fence runner with coordinated switch holders; entrance-view six-pad arrangement; green pad releases the party; four shields, excluding armor; clear traps before the moving-flame shooting sequence. |

Twenty-one local callouts are translated into zh/en/ja. Equipment pads show
quantities 1 / 4 / 4 and their distinct weapon/shield types. All six puzzle pads
retain their source positions and numbers; the caption also states the
entrance-view arrangement because the source cluster is tiny. The actual
central pillars and crescent-room gaps remain non-walkable. Authored routes
bend around pillars instead of copying the source's straight red line through
them. False-wall glyphs now render reliably (a zero-width filtered SVG line
had disappeared). Numeric badges and exit labels are moved off mechanisms.

Corrections to the previous implementation: Area 4’s timer is not its healing
ring; Handgun is 光枪 per the item-name authority; Area 8’s runner does not
operate every switch alone; armor is not an acceptable substitute for shields.
Area 5 no longer claims an unsupported extra false-wall supply room beyond the
warp. Its original switch colors are retained. Palace’s “button near the door”
is described by location; no unverified color is assigned to that phrase.
Area 7’s “left” means left while facing into the room, i.e. the northern rock.

The legacy C2 tables and custom Area 05 renderer are removed. The shared
measured-floor renderer supplies every C2 map. The dash detector now separates
red route ink from pink warp glyphs and counts only source dashes on actual
floor; source lines through pillar holes are not walking evidence. C2 coverage
is 99.7%, 100.0%, 100.0%, 96.5%, 99.2%. All segments are additionally checked
against floor boundaries. This correction changes C1 scores to 99.3% / 100.0%
without changing its routes or floor; C9 generated assets remain byte-identical.

Fourteen structural tests, all fifteen localized C2 layout checks and the
complete map inventory verifier pass. Production mobile-page checks pass for C1, C2 and C9.

## C3 evidence and corrections

Sources: checked-in PSO World Areas 09–13, corresponding Sakura GIFs,
[Sakura’s four Area 13 screenshots](https://www.ne.jp/asahi/mihara/sakura/pso/capture/challenge_mode/index.html)
(`c3_02_01.jpg` through `c3_02_04.jpg`), and
[PSO Palace C3](https://psopalace.sylverant.net/cmode_stage3.html). Palace’s
[annotated Area 9 image](https://psopalace.sylverant.net/images/cmode/areas/area_09.gif)
was also retrieved to reconcile its row-major numbering with Sakura’s action
sequence. The externally sourced prose remains historical route evidence,
not a claim of BB script verification.

| Area | Local instruction inventory |
|---|---|
| 9 | Central traps; coordinated piston hold/retreat; ignore branch enemies and warp back; only entrance-left overhead target plus alternate magic/fixed-gun access; nine-pad sequence and safe transit. |
| 10 | Hallway traps; open first warp and split; either green button works; optional false-wall boxes; only approach-right rocks in both rows. |
| 11 | Hold piston until teammates are clear; two safe pads; side-passage switch duty; four hidden shooting targets; light-path holder returns; stay on the lights; simultaneous exit pads and ignore enemies. |
| 12 | Direct route; skip the detached hidden side room. |
| 13 | Right pad in every pair; do not leave piston holders early; orange side switch; branch/main duties for four hidden switches; correct grass/water/shore locations; corridor traps; final cyan switch. |

Twenty-five local captions replace the older summaries. C3 uses callouts and
insets without a duplicate empty “key notes” panel. Area 9’s source target that
is “left from the entrance” is on the east side of the north-up map; the
correct target and three forbidden targets are individually marked. Area 10
retains both valid greens, as Sakura explicitly allows either. Incorrect
pads have crossed glyphs rather than ordinary switch markers.

The nine-pad inset reconciles two numbering systems: Palace’s 7→4→5→6→3
walk corresponds to Sakura’s action 1→2→3, followed by returning through 4.
Palace explicitly identifies original keys 1/2/8/9 as dangerous. The two
middle-row transit pads must not be relabeled as traps merely because they
are not main action numbers. This fixes the old “all other pads are traps”
claim. The actual floor retains the center cage/diagonal walls; the inset is
clearly described as an entrance view. C2’s six-pad instruction also gains a
readable entrance-view grid using the same renderer.

Area 11 records the holder’s return through a bidirectional warp separately
from the player following the light path. Warp validation now accepts either
direction of a declared pair while still rejecting unrelated endpoints.
Area 13 records each side’s mechanism duty rather than forcing the old 3:1
split onto Palace’s 2:2 explanation. Two bush pads and two shooting targets
are distinguished. Foie / Zonde use the authority names 火球术 / 闪电术;
Handgun remains 光枪. The Area 10 optional boulder corridor is restored beneath
the source icon; Area 12’s deliberately detached hidden-room outline is kept.

The C3 legacy tables are removed. Source-dash coverage: 98.7%, 98.4%, 98.8%,
100.0%, 100.0%. Complete route segments and all contours pass structural checks.
Fifteen structural tests and the map inventory verifier pass. Production-page
and localized browser-layout checks pass.

## C4 evidence and corrections

Sources: checked-in PSO World Areas 14–18 and Sakura GIFs,
[PSO Palace C4](https://psopalace.sylverant.net/cmode_stage4.html), and its
[Area 17 numbered inset](https://psopalace.sylverant.net/images/cmode/areas/area_17.gif).
The historical V1 wall/piston glitch discussion is excluded from the BB guide.
Boss Area 19 combat instructions are outside this map-alignment pass.

| Area | Local instruction inventory |
|---|---|
| 14 | First-room edge avoids traps; east switch runner ignores respawns; piston holders relay; left switch before enemies; right console releases standby player; optional healing needs support; both branches warp back and take the other exit; held dark-room light. |
| 15 | Left warp only; press destination switch to destroy rocks and regroup; optional false-wall boxes. |
| 16 | Timer runner must hurry back; only entrance-left pad; dark destination has no light switch; route trap marks. |
| 17 | Full eight-pad layout and alternating 3:1 relay; wait for the other group; find dark-room false wall; timer is insufficient for its own runner; far-side holder raises the center piston. |
| 18 | Release the two branches in order; only entrance-right pad; left pink switch; left side of right-route U room; cage relay at reunion; boss door may open before every enemy dies. |

Twenty-six local captions replace the incomplete C4 tables. Area 17’s complete
eight-pad puzzle was missing previously. Its numbered pads and gate colors now
follow Sakura’s explicit numbered inset, with positions in PSO World source
coordinates. The main group visits 1/3/5/7; the solo visits 2/4/6/8. Paths route
through the corresponding compartments, and the final hold/return timing is
written at the piston location. A false-wall corridor omitted from PSO World’s
floor outline is restored using Sakura’s topology and Palace’s explicit walking
instruction; it is not shown as a teleport.

Area 14 has two entrances labeled 3 leading to one return destination. Warp
groups now support that source structure instead of forcing invented extra
warp numbers. Actual duplicate endpoints remain invalid. The optional and
standby routes remain distinct from ordinary advancement. Source warp markers
can overhang platforms; walking endpoints remain inside the measured floor.

Area 16 source limitation: the PSO World red line joins the two nearby warp-1
platforms while Palace explicitly describes teleporting into the dark room.
The authored route uses separate warp legs. Forty-four red connector pixels
on the segment (69,94)–(112,94) are explicitly excluded from walking-route
coverage, with a reason stored in `source_route_exclusions`. Raw coverage is
92.7%, and coverage without that diagram connector is 98.1%. This does not
relax floor checks or add a fictional walking line. Other C4 coverage is
98.9% / 100.0% / 100.0% / 98.0%. Every complete walking segment is checked.

The old C4 tables are removed. Sixteen structural tests pass, including the
eight-pad duties, shared return destination and the reviewed connector scope.
All localized layout and production mobile-page checks pass.

## C5 evidence and corrections

Sources: local PSO World Areas 20–24 and Sakura GIFs; retrieved
[PSO Palace C5](https://psopalace.sylverant.net/cmode_stage5.html).

| Area | Operating instructions |
|---|---|
| 20 | Light duty; tap/retreat/clear turrets before the fence relay; optional boxes; guarded healing ring; right-wall detour around last-room traps. |
| 21 | First turret group can be ignored after opening the door; the second must be cleared before the far-side release. |
| 22 | High-HP switch runner exits the raised platform immediately; pink light only; entrance-right computer removes the barrier; corridor traps. |
| 23 | Clear room 2 traps; choose approach-left warp; immediately turn back through the false wall. |
| 24 | Safe side boxes; four U-room trap corners and following corridor; light then run past turrets; overhead shooting target opens optional healing ring. |

Twenty callouts retain these distinctions in three languages. Area 20 uses
the Palace right-wall detour instead of walking straight through the source's
last-room trap line (source dash coverage remains 96.3%). Other areas reach
100%. Area 23's rejected warp has a distinct triangular X glyph, not a shooting
target. Floor cutouts caused by source labels and colored gate ink were
repaired; actual optional branches and terminal alcoves remain.

## C6 evidence and corrections

Sources: PSO World Areas 25–29, local Sakura GIFs, and retrieved
[PSO Palace C6](https://psopalace.sylverant.net/cmode_stage6.html).

| Area | Operating instructions |
|---|---|
| 25 | Trap corridors; do not shoot the third small-room wall switch; enemies in the light-switch room; entrance-rear-left pad only; collector duties. |
| 26 | False wall and fixed Buster; safe box room. Chinese item name 破坏光剑 follows the maintained drop-table authority. |
| 27 | Ignore third-room pad; light before fighting Garanz; safe pre-warp boxes; designated Garanz runner scouts first. The old healing icon was a box. |
| 28 | Clear warp turrets; one maze runner and three operators; nine barriers including entrance; eight outside pad positions; center switch before warp; corrected 2 landing; left turn after 3; conflicting optional-room danger reports. |
| 29 | Entrance-front-left pad only; Garanz scout and omitted traps; lower path; light only after clearing; timer runner and immediate turret cover. |

All five areas cover 100% of source route dashes. Area 28 keeps the physical
3×3 barrier grid and outside pad numbers; it does not invent an internal
walking sequence not drawn by the references. Palace explicitly says entry
is additional to the eight numbered barriers; the old renderer's unsupported
“1 again at the end” instruction is removed. The center switch remains
mandatory before warp 2. Its corrected landing is located near the maze-room
entrance following Sakura; Palace also explicitly rejects the upper-left
landing used by older maps. The marker position is schematic.

Sakura marks optional hidden boxes as trap-free, while Palace warns of
technique turrets on the approach. The local warning records the disagreement;
neither a guaranteed-safe detour nor unverified side-room geometry is added.
No platform-specific Vol Opt battle advice is imported into these floor maps.

## C7 evidence and corrections

Sources: PSO World Areas 31–35, local Sakura GIFs, and retrieved
[PSO Palace C7](https://psopalace.sylverant.net/cmode_stage7.html).

| Area | Operating instructions |
|---|---|
| 31 | Waterfall boxes; ignore early turrets; optional healing; one south-switch runner; 1-first / 2 relay; regroup through 3 and two-player door; ignore final 4. |
| 32 | Break east rocks/open inner passage before timer; clear return-path boxes; timer-spawn turret cover and jars; avoid the entrance console. |
| 33 | Trapped waterfall boxes; progressively smaller paired pads; optional healing; normal warp loop and left warp; hallway traps. |
| 34 | High waterfall rock targets; interact left/right/left/right; four wrong switches; repeatedly refresh light for two rooms. |
| 35 | One runner chooses left/left/right; platform switches and return 4; left-edge turret bypass; optional late healing; light hidden by rocks. |

Area 34 uses an interact-switch glyph instead of a floor-pad glyph, following
Palace's explicit correction. The paired puzzle has a source-oriented inset.
The light requires repeated activation as it resets; “hold once indefinitely”
is not claimed. Source-only gray raised platforms in Area 31 are preserved as
interior lines instead of being labeled dark rooms. Area 33 uses the normal
route rather than importing Palace's Dreamcast Ver.1 wall-clipping shortcut.
Source-route coverage: 99.3%, 97.7%, 100%, 100%, 100%.

## C8 evidence and corrections

Sources: checked-in PSO World Areas 36–40, local Sakura GIFs, retrieved
[PSO Palace C8](https://psopalace.sylverant.net/cmode_stage8.html), and its
[Area 39 enlarged diagram](https://psopalace.sylverant.net/images/cmode/areas/area_39.gif).

| Area | Operating instructions |
|---|---|
| 36 | Four spare weapons / one per shortcut pad; optional 1 boxes; normal 2 route and light; left warp 3; turret bend; optional hall boxes; hanging jar; poison-jar light; skip exit turret boxes. |
| 37 | Marked passage through the barrier room and 2 return; gaps between hanging jars. |
| 38 | A waits without pressing timer; B1/C2/B3/C4/B2 relay; signal A only after ready; D follows C; safe side boxes; second timer split; immediate turret cover; final light. |
| 39 | Rock destruction raises turrets; crossed rocks stay intact; two maze switches including hidden one; optional end-room side switches. |
| 40 | Two mandatory four-weapon pads; four numbered door duties; south 1 then north 3; rock switch 2; held north light; three-pad runner / holder return; safe boxes; skip warp and Mag healing detour; timer stops before exit two-player door. |

Area 36 distinguishes the four-weapon shortcut from Area 40's mandatory eight
weapons. Its exit-side optional item room retains PSO World's two shield and
two weapon icon positions; Sakura instead labels this as four shield pads.
The operating advice therefore says to skip the optional equipment gate
without claiming an agreed item requirement. The isolated optional warp 5
uses a skip marker: its destination is not invented from overlapping symbols.

Area 38 retains four individually numbered pads and the full role/ordering
sequence. Area 39's extra hidden switch is corroborated by Palace's enlarged
diagram; the source map and entrance-view diagram face opposite directions.
Both are described explicitly rather than turning “right” into an absolute
map coordinate. The two red crossed rocks follow Sakura/Palace.

Every C8 map covers 100% of source dashes, with all complete walking segments
on measured floor. Source warp-arrow tips are removed from the floor contours
rather than preserved as triangular room protrusions. Gray interior platforms
and maze boundaries are separate vector lines, not blanket dark-room fills.

## Final local validation

- All 42 EP1 maps use measured vectors; 126 localized SVGs are generated.
- C1–C8: 37 maps and 179 local instructions. With C9: 210 instructions.
- `npm test` passes, including 19 map structure, route, source-inventory and
  mechanism regression tests.
- Chromium layout checks pass for all 126 EP1 SVGs; no caption clipping,
  caption overlap, floor occlusion or out-of-canvas text.
- Production build passes: 1,267 routes, 45 fragments. All 126 built SVGs are
  byte-identical to their generated source assets.
- All nine stages load every area in zh/en/ja on a 390×844 viewport; language
  persistence and complete mobile map inventories also pass.
- `git diff --check` passes. The accepted C9 geometry hash and all 15 accepted
  C9 SVG hashes are unchanged.
- This stage-level validation preceded the shared UI review. Final acceptance,
  viewer regression results and commit/push authorization are recorded in the
  [final acceptance record](CHALLENGE_MAP_REDRAW.md#acceptance-and-review-2026-09-16).

This is source alignment, not verification of every PSOBB quest event in a
live client. Historical platform-specific exploits and unverified destinations
are not treated as required walking routes. Source disagreements are retained
above rather than silently resolved by guesswork.
