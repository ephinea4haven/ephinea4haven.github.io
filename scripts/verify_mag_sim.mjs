/* Engine unit tests. Run: node scripts/verify_mag_sim.mjs */
import { readFileSync } from 'node:fs';
import { createState, magLevel, feedOnce, checkEvolution, checkCellEvolution, exportSession, replaySession }
    from '../assets/js/mag-sim-engine.js';

const src = readFileSync('assets/js/mag-sim-data.js', 'utf8');
const win = {};
new Function('window', src)(win);
const DATA = win.MAG_SIM;

let failed = 0;
const check = (n, c) => { if (c) console.log(`  ok   ${n}`); else { console.error(`  FAIL ${n}`); failed++; } };

// --- createState
const s = createState(DATA, { start: { mode: 'fresh' } });
check('fresh 起始 level 5', magLevel(s) === 5);
check('fresh DEF 5 其余 0', s.def === 5 && s.pow === 0 && s.mind === 0);
check('fresh synchro 20 iq 0', s.synchro === 20 && s.iq === 0);
check('fresh magId=Mag', s.magId === 'Mag');
check('窗口初始 50/100', s.window.stage3 === 50 && s.window.stage4 === 100);

// --- feedOnce: stat progress, carry, caps
{
  const t = createState(DATA, { start: { mode: 'fresh' } }); // DEF5
  feedOnce(DATA, t, 'Monomate'); // Table0: DEF+5 POW+40 DEX+5 MIND0 Sync+3 IQ+3
  check('喂 Monomate 后 progress POW=40', t.progress.pow === 40);
  check('喂 Monomate 后 synchro 23', t.synchro === 23);
  check('单喂不升级（progress<100）', magLevel(t) === 5);
}
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  for (let i = 0; i < 3; i++) feedOnce(DATA, t, 'Trimate'); // POW+50 ×3 = 150
  check('POW 150 经验 → +1 级 progress 50', t.pow === 1 && t.progress.pow === 50);
}
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.synchro = 119; feedOnce(DATA, t, 'Monomate'); // +3 → 夹到 120
  check('synchro 封顶 120', t.synchro === 120);
}

// --- evolution engine
// checkEvolution export exists
check('checkEvolution 已导出', typeof checkEvolution === 'function');

const cs = (o) => createState(DATA, { start: { mode: 'custom', synchro: 20, iq: 0, ...o } });
function feedN(state, item, n) { for (let i = 0; i < n; i++) feedOnce(DATA, state, item); }
// Star Atomizer exists in every feed table and is all-positive & small, so a
// single feed from progress 0 never crosses 100 -> stats & level stay put,
// which triggers a window check exactly on the mag's current level.

// stage1 by FEEDER class: HU -> Varuna
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedN(t, 'Trimate', 10);
  check('Lv10 stage1 HU -> Varuna', t.magId === 'Varuna' && DATA.mags[t.magId].stage === 1);
}
// stage1 by feeder class FO -> Vritra (proves stage1 keys on feeder.class)
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'FO', gender: 'M', sectionId: 'Viridia' };
  feedN(t, 'Trimate', 10);
  check('Lv10 stage1 FO -> Vritra', t.magId === 'Vritra');
}

