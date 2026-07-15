// assets/js/mag-sim-planner.js
//
// Reverse planner for the Mag simulator: given a target mag id, enumerate the
// evolution chains (feeder-class/gender/Section-ID + condition, at each
// evolution level) that could have produced it. This is the mirror image of
// mag-sim-engine.js's forward `checkEvolution` — that function walks
// stage0->1->2->3->4 given a live state; this module walks the same rule
// tables BACKWARD from a target mag id, with no state/stats involved (a
// player armed with a chain still has to hit the stat conditions itself; this
// only tells them WHICH feeder/condition combinations are reachable at all).
//
// Pure, DOM-free, data injected via `data` (same convention as
// mag-sim-engine.js), so this is plain Node-importable and testable without a
// browser.

// planMag (below) forward-simulates candidate plans through the REAL engine as
// it builds them, then replays the finished plan a second time to assert the
// terminal state is EXACTLY the target — the engine is the single source of
// truth, so a wrong internal computation can only ever MISS a plan, never emit a
// wrong one.
import { createState, feedOnce, bankMag, feedCycles } from './mag-sim-engine.js';

// Any single representative Section ID from an idGroups bucket (A/B or
// Type1/2/3). Forward code (idGroupAB/idType in mag-sim-engine.js) treats
// every id in a bucket identically, so for "does some feeder satisfy this
// gate" purposes any one of them proves it — which one we quote is cosmetic.
function repId(data, group) {
    const ids = data.idGroups[group];
    return ids && ids.length ? ids[0] : undefined;
}

function feedTableIdOf(data, magId) {
    const m = data.mags[magId];
    return m ? m.feedTableId : undefined;
}

// --- stage0 -> stage1: gated purely on the feeder's class (wiki: "HU evolves
// Mag"). data.evolution.stage1 is a bijection {HU:'Varuna', RA:'Kalki',
// FO:'Vritra'}, so this returns at most one match.
function stage1Predecessors(data, magId) {
    const out = [];
    for (const cls of Object.keys(data.evolution.stage1)) {
        if (data.evolution.stage1[cls] !== magId) continue;
        out.push({
            stage: 1,
            magId,
            feedTableId: feedTableIdOf(data, magId),
            evoLevel: 10,
            feeder: { class: cls },
            condKey: null, // no stat condition at Lv.10 — class alone decides
        });
    }
    return out;
}

// --- stage1 -> stage2: keyed on the mag's OWN lineage + whichever of
// POW/DEX/MIND is strictly max (ties broken by evolution.tieBreak). Per
// mag-sim-engine.js checkEvolution, this branch reads `ev.stage2[state.magId]`
// — the feeder does not gate it at all (feeding only supplies the stats that
// decide the argmax), so `feeder` carries no class/section here.
function stage2Predecessors(data, magId) {
    const out = [];
    for (const stage1Mag of Object.keys(data.evolution.stage2)) {
        const branch = data.evolution.stage2[stage1Mag];
        for (const stat of Object.keys(branch)) {
            if (branch[stat] !== magId) continue;
            out.push({
                stage: 2,
                magId,
                feedTableId: feedTableIdOf(data, magId),
                evoLevel: 35,
                feeder: {},
                condKey: stat, // this stat must be the (tie-break-resolved) max
                _prevMagId: stage1Mag,
            });
        }
    }
    return out;
}

// --- stage2/stage3 -> stage3: the per-class ordered rule rows (first-match
// wins going forward; going backward every row that names this mag in its A
// or B column is a distinct way to reach it), plus FO's DEF>=45 override.
// Searched across EVERY class's rule table, not just one: the wiki's
// "transfer the Mag to another character" trick means the feeder's class at
// this step need not match the mag's original stage0 lineage, and the same
// mag name legitimately appears under more than one class's table (e.g.
// Varaha under both HU and RA).
function stage3Predecessors(data, magId) {
    const ev = data.evolution;
    const out = [];
    for (const cls of Object.keys(ev.stage3Rules || {})) {
        (ev.stage3Rules[cls] || []).forEach((row) => {
            for (const grp of ['A', 'B']) {
                if (row[grp] !== magId) continue;
                out.push({
                    stage: 3,
                    magId,
                    feedTableId: feedTableIdOf(data, magId),
                    evoLevel: 50,
                    feeder: { class: cls, sectionId: repId(data, grp) },
                    condKey: row.cond,
                    _lineageCls: cls,
                });
            }
        });
    }
    // FO's all-Section-ID DEF>=45 override sits ahead of (and outside) the
    // rule rows in stage3Next, but is still an FO-feeder-only path.
    const special = ev.stage3SpecialFO;
    if (special) {
        if (magId === special.powMax) {
            out.push({
                stage: 3,
                magId,
                feedTableId: feedTableIdOf(data, magId),
                evoLevel: 50,
                feeder: { class: 'FO', sectionId: repId(data, 'A') },
                condKey: `DEF>=${special.minDef} & POW is max`,
                _lineageCls: 'FO',
            });
        }
        if (magId === special.other) {
            out.push({
                stage: 3,
                magId,
                feedTableId: feedTableIdOf(data, magId),
                evoLevel: 50,
                feeder: { class: 'FO', sectionId: repId(data, 'A') },
                condKey: `DEF>=${special.minDef} & POW not max`,
                _lineageCls: 'FO',
            });
        }
    }
    return out;
}

