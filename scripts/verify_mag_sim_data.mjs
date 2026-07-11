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

// ---- evolution predicates (Task 3) ----------------------------------------
check('stage1 by class', D.evolution.stage1.HU === 'Varuna'
    && D.evolution.stage1.RA === 'Kalki' && D.evolution.stage1.FO === 'Vritra');
check('stage2 Varuna+POW→Rudra', D.evolution.stage2.Varuna.POW === 'Rudra');
check('stage2 Kalki+DEX→Mitra', D.evolution.stage2.Kalki.DEX === 'Mitra');
check('stage3 有 6 种排列', Object.keys(Object.values(D.evolution.stage3)[0]).length === 6);
check('tieBreak HU=POW', D.evolution.tieBreak.HU === 'POW');

// every lineage must map all 6 strict stat orderings, each with an A and a B mag
const PERMS = ['POW>DEX>MIND', 'POW>MIND>DEX', 'DEX>POW>MIND',
    'DEX>MIND>POW', 'MIND>POW>DEX', 'MIND>DEX>POW'];
for (const [first, map] of Object.entries(D.evolution.stage3)) {
    check(`${first} 覆盖全部 6 排列且 A/B 齐全`,
        Object.keys(map).length === 6
        && PERMS.every((p) => map[p] && typeof map[p].A === 'string' && typeof map[p].B === 'string'));
}
// strict rule: HU POW>DEX>MIND resolves to Varaha (A) / Kama (B)
check('stage3 Varuna POW>DEX>MIND → A=Varaha,B=Kama',
    D.evolution.stage3.Varuna['POW>DEX>MIND'].A === 'Varaha'
    && D.evolution.stage3.Varuna['POW>DEX>MIND'].B === 'Kama');
// tie-derived rule: RA "DEX ≥ MIND ≥ POW" covers DEX>MIND>POW → Kama (A) / Varaha (B)
check('stage3 Kalki DEX>MIND>POW → A=Kama,B=Varaha',
    D.evolution.stage3.Kalki['DEX>MIND>POW'].A === 'Kama'
    && D.evolution.stage3.Kalki['DEX>MIND>POW'].B === 'Varaha');

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