// stage2 by LINEAGE + max stat: Varuna + POW -> Rudra, even with feeder RA
{
  const t = cs({ magId: 'Varuna', def: 20, pow: 15, dex: 0, mind: 0 }); // level 35
  t.feeder = { class: 'RA', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv35 Varuna+POW -> Rudra (lineage, feeder RA ignored)', t.magId === 'Rudra');
}
// stage2 tie broken by LINEAGE tie-break, not feeder: POW==DEX (both max),
// lineage Varuna=HU tie=POW -> Rudra (feeder RA tie=DEX would give Marutah)
{
  const t = cs({ magId: 'Varuna', def: 20, pow: 7, dex: 7, mind: 1 }); // level 35
  t.feeder = { class: 'RA', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv35 tie POW==DEX -> Rudra via lineage HU (not Marutah)', t.magId === 'Rudra');
}

// stage3 strict perm: Rudra (Varuna lineage), POW>DEX>MIND, sectionId A -> Varaha
{
  const t = cs({ magId: 'Rudra', def: 48, pow: 2, dex: 0, mind: 0 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // group A
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 stage3 Rudra strict POW>DEX>MIND/A -> Varaha',
    t.magId === 'Varaha' && DATA.mags[t.magId].stage === 3);
}
// stage3 window SLIDE: stage2 mag created past 50 misses window, slides to 55,
// then evolves on the next feed at 55.
{
  const t = cs({ magId: 'Rudra', def: 53, pow: 2, dex: 0, mind: 0 }); // level 55
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer'); // 55 != 50 -> no evolve, slide to 55
  check('window slides 50 -> 55 on miss (still stage2)',
    t.window.stage3 === 55 && DATA.mags[t.magId].stage === 2);
  feedOnce(DATA, t, 'Star Atomizer'); // 55 == 55 -> evolve
  check('evolves at slid window 55 -> stage3', DATA.mags[t.magId].stage === 3);
}
// --- evolution windows are RANGES, not exact levels (review I1) -------------
// One feed can raise the level by up to +4 (all four stats crossing a progress
// boundary at once), so an `=== window` gate can be jumped clean over.
// (a) stage3: Rudra at Lv49 with two stats at progress 99 -> one feed -> Lv51.
{
  const t = cs({ magId: 'Rudra', def: 47, pow: 2, dex: 0, mind: 0 }); // level 49
  t.progress.def = 99; t.progress.pow = 99;
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };      // group A
  feedOnce(DATA, t, 'Star Atomizer'); // def+1 pow+1 -> level 51, overshoots 50
  check('Lv49 -> 51 overshoot still evolves at stage3',
    magLevel(t) === 51 && DATA.mags[t.magId].stage === 3);
}
// (b) stage4: a Lv99 stage-3 mag gaining +3 in one feed overshoots the Lv100
// window; with an `=== window` gate the window slid to 110 and the evolution
// was lost forever.
{
  const t = cs({ magId: 'Varaha', def: 40, pow: 30, dex: 9, mind: 20 }); // level 99
  t.progress.def = 99; t.progress.pow = 99; t.progress.dex = 99;
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer'); // -> 41/31/10/20 = Lv102, DEF+DEX=POW+MIND
  check('Lv99 -> 102 overshoot still evolves at stage4 -> Deva',
    magLevel(t) === 102 && t.magId === 'Deva' && DATA.mags[t.magId].stage === 4);
}
// (c) a custom-start base Mag above Lv14 (the setup dropdown offers exactly
// this) must still take its stage1 evolution, not be stuck at stage 0 forever.
{
  const t = cs({ magId: 'Mag', def: 50, pow: 0, dex: 0, mind: 0 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('custom Mag at Lv50 evolves (stage1 has no upper bound)', t.magId === 'Varuna');
}
// windows never lag behind the level: a stage-3 mag created at Lv121 slides
// its stage4 window 100 -> 110 -> 120 in ONE feed (a single `+= 10` left it at
// 110 and, on an odd-level mag, it could never catch up).
{
  const t = cs({ magId: 'Varaha', def: 121, pow: 0, dex: 0, mind: 0 }); // level 121
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('stage4 window slides all the way to 120 in one feed', t.window.stage4 === 120);
}

// stage3 tie case (non-FO): Rudra HU, DEX==MIND > POW -> tie mag Varaha (A),
// NOT strict-perm Nandin (DEX>MIND>POW/A).
{
  const t = cs({ magId: 'Rudra', def: 43, pow: 1, dex: 3, mind: 3 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // A
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 stage3 tie DEX==MIND>POW/A -> Varaha (tie beats strict Nandin)',
    t.magId === 'Varaha');
}

// FO special (POW strictly max, DEF>=45) -> Andhaka
{
  const t = cs({ magId: 'Namuci', def: 45, pow: 5, dex: 0, mind: 0 }); // level 50
  t.feeder = { class: 'FO', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('FO DEF>=45 POW-max -> Andhaka', t.magId === 'Andhaka');
}
// FO special beats TIE path: DEF>=45, POW==DEX (not strict max) -> other=Bana,
// NOT stage3Ties[FO] mag Naga.
{
  const t = cs({ magId: 'Namuci', def: 45, pow: 2, dex: 2, mind: 1 }); // level 50
  t.feeder = { class: 'FO', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('FO special beats tie/strict (POW not strict) -> Bana', t.magId === 'Bana');
}

// stage4 -> Deva: HU/M/Type1, DEF+DEX=POW+MIND (first-matching formula)
{
  const t = cs({ magId: 'Varaha', def: 40, pow: 30, dex: 10, mind: 20 }); // level 100
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv100 HU/M/Type1 DEF+DEX=POW+MIND -> Deva',
    t.magId === 'Deva' && DATA.mags[t.magId].stage === 4);
}
// stage4 NULL combo leaves mag at stage3: HU/M/Type1, DEF+POW=DEX+MIND -> null
{
  const t = cs({ magId: 'Varaha', def: 25, pow: 25, dex: 25, mind: 25 }); // level 100
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // Type1 -> null
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv100 null stage4 combo stays stage3 Varaha',
    t.magId === 'Varaha' && DATA.mags[t.magId].stage === 3);
}

// cap boundary: feeding past level 200 caps at 200
{
  const t = cs({ magId: 'Mag', def: 100, pow: 99, dex: 0, mind: 0 }); // level 199
  feedN(t, 'Trimate', 5);
  check('level caps at 200', magLevel(t) === 200);
}
// --- BUG 1: a negative feed must never cost the mag a LEVEL ------------------
// Wiki (Mags#Raising): "Mags may also lose experience in their stats depending
// on the item, but they cannot lose levels." The engine used to borrow a whole
// point (mind 5 -> 4, progress 85), which drops the level. The loss now floors
// at the bottom of the current point instead.
// (This test asserted the borrow before; the borrow IS the bug, so the
// expectation is inverted rather than the fix weakened to keep it green.)
{
  const t = cs({ magId: 'Rudra', def: 10, pow: 0, dex: 0, mind: 5 });
  feedOnce(DATA, t, 'Trimate'); // table2 Trimate MIND -15, progress 0 -> floors at 0
  check('负值喂食不借位：MIND 保持 5，progress 归零',
    t.mind === 5 && t.progress.mind === 0);
}
// partial loss WITHIN the current point is still applied (80 -> 65)
{
  const t = cs({ magId: 'Rudra', def: 10, pow: 0, dex: 0, mind: 5 });
  t.progress.mind = 80;
  feedOnce(DATA, t, 'Trimate'); // MIND -15
  check('负值喂食在当前点内扣减 progress（80 -> 65）',
    t.mind === 5 && t.progress.mind === 65);
}
// the reported repro: a Diwari (table 7) at 20/20/20/20 = Lv80 fed one Monomate
// ([-4,+21,-15,-5]) used to drop to Lv77.
{
  const t = cs({ magId: 'Diwari', def: 20, pow: 20, dex: 20, mind: 20 }); // level 80
  feedOnce(DATA, t, 'Monomate');
  check('Diwari Lv80 喂 Monomate 后仍是 Lv80（不掉级）', magLevel(t) === 80);
}
// even a capped Lv200 mag must not be knocked back down to 198
{
  const t = cs({ magId: 'Diwari', def: 50, pow: 50, dex: 50, mind: 50 }); // level 200
  feedOnce(DATA, t, 'Monomate');
  check('Lv200 满级 mag 喂 Monomate 后仍是 Lv200', magLevel(t) === 200);
}

// --- mag cell evolution
check('checkCellEvolution 已导出', typeof checkCellEvolution === 'function');

// level gate: Chu Chu needs Lv50+ mag
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Kama', def: 10, pow: 10, dex: 10, mind: 10, synchro: 20, iq: 0 } }); // level 40
  const ev = feedOnce(DATA, t, 'Heart of Chu Chu');
  check('cell level too low → magCellRejected', ev.some(e => e.type === 'magCellRejected'));
  check('rejected cell leaves magId', t.magId === 'Kama'); }
// species gate: D-Photon Core needs current mag = Kama
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Kama', def: 70, pow: 30, dex: 0, mind: 0, synchro: 20, iq: 0 } }); // level 100, stage3
  const ev = feedOnce(DATA, t, 'D-Photon Core');
  check('D-Photon Core on Kama Lv100 → Gael Giel', t.magId === 'Gael Giel'); }
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Rudra', def: 70, pow: 30, dex: 0, mind: 0, synchro: 20, iq: 0 } });
  check('D-Photon Core on non-Kama → rejected',
        feedOnce(DATA, t, 'D-Photon Core').some(e => e.type === 'magCellRejected') && t.magId === 'Rudra'); }
// multi-target by Section-ID group: Cell of Mag 213 A→Churel, B→Preta.
// Both need a *third evolution* mag (Varaha), not the stage-2 Rudra this test
// used to pass with — the wiki forbids that (review I2b).
{ const t = cs({ magId: 'Varaha', def: 100, pow: 50, dex: 25, mind: 25 }); // level 200, stage3
  t.feeder.sectionId = 'Viridia'; // group A
  feedOnce(DATA, t, 'Cell of Mag 213'); check('Cell213 TypeA → Churel', t.magId === 'Churel'); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 50, dex: 25, mind: 25 });
  t.feeder.sectionId = 'Greenill'; // group B
  feedOnce(DATA, t, 'Cell of Mag 213'); check('Cell213 TypeB → Preta', t.magId === 'Preta'); }
{ const t = cs({ magId: 'Rudra', def: 100, pow: 50, dex: 25, mind: 25 }); // stage2
  check('Cell213 on a stage-2 mag → rejected (needs third evolution)',
    feedOnce(DATA, t, 'Cell of Mag 213').some(e => e.type === 'magCellRejected')
    && t.magId === 'Rudra'); }

