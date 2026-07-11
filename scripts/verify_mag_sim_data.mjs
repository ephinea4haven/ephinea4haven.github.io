/* Asserts assets/js/mag-sim-data.js. Run: node scripts/verify_mag_sim_data.mjs */
import { readFileSync } from 'node:fs';
const src = readFileSync('assets/js/mag-sim-data.js', 'utf8');
const win = {};
new Function('window', src)(win);
const D = win.MAG_SIM;

let failed = 0;
const check = (name, cond) => {
    if (cond) console.log(`  ok   ${name}`);
    else { console.error(`  FAIL ${name}`); failed++; }
};

check('8 张喂食表', Object.keys(D.feedTables).length === 8);
check('Table0 Monomate = 5/40/5/0/3/3',
    JSON.stringify(D.feedTables['0'].Monomate) === JSON.stringify([5,40,5,0,3,3]));
check('每表 11 个道具',
    Object.values(D.feedTables).every((t) => Object.keys(t).length === 11));

check('mags 收录 Mag→Table0 stage0',
    D.mags.Mag && D.mags.Mag.feedTableId === '0' && D.mags.Mag.stage === 0);
check('Varuna→Table1 stage1',
    D.mags.Varuna && D.mags.Varuna.feedTableId === '1' && D.mags.Varuna.stage === 1);
check('Vayu 在 Table4（stage2 与 stage3 混表）',
    D.mags.Vayu && D.mags.Vayu.feedTableId === '4' && D.mags.Vayu.stage === 2);
check('cell mag Deva→Table7 stage4',
    D.mags.Deva && D.mags.Deva.feedTableId === '5' && D.mags.Deva.stage === 4);

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
