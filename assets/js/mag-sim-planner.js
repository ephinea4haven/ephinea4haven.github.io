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
// stat already at (or past) its target level. This is the greedy heuristic:
// smaller = closer to done. `effProg[k] = 100*gain[k] + prog[k]`.
function solveNeed(state, target) {
    let sum = 0;
    for (const k of SOLVE_STATS) {
        const eff = 100 * state.gain[k] + state.prog[k];
        const lo = 100 * target[k];
        if (eff < lo) sum += lo - eff;
    }
    return sum;
}

export function solveSegment(data, opts) {
    const { table, startStats, targetDelta, maxItems = 400, orderConstraint } = opts || {};
    const rows = data.feedTables[table];
    if (!rows) return null;

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
                    prog: { def: 0, pow: 0, dex: 0, mind: 0 } };
    if (isGoal(start.gain)) return [];
    if (!orderOk(start.gain)) return null;

    const key = (s) => `${s.gain.def},${s.gain.pow},${s.gain.dex},${s.gain.mind}|`
        + `${s.prog.def},${s.prog.pow},${s.prog.dex},${s.prog.mind}`;
    const visited = new Set([key(start)]);
    const path = [];
    let nodes = 0;
    let budgetHit = false;

    const dfs = (state) => {
        if (nodes++ > SOLVE_MAX_NODES) { budgetHit = true; return false; }
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
        cands.sort((a, b) => a.need - b.need);

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

// browser (non-module) global — mirrors mag-sim-engine.js's window.MagSimEngine
if (typeof window !== 'undefined') {
    window.MagSimPlanner = { evolutionChains, solveSegment };
}