// --- mag-cell gates the engine used to skip entirely (review I2) ------------
// (a) minMagLevel must hold even when requiresMag matches. The generator used
// to store the *character* level of the System chain as `minLevel` and the
// engine skipped minLevel whenever requiresMag was present.
{ const t = cs({ magId: 'Kama', def: 10, pow: 10, dex: 10, mind: 10 }); // level 40, stage3
  check('D-Photon Core on a Lv40 Kama → rejected (needs Lv100+)',
    feedOnce(DATA, t, 'D-Photon Core').some(e => e.type === 'magCellRejected')
    && t.magId === 'Kama'); }
{ const t = cs({ magId: 'Naga', def: 10, pow: 0, dex: 0, mind: 0 }); // level 10, stage3
  check("Panther's Spirit on a Lv10 Naga → rejected (needs Lv50+)",
    feedOnce(DATA, t, "Panther's Spirit").some(e => e.type === 'magCellRejected')
    && t.magId === 'Naga'); }
{ const t = cs({ magId: 'Naga', def: 50, pow: 0, dex: 0, mind: 0 }); // level 50
  feedOnce(DATA, t, "Panther's Spirit");
  check("Panther's Spirit on a Lv50 Naga → Panzer's Tail", t.magId === "Panzer's Tail"); }
