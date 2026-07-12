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

// Forward-declared for later tasks (Task 7: feedOnce; later: exportSession /
// replaySession). Stubs exist only so verify_mag_sim.mjs's ES module import
// line — which names the full Phase 2 surface up front per the plan — can
// link under Node's strict named-export resolution before those tasks land.
// Each stub is replaced by its real implementation in its own task.
export function feedOnce() { throw new Error('feedOnce: not implemented yet (Task 7)'); }
export function exportSession() { throw new Error('exportSession: not implemented yet'); }
export function replaySession() { throw new Error('replaySession: not implemented yet'); }

// browser (non-module) global
if (typeof window !== 'undefined') {
    window.MagSimEngine = { magLevel, createState, feedOnce, exportSession, replaySession };
}
