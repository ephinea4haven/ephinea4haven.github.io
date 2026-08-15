import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOfficialMilestones, updateAnniversaryFragment } from './sync_anniversary_milestones.mjs';

const questNames = ['Forest', 'Cave', 'Mine', 'Ruins', 'Temple', 'Spaceship', 'CCA', 'Seabed', 'Tower', 'Crater', 'Desert'];
const officialHtml = `
<table>
  <tr><td colspan="2">11th Anniversary Event 2026 Milestone Rewards</td></tr>
  <tr><td colspan="2">Server clear points: 4,485</td></tr>
  <tr><td>+10% Rare Drop Rate</td><td>1,000 points needed!</td></tr>
  <tr><td>+25% Meseta Drops</td><td>2,000 points needed!</td></tr>
  <tr><td>+50% Experience Rate (EXP)</td><td>4,000 points needed!</td></tr>
  <tr><td>? ? ?</td><td>4,500 points needed!</td></tr>
</table>
<table>
  <tr><td colspan="2">Per Quest Clear Points</td></tr>
  ${questNames.map((name, index) => `<tr><td>${name}/日本語</td><td>${index === 8 ? '4,485' : '5,000'} points</td></tr>`).join('')}
</table>`;

test('parses the official milestone and quest tables', () => {
  const snapshot = parseOfficialMilestones(officialHtml);
  assert.equal(snapshot.total, 4485);
  assert.deepEqual(snapshot.rewards, [
    { threshold: 1000, reward: '+10% Rare Drop Rate' },
    { threshold: 2000, reward: '+25% Meseta Drops' },
    { threshold: 4000, reward: '+50% Experience Rate (EXP)' },
    { threshold: 4500, reward: '? ? ?' },
  ]);
  assert.deepEqual(snapshot.quests.map(({ name }) => name), questNames);
});

test('updates only the milestone snapshot content', () => {
  const source = `<section id="anniv-2026-milestones">
<p>截至 2026 年 8 月 14 日，服务器点数为 <strong>4,462</strong>，已解锁旧奖励。</p>
<table class="shop-table milestone-table" data-milestone-year="2026"><tbody>
<tr><td>old</td></tr>
</tbody></table>
<table><thead><tr><th>MAE 任务</th><th>当前点数</th></tr></thead><tbody>
<tr><td>old</td></tr>
</tbody></table>
</section>
    <section id="next">keep me</section>`;
  const updated = updateAnniversaryFragment(source, parseOfficialMilestones(officialHtml), new Date('2026-08-14T12:00:00-07:00'));
  assert.match(updated, /服务器点数为 <strong>4,485<\/strong>/);
  assert.match(updated, /<tr><td>1,000<\/td><td>稀有物品掉落率 \+10%（已解锁）<\/td><\/tr>/);
  assert.match(updated, /经验值获取率 \+50%（已解锁）/);
  assert.match(updated, /截至 2026 年 8 月 14 日/);
  assert.match(updated, /<tr><td>Tower<\/td><td>4,485<\/td><\/tr>/);
  assert.match(updated, /<section id="next">keep me<\/section>/);
});