// --- stage3 -> stage4: feeder class/gender/Section-ID Type, plus one of the
// three DEF/POW/DEX/MIND equalities (evolution.stage4[cls][gender][Type]).
// The formula is evaluated purely against the mag's STATS (stage4Next in
// mag-sim-engine.js) — it never looks at which of the 21 named 3rd-evolution
// mags is currently held — so every stage3 mag in the game is a legitimate
// predecessor here; which one gets filled in by the caller.
function stage4Predecessors(data, magId) {
    const ev = data.evolution;
    const out = [];
    for (const cls of Object.keys(ev.stage4 || {})) {
        const byGender = ev.stage4[cls];
        for (const g of Object.keys(byGender)) {
            const byType = byGender[g];
            for (const type of Object.keys(byType)) {
                const leaf = byType[type];
                for (const formula of Object.keys(leaf)) {
                    if (leaf[formula] !== magId) continue;
                    out.push({
                        stage: 4,
                        magId,
                        feedTableId: feedTableIdOf(data, magId),
                        evoLevel: 100,
                        feeder: { class: cls, gender: g, sectionId: repId(data, type) },
                        condKey: formula,
                    });
                }
            }
        }
    }
    return out;
}

// Every named 3rd-evolution mag in the game: the union of every rule row's
// A/B columns (across all classes) plus the FO DEF>=45 override's two mags.
// This is the candidate predecessor pool for stage4Predecessors (see comment
// there for why identity, not just stage, is genuinely unconstrained).
function allStage3MagIds(data) {
    const ev = data.evolution;
    const ids = new Set();
    for (const cls of Object.keys(ev.stage3Rules || {})) {
        (ev.stage3Rules[cls] || []).forEach((row) => { ids.add(row.A); ids.add(row.B); });
    }
    if (ev.stage3SpecialFO) {
        ids.add(ev.stage3SpecialFO.powMax);
        ids.add(ev.stage3SpecialFO.other);
    }
    return [...ids];
}

// Every ordered step-chain (stage1 first, target last) that ends at `magId`.
// Memoized per top-level call: chainsTo(magId) is a pure function of magId +
// data alone (it never depends on who's asking), and the same predecessor
// mag id is legitimately reached from many different branches above it.
function chainsTo(data, magId, memo) {
    if (memo.has(magId)) return memo.get(magId);
    // Cycle guard: stage strictly decreases on every recursive call below
    // (stage2 recurses into a stage1 predecessor, stage3 into stage2, stage4
    // into stage3), so this can only trip on malformed/hand-edited data.
    memo.set(magId, []);

    const info = data.mags[magId];
    let chains = [];
    if (info) {
        const stage = info.stage;
        if (stage === 1) {
            chains = stage1Predecessors(data, magId).map((step) => [step]);
        } else if (stage === 2) {
            for (const step of stage2Predecessors(data, magId)) {
                const prevMagId = step._prevMagId;
                const step2 = { ...step };
                delete step2._prevMagId;
                for (const prev of chainsTo(data, prevMagId, memo)) {
                    chains.push([...prev, step2]);
                }
            }
        } else if (stage === 3) {
            for (const step of stage3Predecessors(data, magId)) {
                const lineageCls = step._lineageCls;
                const step3 = { ...step };
                delete step3._lineageCls;
                const stage1Mag = data.evolution.stage1[lineageCls];
                const branch = stage1Mag ? data.evolution.stage2[stage1Mag] : null;
                if (!branch) continue;
                for (const stat of Object.keys(branch)) {
                    const stage2MagId = branch[stat];
                    for (const prev of chainsTo(data, stage2MagId, memo)) {
                        chains.push([...prev, step3]);
                    }
                }
            }
        } else if (stage === 4) {
            const stage3Ids = allStage3MagIds(data);
            for (const step of stage4Predecessors(data, magId)) {
                for (const stage3MagId of stage3Ids) {
                    for (const prev of chainsTo(data, stage3MagId, memo)) {
                        chains.push([...prev, step]);
                    }
                }
            }
        }
    }

    memo.set(magId, chains);
    return chains;
}