// (b) the "third evolution Mag" precondition (requiredStage)
{ const t = cs({ magId: 'Mitra', def: 50, pow: 0, dex: 0, mind: 0 }); // level 50, stage2
  check('Heart of Chu Chu on a stage-2 Mitra → rejected (needs third evolution)',
    feedOnce(DATA, t, 'Heart of Chu Chu').some(e => e.type === 'magCellRejected')
    && t.magId === 'Mitra'); }
{ const t = cs({ magId: 'Kama', def: 50, pow: 0, dex: 0, mind: 0 }); // level 50, stage3
  feedOnce(DATA, t, 'Heart of Chu Chu');
  check('Heart of Chu Chu on a Lv50 stage-3 Kama → Chu Chu', t.magId === 'Chu Chu'); }
// (c) synchro / IQ / stat-threshold conditions
{ const t = cs({ magId: 'Varaha', def: 120, pow: 0, dex: 0, mind: 0 }); // level 120, sync 20, iq 0
  check('Heart of Pian without 120% synchro / 180 IQ → rejected',
    feedOnce(DATA, t, 'Heart of Pian').some(e => e.type === 'magCellRejected')); }
{ const t = cs({ magId: 'Varaha', def: 120, pow: 0, dex: 0, mind: 0, synchro: 120, iq: 179 });
  check('Heart of Pian with IQ 179 → rejected (needs 180+)',
    feedOnce(DATA, t, 'Heart of Pian').some(e => e.type === 'magCellRejected')); }
{ const t = cs({ magId: 'Varaha', def: 120, pow: 0, dex: 0, mind: 0, synchro: 120, iq: 180 });
  feedOnce(DATA, t, 'Heart of Pian');
  check('Heart of Pian at Lv120 / 120% synchro / 180 IQ → Pian', t.magId === 'Pian'); }
{ const t = cs({ magId: 'Varaha', def: 140, pow: 0, dex: 0, mind: 0 }); // level 140
  check('Heart of Chao without 35+ in all stats → rejected',
    feedOnce(DATA, t, 'Heart of Chao').some(e => e.type === 'magCellRejected')); }
{ const t = cs({ magId: 'Varaha', def: 35, pow: 35, dex: 35, mind: 35 }); // level 140
  feedOnce(DATA, t, 'Heart of Chao');
  check('Heart of Chao with 35+ in all stats → Chao', t.magId === 'Chao'); }
{ const t = cs({ magId: 'Varaha', def: 145, pow: 0, dex: 0, mind: 0 }); // level 145
  check('Parts of RoboChao with only one 70+ stat → rejected',
    feedOnce(DATA, t, 'Parts of RoboChao').some(e => e.type === 'magCellRejected')); }
{ const t = cs({ magId: 'Varaha', def: 75, pow: 70, dex: 0, mind: 0 }); // level 145
  feedOnce(DATA, t, 'Parts of RoboChao');
  check('Parts of RoboChao with two 70+ stats → Robochao', t.magId === 'Robochao'); }
