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
        // The feeder is one of the 12 PSO classes; the class alone fixes the
        // class line, the gender AND the race (HUmar = HU/M/Human, HUcast =
        // HU/M/Android, …). Race only matters for the mag-cell race rules.
        feeder: { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' },
        // Magatama's blnMagRacialRestriction: when off, the mag-cell race rules
        // are not enforced at all.
        racialRestriction: true,
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
        const rejected = events.find((e) => e.type === 'magCellRejected');
        if (rejected) entry.reason = rejected.reason;   // shown in the history log
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
    // primary stats: progress accumulator with carry, respect 200 cap
    STAT_KEYS.forEach((k, i) => {
        state.progress[k] += row[i];
        while (state.progress[k] >= 100) {
            if (magLevel(state) >= 200 || state[k] >= 200) { // capped
                state.progress[k] = 99; events.push({ type: 'capped', stat: k });
                break;
            }
            state[k] += 1; state.progress[k] -= 100;
        }
        // A negative feed can only eat into the CURRENT point's hundredths
        // (80 -> 65); it never borrows from the integer stat. The wiki is
        // explicit: "Mags may also lose experience in their stats depending on
        // the item, but they cannot lose levels." Borrowing here dropped a
        // Lv200 mag to Lv198 on a single Monomate.
        if (state.progress[k] < 0) state.progress[k] = 0;
    });
    const after = magLevel(state);
    if (after > before) events.push({ type: 'levelUp', level: after });

    state.log.push({ kind: 'feed', item: itemName, feeder: { ...state.feeder } });
    events.push(...checkEvolution(data, state));
    return events;
}

// --- Evolution engine --------------------------------------------------------
// Which stage keys on WHAT (from the wiki's own condition-line grammar):
//   Lv.10  `HU evolves Mag`             -> the FEEDER's class
//   Lv.35  `Evolves from Varuna`        -> the mag's LINEAGE (the only one)
//   Lv.50  `HU {{TypeA}} POW ≥ DEX ...` -> the FEEDER's class + Section-ID group
//   Lv.100 `Male HU {{Type1}} ...`      -> the FEEDER's class/gender/Section-ID Type
// Lineage = the first-evolution form (Varuna/Kalki/Vritra), fixed at Lv10, and
// used ONLY for the Lv.35 branch and its tie-break.
const LINEAGE_CLASS = { Varuna: 'HU', Kalki: 'RA', Vritra: 'FO' };

// strictly-max of POW/DEX/MIND; on a tie for max, return `tie`.
function argmaxStat(state, tie) {
    const v = { POW: state.pow, DEX: state.dex, MIND: state.mind };
    const max = Math.max(v.POW, v.DEX, v.MIND);
    const top = ['POW', 'DEX', 'MIND'].filter(k => v[k] === max);
    return top.length === 1 ? top[0] : tie;
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

// --- stage 3: the wiki's ordered Lv.50 rows -----------------------------------
// Each class has SEVEN ordered rules; the FIRST one that holds wins, and the
// feeder's Section-ID group (A/B) picks the mag. The rules are `≥`/`>`/`=`
// chains over POW/DEX/MIND, evaluated left-to-right — a 5-token chain like
// `DEX = MIND > POW` asserts BOTH `DEX == MIND` and `MIND > POW`.
//
// The old 6-strict-permutation map plus one hard-coded tie row could not
// express this: it ranked the stats and broke ties by a fixed POW>DEX>MIND
// priority, so e.g. HU `DEX > MIND = POW` landed on 'DEX>POW>MIND' (Ila) when
// the wiki's row `DEX > MIND ≥ POW` says Nandin.
const RULE_OPS = {
    '>': (a, b) => a > b,
    '≥': (a, b) => a >= b,
    '=': (a, b) => a === b,
};

export function evalStage3Rule(cond, state) {
    const v = { POW: state.pow, DEX: state.dex, MIND: state.mind };
    const tok = cond.split(' ');
    for (let i = 0; i + 2 < tok.length; i += 2) {
        const op = RULE_OPS[tok[i + 1]];
        if (!op) throw new Error(`stage3 rule ${cond}: unknown operator ${tok[i + 1]}`);
        if (!op(v[tok[i]], v[tok[i + 2]])) return false;
    }
    return true;
}

// Keyed on the FEEDER's class (`f.class`), never on the mag's lineage — a
// Vritra-line mag fed by a Hunter takes the HU table. That is what makes
// "transfer the mag to another character" a real strategy.
function stage3Next(data, state, f) {
    const ev = data.evolution;
    const grp = idGroupAB(data, f.sectionId);
    // 1. FO's all-IDs DEF >= 45 override sits ahead of the rule rows — and it,
    //    too, keys on the feeder being a Force.
    if (f.class === 'FO' && state.def >= ev.stage3SpecialFO.minDef) {
        return argmaxStat(state, null) === 'POW'
            ? ev.stage3SpecialFO.powMax : ev.stage3SpecialFO.other;
    }
    // 2. the ordered rule rows: first match wins.
    const row = (ev.stage3Rules[f.class] || []).find((r) => evalStage3Rule(r.cond, state));
    return row ? row[grp] : null;
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

// The cell's racial restriction (magCells[cell].raceRule — only three cells
// carry one). INDEPENDENT of every other gate: it keys on the *feeder's race*,
// not on the mag, so it is checked once, up front, for the whole cell.
// A feeder with no `race` (an old share link, a hand-built state) is never
// blocked by a `deny` rule — it can only fail an `only` rule.
// Returns a rejection reason, or null when the cell is allowed.
function raceRejection(cell, state) {
    const rule = cell.raceRule;
    if (!rule || !state.racialRestriction) return null;
    const race = state.feeder.race;
    if (rule.deny && race && rule.deny.includes(race)) {
        return `${RACE_ZH[race] || race}无法使用该 cell`;
    }
    if (rule.only && !rule.only.includes(race)) {
        return `仅${rule.only.map((r) => RACE_ZH[r] || r).join('/')}可使用该 cell`;
    }
    return null;
}
const RACE_ZH = { Human: '人类', Newman: '新人类', Android: '机器人' };

export function checkCellEvolution(data, state, cellName) {
    const cell = data.magCells[cellName];
    const lvl = magLevel(state);
    const cur = data.mags[state.magId]?.stage;
    const reject = (reason) => [{ type: 'magCellRejected', cell: cellName, reason }];
    // A stage-4 rare mag can only re-evolve via a whitelisted cell.
    if (cur === 4 && !cell.reEvoWhitelist) return reject('稀有 mag 无法再进化');
    const raceReason = raceRejection(cell, state);
    if (raceReason) return reject(raceReason);

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
        racialRestriction: state.racialRestriction,
        feeds: state.log.filter((e) => e.kind === 'feed' || e.kind === 'feedCell')
                        .map((e) => ({ item: e.item, feeder: { ...e.feeder } })),
        final: { magId: state.magId, def: state.def, pow: state.pow,
                 dex: state.dex, mind: state.mind, synchro: state.synchro,
                 iq: state.iq, level: magLevel(state) },
    };
}
export function replaySession(data, session) {
    const s = createState(data, { start: session.start });
    // absent in links shared before the toggle existed -> the default (on)
    if (session.racialRestriction !== undefined) s.racialRestriction = session.racialRestriction;
    for (const f of session.feeds) { s.feeder = { ...f.feeder }; feedOnce(data, s, f.item); }
    return s;
}

// browser (non-module) global
if (typeof window !== 'undefined') {
    window.MagSimEngine = { magLevel, createState, feedOnce, checkEvolution, checkCellEvolution, evalStage3Rule, exportSession, replaySession };
}
