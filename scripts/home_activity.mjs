const startMarker = '<!-- current-activity:start -->';
const endMarker = '<!-- current-activity:end -->';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function renderHomeActivity(activity) {
  const milestone = activity.milestone;
  const progress = milestone ? Math.min(100, Math.max(0, milestone.current / milestone.target * 100)) : 0;
  const remaining = milestone ? Math.max(0, milestone.target - milestone.current) : 0;
  const progressValue = milestone ? Math.min(milestone.current, milestone.target) : 0;
  const buffCards = (activity.buffs || []).map((buff) => `
                    <li class="activity-buff">
                        <span>${escapeHtml(buff.code)}</span>
                        <strong>+${escapeHtml(buff.value)}%</strong>
                        <small>${escapeHtml(buff.label)}</small>
                    </li>`).join('');
  const unlockedMilestones = (activity.unlockedMilestones || []).map((unlocked) => `
                    <li>
                        <span>${formatNumber(unlocked.threshold)}</span>
                        <strong>${escapeHtml(unlocked.reward)}</strong>
                    </li>`).join('');
  const highlights = (activity.highlights || []).map((highlight) => `
                    <li>
                        <span>${escapeHtml(highlight.value)}</span>
                        <strong>${escapeHtml(highlight.label)}</strong>
                    </li>`).join('');
  const hidden = activity.active ? '' : ' hidden';
  const titleId = `current-activity-title-${activity.id}`;
  const dashboard = milestone ? `
            <div class="activity-progress-heading">
                <div><span>全服里程碑</span><strong>${formatNumber(milestone.current)}</strong></div>
                <div class="activity-next"><span>下一节点</span><strong>${formatNumber(milestone.target)}</strong></div>
            </div>
            <div class="activity-progress-track" role="progressbar" aria-label="全服里程碑进度" aria-valuemin="0" aria-valuemax="${milestone.target}" aria-valuenow="${progressValue}">
                <span style="--activity-progress: ${progress.toFixed(2)}%"></span>
            </div>
            <div class="activity-progress-note">
                <span>${escapeHtml(milestone.reward)}</span>
                <strong>${remaining ? `还差 ${formatNumber(remaining)} 点` : '全部节点已完成'}</strong>
            </div>
            <div class="activity-unlock-heading"><span>已解锁里程碑</span><strong>${activity.unlockedMilestones.length} / ${activity.milestoneCount}</strong></div>
            <ol class="activity-milestones" aria-label="已解锁里程碑">${unlockedMilestones}
            </ol>
            <div class="activity-buff-heading"><span>当前生效 Buff</span><strong>${activity.buffs.length} 项</strong></div>
            <ul class="activity-buffs" aria-label="当前活动增益">${buffCards}
            </ul>` : `
            <div class="activity-highlight-heading"><span>活动重点</span><strong>${activity.highlights.length} 项</strong></div>
            <ul class="activity-highlights" aria-label="活动重点">${highlights}
            </ul>`;

  return `    <section class="current-activity card" data-current-activity="${escapeHtml(activity.id)}" data-active-from="${escapeHtml(activity.activeFrom)}" data-active-through="${escapeHtml(activity.activeThrough)}" aria-labelledby="${escapeHtml(titleId)}"${hidden}>
        <div class="activity-intro">
            <div class="activity-status"><span>${escapeHtml(activity.status)}</span>${escapeHtml(activity.eyebrow)}</div>
            <h2 id="${escapeHtml(titleId)}">${escapeHtml(activity.title)}</h2>
            <p>${escapeHtml(activity.description)}</p>
            <div class="activity-actions">
                <a class="activity-primary" href="${escapeHtml(activity.href)}">查看活动完整攻略 <span aria-hidden="true">→</span></a>
                <a class="activity-secondary" href="${escapeHtml(activity.secondaryHref)}">${escapeHtml(activity.secondaryLabel || '活动详情')}</a>
                <a class="activity-source" href="${escapeHtml(activity.officialHref)}" target="_blank" rel="noopener noreferrer">官方 Wiki 详情 <span aria-hidden="true">↗</span></a>
            </div>
            <dl class="activity-meta">
                <div><dt>活动时间</dt><dd>${escapeHtml(activity.period)}</dd></div>
                <div><dt>数据更新</dt><dd>${escapeHtml(activity.updated)}</dd></div>
            </dl>
        </div>
        <div class="activity-dashboard">${dashboard}
        </div>
    </section>`;
}