// species multi-target: Heart of Devil on a Devil's Wing (stage4, whitelisted)
// takes the FIRST target whose gates pass -> Devil's Tail.
{ const t = cs({ magId: "Devil's Wing", def: 100, pow: 0, dex: 0, mind: 0 });
  feedOnce(DATA, t, 'Heart of Devil');
  check("Heart of Devil on a Devil's Wing → Devil's Tail", t.magId === "Devil's Tail"); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 }); // stage3 Lv100
  feedOnce(DATA, t, 'Heart of Devil');
  check("Heart of Devil on a stage-3 mag → Devil's Wing", t.magId === "Devil's Wing"); }
// (d) a cell evolution is logged like any other evolution, so it survives export
{ const t = cs({ magId: 'Kama', def: 70, pow: 30, dex: 0, mind: 0 }); // level 100, stage3
  const ev = feedOnce(DATA, t, 'D-Photon Core');
  check('cell evolution emits an evolve event', ev.some(e => e.type === 'evolve'));
  const logged = t.log.filter((e) => e.kind === 'evolve');
  check('cell evolution pushes an evolve log entry',
    logged.length === 1 && logged[0].to === 'Gael Giel' && logged[0].viaCell === 'D-Photon Core');
  check('feedCell log entry precedes its evolve entry and is marked ok',
    t.log[0].kind === 'feedCell' && t.log[0].ok === true && t.log[1].kind === 'evolve');
  const session = exportSession(t);
  check('exportSession records the cell feed + resulting mag',
    session.feeds.length === 1 && session.feeds[0].item === 'D-Photon Core'
    && session.final.magId === 'Gael Giel');
  check('replaying the cell session reproduces the mag',
    replaySession(DATA, session).magId === 'Gael Giel'); }
// re-evo whitelist: stage4 rare + non-whitelisted cell rejected
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Deva', def: 50, pow: 50, dex: 50, mind: 50, synchro: 20, iq: 0 } }); // stage4
  check('stage4 + non-whitelist cell rejected',
        feedOnce(DATA, t, 'Heart of Chu Chu').some(e => e.type === 'magCellRejected')); }
