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
        feeder: { class: 'HU', gender: 'M', sectionId: 'Viridia' },
        log: [],
    };
    s._start = start;   // 供 exportSession / 重置复用
    return s;
}

const STAT_KEYS = ['def', 'pow', 'dex', 'mind'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function feedOnce(data, state, itemName) {
    if (data.magCells[itemName]) {
        // logged BEFORE the cell runs, so a resulting `evolve` entry lands
        // after its own feed line (the order checkEvolution's feeds produce).
        const entry = { kind: 'feedCell', item: itemName,
                        feeder: { ...state.feeder }, ok: false };
        state.log.push(entry);
        const events = checkCellEvolution(data, state, itemName);
        entry.ok = events.some((e) => e.type === 'evolve');
        return events;   // cells don't apply stat deltas
    }
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

    state.log.push({ kind: 'feed', item: itemName, feeder: { ...state.feeder } });
    events.push(...checkEvolution(data, state));
    return events;
}

// --- Evolution engine --------------------------------------------------------
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
    // Every gate below is a RANGE, never an exact level: ONE feed can raise the
    // level by up to +4 (all four stats crossing a progress boundary at once),
    // so an `=== window` test is jumped clean over — Lv49 -> Lv51 used to lose
    // the Lv50 evolution outright.
    //
    // stage1: Lv10+, only from a fresh (stage 0) mag; by FEEDER class. No upper
    // bound, or a custom-start base Mag above Lv14 would be stuck at stage 0.
    if (stage === 0 && level >= 10) {
        evolve(ev.stage1[f.class], 1);
    }
    // stage2: Lv35+, from stage 0 or 1; by LINEAGE + max stat (lineage tie).
    else if (stage <= 1 && level >= 35) {
        const branch = ev.stage2[state.magId];
        if (branch) {
            const tie = ev.tieBreak[LINEAGE_CLASS[state.magId]];
            evolve(branch[argmaxStat(state, tie)], 2);
        }
    }
    // stage3: the 5-wide window at 50, 55, 60, ...; from stage 2; by LINEAGE + Section ID.
    else if (stage === 2 && level >= state.window.stage3 && level < state.window.stage3 + 5) {
        evolve(stage3Next(data, state, f), 3);
    }
    // stage4: the 10-wide window at 100, 110, ...; from stage 3; by FEEDER class/gender/Type.
    else if (stage === 3 && level >= state.window.stage4 && level < state.window.stage4 + 10) {
        const leaf = ((ev.stage4[f.class] || {})[f.gender] || {})[idType(data, f.sectionId)];
        const form = stage4Formula(state);
        evolve(form && leaf ? leaf[form] : null, 4);
    }

    // Windows slide once fully passed (the "evolve every 5th / 10th level"
    // mechanic). `while`, not `if`: a single feed can clear a whole window, and
    // a window left behind the level can never be reached again.
    while (level >= state.window.stage3 + 5) state.window.stage3 += 5;
    while (level >= state.window.stage4 + 10) state.window.stage4 += 10;
    return events;
}

// --- Mag Cells ---------------------------------------------------------------
// Mag Cells force an evolution directly (no stat feed, no level window) once
// their target-specific gates pass. A cell may list one or two possible
// targets; the first target whose gates pass wins.
//
// Every gate below is a key the generator parses out of the wiki's "Evolution
// Conditions" column (and keeps verbatim in `req.raw`). `minCharLevel` is the
// one gate deliberately NOT enforced: the sim models the mag, not the
// character, so it is carried in the data for display only.

// "35+ in all Mag stats" / "70+ in two Mag stats" — DEF/POW/DEX/MIND only.
function statThresholdOk(state, { value, count }) {
    const n = STAT_KEYS.filter((k) => state[k] >= value).length;
    return count === 'all' ? n === STAT_KEYS.length : n >= count;
}

export function checkCellEvolution(data, state, cellName) {
    const cell = data.magCells[cellName];
    const lvl = magLevel(state);
    const cur = data.mags[state.magId]?.stage;
    const reject = (reason) => [{ type: 'magCellRejected', cell: cellName, reason }];
    // A stage-4 rare mag can only re-evolve via a whitelisted cell.
    if (cur === 4 && !cell.reEvoWhitelist) return reject('稀有 mag 无法再进化');

    const targets = Array.isArray(cell.target) ? cell.target : [cell.target];
    for (const tgt of targets) {
        const req = (cell.requires && cell.requires[tgt]) || {};
        const species = req.requiresMag
            && (Array.isArray(req.requiresMag) ? req.requiresMag : [req.requiresMag]);
        if (species && !species.includes(state.magId)) continue;                        // species gate
        if (req.requiredStage !== undefined && cur !== req.requiredStage) continue;     // "third evolution Mag"
        if (req.minMagLevel && lvl < req.minMagLevel) continue;                         // mag-level gate
        if (req.race && idGroupAB(data, state.feeder.sectionId) !== req.race) continue; // Section-ID group gate
        if (req.minSynchro && state.synchro < req.minSynchro) continue;
        if (req.minIQ && state.iq < req.minIQ) continue;
        if (req.statThreshold && !statThresholdOk(state, req.statThreshold)) continue;

        const from = state.magId;
        state.magId = tgt;
        const stage = data.mags[tgt]?.stage;
        state.log.push({ kind: 'evolve', from, to: tgt, stage, level: lvl, viaCell: cellName });
        return [{ type: 'evolve', from, to: tgt, stage, level: lvl, viaCell: cellName }];
    }
    return reject('未满足该 cell 的进化条件');
}

// --- Session export / replay --------------------------------------------------
// Exports the ordered feed/feedCell log (each entry carrying the feeder
// snapshot at the moment of that feed) plus the original start config, so a
// session can be losslessly reconstructed from data + this record alone.
export function exportSession(state) {
    return {
        start: state._start,               // createState 时存下的 start 参数
        feeds: state.log.filter((e) => e.kind === 'feed' || e.kind === 'feedCell')
                        .map((e) => ({ item: e.item, feeder: { ...e.feeder } })),
        final: { magId: state.magId, def: state.def, pow: state.pow,
                 dex: state.dex, mind: state.mind, synchro: state.synchro,
                 iq: state.iq, level: magLevel(state) },
    };
}
export function replaySession(data, session) {
    const s = createState(data, { start: session.start });
    for (const f of session.feeds) { s.feeder = { ...f.feeder }; feedOnce(data, s, f.item); }
    return s;
}

// browser (non-module) global
if (typeof window !== 'undefined') {
    window.MagSimEngine = { magLevel, createState, feedOnce, checkEvolution, checkCellEvolution, exportSession, replaySession };
}
