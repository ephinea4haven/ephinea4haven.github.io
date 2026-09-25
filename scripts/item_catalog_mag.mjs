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

/** Evolution rules of a Mag cell, as localized text ({ text, join, itemName } from the generator). */
export function magCellRules(cell, { text, join, itemName }, idGroups) {
  if (!cell) return [];
  const rules = [];
  for (const [target, condition] of Object.entries(cell.requires)) {
    const needs = [];
    if (condition.requiresMag) needs.push(text('items.cellEquipMag', { mag: itemName(condition.requiresMag) }));
    if (condition.minMagLevel) needs.push(text('items.cellMagLevel', { level: condition.minMagLevel }));
    if (condition.minCharLevel) needs.push(text('items.cellCharacterLevel', { level: condition.minCharLevel }));
    if (condition.requiredStage !== undefined) needs.push(condition.requiredStage === 0 ? text('items.cellInitialForm') : text('items.cellStage', { stage: condition.requiredStage }));
    if (condition.minSynchro) needs.push(text('items.cellSynchro', { value: condition.minSynchro }));
    if (condition.minIQ) needs.push(text('items.cellIq', { value: condition.minIQ }));
    if (condition.statThreshold) {
      const { count, value } = condition.statThreshold;
      needs.push(count === 'all' ? text('items.cellAllStats', { value }) : text('items.cellSomeStats', { count, value }));
    }
    if (condition.race) needs.push(text('items.cellSectionId', { ids: idGroups[condition.race].join(' / ') }));
    rules.push(text('items.cellEvolvesTo', { target: itemName(target), needs: join(needs, 'items.cellNeedsSeparator') }));
  }
  if (cell.raceRule?.deny?.includes('Android')) rules.push(text('items.cellNoAndroid'));
  if (cell.raceRule?.only?.includes('Android')) rules.push(text('items.cellAndroidOnly'));
  return rules;
}
