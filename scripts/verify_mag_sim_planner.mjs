/* Planner unit tests. Run: node scripts/verify_mag_sim_planner.mjs */
import { readFileSync } from 'node:fs';
import { evolutionChains, solveSegment, planMag } from '../assets/js/mag-sim-planner.js';
import { createState, feedOnce, bankMag, magLevel } from '../assets/js/mag-sim-engine.js';

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

// === solveSegment: single-段精确四维求解器 ===================================
// 每个求解器测试都把输出交给真实引擎 feedOnce 回放裁决——引擎是 ground truth。

// (1) 品牌案例：从 5/0/0/0 的 Vayu（表4，二阶）起，MIND 精确 +20 → level 25，
// 安全落在下个进化级(Lv50)之前。表4 无"纯 MIND"道具，但 Difluid=[0,-10,0,11,..]
// 在 POW=0 时其 -10 POW 被"整笔不生效"跳过，于是等效纯 MIND。solveSegment 无需
// 知道这点——它搜出的序列由引擎回放裁决。
{
  const seq = solveSegment(DATA, { table:'4', startStats:{def:5,pow:0,dex:0,mind:0},
      targetDelta:{def:0,pow:0,dex:0,mind:20}, maxItems:400 });
  check('solveSegment 返回序列', Array.isArray(seq) && seq.length>0);
  const t = createState(DATA,{start:{mode:'custom',magId:'Vayu',def:5,pow:0,dex:0,mind:0,synchro:20,iq:0}});
  seq.forEach(it => feedOnce(DATA,t,it));
  check('回放后 level 25（未跨 Lv50，无中途进化）', magLevel(t)===25);
  check('回放后 MIND 恰 +20', t.mind===20 && t.magId==='Vayu');
  check('回放后 DEF/POW/DEX 未变', t.def===5 && t.pow===0 && t.dex===0);
}

// (2) 负值跳过的单维案例：POW 精确 +10。表4 无纯 POW 道具，但 Dimate=[0,11,0,-10,..]
// 在 MIND=0 时其 -10 MIND 整笔跳过 → 等效纯 POW。
{
  const seq = solveSegment(DATA, { table:'4', startStats:{def:5,pow:0,dex:0,mind:0},
      targetDelta:{def:0,pow:10,dex:0,mind:0}, maxItems:400 });
  check('solveSegment POW+10 返回序列', Array.isArray(seq) && seq.length>0);
  const t = createState(DATA,{start:{mode:'custom',magId:'Vayu',def:5,pow:0,dex:0,mind:0,synchro:0,iq:0}});
  seq.forEach(it => feedOnce(DATA,t,it));
  check('POW+10 回放后 POW 恰 +10', t.pow===10 && t.magId==='Vayu');
  check('POW+10 回放后 DEF/DEX/MIND 未变', t.def===5 && t.dex===0 && t.mind===0);
}

// (3) 双维精确案例：DEF 精确 +1 且 POW 精确 +3（其余不变）。需要多种道具交织，
// 且不得让任一维越过目标整数级。
{
  const seq = solveSegment(DATA, { table:'4', startStats:{def:5,pow:0,dex:0,mind:0},
      targetDelta:{def:1,pow:3,dex:0,mind:0}, maxItems:400 });
  check('solveSegment DEF+1/POW+3 返回序列', Array.isArray(seq) && seq.length>0);
  const t = createState(DATA,{start:{mode:'custom',magId:'Vayu',def:5,pow:0,dex:0,mind:0,synchro:0,iq:0}});
  seq.forEach(it => feedOnce(DATA,t,it));
  check('DEF+1/POW+3 回放后 DEF 恰 +1', t.def===6);
  check('DEF+1/POW+3 回放后 POW 恰 +3', t.pow===3);
  check('DEF+1/POW+3 回放后 DEX/MIND 未变', t.dex===0 && t.mind===0 && t.magId==='Vayu');
}

// (4) 无解/负目标：整数级永不下降，负增量目标必然 null（不崩、不挂）。
check('负增量目标返回 null',
  solveSegment(DATA, { table:'4', startStats:{def:5,pow:5,dex:5,mind:5},
      targetDelta:{def:-1,pow:0,dex:0,mind:0}, maxItems:50 }) === null);

// === planMag: 组装 + 引擎回放验证（对官方指南的黄金目标）====================
// 把一份 plan 灌进真引擎，返回终态——所有断言以引擎回放为准（ground truth）。
function replay(plan) {
  const t = createState(DATA, { start: { mode: 'fresh' } });
  for (const seg of plan.segments) {
    t.feeder = { ...seg.feeder, race: 'Human' };
    for (const step of seg.order) { step.bank ? bankMag(DATA, t) : feedOnce(DATA, t, step.item); }
  }
  return t;
}

// 官方指南: Deva 的一种配方是 5/50/45/0（HU/M/Type1，公式 DEF+DEX=POW+MIND）。
{
  const { plan } = planMag(DATA, { magId: 'Deva', def: 5, pow: 50, dex: 45, mind: 0 }, { budget: 2_000_000 });
  check('Deva 5/50/45/0 有精确计划', !!plan);
  if (plan) {
    const t = replay(plan);
    check('回放后种类 = Deva', t.magId === 'Deva');
    check('回放后四维 = 5/50/45/0', t.def === 5 && t.pow === 50 && t.dex === 45 && t.mind === 0);
    check('plan.totals 一致（items = order 步数之和）',
      plan.totals.items === plan.segments.reduce((n, s) => n + s.order.length, 0));
    check('plan 每段都标注 magFrom/magTo/evoLevel/feeder',
      plan.segments.every((s) => s.magFrom && s.magTo && s.evoLevel && s.feeder && s.feeder.class));
    check('nearest 本任务返回 null（留给 Task 4）',
      (planMag(DATA, { magId: 'Deva', def: 5, pow: 50, dex: 45, mind: 0 }, { budget: 2_000_000 }).nearest) === null);
  }
}

// 无解目标（负增量：整数级永不下降）→ plan 必为 null，绝不返回错误计划。
{
  const { plan } = planMag(DATA, { magId: 'Deva', def: 5, pow: 50, dex: 45, mind: -1 }, { budget: 200_000 });
  check('不可达目标返回 plan=null', plan === null);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
