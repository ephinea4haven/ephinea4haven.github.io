import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { activityIsActive, registeredSeasonalActivities, replaceHomeActivities } from './home_activity.mjs';

export const OFFICIAL_MILESTONE_URL = 'https://ephinea.pioneer2.net/11th-anniv-event/';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const anniversaryFragment = path.join(root, 'event', 'anniversary', '2026.html');
const homePage = path.join(root, 'index.html');
const questNames = [
  'Forest', 'Cave', 'Mine', 'Ruins', 'Temple', 'Spaceship',
  'CCA', 'Seabed', 'Tower', 'Crater', 'Desert',
];
const milestoneThresholds = [
  1000, 2000, 3500, 4500, 5500, 7000, 8000, 9500,
  10000, 11500, 12500, 14000, 15000, 16500, 18000, 20000,
];
const anniversaryBoosts = [
  { key: 'dar', acronym: 'DAR', label: '普通掉落判定率', base: 25, pattern: /Drop Anything Rate/i },
  { key: 'rareDrop', acronym: 'RDR', label: '稀有物品掉落率', base: 25, pattern: /Rare Drop Rate/i },
  { key: 'badge', acronym: '徽章', label: '周年徽章掉落率', base: 0, pattern: /(?:Anniversary )?Badge (?:Drop )?Rate/i },
  { key: 'photonDrop', acronym: 'PD', label: 'Photon Drop 掉落率', base: 0, pattern: /Photon Drop Rate/i },
  { key: 'experience', acronym: 'EXP', label: '经验值', rewardLabel: '经验值获取率', base: 50, pattern: /Experience Rate/i },
  { key: 'meseta', acronym: 'Meseta', label: 'Meseta 掉落量', base: 0, pattern: /Meseta Drops/i },
  { key: 'rareMonster', acronym: 'RER', label: '稀有怪出现率', base: 50, pattern: /Rare (?:Monster|Enemy) Rate/i },
  { key: 'hitWeapon', acronym: 'Hit', label: 'Hit 武器出现率', base: 0, pattern: /(?:Weapon )?Hit (?:Weapon )?(?:Drop )?Rate/i },
];

function rewardDetails(reward) {
  if (/^\?(?:\s*\?)*$/.test(reward)) return null;
  const boost = anniversaryBoosts.find(({ pattern }) => pattern.test(reward));
  const rate = reward.match(/([+-]\d+)%/)?.[1];
  if (!boost || !rate) throw new Error(`Unsupported official milestone reward: ${reward}`);
  return { boost, rate: Number.parseInt(rate, 10) };
}

function textContent(node) {
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes || []).map(textContent).join('');
}

function descendants(node, tagName) {
  const matches = [];
  if (node.tagName === tagName) matches.push(node);
  for (const child of node.childNodes || []) matches.push(...descendants(child, tagName));
  return matches;
}

function cells(row) {
  return (row.childNodes || [])
    .filter((node) => node.tagName === 'td' || node.tagName === 'th')
    .map((node) => textContent(node).replace(/\s+/g, ' ').trim());
}

function parseNumber(value, context) {
  const match = value.match(/\b([\d,]+)\b/);
  if (!match) throw new Error(`Missing number in ${context}: ${value}`);
  return Number.parseInt(match[1].replaceAll(',', ''), 10);
}