// Reverse-enumerate the evolution chains that produce `targetMagId`.
// Returns [] for an unknown id or a stage-0 (fresh) mag, which has no
// predecessor to enumerate.
export function evolutionChains(data, targetMagId) {
    const info = data.mags[targetMagId];
    if (!info || !info.stage) return [];
    const memo = new Map();
    const chains = chainsTo(data, targetMagId, memo);
    return chains.map((steps) => ({ steps, targetStage: info.stage }));
}

// ===========================================================================
// solveSegment — bounded exact per-segment four-stat solver
// ===========================================================================
//
// Given ONE feed table, a starting four-stat vector and an EXACT integer delta
// to add to each stat, find an ORDERED array of item names whose net integer
// stat gains equal `targetDelta` exactly. Returns `null` if it cannot within
// `maxItems` (or within its search budget — a hard case).
//
// This is pure stat arithmetic inside a single table: it does NOT check
// evolution (the Task-3 assembler keeps each segment under the next evolution
// level). Correctness is guaranteed by engine replay — the tests feed the
// solver's output through mag-sim-engine.js `feedOnce` and assert the exact
// resulting stats; the engine is ground truth.
//
// The stat model MUST match feedOnce bit-for-bit:
//   * each item vector is `[ΔDEF,ΔPOW,ΔDEX,ΔMIND,ΔSync,ΔIQ]` in HUNDREDTHS;
//   * a stat's integer level rises by 1 per 100 accumulated hundredths (carry),
//     level is re-read on every carry step for the 200 cap;
//   * NEGATIVE-FEED ALL-OR-NOTHING: a negative delta that would take a stat's
//     hundredths bar below 0 does NOT apply at all (the bar is untouched, not
//     floored). This is why Difluid=[0,-10,0,11] is pure-MIND when POW=0.
//   * integer levels NEVER decrease — so a target with any negative component
//     is unsolvable (returns null immediately).
//
// Algorithm: heuristic best-first bounded DFS over the state
// (4 hundredths accumulators + 4 integer gains). Each item application follows
// the engine's exact carry/negative-skip rules. Pruning: any stat's integer
// gain exceeding its target is a dead branch (levels never come back down);
// path length over `maxItems` is pruned; a `visited` set kills revisited
// states; a global node budget guarantees termination (return null, never
// hang). Candidates are ordered by remaining L1 hundredths-need so the search
// dives straight at tractable single-/few-dominant-stat targets.
//
// What it reliably solves: single-dominant-stat targets and modest multi-stat
// targets where near-pure items exist (the common planner cases). What it may
// return null on: tightly-coupled multi-stat targets that need exact negative
// interleaving, or anything whose search exceeds the node budget — by design,
// the caller (Task 3) falls back to nearest-reachable for those.

const SOLVE_STATS = ['def', 'pow', 'dex', 'mind'];
const SOLVE_MAX_NODES = 600000;

// Exact mirror of feedOnce's primary-stat block (mag-sim-engine.js lines
// ~72-101), minus synchro/iq/evolution which do not affect integer stat gains.
// `base` are the segment's starting integer stats (for the 200 cap and level).
// Returns the next {gain, prog} or null if the item is a no-op (changes
// nothing — every negative skipped and nothing carried), which the caller
// discards to avoid cycles.
function solveApply(state, vec, base) {
    const gain = { ...state.gain };
    const prog = { ...state.prog };
    let changed = false;
    for (let i = 0; i < SOLVE_STATS.length; i++) {
        const k = SOLVE_STATS[i];
        const d = vec[i];
        if (d === 0) continue;
        // negative all-or-nothing: skip entirely if it would go below 0
        if (d < 0 && prog[k] + d < 0) continue;
        prog[k] += d;
        if (d !== 0) changed = true;
        while (prog[k] >= 100) {
            const level = base.def + base.pow + base.dex + base.mind
                + gain.def + gain.pow + gain.dex + gain.mind;
            const statVal = base[k] + gain[k];
            if (level >= 200 || statVal >= 200) { prog[k] = 99; break; } // capped
            gain[k] += 1; prog[k] -= 100;
        }
    }
    return changed ? { gain, prog } : null;
}