// cell feed applies NO stat delta
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Kama', def: 70, pow: 30, dex: 0, mind: 0, synchro: 20, iq: 0 } });
  const p = { ...t.progress }; feedOnce(DATA, t, 'D-Photon Core');
  check('cell feed applied no stat progress', JSON.stringify(t.progress) === JSON.stringify(p)); }

// --- racial restriction (mag cells) -----------------------------------------
// The wiki has no race data; the rules live in the generator's CELL_RACE_RULES
// (mirroring Magatama's MagCellsError.xml) and reach the engine as
// magCells[cell].raceRule. Gated on state.racialRestriction (Magatama's toggle).
check('createState 默认 feeder.race=Human', s.feeder.race === 'Human');
check('createState 默认开启种族限制', s.racialRestriction === true);

// deny: Android — Heart of Angel / Heart of Devil
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 }); // Lv100 stage3
  t.feeder = { class: 'HU', gender: 'M', race: 'Android', sectionId: 'Viridia' }; // HUcast
  const ev = feedOnce(DATA, t, 'Heart of Angel');
  check('Heart of Angel + 机器人 → 拒绝',
    ev.some((e) => e.type === 'magCellRejected' && /机器人/.test(e.reason))
    && t.magId === 'Varaha'); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // HUmar
  feedOnce(DATA, t, 'Heart of Angel');
  check("Heart of Angel + 人类 → Angel's Wing", t.magId === "Angel's Wing"); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'HU', gender: 'F', race: 'Newman', sectionId: 'Viridia' }; // HUnewearl
  feedOnce(DATA, t, 'Heart of Angel');
  check("Heart of Angel + 新人类 → Angel's Wing", t.magId === "Angel's Wing"); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'RA', gender: 'F', race: 'Android', sectionId: 'Viridia' }; // RAcaseal
  check('Heart of Devil + 机器人 → 拒绝',
    feedOnce(DATA, t, 'Heart of Devil').some((e) => e.type === 'magCellRejected')
    && t.magId === 'Varaha'); }