export function replaceHomeActivities(source, activities) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || source.indexOf(startMarker, start + 1) >= 0 || source.indexOf(endMarker, end + 1) >= 0) {
    throw new Error('Expected exactly one current activity region');
  }
  const rendered = activities.map(renderHomeActivity).join('\n');
  return `${source.slice(0, start)}${startMarker}\n${rendered}\n${endMarker}${source.slice(end + endMarker.length)}`;
}

export function activityIsActive(activity, today) {
  return today >= activity.activeFrom && today <= activity.activeThrough;
}

export function registeredSeasonalActivities(today) {
  // Register only officially announced yearly windows; Ephinea has no fixed annual start dates.
  return [
    {
      id: 'valentines-2026', status: 'EVENT', eyebrow: '组队 RDR · Forecast 共享',
      title: 'Ephinea 2026 情人节活动',
      description: '多人组队提升稀有物品掉落率，并在队伍成员之间共享 Daily Forecast。',
      href: '/event/valentines.html?year=2026', secondaryHref: '/event/valentines.html?year=2026',
      officialHref: 'https://wiki.pioneer2.net/w/Valentine%27s_event',
      period: '2.06 — 2.20', updated: '官方活动档案', activeFrom: '2026-02-06', activeThrough: '2026-02-20',
      highlights: [
        { value: '+10%', label: '2 人组队 RDR' }, { value: '+20%', label: '3 人组队 RDR' },
        { value: '+30%', label: '4 人组队 RDR' }, { value: '共享', label: 'Daily Forecast' },
      ],
    },
    {
      id: 'easter-2026', status: 'EVENT', eyebrow: 'Event Egg · RBR Boost',
      title: 'Ephinea 2026 复活节活动',
      description: 'Event Egg 狩猎、Egg Rappy 与三类 Egg Shop 回归，RBR 队伍人数提供额外 Egg Boost。',
      href: '/event/easter.html?year=2026', secondaryHref: '/event/easter.html?year=2026',
      officialHref: 'https://wiki.pioneer2.net/w/Easter_event',
      period: '3.23 — 4.20', updated: '官方活动档案', activeFrom: '2026-03-23', activeThrough: '2026-04-20',
      highlights: [
        { value: '+15%', label: 'RBR 1 人 Egg Boost' }, { value: '+20%', label: 'RBR 2 人 Egg Boost' },
        { value: '+25%', label: 'RBR 3–4 人 Egg Boost' }, { value: '3 NPC', label: 'Egg Shop' },
      ],
    },
    {
      id: 'halloween-2025', status: 'EVENT', eyebrow: 'Cookie · Halloween Quests',
      title: 'Ephinea 2025 万圣节活动',
      description: '分难度 Cookie 掉率、11 个 Halloween Quests 与 Hallo Rappy 奖池全部开放。',
      href: '/event/halloween.html?year=2025', secondaryHref: '/event/halloween.html?year=2025',
      officialHref: 'https://wiki.pioneer2.net/w/Halloween_event',
      period: '10.23 — 11.07', updated: '官方活动档案', activeFrom: '2025-10-23', activeThrough: '2025-11-07',
      highlights: [
        { value: '11', label: 'Halloween Quests' }, { value: '+20%', label: '任务 Cookie Boost' },
        { value: '4 档', label: '分难度 Cookie 掉率' }, { value: '限定', label: 'Hallo Rappy 奖池' },
      ],
    },
    {
      id: 'christmas-2025', status: 'EVENT', eyebrow: 'Present · Christmas Quests',
      title: 'Ephinea 2025 圣诞活动',
      description: 'Christmas Present、活动任务与季节奖池同步开放，覆盖圣诞至新年阶段。',
      href: '/event/christmas.html?year=2025', secondaryHref: '/event/christmas.html?year=2025',
      officialHref: 'https://wiki.pioneer2.net/w/Christmas_event',
      period: '12.14 — 1.11', updated: '官方活动档案', activeFrom: '2025-12-14', activeThrough: '2026-01-11',
      highlights: [
        { value: 'Present', label: '全服季节掉落' }, { value: '15–60', label: 'Variable Hit' },
        { value: 'Quest', label: 'Christmas 活动任务' }, { value: '限定', label: '圣诞奖池' },
      ],
    },
  ].map((activity) => ({ ...activity, active: activityIsActive(activity, today) }));
}