function solveStatsOf(base, gain) {
    return { def: base.def + gain.def, pow: base.pow + gain.pow,
             dex: base.dex + gain.dex, mind: base.mind + gain.mind };
}

// Remaining hundredths-need to reach each stat's lower target bound. Zero for a
// stat already at (or past) its target level. `effProg[k] = 100*gain[k] +
// prog[k]`. Returns BOTH the total (`sum`) and the single worst stat (`max`):
// the greedy expansion sorts on `max` FIRST so it always chips at the
// BOTTLENECK stat, then breaks ties on `sum`. Sorting on `sum` alone let a
// side-stat-heavy item (e.g. a dex-rich cell) edge out the pow-focused item on
// a pow-dominant target by a hair, then the DFS sank the entire node budget into
// that dead-end subtree before ever backtracking to try the right item first.
function solveNeed(state, target) {
    let sum = 0, max = 0;
    for (const k of SOLVE_STATS) {
        const eff = 100 * state.gain[k] + state.prog[k];
        const lo = 100 * target[k];
        if (eff < lo) { const d = lo - eff; sum += d; if (d > max) max = d; }
    }
    return { sum, max };
}

export function solveSegment(data, opts) {
    const { table, startStats, targetDelta, maxItems = 400, orderConstraint,
            startProgress, maxNodes = SOLVE_MAX_NODES } = opts || {};
    const rows = data.feedTables[table];
    if (!rows) return null;

    // Hundredths already sitting in each stat's bar at the segment's start. The
    // engine's `progress` CARRIES ACROSS an evolution (feedOnce never resets it),
    // so the assembler MUST hand the live carried bar here or the solver's model
    // drifts from the engine on the first feed. Defaults to a clean 0 bar, which
    // is exactly the zero-progress contract Task 2's tests rely on.
    const prog0 = {
        def: (startProgress && startProgress.def) | 0,
        pow: (startProgress && startProgress.pow) | 0,
        dex: (startProgress && startProgress.dex) | 0,
        mind: (startProgress && startProgress.mind) | 0,
    };

    const base = { def: startStats.def | 0, pow: startStats.pow | 0,
                   dex: startStats.dex | 0, mind: startStats.mind | 0 };
    const target = { def: targetDelta.def | 0, pow: targetDelta.pow | 0,
                     dex: targetDelta.dex | 0, mind: targetDelta.mind | 0 };
    // Integer levels never decrease: any negative target component is
    // unsolvable, and the whole segment must stay under the 200 cap.
    for (const k of SOLVE_STATS) {
        if (target[k] < 0) return null;
        if (base[k] + target[k] > 200) return null;
    }
    if (base.def + base.pow + base.dex + base.mind
        + target.def + target.pow + target.dex + target.mind > 200) return null;

    const items = Object.entries(rows); // [name, vec]
    const isGoal = (g) => SOLVE_STATS.every((k) => g[k] === target[k]);

    // orderConstraint: an optional predicate over the integer stats
    // ({def,pow,dex,mind}, base+gain) that must hold AFTER every feed
    // (e.g. `(s) => s.dex <= s.pow` for "DEX must never exceed POW").
    const orderOk = typeof orderConstraint === 'function'
        ? (gain) => orderConstraint(solveStatsOf(base, gain))
        : () => true;

    const start = { gain: { def: 0, pow: 0, dex: 0, mind: 0 },
                    prog: { ...prog0 } };
    if (isGoal(start.gain)) return [];
    if (!orderOk(start.gain)) return null;

    const key = (s) => `${s.gain.def},${s.gain.pow},${s.gain.dex},${s.gain.mind}|`
        + `${s.prog.def},${s.prog.pow},${s.prog.dex},${s.prog.mind}`;
    const visited = new Set([key(start)]);
    const path = [];
    let nodes = 0;
    let budgetHit = false;

    const dfs = (state) => {
        if (nodes++ > maxNodes) { budgetHit = true; return false; }
        if (path.length >= maxItems) return false;

        const cands = [];
        for (const [name, vec] of items) {
            const ns = solveApply(state, vec, base);
            if (!ns) continue;                                   // no-op item
            let over = false;
            for (const k of SOLVE_STATS) if (ns.gain[k] > target[k]) { over = true; break; }
            if (over) continue;                                  // integer overshoot: dead
            if (!orderOk(ns.gain)) continue;
            const kk = key(ns);
            if (visited.has(kk)) continue;
            cands.push({ name, ns, kk, need: solveNeed(ns, target) });
        }
        // Heuristic: expand the candidate that leaves the least remaining need
        // first, so tractable targets are reached with little/no backtracking.
        // Bottleneck stat (`max`) dominates the ordering, total (`sum`) breaks
        // ties — see solveNeed for why `sum` alone mis-orders pow-dominant runs.
        cands.sort((a, b) => (a.need.max - b.need.max) || (a.need.sum - b.need.sum));

        for (const c of cands) {
            if (isGoal(c.ns.gain)) { path.push(c.name); return true; }
            visited.add(c.kk);
            path.push(c.name);
            if (dfs(c.ns)) return true;
            path.pop();
            if (budgetHit) return false;
        }
        return false;
    };

    return dfs(start) ? [...path] : null;
}

