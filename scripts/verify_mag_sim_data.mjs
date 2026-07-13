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

// ---- evolution predicates --------------------------------------------------
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

// ---- stage4 reference chart + mag cells ------------------------------------
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

// ---- structured mag-cell requirements (review I2) ---------------------------
// The character level and the MAG level are separate gates: the old parser
// grabbed the first "Level N+" in the text, so the System chain stored the
// character level and lost the mag level entirely.
{
    const r = D.magCells['Kit of Genesis'].requires.Genesis;
    check('Kit of Genesis 拆分 minCharLevel 80 / minMagLevel 70',
        r.minCharLevel === 80 && r.minMagLevel === 70 && r.requiresMag === 'Master System');
    check('minLevel 键已废弃', r.minLevel === undefined);
}
check('Panther\'s Spirit minMagLevel 50 + requiresMag Naga',
    D.magCells["Panther's Spirit"].requires["Panzer's Tail"].minMagLevel === 50
    && D.magCells["Panther's Spirit"].requires["Panzer's Tail"].requiresMag === 'Naga');
// "third evolution Mag" → requiredStage 3；"any basic Mag" → requiredStage 0
check('Heart of Chu Chu requiredStage 3',
    D.magCells['Heart of Chu Chu'].requires['Chu Chu'].requiredStage === 3);
check('Kit of Mark III requiredStage 0（基础 Mag）',
    D.magCells['Kit of Mark III'].requires['Mark III'].requiredStage === 0);
check('Any-<species> cell 无 requiredStage（Heart of Devil → Devil\'s Tail）',
    D.magCells['Heart of Devil'].requires["Devil's Tail"].requiredStage === undefined
    && D.magCells['Heart of Devil'].requires["Devil's Tail"].requiresMag === "Devil's Wing");
check('Heart of Pian minSynchro 120 / minIQ 180 / minMagLevel 120',
    D.magCells['Heart of Pian'].requires.Pian.minSynchro === 120
    && D.magCells['Heart of Pian'].requires.Pian.minIQ === 180
    && D.magCells['Heart of Pian'].requires.Pian.minMagLevel === 120);
check('Heart of Chao statThreshold 35/all',
    D.magCells['Heart of Chao'].requires.Chao.statThreshold.value === 35
    && D.magCells['Heart of Chao'].requires.Chao.statThreshold.count === 'all');
check('Parts of RoboChao statThreshold 70/2',
    D.magCells['Parts of RoboChao'].requires.Robochao.statThreshold.value === 70
    && D.magCells['Parts of RoboChao'].requires.Robochao.statThreshold.count === 2);
check('Cell of Mag 213 Churel = A 组 + 三段 + Lv100',
    D.magCells['Cell of Mag 213'].requires.Churel.race === 'A'
    && D.magCells['Cell of Mag 213'].requires.Churel.requiredStage === 3
    && D.magCells['Cell of Mag 213'].requires.Churel.minMagLevel === 100);
// every requirement keeps its raw wiki text and gates on something checkable
{
    const reqs = Object.values(D.magCells).flatMap((c) => Object.values(c.requires));
    check('34 个 cell 的每条 requires 都带 raw 原文',
        Object.keys(D.magCells).length === 34
        && reqs.length > 0 && reqs.every((r) => typeof r.raw === 'string' && r.raw));
    check('每条 requires 至少有 requiresMag 或 requiredStage',
        reqs.every((r) => r.requiresMag !== undefined || r.requiredStage !== undefined));
}

// ---- racial restrictions (hand-maintained CELL_RACE_RULES) ------------------
// The wiki carries no race data for cells; the generator mirrors Magatama's
// MagCellsError.xml. Exactly three cells carry a raceRule, and no others.
check("Heart of Angel raceRule deny=[Android]",
    JSON.stringify(D.magCells['Heart of Angel'].raceRule) === '{"deny":["Android"]}');
check("Heart of Devil raceRule deny=[Android]",
    JSON.stringify(D.magCells['Heart of Devil'].raceRule) === '{"deny":["Android"]}');
check("Heart of YN-0117 raceRule only=[Android]",
    JSON.stringify(D.magCells['Heart of YN-0117'].raceRule) === '{"only":["Android"]}');
{
    const withRule = Object.keys(D.magCells).filter((c) => D.magCells[c].raceRule);
    check('只有这 3 个 cell 带 raceRule，其余 31 个不带',
        withRule.length === 3 && Object.keys(D.magCells).length === 34
        && withRule.join() === ['Heart of Angel', 'Heart of Devil', 'Heart of YN-0117'].sort().join());
    const RACES = ['Human', 'Newman', 'Android'];
    check('raceRule 结构合法（deny/only 二选一，值为已知种族）',
        withRule.every((c) => {
            const r = D.magCells[c].raceRule;
            const keys = Object.keys(r);
            return keys.length === 1 && (keys[0] === 'deny' || keys[0] === 'only')
                && Array.isArray(r[keys[0]]) && r[keys[0]].length > 0
                && r[keys[0]].every((x) => RACES.includes(x));
        }));
}

// ---- constants -------------------------------------------------------------
check('itemOrder 11 项且以 Monomate 开头 Star Atomizer 结尾',
    D.itemOrder.length === 11 && D.itemOrder[0] === 'Monomate'
    && D.itemOrder[10] === 'Star Atomizer');
check('costs.Trimate = 2000', D.costs.Trimate === 2000);
check('freshMag = DEF5 Synchro20', D.freshMag.def === 5 && D.freshMag.synchro === 20);
check('idGroups.Type1 含 Viridia', D.idGroups.Type1.includes('Viridia'));

// ---- stage3 tie-cases + FO special -----------------------------------------
check('stage3Ties HU DEX=MIND>POW → Varaha/Kama',
    D.evolution.stage3Ties.HU.A === 'Varaha' && D.evolution.stage3Ties.HU.B === 'Kama'
    && D.evolution.stage3Ties.HU.eq.join() === 'DEX,MIND' && D.evolution.stage3Ties.HU.lt === 'POW');
check('stage3Ties RA POW=MIND>DEX → Kama/Varaha',
    D.evolution.stage3Ties.RA.A === 'Kama' && D.evolution.stage3Ties.RA.B === 'Varaha');
check('stage3Ties FO POW=DEX>MIND → Naga/Kumara',
    D.evolution.stage3Ties.FO.A === 'Naga' && D.evolution.stage3Ties.FO.B === 'Kumara');
check('stage3SpecialFO Andhaka/Bana minDef 45',
    D.evolution.stage3SpecialFO.powMax === 'Andhaka'
    && D.evolution.stage3SpecialFO.other === 'Bana'
    && D.evolution.stage3SpecialFO.minDef === 45);

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
