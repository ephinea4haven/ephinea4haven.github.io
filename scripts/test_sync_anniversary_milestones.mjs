import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anniversaryMilestonesAreComplete,
  calculateCurrentBoosts,
  parseOfficialMilestones,
  updateAnniversaryFragment,
  updatePageTimestamp,
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
  if (threshold === 7000) return '+25% Badge Drop Rate';
  if (threshold === 8000) return '+15% Rare Monster Rate';
  if (threshold === 9500) return '+20% Drop Anything Rate';
  if (threshold === 10000) return '+25% Weapon Hit Drop Rate';
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

test('rejects revealed milestone rewards that are not recognized', () => {
  assert.throws(
    () => parseOfficialMilestones(officialHtml.replace('+10% Rare Drop Rate', '+10% Mystery Rate')),
    /Unsupported official milestone reward: \+10% Mystery Rate/,
  );
});

test('parses the official Hit Chance wording used by the final milestone', () => {
  const finalRewardHtml = officialHtml.replace(
    '<tr><td>? ? ?</td><td>20,000 points needed!</td></tr>',
    '<tr><td>+1% Hit Chance (ヒット)</td><td>20,000 points needed!</td></tr>',
  );
  const snapshot = parseOfficialMilestones(finalRewardHtml);
  const hitBoost = calculateCurrentBoosts(snapshot.rewards, 20000)
    .find(({ key }) => key === 'hitWeapon');

  assert.equal(snapshot.rewards.at(-1).reward, '+1% Hit Chance (ヒット)');
  assert.equal(hitBoost.milestone, 26);
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
    calculateCurrentBoosts(rewards, 10000)
      .map(({ key, base, milestone, total }) => ({ key, base, milestone, total })),
    [
      { key: 'dar', base: 25, milestone: 20, total: 45 },
      { key: 'rareDrop', base: 25, milestone: 10, total: 35 },
      { key: 'badge', base: 0, milestone: 25, total: 25 },
      { key: 'photonDrop', base: 0, milestone: 10, total: 10 },
      { key: 'experience', base: 50, milestone: 50, total: 100 },
      { key: 'meseta', base: 0, milestone: 25, total: 25 },
      { key: 'rareMonster', base: 50, milestone: 25, total: 75 },
      { key: 'hitWeapon', base: 0, milestone: 25, total: 25 },
    ],
  );
});

test('completes only after the final threshold and reward are both available', () => {
  const snapshot = parseOfficialMilestones(officialHtml);
  assert.equal(anniversaryMilestonesAreComplete(snapshot), false);
  assert.equal(
    anniversaryMilestonesAreComplete({ ...snapshot, total: 20000 }),
    false,
  );

  const revealed = {
    ...snapshot,
    total: 20000,
    rewards: snapshot.rewards.map(({ threshold, reward }) => ({
      threshold,
      reward: /^\?(?:\s*\?)*$/.test(reward) ? '+10% Rare Drop Rate' : reward,
    })),
  };
  assert.equal(anniversaryMilestonesAreComplete(revealed), true);
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
  assert.match(updated, /<tr><td>2,000<\/td><td>Meseta 掉落量 \+25%（已解锁）<\/td><\/tr>/);
  assert.match(updated, /<tr><td>3,500<\/td><td>Photon Drop 掉落率 \+10%（已解锁）<\/td><\/tr>/);
  assert.match(updated, /经验值获取率 \+50%（已解锁）/);
  assert.match(updated, /<tr><td>5,500<\/td><td>稀有怪出现率 \+10%<\/td><\/tr>/);
  assert.match(updated, /<tr><td>7,000<\/td><td>周年徽章掉落率 \+25%<\/td><\/tr>/);
  assert.match(updated, /<tr><td>8,000<\/td><td>稀有怪出现率 \+15%<\/td><\/tr>/);
  assert.match(updated, /<tr><td>9,500<\/td><td>普通掉落判定率 \+20%<\/td><\/tr>/);
  assert.match(updated, /<tr><td>10,000<\/td><td>Hit 武器出现率 \+25%<\/td><\/tr>/);
  assert.match(updated, /<em>\+100%<\/em><strong>EXP · 经验值<\/strong>/);
  assert.match(updated, /<em>\+35%<\/em><strong>RDR · 稀有物品掉落率<\/strong>/);
  assert.match(updated, /<em>\+0%<\/em><strong>徽章 · 周年徽章掉落率<\/strong>/);
  assert.match(updated, /<em>\+0%<\/em><strong>Hit · Hit 武器出现率<\/strong>/);
  assert.match(updated, /周年固定 \+25% · 里程碑 \+10%/);
  assert.match(updated, /截至 2026 年 8 月 15 日/);
  assert.match(updated, /<tr><td>Tower<\/td><td>4,730<\/td><\/tr>/);
  assert.match(updated, /<section id="next">keep me<\/section>/);
});

test('updates a page-level timestamp with semantic UTC+8 time to the minute', () => {
  const source = '<page-update-stamp class="milestone-section-update" timestamp="2026-08-15T09:30-07:00"></page-update-stamp>';
  const updated = updatePageTimestamp(source, new Date('2026-08-17T01:00:00-07:00'));
  assert.equal(updated, '<page-update-stamp class="milestone-section-update" timestamp="2026-08-17T16:00+08:00"></page-update-stamp>');
});