// ===========================================================================
// planMag — assemble an EXACT plan and prove it by engine replay
// ===========================================================================
//
// Given a target mag id + four stats, return { plan, nearest, reason } where a
// non-null `plan` is GUARANTEED (by replay) to end at exactly that mag and those
// stats. `nearest` is Task 4's job and is always null here.
//
// The crucial subtlety: the engine's hundredths `progress` CARRIES ACROSS an
// evolution — feedOnce never resets it. So the plan is built by forward-
// simulating through the real engine one segment at a time; each segment hands
// solveSegment the LIVE carried progress (`startProgress`) and the live integer
// stats, and the engine — not the solver — decides the actual carried state and
// which mag we evolve into. The solver only proposes the item order to reach the
// next checkpoint; the engine adjudicates. A final independent replay is the
// non-negotiable safety net.
//
// Strategy (mirrors the guide's structure for a stage-4 target):
//   * Pick a FEEDER (class/gender/Section-ID) from the reverse chains whose
//     Lv.100 formula is satisfied by the target — one feeder used throughout
//     (no mid-run character transfer), which is what real single-recipe guides
//     do.
//   * Cross Lv.10 (any stats), Lv.35 (DEX-heavy — Table-1's only DEF-free item,
//     Antidote, is DEX-dominant, so we ride the Marutah line and let POW catch
//     up later), Lv.50 (land on a stage-3 rule), Lv.100 (land EXACTLY on target,
//     satisfying the Lv.100 formula). DEF is held at its fresh value throughout
//     because integer levels never fall — any DEF gained early can never be
//     given back, so it must never cross a whole level.

const P_STATS = ['def', 'pow', 'dex', 'mind'];
const PRIM = ['pow', 'dex', 'mind'];

const PLAN_FORMULA = {
    'DEF+POW=DEX+MIND': (s) => s.def + s.pow === s.dex + s.mind,
    'DEF+DEX=POW+MIND': (s) => s.def + s.dex === s.pow + s.mind,
    'DEF+MIND=POW+DEX': (s) => s.def + s.mind === s.pow + s.dex,
};

function idTypeOf(data, id) {
    if (data.idGroups.Type1.includes(id)) return 'Type1';
    if (data.idGroups.Type2.includes(id)) return 'Type2';
    return 'Type3';
}
function idGroupABOf(data, id) { return data.idGroups.A.includes(id) ? 'A' : 'B'; }

// mirrors mag-sim-engine.js evalStage3Rule (kept local so the planner needs no
// engine internals beyond the replay primitives).
function evalRuleLocal(cond, v) {
    const OPS = { '>': (a, b) => a > b, '≥': (a, b) => a >= b, '=': (a, b) => a === b };
    const tok = cond.split(' ');
    for (let i = 0; i + 2 < tok.length; i += 2) {
        const op = OPS[tok[i + 1]];
        if (!op || !op(v[tok[i]], v[tok[i + 2]])) return false;
    }
    return true;
}
function argmax3(s, tie) {
    const v = { POW: s.pow, DEX: s.dex, MIND: s.mind };
    const mx = Math.max(v.POW, v.DEX, v.MIND);
    const top = ['POW', 'DEX', 'MIND'].filter((k) => v[k] === mx);
    return top.length === 1 ? top[0] : tie;
}
// mirrors engine stage3Next: which 3rd-evolution mag this feeder+stats yields.
function stage3MagFor(data, feeder, s) {
    const ev = data.evolution;
    if (feeder.class === 'FO' && s.def >= ev.stage3SpecialFO.minDef) {
        return argmax3(s, null) === 'POW' ? ev.stage3SpecialFO.powMax : ev.stage3SpecialFO.other;
    }
    const grp = idGroupABOf(data, feeder.sectionId);
    const V = { POW: s.pow, DEX: s.dex, MIND: s.mind };
    const row = (ev.stage3Rules[feeder.class] || []).find((r) => evalRuleLocal(r.cond, V));
    return row ? row[grp] : null;
}
// mirrors engine stage4Next: which 4th-evolution mag this feeder+stats yields.
function stage4MagFor(data, feeder, s) {
    const leaf = ((data.evolution.stage4[feeder.class] || {})[feeder.gender] || {})[idTypeOf(data, feeder.sectionId)];
    if (!leaf) return null;
    const formula = Object.keys(leaf).find((k) => leaf[k] !== null);
    if (!formula || !PLAN_FORMULA[formula]) return null;
    return PLAN_FORMULA[formula](s) ? leaf[formula] : null;
}

