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
    window.MagSimEngine = { magLevel, createState, feedOnce, exportSession, replaySession };
}
