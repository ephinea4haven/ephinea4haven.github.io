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

// browser (non-module) global — mirrors mag-sim-engine.js's window.MagSimEngine
if (typeof window !== 'undefined') {
    window.MagSimPlanner = { evolutionChains };
}