// Split `level` whole primary points across POW/DEX/MIND proportional to the
// target's growth `g`, clamped into [floor, cap] per stat and nudged so the
// parts sum to exactly `level`.
function distribute(level, g, floor, cap) {
    const gs = g.pow + g.dex + g.mind || 1;
    const a = {
        pow: Math.round(level * g.pow / gs),
        dex: Math.round(level * g.dex / gs),
        mind: 0,
    };
    a.mind = level - a.pow - a.dex;
    for (const k of PRIM) a[k] = Math.max(floor[k], Math.min(cap[k], a[k]));
    let s = a.pow + a.dex + a.mind, guard = 0;
    while (s !== level && guard++ < 2000) {
        if (s < level) {
            const k = PRIM.filter((k) => a[k] < cap[k]).sort((x, y) => g[y] - g[x])[0];
            if (k === undefined) break; a[k]++; s++;
        } else {
            const k = PRIM.filter((k) => a[k] > floor[k]).sort((x, y) => g[x] - g[y])[0];
            if (k === undefined) break; a[k]--; s--;
        }
    }
    return { def: floor.def, pow: a.pow, dex: a.dex, mind: a.mind, _lvl: floor.def + s };
}

// The ordered stat checkpoints to cross on the way to a stage-`stage` target.
// Returns a SMALL SET of candidate schemes (each a list of {evoLevel, stats}),
// because the exact stat split at an intermediate evolution level is not
// pinned down — only the level and the evolution gate are. A given feed table
// can hit some splits cleanly and not others (Table-2's Sol adds POW and DEX in
// a fixed 11:3 lump, so a Lv.50 that wants DEX+2 is unsolvable while DEX+3 is
// trivial). So we enumerate a few Lv.50 splits and let the caller's engine
// replay adjudicate which one actually lands. DEF stays at the fresh value on
// every intermediate checkpoint (integer levels never fall, so DEF must never
// cross a whole level early — see the header note).
function planSchemes(data, target) {
    const fresh = data.freshMag;
    const D0 = fresh.def;
    const stage = data.mags[target.magId].stage;
    const g = { pow: target.pow - fresh.pow, dex: target.dex - fresh.dex, mind: target.mind - fresh.mind };
    const tgt = { def: target.def, pow: target.pow, dex: target.dex, mind: target.mind };
    const targetLevel = target.def + target.pow + target.dex + target.mind;
    const base = { def: D0, pow: fresh.pow, dex: fresh.dex, mind: fresh.mind };

    // Lv.10 — raise the target's dominant primary by (10 - DEF). No stat gate.
    const dom = PRIM.slice().sort((a, b) => g[b] - g[a])[0];
    const cp0 = { ...base };
    cp0[dom] = Math.min(tgt[dom], cp0[dom] + (10 - D0));
    const useCp0 = stage >= 1 && targetLevel > 10;

    // Lv.35 — DEX-heavy, and NOT free-form: Table-1's only DEF-free item is
    // Antidote, whose fixed +5 POW / +15 DEX hundredths force POW:DEX ≈ 1:3 on
    // any DEF-preserving run. So the checkpoint ADDS the ~25 remaining levels to
    // cp0 in that same 1:3 ratio (a proportional-to-target split overran POW and
    // left the segment unsolvable). Capped by the target.
    const prev1 = useCp0 ? cp0 : base;
    const cp1 = { ...prev1 };
    const add1 = Math.max(0, 35 - (prev1.def + prev1.pow + prev1.dex + prev1.mind));
    const powAdd = Math.round(add1 / 4);
    let left = add1;
    cp1.pow = Math.min(tgt.pow, cp1.pow + powAdd); left -= (cp1.pow - prev1.pow);
    cp1.dex = Math.min(tgt.dex, cp1.dex + left); left = add1 - (cp1.pow - prev1.pow) - (cp1.dex - prev1.dex);
    for (const k of PRIM) { while (left > 0 && cp1[k] < tgt[k]) { cp1[k]++; left--; } }
    const useCp1 = stage >= 2 && targetLevel > 35;

    const head = [];
    if (useCp0) head.push({ evoLevel: 10, stats: cp0 });
    if (useCp1) head.push({ evoLevel: 35, stats: cp1 });

    // Below stage 4 (or a target that never reaches Lv.50) there is no Lv.50
    // split to vary — one scheme suffices.
    if (stage < 4 || targetLevel <= 50) {
        return [[...head, { evoLevel: targetLevel, stats: tgt }]];
    }

    // Lv.50 — proportional split is the seed; enumerate DEX ±k around it (POW
    // takes up the slack so DEF(5)+POW+DEX+MIND == 50), keeping every part inside
    // [floor, target]. The proportional split matches the final stat ordering,
    // which keeps the stage-3 mag stable all the way to Lv.100.
    const floor2 = useCp1 ? cp1 : (useCp0 ? cp0 : base);
    const prop = distribute(45, g, { def: D0, pow: floor2.pow, dex: floor2.dex, mind: floor2.mind }, tgt);
    const mind2 = prop.mind;
    const schemes = [];
    const seenDex = new Set();
    for (let k = 0; k <= 8; k++) {
        for (const dex of (k === 0 ? [prop.dex] : [prop.dex + k, prop.dex - k])) {
            if (seenDex.has(dex)) continue; seenDex.add(dex);
            const pow = 45 - dex - mind2;
            if (dex < floor2.dex || dex > tgt.dex) continue;
            if (pow < floor2.pow || pow > tgt.pow) continue;
            const cp2 = { def: D0, pow, dex, mind: mind2 };
            schemes.push([...head, { evoLevel: 50, stats: cp2 }, { evoLevel: targetLevel, stats: tgt }]);
        }
    }
    return schemes;
}