export function parseOfficialMilestones(html) {
  const document = parse(html);
  const tables = descendants(document, 'table');
  const rewardTable = tables.find((table) => textContent(table).includes('Milestone Rewards'));
  const questTable = tables.find((table) => textContent(table).includes('Per Quest Clear Points'));
  if (!rewardTable || !questTable) throw new Error('Official milestone tables were not found');

  const rewardRows = descendants(rewardTable, 'tr').map(cells);
  const totalRow = rewardRows.find((row) => row.some((cell) => cell.includes('Server clear points')));
  if (!totalRow) throw new Error('Official server clear point total was not found');
  const total = parseNumber(totalRow.join(' '), 'server clear points');

  const rewards = rewardRows
    .filter((row) => row.length === 2 && row[1].includes('points needed'))
    .map(([reward, threshold]) => ({
      threshold: parseNumber(threshold, 'milestone threshold'),
      reward: reward.replace(/^\s+|\s+$/g, ''),
    }));

  const quests = descendants(questTable, 'tr').map(cells)
    .filter((row) => row.length === 2 && row[1].includes('points'))
    .map(([name, points]) => ({
      name: name.split('/', 1)[0].trim(),
      points: parseNumber(points, `${name} points`),
    }));

  if (JSON.stringify(rewards.map(({ threshold }) => threshold)) !== JSON.stringify(milestoneThresholds)) {
    throw new Error(`Unexpected official milestone thresholds: ${rewards.map(({ threshold }) => threshold).join(', ')}`);
  }
  if (JSON.stringify(quests.map(({ name }) => name)) !== JSON.stringify(questNames)) {
    throw new Error(`Unexpected official quest list: ${quests.map(({ name }) => name).join(', ')}`);
  }
  if (total !== Math.min(...quests.map(({ points }) => points))) {
    throw new Error(`Server clear points ${total} do not match the lowest quest total`);
  }
  rewards.forEach(({ reward }) => rewardDetails(reward));
  return { total, rewards, quests };
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function pacificDate(now) {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now);
  const datePart = (type) => dateParts.find((part) => part.type === type)?.value;
  return {
    chinese: `${datePart('year')} 年 ${datePart('month')} 月 ${datePart('day')} 日`,
    compact: `${datePart('month')}.${datePart('day')}`,
    iso: `${datePart('year')}-${datePart('month').padStart(2, '0')}-${datePart('day').padStart(2, '0')}`,
  };
}

function translatedReward(reward) {
  const details = rewardDetails(reward);
  if (!details) return '官方暂未公开';
  const sign = details.rate >= 0 ? '+' : '';
  return `${details.boost.rewardLabel || details.boost.label} ${sign}${details.rate}%`;
}

