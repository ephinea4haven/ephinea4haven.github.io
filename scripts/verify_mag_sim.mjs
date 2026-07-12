/* Engine unit tests. Run: node scripts/verify_mag_sim.mjs */
import { readFileSync } from 'node:fs';
import { createState, magLevel, feedOnce, exportSession, replaySession }
    from '../assets/js/mag-sim-engine.js';

const src = readFileSync('assets/js/mag-sim-data.js', 'utf8');
const win = {};
new Function('window', src)(win);
const DATA = win.MAG_SIM;

let failed = 0;
const check = (n, c) => { if (c) console.log(`  ok   ${n}`); else { console.error(`  FAIL ${n}`); failed++; } };

// --- Task 6
const s = createState(DATA, { start: { mode: 'fresh' } });
check('fresh 起始 level 5', magLevel(s) === 5);
check('fresh DEF 5 其余 0', s.def === 5 && s.pow === 0 && s.mind === 0);
check('fresh synchro 20 iq 0', s.synchro === 20 && s.iq === 0);
check('fresh magId=Mag', s.magId === 'Mag');
check('窗口初始 50/100', s.window.stage3 === 50 && s.window.stage4 === 100);

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