// Forward-build one candidate plan for a fixed feeder. Returns the plan object
// (segments + totals) or null if any segment is unsolvable / the run does not
// land on the target. Every stat number comes from the real engine.
function buildPlanForFeeder(data, target, feeder, cps, maxNodes) {
    const state = createState(data, { start: { mode: 'fresh' } });
    const segments = [];

    for (const cp of cps) {
        const magFrom = state.magId;
        const table = data.mags[magFrom].feedTableId;
        const cur = { def: state.def, pow: state.pow, dex: state.dex, mind: state.mind };
        const delta = {
            def: cp.stats.def - cur.def, pow: cp.stats.pow - cur.pow,
            dex: cp.stats.dex - cur.dex, mind: cp.stats.mind - cur.mind,
        };
        // While feeding a 3rd-evolution mag the engine re-checks stage-3 at every
        // multiple of 5 — hold the SAME mag (hence the same feed table) by
        // forbidding any feed that would re-target it.
        let orderConstraint;
        if (data.mags[magFrom].stage === 3) {
            const X = magFrom;
            orderConstraint = (s) => stage3MagFor(data, feeder, s) === X;
        }
        const seq = solveSegment(data, {
            table, startStats: cur, targetDelta: delta, maxItems: 1200,
            startProgress: { ...state.progress }, orderConstraint, maxNodes,
        });
        if (!seq) return null;

        state.feeder = { class: feeder.class, gender: feeder.gender, sectionId: feeder.sectionId, race: 'Human' };
        for (const item of seq) feedOnce(data, state, item);

        const counts = new Map();
        for (const it of seq) counts.set(it, (counts.get(it) || 0) + 1);
        segments.push({
            feeder: { class: feeder.class, gender: feeder.gender, sectionId: feeder.sectionId },
            magFrom, magTo: state.magId, evoLevel: cp.evoLevel,
            feeds: [...counts.entries()].map(([item, count]) => ({ item, count })),
            banks: 0,
            order: seq.map((item) => ({ item })),
        });
    }

    // land check (redundant with the replay below, but a cheap early out)
    if (!(state.magId === target.magId && state.def === target.def && state.pow === target.pow
        && state.dex === target.dex && state.mind === target.mind)) return null;

    // Totals from the actual run.
    const items = segments.reduce((n, s) => n + s.order.length, 0);
    let meseta = 0;
    for (const s of segments) for (const st of s.order) meseta += (data.costs[st.item] || 0);
    return {
        segments,
        totals: { items, meseta, cycles: feedCycles(state.log), banks: 0 },
    };
}

