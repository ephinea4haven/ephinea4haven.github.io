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

// ---- stage4 reference chart + mag cells (Task 4) --------------------------
// Type→formula mapping is fixed by both the wikitable and build()'s stage4:
//   Type1 → DEF+DEX=POW+MIND,  Type2 → DEF+MIND=POW+DEX,  Type3 → DEF+POW=DEX+MIND
// (Each group's single mag sits in exactly the column matching its Type.)
check('stage4 HU/M/Type1 DEF+DEX=POW+MIND → Deva',
    D.evolution.stage4.HU.M.Type1['DEF+DEX=POW+MIND'] === 'Deva');
check('stage4 HU/M/Type1 其余等式为 null',
    D.evolution.stage4.HU.M.Type1['DEF+POW=DEX+MIND'] === null
    && D.evolution.stage4.HU.M.Type1['DEF+MIND=POW+DEX'] === null);
// Brief Step-1 wrote FO/F/Type2 under 'DEF+DEX=POW+MIND' (Type1's key) by
// copy-paste; the wiki puts Bhima under Type2's column DEF+MIND=POW+DEX.
check('stage4 FO/F/Type2 DEF+MIND=POW+DEX → Bhima',
    D.evolution.stage4.FO.F.Type2['DEF+MIND=POW+DEX'] === 'Bhima');
check('stage4 FO/F/Type2 DEF+DEX=POW+MIND 为 null',
    D.evolution.stage4.FO.F.Type2['DEF+DEX=POW+MIND'] === null);
// table walk generalizes beyond HU: one RA mag and one FO mag
check('stage4 RA/M/Type1 → Pushan',
    D.evolution.stage4.RA.M.Type1['DEF+DEX=POW+MIND'] === 'Pushan');
check('stage4 FO/M/Type3 → Nidra',
    D.evolution.stage4.FO.M.Type3['DEF+POW=DEX+MIND'] === 'Nidra');
// a colspan '-' null cell (Type3's mag is in col0, so col1/col2 are null)
check('stage4 RA/F/Type3 DEF+DEX=POW+MIND 为 null (colspan -)',
    D.evolution.stage4.RA.F.Type3['DEF+DEX=POW+MIND'] === null);

check('magCells 收录 Heart of Devil',
    !!D.magCells['Heart of Devil']);
check('Heart of Devil 目标含 Devil Tail + Devil Wing',
    Array.isArray(D.magCells['Heart of Devil'].target)
    && D.magCells['Heart of Devil'].target.includes("Devil's Tail")
    && D.magCells['Heart of Devil'].target.includes("Devil's Wing"));
check('Heart of Devil 可再进化（白名单）',
    D.magCells['Heart of Devil'].reEvoWhitelist === true);
check('普通 cell 非白名单 (Dragon Scale)',
    D.magCells['Dragon Scale'] && D.magCells['Dragon Scale'].reEvoWhitelist === false);
// carry-forward: every cell-target mag lands in mags on feeding table 7 / stage 4
check('cell mag Gael Giel → Table7 stage4',
    D.mags['Gael Giel'] && D.mags['Gael Giel'].feedTableId === '7'
    && D.mags['Gael Giel'].stage === 4);

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
