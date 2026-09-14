export function collectMagTriggers(data) {
  const result = new Map();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.name && value.triggers) result.set(value.name, value.triggers);
    for (const child of Object.values(value)) visit(child);
  };
  visit(data.classes);
  return result;
}

export function magCellRules(cell, display, idGroups) {
  if (!cell) return [];
  const rules = [];
  for (const [target, condition] of Object.entries(cell.requires)) {
    const needs = [];
    if (condition.requiresMag) needs.push(`装备 ${display(condition.requiresMag)}`);
    if (condition.minMagLevel) needs.push(`玛古等级 ≥ ${condition.minMagLevel}`);
    if (condition.minCharLevel) needs.push(`角色等级 ≥ ${condition.minCharLevel}`);
    if (condition.requiredStage !== undefined) needs.push(condition.requiredStage === 0 ? '初始形态玛古' : `第 ${condition.requiredStage} 阶段玛古`);
    if (condition.minSynchro) needs.push(`同步率 ≥ ${condition.minSynchro}%`);
    if (condition.minIQ) needs.push(`IQ ≥ ${condition.minIQ}`);
    if (condition.statThreshold) needs.push(`${condition.statThreshold.count === 'all' ? '全部四项' : condition.statThreshold.count + ' 项'}属性 ≥ ${condition.statThreshold.value}`);
    if (condition.race) needs.push(`Section ID：${idGroups[condition.race].join(' / ')}`);
    rules.push(`进化为 ${display(target)}：${needs.join('，')}。`);
  }
  if (cell.raceRule?.deny?.includes('Android')) rules.push('机器人角色不能使用此进化道具。');
  if (cell.raceRule?.only?.includes('Android')) rules.push('仅机器人角色能使用此进化道具。');
  return rules;
}