// only: Android — Heart of YN-0117
{ const t = cs({ magId: 'Varaha', def: 50, pow: 0, dex: 0, mind: 0 }); // Lv50 stage3
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  const ev = feedOnce(DATA, t, 'Heart of YN-0117');
  check('Heart of YN-0117 + 人类 → 拒绝',
    ev.some((e) => e.type === 'magCellRejected' && /仅机器人/.test(e.reason))
    && t.magId === 'Varaha'); }
{ const t = cs({ magId: 'Varaha', def: 50, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'FO', gender: 'F', race: 'Newman', sectionId: 'Viridia' }; // FOnewearl
  check('Heart of YN-0117 + 新人类 → 拒绝',
    feedOnce(DATA, t, 'Heart of YN-0117').some((e) => e.type === 'magCellRejected')
    && t.magId === 'Varaha'); }
{ const t = cs({ magId: 'Varaha', def: 50, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'RA', gender: 'M', race: 'Android', sectionId: 'Viridia' }; // RAcast
  feedOnce(DATA, t, 'Heart of YN-0117');
  check('Heart of YN-0117 + 机器人 → Elenor', t.magId === 'Elenor'); }

// the toggle: racialRestriction=false skips the race gate entirely (both ways)
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'HU', gender: 'M', race: 'Android', sectionId: 'Viridia' };
  t.racialRestriction = false;
  feedOnce(DATA, t, 'Heart of Angel');
  check("关闭种族限制后机器人可用 Heart of Angel", t.magId === "Angel's Wing"); }
{ const t = cs({ magId: 'Varaha', def: 50, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  t.racialRestriction = false;
  feedOnce(DATA, t, 'Heart of YN-0117');
  check('关闭种族限制后人类可用 Heart of YN-0117', t.magId === 'Elenor'); }

// a cell WITHOUT a raceRule is never race-gated
{ const t = cs({ magId: 'Kama', def: 50, pow: 0, dex: 0, mind: 0 }); // Lv50 stage3
  t.feeder = { class: 'HU', gender: 'M', race: 'Android', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Heart of Chu Chu');
  check('无 raceRule 的 cell 不受种族影响（机器人 → Chu Chu）', t.magId === 'Chu Chu'); }

// legacy feeder objects (no `race` key — every pre-existing test and any old
// share link) must not be blocked by a deny rule.
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // no race
  feedOnce(DATA, t, 'Heart of Angel');
  check("无 race 字段的 feeder 不被 deny 规则拦截", t.magId === "Angel's Wing"); }

// --- session export / replay
{
  const t = createState(DATA, { start:{mode:'fresh'} });
  t.feeder = { class:'RA', gender:'F', sectionId:'Skyly' };
  const seq = ['Trimate','Trimate','Antidote','Monomate','Trimate'];
  seq.forEach((it) => feedOnce(DATA, t, it));
  const session = exportSession(t);
  const replayed = replaySession(DATA, session);
  check('回放后 magId 一致', replayed.magId === t.magId);
  check('回放后四维一致',
    replayed.def===t.def && replayed.pow===t.pow
    && replayed.dex===t.dex && replayed.mind===t.mind);
  check('回放后 progress 一致',
    JSON.stringify(replayed.progress) === JSON.stringify(t.progress));
}

// The 种族限制 toggle must survive export/replay. An Android feeder with the
// toggle OFF can use Heart of Angel; if the toggle didn't round-trip, the replay
// would re-apply the deny rule and reproduce a DIFFERENT mag from the same link.
{
  const t = createState(DATA, { start:{mode:'custom', magId:'Varaha',
    def:40, pow:30, dex:10, mind:20, synchro:20, iq:0} });
  t.feeder = { class:'HU', gender:'M', sectionId:'Viridia', race:'Android' };
  t.racialRestriction = false;
  feedOnce(DATA, t, 'Heart of Angel');
  check('关闭种族限制:机器人喂 Heart of Angel 成功', t.magId === "Angel's Wing");
  const replayed = replaySession(DATA, exportSession(t));
  check('回放保留 racialRestriction=false', replayed.racialRestriction === false);
  check('回放后仍是 Angel\'s Wing（deny 规则未被重新套用）',
    replayed.magId === t.magId);
}

// mid-session feeder swap: export/replay must survive the feeder object being
// reassigned in place mid-session (the UI idiom), proving exportSession /
// replaySession don't alias the live `state.feeder` .
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  ['Monomate', 'Trimate'].forEach((it) => feedOnce(DATA, t, it));
  t.feeder = { class: 'RA', gender: 'F', sectionId: 'Skyly' };
  ['Antidote', 'Trimate', 'Monomate'].forEach((it) => feedOnce(DATA, t, it));

  const session = exportSession(t);
  const replayed = replaySession(DATA, session);
  check('中途换 feeder 后回放 magId 一致', replayed.magId === t.magId);
  check('中途换 feeder 后回放四维一致',
    replayed.def === t.def && replayed.pow === t.pow
    && replayed.dex === t.dex && replayed.mind === t.mind);
  check('中途换 feeder 后回放 progress 一致',
    JSON.stringify(replayed.progress) === JSON.stringify(t.progress));
  check('中途换 feeder 后回放 synchro 一致', replayed.synchro === t.synchro);
  check('中途换 feeder 后回放 iq 一致', replayed.iq === t.iq);

  // Anti-aliasing: mutating the replayed state's feeder in place (the Phase 3
  // UI idiom, e.g. `state.feeder.sectionId = ...`) must NOT reach back into
  // the exported session snapshot or the original run's log — they must be
  // independent objects, not shared references.
  replayed.feeder.sectionId = 'MUTATED';
  check('回放态 feeder 被原地修改不会污染 exportSession 快照',
    session.feeds[session.feeds.length - 1].feeder.sectionId !== 'MUTATED');
  check('回放态 feeder 被原地修改不会污染原始 run 的 log',
    t.log.filter((e) => e.kind === 'feed' || e.kind === 'feedCell')
         .slice(-1)[0].feeder.sectionId !== 'MUTATED');
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
