/* Asserts assets/js/mag-evolution.js carries the corrections listed in the
 * 2026-07 chart redesign. Run: node scripts/verify_mag_data.mjs */
import { readFileSync } from 'node:fs';

const src = readFileSync('assets/js/mag-evolution.js', 'utf8');
const win = {};
new Function('window', src)(win);
const D = win.MAG_EVOLUTION;

let failed = 0;
const check = (name, cond) => {
    if (cond) console.log(`  ok   ${name}`);
    else { console.error(`  FAIL ${name}`); failed++; }
};
const find = (list, n) => list.filter((m) => m.name === n);
const conds = (list, n) => find(list, n).flatMap((m) => m.cond);

// ---- shape
check('三个职业', Object.keys(D.classes).join() === 'HU,RA,FO');
check('meta.pbNames 六个 PB', Object.keys(D.meta.pbNames).length === 6);
check('meta.events 三个且无死亡', D.meta.events.length === 3 && !D.meta.events.includes('Death'));

// ---- #1 FO B 组是 Marica 不是 Madhu
const foB = D.classes.FO.stage3.B;
check('#1 FO B 有 Marica', find(foB, 'Marica').length === 1);
check('#1 FO B 无 Madhu', find(foB, 'Madhu').length === 0);
check('#1 Marica 规则', conds(foB, 'Marica').join() === 'POW > DEX ≥ MIND');
check('#1 Marica PB=Pilla', find(foB, 'Marica')[0]?.pb === 'Pilla');
check('#1 Marica 中文名', find(foB, 'Marica')[0]?.zh === '摩利支天');
check('#1 Madhu 只在 RA', find(D.classes.RA.stage3.B, 'Madhu').length === 1);
check('#1 Madhu PB=M&Y', find(D.classes.RA.stage3.B, 'Madhu')[0]?.pb === 'Mylla & Youlla');

// ---- #2 RA A 组补回 Varaha，Apsaras 归位
const raA = D.classes.RA.stage3.A;
check('#2 RA A 有 Varaha', conds(raA, 'Varaha').includes('MIND > POW ≥ DEX'));
check('#2 RA A Apsaras 归位', conds(raA, 'Apsaras').join() === 'MIND > DEX > POW');

// ---- #3 RA B 组补齐子句
const raB = D.classes.RA.stage3.B;
check('#3 Kaitabha 补 DEX ≥ POW > MIND', conds(raB, 'Kaitabha').includes('DEX ≥ POW > MIND'));
check('#3 RA B Varaha 补 POW = MIND > DEX', conds(raB, 'Varaha').includes('POW = MIND > DEX'));

// ---- #4 FO 比较符
const foA = D.classes.FO.stage3.A;
check('#4 FO A Naga MIND ≥ POW ≥ DEX', conds(foA, 'Naga').includes('MIND ≥ POW ≥ DEX'));
check('#4 FO B Kumara 补 POW = DEX > MIND', conds(foB, 'Kumara').includes('POW = DEX > MIND'));
check('#4 无 MIND ≥ POW = DEX', !JSON.stringify(D).includes('MIND ≥ POW = DEX'));

// ---- #5 Kama / Ila / Naga 无 100PB
for (const [cls, side, n] of [
    ['HU', 'B', 'Kama'], ['HU', 'A', 'Ila'], ['RA', 'A', 'Kama'],
    ['FO', 'A', 'Naga'], ['FO', 'B', 'Naga'], ['FO', 'B', 'Ila'],
]) {
    const m = find(D.classes[cls].stage3[side], n)[0];
    check(`#5 ${cls}/${side} ${n} 无 100PB`, m && !('100PB' in m.triggers));
}

// ---- #6 Vritra 触发
const vritra = D.classes.FO.stage1;
check('#6 Vritra 有 100PB', '100PB' in vritra.triggers);
check('#6 Vritra 有 BOSS', 'BOSS' in vritra.triggers);
check('#6 Vritra 无 10%HP', !('10%HP' in vritra.triggers));

// ---- #7 Bhima 补 BOSS
const bhima = D.classes.FO.stage4.flatMap((r) => [r.male, r.female]).find((m) => m.name === 'Bhima');
check('#7 Bhima 有 BOSS', bhima && 'BOSS' in bhima.triggers);

