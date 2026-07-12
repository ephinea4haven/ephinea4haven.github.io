// assets/js/mag-sim-engine.js
export function magLevel(s) { return s.def + s.pow + s.dex + s.mind; }

export function createState(data, { start }) {
    const base = data.freshMag;
    const src = start.mode === 'custom' ? start : base;
    const s = {
        magId: src.magId,
        def: src.def, pow: src.pow, dex: src.dex, mind: src.mind,
        progress: { def: 0, pow: 0, dex: 0, mind: 0 },
        synchro: src.synchro, iq: src.iq,
        window: { stage3: 50, stage4: 100 },
        feeder: { class: 'HU', gender: 'M', sectionId: 'Viridia', race: 'Human' },
        racialRestriction: true,
        log: [],
    };
    s._start = start;   // 供 exportSession / 重置复用
    return s;
}

const STAT_KEYS = ['def', 'pow', 'dex', 'mind'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function feedOnce(data, state, itemName) {
    const events = [];
    const table = data.feedTables[data.mags[state.magId].feedTableId];
    const row = table[itemName]; // [DEF,POW,DEX,MIND,Sync,IQ]
    if (!row) throw new Error(`no feed row for ${itemName} in table`);

    // secondary stats
    state.synchro = clamp(state.synchro + row[4], 0, 120);
    state.iq = clamp(state.iq + row[5], 0, 200);

    const before = magLevel(state);
    // primary stats: progress accumulator with carry/borrow, respect 200 cap
    STAT_KEYS.forEach((k, i) => {
        state.progress[k] += row[i];
        while (state.progress[k] >= 100) {
            if (magLevel(state) >= 200 || state[k] >= 200) { // capped
                state.progress[k] = 99; events.push({ type: 'capped', stat: k });
                break;
            }
            state[k] += 1; state.progress[k] -= 100;
        }
        while (state.progress[k] < 0) {
            if (state[k] <= 0) { state.progress[k] = 0; break; }
            state[k] -= 1; state.progress[k] += 100;
        }
    });
    const after = magLevel(state);
    if (after > before) events.push({ type: 'levelUp', level: after });

    state.log.push({ kind: 'feed', item: itemName });
    events.push(...checkEvolution(data, state));
    return events;
}

// --- Evolution engine (Task 8) ---------------------------------------------
// Lineage = the first-evolution form (Varuna/Kalki/Vritra), fixed at the Lv10
// evolution. Only stage1 & stage4 branch on the *feeder* class; stage2 & stage3
// branch on the *lineage*.
const LINEAGE_CLASS = { Varuna: 'HU', Kalki: 'RA', Vritra: 'FO' };
const PERM_ORDER = { POW: 0, DEX: 1, MIND: 2 };

// strictly-max of POW/DEX/MIND; on a tie for max, return `tie`.
function argmaxStat(state, tie) {
    const v = { POW: state.pow, DEX: state.dex, MIND: state.mind };
    const max = Math.max(v.POW, v.DEX, v.MIND);
    const top = ['POW', 'DEX', 'MIND'].filter(k => v[k] === max);
    return top.length === 1 ? top[0] : tie;
}

// e.g. 'POW>DEX>MIND': sort POW/DEX/MIND descending, ties broken by fixed order.
function permKey(state) {
    const v = { POW: state.pow, DEX: state.dex, MIND: state.mind };
    return ['POW', 'DEX', 'MIND']
        .sort((a, b) => (v[b] - v[a]) || (PERM_ORDER[a] - PERM_ORDER[b]))
        .join('>');
}

function idGroupAB(data, id) { return data.idGroups.A.includes(id) ? 'A' : 'B'; }

function idType(data, id) {
    if (data.idGroups.Type1.includes(id)) return 'Type1';
    if (data.idGroups.Type2.includes(id)) return 'Type2';
    return 'Type3';
}

// first equality that holds, in fixed order; else null.
function stage4Formula(state) {
    const { def: d, pow: p, dex: x, mind: m } = state;
    if (d + p === x + m) return 'DEF+POW=DEX+MIND';
    if (d + x === p + m) return 'DEF+DEX=POW+MIND';
    if (d + m === p + x) return 'DEF+MIND=POW+DEX';
    return null;
}

// stage2 mag -> its stage1 ancestor; a stage1 mag maps to itself.
function firstEvoOf(data, magId) {
    if (data.evolution.stage2[magId]) return magId; // already a first-evo form
    for (const [first, branch] of Object.entries(data.evolution.stage2)) {
        for (const child of Object.values(branch)) {
            if (child === magId) return first;
        }
    }
    return magId;
}

function stage3Next(data, state, f) {
    const ev = data.evolution;
    const lineage = firstEvoOf(data, state.magId);
    const lc = LINEAGE_CLASS[lineage];
    const grp = idGroupAB(data, f.sectionId);
    // 1. FO special override (DEF >= minDef)
    if (lc === 'FO' && state.def >= ev.stage3SpecialFO.minDef) {
        return argmaxStat(state, null) === 'POW'
            ? ev.stage3SpecialFO.powMax : ev.stage3SpecialFO.other;
    }
    // 2. tie case
    const tie = ev.stage3Ties[lc];
    const s = { POW: state.pow, DEX: state.dex, MIND: state.mind };
    if (s[tie.eq[0]] === s[tie.eq[1]] && s[tie.eq[0]] > s[tie.lt]) return tie[grp];
    // 3. strict perm
    return ((ev.stage3[lineage] || {})[permKey(state)] || {})[grp];
}

export function checkEvolution(data, state) {
    const events = [];
    const ev = data.evolution;
    const f = state.feeder;
    const level = magLevel(state);
    const stageOf = (id) => data.mags[id].stage;
    const evolve = (next, stage) => {
        if (!next || next === state.magId) return;
        const from = state.magId;
        state.magId = next;
        state.log.push({ kind: 'evolve', from, to: next, stage, level });
        events.push({ type: 'evolve', from, to: next, stage, level });
    };

    const stage = stageOf(state.magId);
    // stage1: Lv10-14, only from a fresh (stage 0) mag; by FEEDER class.
    if (stage === 0 && level >= 10 && level <= 14) {
        evolve(ev.stage1[f.class], 1);
    }
    // stage2: Lv35-39, from stage 0 or 1; by LINEAGE + max stat (lineage tie).
    else if ((stage === 0 || stage === 1) && level >= 35 && level <= 39) {
        const branch = ev.stage2[state.magId];
        if (branch) {
            const tie = ev.tieBreak[LINEAGE_CLASS[state.magId]];
            evolve(branch[argmaxStat(state, tie)], 2);
        }
    }
    // stage3: exact window (50, 55, 60, ...); from stage 2; by LINEAGE + Section ID.
    else if (stage === 2 && level === state.window.stage3) {
        evolve(stage3Next(data, state, f), 3);
    }
    // stage4: exact window (100, 110, ...); from stage 3; by FEEDER class/gender/Type.
    else if (stage === 3 && level === state.window.stage4) {
        const leaf = ((ev.stage4[f.class] || {})[f.gender] || {})[idType(data, f.sectionId)];
        const form = stage4Formula(state);
        evolve(form && leaf ? leaf[form] : null, 4);
    }

    // windows slide once past (the "evolve every 5th / 10th level" mechanic).
    if (level > state.window.stage3) state.window.stage3 += 5;
    if (level > state.window.stage4) state.window.stage4 += 10;
    return events;
}

// Forward-declared for later tasks (exportSession / replaySession). Stubs
// exist only so verify_mag_sim.mjs's ES module import line — which names the
// full Phase 2 surface up front per the plan — can link under Node's strict
// named-export resolution before those tasks land. Each stub is replaced by
// its real implementation in its own task.
export function exportSession() { throw new Error('exportSession: not implemented yet'); }
export function replaySession() { throw new Error('replaySession: not implemented yet'); }

// browser (non-module) global
if (typeof window !== 'undefined') {
    window.MagSimEngine = { magLevel, createState, feedOnce, checkEvolution, exportSession, replaySession };
}