// THE SAFETY NET: replay a finished plan through a fresh engine and return the
// terminal state, so planMag can assert it equals the target before ever
// handing the plan back. Independent of the build-time simulation.
function replayPlan(data, plan) {
    const t = createState(data, { start: { mode: 'fresh' } });
    for (const seg of plan.segments) {
        t.feeder = { ...seg.feeder, race: 'Human' };
        for (const step of seg.order) { step.bank ? bankMag(data, t) : feedOnce(data, t, step.item); }
    }
    return t;
}

export function planMag(data, target, opts = {}) {
    const budget = opts.budget ?? 2_000_000;
    const fail = (reason) => ({ plan: null, nearest: null, reason });
    if (!target || !data.mags[target.magId]) return fail('unknown mag');

    const fresh = data.freshMag;
    const T = { magId: target.magId, def: target.def | 0, pow: target.pow | 0,
                dex: target.dex | 0, mind: target.mind | 0 };
    // Integer levels never fall, so every stat must start no lower than the fresh
    // mag's, and the whole thing must fit under the 200 cap.
    for (const k of P_STATS) if (T[k] < fresh[k]) return fail('stat below fresh mag');
    if (T.def + T.pow + T.dex + T.mind > 200) return fail('level over cap');

    // Candidate feeders: from the reverse chains, keep those whose Lv.100 formula
    // the target satisfies, that use a single class from Lv.10 to Lv.100, and
    // that actually map to the target mag. Dedup by class/gender/Section-Type.
    const chains = evolutionChains(data, T.magId);
    const feeders = [];
    const seen = new Set();
    for (const { steps } of chains) {
        const s4 = steps.find((s) => s.stage === 4);
        const s3 = steps.find((s) => s.stage === 3);
        const s1 = steps.find((s) => s.stage === 1);
        if (!s4 || !s1) continue;
        if (!PLAN_FORMULA[s4.condKey] || !PLAN_FORMULA[s4.condKey](T)) continue;
        const cls = s4.feeder.class, gen = s4.feeder.gender, section = s4.feeder.sectionId;
        if (s1.feeder.class !== cls) continue;
        if (s3 && s3.feeder.class !== cls) continue;
        const key = `${cls}/${gen}/${idTypeOf(data, section)}`;
        if (seen.has(key)) continue;
        const feeder = { class: cls, gender: gen, sectionId: section };
        if (stage4MagFor(data, feeder, T) !== T.magId) continue;
        seen.add(key);
        feeders.push(feeder);
    }
    if (!feeders.length) return fail('no feeder satisfies the target formula');

    // Try each feeder × each checkpoint scheme, keep the fewest-items plan that
    // REPLAYS to the target. maxNodes per solveSegment is carved from the caller's
    // budget so the whole search is bounded and can never hang.
    const tryFeeders = feeders.slice(0, 6);
    const schemes = planSchemes(data, T).slice(0, 18);
    const attempts = Math.max(1, tryFeeders.length * schemes.length);
    const maxNodes = Math.min(SOLVE_MAX_NODES, Math.max(50000, Math.floor(budget / (attempts * 4))));
    let best = null;
    for (const feeder of tryFeeders) {
        for (const cps of schemes) {
            const plan = buildPlanForFeeder(data, T, feeder, cps, maxNodes);
            if (!plan) continue;
            const t = replayPlan(data, plan);           // non-negotiable replay
            if (!(t.magId === T.magId && t.def === T.def && t.pow === T.pow
                && t.dex === T.dex && t.mind === T.mind)) continue;   // reject silently
            if (!best || plan.totals.items < best.totals.items) best = plan;
        }
        if (best) break;   // first feeder that yields any exact plan wins
    }
    return best
        ? { plan: best, nearest: null, reason: 'exact' }
        : { plan: null, nearest: null, reason: 'no exact plan within budget' };
}

// browser (non-module) global — mirrors mag-sim-engine.js's window.MagSimEngine
if (typeof window !== 'undefined') {
    window.MagSimPlanner = { evolutionChains, solveSegment, planMag };
}
