/* Planner unit tests. Run: node scripts/verify_mag_sim_planner.mjs */
import { readFileSync } from 'node:fs';
import { evolutionChains } from '../assets/js/mag-sim-planner.js';

const win = {};
new Function('window', readFileSync('assets/js/mag-sim-data.js', 'utf8'))(win);
const DATA = win.MAG_SIM;

let failed = 0;
const check = (n, c) => { if (c) console.log(`  ok   ${n}`); else { console.error(`  FAIL ${n}`); failed++; } };

// Deva (stage4, HU/M/Type1, DEF+DEX=POW+MIND) —— 反查链
const chains = evolutionChains(DATA, 'Deva');
check('Deva 有至少一条链', chains.length >= 1);
const c = chains[0];
check('末阶是 Deva', c.steps.at(-1).magId === 'Deva' && c.steps.at(-1).stage === 4);
check('起手 HU 血统 -> Varuna', c.steps.find(s => s.stage === 1).magId === 'Varuna');
check('Lv100 需 HU/M 且 Type1 公式 DEF+DEX=POW+MIND',
    c.steps.at(-1).feeder.class === 'HU' && c.steps.at(-1).feeder.gender === 'M'
    && c.steps.at(-1).condKey === 'DEF+DEX=POW+MIND');

// --- shape / sanity checks across every stage -------------------------------
check('每条 Deva 链恰有 4 步（stage1..4）',
    chains.every((chain) => chain.steps.length === 4
        && chain.steps.map((s) => s.stage).join() === '1,2,3,4'));
check('targetStage === 4', chains.every((chain) => chain.targetStage === 4));
check('每步都带 feedTableId', chains.every((chain) => chain.steps.every((s) => s.feedTableId !== undefined)));

// A stage-2 target (Rudra: HU/Varuna/POW) should reverse-enumerate a 2-step
// chain (stage1 -> stage2) and stop there — no forced stage3/4 tail.
const rudraChains = evolutionChains(DATA, 'Rudra');
check('Rudra 至少一条链', rudraChains.length >= 1);
check('Rudra 链在 stage2 终止（不强行续到 stage3/4）',
    rudraChains.every((chain) => chain.steps.length === 2
        && chain.steps.at(-1).stage === 2 && chain.steps.at(-1).magId === 'Rudra'));
check('Rudra 链的 stage2 步 condKey 是 POW（argmax 条件）',
    rudraChains.every((chain) => chain.steps.at(-1).condKey === 'POW'));
check('Rudra targetStage === 2', rudraChains.every((chain) => chain.targetStage === 2));

// A stage-3 target reachable via BOTH HU and RA rule tables (Varaha) should
// yield chains under both classes.
const varahaChains = evolutionChains(DATA, 'Varaha');
check('Varaha 至少一条链', varahaChains.length >= 1);
check('Varaha 链在 stage3 终止',
    varahaChains.every((chain) => chain.steps.length === 3 && chain.steps.at(-1).stage === 3));
check('Varaha 存在经由 HU 表的链', varahaChains.some((chain) => chain.steps.at(-1).feeder.class === 'HU'));
check('Varaha 存在经由 RA 表的链', varahaChains.some((chain) => chain.steps.at(-1).feeder.class === 'RA'));

// FO's DEF>=45 override (Andhaka / Bana) is reachable only through an FO feeder.
const andhakaChains = evolutionChains(DATA, 'Andhaka');
check('Andhaka（FO 特殊 POW-max）至少一条链', andhakaChains.length >= 1);
check('Andhaka 链末步 feeder 是 FO 且 condKey 提及 POW is max',
    andhakaChains.every((chain) => chain.steps.at(-1).feeder.class === 'FO'
        && /POW is max/.test(chain.steps.at(-1).condKey)));

// Unknown / stage-0 ids reverse-enumerate to nothing.
check('未知 mag id 返回空数组', evolutionChains(DATA, 'NoSuchMag').length === 0);
check('fresh Mag（stage0）返回空数组', evolutionChains(DATA, 'Mag').length === 0);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