// ---- #8 全局无死亡触发
check('#8 无 Death', !JSON.stringify(D).includes('Death'));
check('#8 无 KO', !JSON.stringify(D).includes('KO'));

// ---- #9 每个节点都有效果+概率
const allNodes = Object.values(D.classes).flatMap((c) => [
    c.stage1, ...c.stage2, ...c.stage3.A, ...c.stage3.B,
    ...(c.stage3.special || []), ...c.stage4.flatMap((r) => [r.male, r.female]),
]);
check('#9 触发均带 effect+rate',
    allNodes.every((m) => Object.values(m.triggers).every((t) => t.effect && t.rate)));
check('#9 每个节点至少一个触发', allNodes.every((m) => Object.keys(m.triggers).length > 0));

// ---- #10 译名取自 items_i18n
check('#10 Kalki 迦尔吉', D.classes.RA.stage1.zh === '迦尔吉');
check('#10 Apsaras 飞天', find(D.classes.HU.stage3.B, 'Apsaras')[0]?.zh === '飞天');
check('#10 Naraka 奈落迦', find(foA, 'Naraka')[0]?.zh === '奈落迦');
check('#10 每个节点都有 zh', allNodes.every((m) => m.zh && m.zh !== m.name));

// ---- FO 特殊分支。wikitext 把职业与规则拆成两行，早先的解析只留下了职业行，
// 于是 Andhaka 没有条件、Bana 只剩一个「或」字。
const special = D.classes.FO.stage3.special;
check('FO 有 DEF≥45 分支', special?.length === 2);
check('HU 无特殊分支', D.classes.HU.stage3.special === null);
check('特殊分支条件非空', special.every((m) => m.cond.length && m.cond.every((c) => c.trim())));
check('Andhaka 条件', conds(special, 'Andhaka').join() === 'POW > Others');
check('Bana 两条件', conds(special, 'Bana').join() === 'DEX ≥ POW,MIND ≥ POW');
check('特殊分支已提出 DEF ≥ 45', special.every((m) => m.cond.every((c) => !c.includes('DEF'))));

// ---- 每职业规模。一只 mag 满足多条件时合并为一张卡，故 RA A 是 4 张
// （Kama 独占 POW>DEX≥MIND / DEX≥MIND≥POW / POW=MIND>DEX 三条）。
check('HU A/B 各 6', D.classes.HU.stage3.A.length === 6 && D.classes.HU.stage3.B.length === 6);
check('RA A 4 张 / B 5 张', raA.length === 4 && raB.length === 5);
check('FO A/B 各 6', foA.length === 6 && foB.length === 6);
check('RA A Kama 三条件合一', conds(raA, 'Kama').length === 3);
check('每职业 Lv.35 三分支', Object.values(D.classes).every((c) => c.stage2.length === 3));
check('每职业 Lv.100 三公式', Object.values(D.classes).every((c) => c.stage4.length === 3));

// ---- 卡片顺序按属性优先级：POW 优先 → DEX 优先 → MIND 优先。
// 带 '=' 的条件是补充子句，不得决定 mag 的位置，否则 Kumara 会窜到 FO B 组首位。
const order = (list) => list.map((m) => m.name).join(',');
check('HU A 顺序', order(D.classes.HU.stage3.A) === 'Varaha,Bhirava,Ila,Nandin,Kabanda,Ushasu');
check('HU B 顺序', order(D.classes.HU.stage3.B) === 'Kama,Apsaras,Garuda,Yaksa,Bana,Soma');
check('RA A 顺序', order(raA) === 'Kama,Bhirava,Varaha,Apsaras');
check('RA B 顺序', order(raB) === 'Madhu,Kaitabha,Varaha,Kabanda,Durga');
check('FO A 顺序', order(foA) === 'Naraka,Ravana,Ribhava,Sita,Naga,Kabanda');
check('FO B 顺序', order(foB) === 'Marica,Naga,Garuda,Bhirava,Kumara,Ila');
check('Kumara 主条件在前', conds(foB, 'Kumara')[0] === 'MIND ≥ POW ≥ DEX');

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