export function calculateCurrentBoosts(rewards, total) {
  return anniversaryBoosts.map((boost) => {
    const milestone = rewards
      .filter(({ threshold }) => threshold <= total)
      .map(({ reward }) => rewardDetails(reward))
      .filter((details) => details?.boost.key === boost.key)
      .reduce((sum, details) => sum + details.rate, 0);
    return { ...boost, milestone, total: boost.base + milestone };
  });
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function joinChinese(items) {
  if (items.length < 2) return items[0] || '暂无';
  return `${items.slice(0, -1).join('、')} 与${items.at(-1)}`;
}

function replaceExactlyOnce(source, pattern, replacement, context) {
  const matches = source.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
  if (matches?.length !== 1) throw new Error(`Expected one ${context}, found ${matches?.length || 0}`);
  return source.replace(pattern, replacement);
}

export function updateAnniversaryFragment(source, snapshot, now = new Date()) {
  const unlocked = snapshot.rewards
    .filter(({ threshold, reward }) => threshold <= snapshot.total && translatedReward(reward) !== '官方暂未公开')
    .map(({ reward }) => translatedReward(reward));
  const date = pacificDate(now).chinese;
  const summary = `截至 ${date}，服务器点数为 <strong>${formatNumber(snapshot.total)}</strong>，已解锁${joinChinese(unlocked)}。`;
  const boostCards = calculateCurrentBoosts(snapshot.rewards, snapshot.total).map((boost) => {
    const sources = [];
    if (boost.base) sources.push(`周年固定 +${boost.base}%`);
    if (boost.milestone) sources.push(`里程碑 +${boost.milestone}%`);
    if (!sources.length) sources.push('里程碑尚未解锁加成');
    return `            <article class="quest-card"><em>+${boost.total}%</em><strong>${boost.acronym} · ${boost.label}</strong><p>${sources.join(' · ')}</p></article>`;
  }).join('\n');
  const rewardRows = snapshot.rewards.map(({ threshold, reward }) => {
    const label = translatedReward(reward);
    const suffix = threshold <= snapshot.total && label !== '官方暂未公开' ? '（已解锁）' : '';
    return `                <tr><td>${formatNumber(threshold)}</td><td>${escapeHtml(label)}${suffix}</td></tr>`;
  }).join('\n');
  const questRows = snapshot.quests.map(({ name, points }) =>
    `                <tr><td>${name}</td><td>${formatNumber(points)}</td></tr>`).join('\n');

  const sectionStart = source.indexOf('<section id="anniv-2026-milestones"');
  const sectionEnd = source.indexOf('\n    <section ', sectionStart + 1);
  if (sectionStart < 0 || sectionEnd < 0) throw new Error('2026 milestone section was not found');
  let section = source.slice(sectionStart, sectionEnd);
  section = replaceExactlyOnce(
    section,
    /<p>截至 [^<]+<strong>[\d,]+<\/strong>，已解锁[^<]+<\/p>/,
    `<p>${summary}</p>`,
    'milestone summary',
  );
  section = replaceExactlyOnce(
    section,
    /(<div class="quest-cards current-boosts" data-boost-summary-year="2026">)\n[\s\S]*?(\n\s*<\/div>)/,
    `$1\n${boostCards}$2`,
    'current boost summary',
  );
  section = replaceExactlyOnce(
    section,
    /(<table class="shop-table milestone-table" data-milestone-year="2026">[\s\S]*?<tbody>)\n[\s\S]*?(\n\s*<\/tbody>)/,
    `$1\n${rewardRows}$2`,
    'milestone reward table',
  );
  section = replaceExactlyOnce(
    section,
    /(<thead><tr><th>MAE 任务<\/th><th>当前点数<\/th><\/tr><\/thead>\s*<tbody>)\n[\s\S]*?(\n\s*<\/tbody>)/,
    `$1\n${questRows}$2`,
    'quest point table',
  );
  return `${source.slice(0, sectionStart)}${section}${source.slice(sectionEnd)}`;
}

export function updateHomeActivity(source, snapshot, now = new Date()) {
  const nextMilestone = snapshot.rewards.find(({ threshold }) => threshold > snapshot.total);
  const milestone = nextMilestone || snapshot.rewards.at(-1);
  if (!milestone) throw new Error('The anniversary has no milestones');
  const buffs = calculateCurrentBoosts(snapshot.rewards, snapshot.total)
    .filter(({ total }) => total > 0)
    .map(({ acronym, label, total }) => ({ code: acronym, label, value: total }));
  const unlockedMilestones = snapshot.rewards
    .filter(({ threshold, reward }) => threshold <= snapshot.total && translatedReward(reward) !== '官方暂未公开')
    .map(({ threshold, reward }) => ({ threshold, reward: translatedReward(reward) }));
  const activeFrom = '2026-08-12';
  const activeThrough = '2026-09-09';
  const today = pacificDate(now).iso;
  const anniversary = {
    id: 'anniversary-2026',
    status: 'LIVE',
    eyebrow: '全服 Buff · 高增益阶段',
    title: 'Ephinea 2026 十一周年活动',
    description: '完成 MAE 与 August Atrocity，推进全服里程碑；周年徽章、经验、稀有怪与掉落增益现已同时生效。',
    href: '/event/anniversary.html?year=2026',
    secondaryHref: '/event/anniversary.html?year=2026#anniv-2026-milestones',
    secondaryLabel: 'Buff 与里程碑',
    officialHref: 'https://wiki.pioneer2.net/w/Anniversary_event',
    period: '8.12 — 9.09',
    updated: `${pacificDate(now).compact} · 自动同步`,
    activeFrom,
    activeThrough,
    active: false,
    milestone: {
      current: snapshot.total,
      target: milestone.threshold,
      reward: nextMilestone ? translatedReward(nextMilestone.reward) : '全部里程碑奖励已解锁',
    },
    milestoneCount: snapshot.rewards.length,
    unlockedMilestones,
    buffs,
  };
  anniversary.active = activityIsActive(anniversary, today);
  return replaceHomeActivities(source, [...registeredSeasonalActivities(today), anniversary]);
}

async function main() {
  const response = await fetch(OFFICIAL_MILESTONE_URL, {
    headers: { 'user-agent': 'ephinea4haven-milestone-sync/1.0' },
  });
  if (!response.ok) throw new Error(`Official milestone request failed: HTTP ${response.status}`);
  const snapshot = parseOfficialMilestones(await response.text());
  const [current, currentHome] = await Promise.all([
    readFile(anniversaryFragment, 'utf8'),
    readFile(homePage, 'utf8'),
  ]);
  const updated = updateAnniversaryFragment(current, snapshot);
  const updatedHome = updateHomeActivity(currentHome, snapshot);
  await Promise.all([
    updated === current ? null : writeFile(anniversaryFragment, updated),
    updatedHome === currentHome ? null : writeFile(homePage, updatedHome),
  ]);
  const changed = updated !== current || updatedHome !== currentHome;
  console.log(`2026 anniversary milestones: ${formatNumber(snapshot.total)} (${changed ? 'updated' : 'unchanged'})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
