import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCurrentBoosts,
  parseOfficialMilestones,
  updateAnniversaryFragment,
} from './sync_anniversary_milestones.mjs';

const questNames = ['Forest', 'Cave', 'Mine', 'Ruins', 'Temple', 'Spaceship', 'CCA', 'Seabed', 'Tower', 'Crater', 'Desert'];
const milestoneThresholds = [
  1000, 2000, 3500, 4500, 5500, 7000, 8000, 9500,
  10000, 11500, 12500, 14000, 15000, 16500, 18000, 20000,
];

function rewardName(threshold) {
  if (threshold === 1000) return '+10% Rare Drop Rate';
  if (threshold === 2000) return '+25% Meseta Drops';
  if (threshold === 3500) return '+10% Photon Drop Rate';
  if (threshold === 4500) return '+50% Experience Rate (EXP)';
  if (threshold === 5500) return '+10% Rare Enemy Rate';
  return '? ? ?';
}

function officialHtmlFor(thresholds = milestoneThresholds) {
  return `
<table>
  <tr><td colspan="2">11th Anniversary Event 2026 Milestone Rewards</td></tr>
  <tr><td colspan="2">Server clear points: 4,730</td></tr>
  ${thresholds.map((threshold) => `<tr><td>${rewardName(threshold)}</td><td>${threshold.toLocaleString('en-US')} points needed!</td></tr>`).join('')}
</table>
<table>
  <tr><td colspan="2">Per Quest Clear Points</td></tr>
  ${questNames.map((name, index) => `<tr><td>${name}/日本語</td><td>${index === 8 ? '4,730' : '5,000'} points</td></tr>`).join('')}
</table>`;
}

const officialHtml = officialHtmlFor();

test('parses the official milestone and quest tables', () => {
  const snapshot = parseOfficialMilestones(officialHtml);
  assert.equal(snapshot.total, 4730);
  assert.deepEqual(snapshot.rewards.map(({ threshold }) => threshold), milestoneThresholds);
  assert.equal(snapshot.rewards.find(({ threshold }) => threshold === 4500).reward, '+50% Experience Rate (EXP)');
  assert.deepEqual(snapshot.quests.map(({ name }) => name), questNames);
});

test('rejects incomplete, duplicate, reordered, and unknown milestone thresholds', () => {
  const malformedThresholds = [
    milestoneThresholds.slice(0, -1),
    milestoneThresholds.with(4, 4500),
    milestoneThresholds.with(3, 5500).with(4, 4500),
    milestoneThresholds.with(4, 5600),
  ];
  for (const thresholds of malformedThresholds) {
    assert.throws(
      () => parseOfficialMilestones(officialHtmlFor(thresholds)),
      /Unexpected official milestone thresholds/,
    );
  }
});

test('combines fixed anniversary boosts with unlocked milestone rewards', () => {
  const rewards = parseOfficialMilestones(officialHtml).rewards;
  const boosts = calculateCurrentBoosts(rewards, 4730);
  assert.deepEqual(
    boosts.map(({ key, base, milestone, total }) => ({ key, base, milestone, total })),
    [
      { key: 'dar', base: 25, milestone: 0, total: 25 },
      { key: 'rareDrop', base: 25, milestone: 10, total: 35 },
      { key: 'badge', base: 0, milestone: 0, total: 0 },
      { key: 'photonDrop', base: 0, milestone: 10, total: 10 },
      { key: 'experience', base: 50, milestone: 50, total: 100 },
      { key: 'meseta', base: 0, milestone: 25, total: 25 },
      { key: 'rareMonster', base: 50, milestone: 0, total: 50 },
      { key: 'hitWeapon', base: 0, milestone: 0, total: 0 },
    ],
  );
  assert.deepEqual(
    calculateCurrentBoosts(rewards, 5500).find(({ key }) => key === 'rareMonster'),
    {
      key: 'rareMonster',
      acronym: 'RER',
      label: '稀有怪出现率',
      base: 50,
      patterns: [/Rare (?:Monster|Enemy) Rate/i],
      milestone: 10,
      total: 60,
    },
  );
});

test('updates only the milestone snapshot content', () => {
  const source = `<section id="anniv-2026-milestones">
<p>截至 2026 年 8 月 14 日，服务器点数为 <strong>4,462</strong>，已解锁旧奖励。</p>
<div class="quest-cards current-boosts" data-boost-summary-year="2026">
<article class="quest-card">old boosts</article>
</div>
<table class="shop-table milestone-table" data-milestone-year="2026"><tbody>
<tr><td>old</td></tr>
</tbody></table>
<table><thead><tr><th>MAE 任务</th><th>当前点数</th></tr></thead><tbody>
<tr><td>old</td></tr>
</tbody></table>
</section>
    <section id="next">keep me</section>`;
  const updated = updateAnniversaryFragment(source, parseOfficialMilestones(officialHtml), new Date('2026-08-14T12:00:00-07:00'));
  assert.match(updated, /服务器点数为 <strong>4,730<\/strong>/);
  assert.match(updated, /<tr><td>1,000<\/td><td>稀有物品掉落率 \+10%（已解锁）<\/td><\/tr>/);
  assert.match(updated, /经验值获取率 \+50%（已解锁）/);
  assert.match(updated, /<tr><td>5,500<\/td><td>稀有怪出现率 \+10%<\/td><\/tr>/);
  assert.match(updated, /<em>\+100%<\/em><strong>EXP · 经验值<\/strong>/);
  assert.match(updated, /<em>\+35%<\/em><strong>RDR · 稀有物品掉落率<\/strong>/);
  assert.match(updated, /<em>\+0%<\/em><strong>徽章 · 周年徽章掉落率<\/strong>/);
  assert.match(updated, /<em>\+0%<\/em><strong>Hit · Hit 武器出现率<\/strong>/);
  assert.match(updated, /周年固定 \+25% · 里程碑 \+10%/);
  assert.match(updated, /截至 2026 年 8 月 14 日/);
  assert.match(updated, /<tr><td>Tower<\/td><td>4,730<\/td><\/tr>/);
  assert.match(updated, /<section id="next">keep me<\/section>/);
});
