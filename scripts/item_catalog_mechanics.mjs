import { clean } from './item_catalog_model.mjs';

// Only inspect the item's mechanics, before acquisition/reward prose can mention
// other equipment. Require a directional verb for every periodic effect.
export function extractMechanics(source, type) {
  const text = clean(source, true);
  const periodic = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const drain = /HP is drained (while moving )?at a rate of (\d+) HP every (\d+) seconds/i.exec(sentence);
    if (drain) {
      periodic.push({ stat: 'HP', amount: -Number(drain[2]), seconds: +drain[3], moving: !!drain[1] });
      continue;
    }
    const restore = /(?:restores|generates)(?: (?:HP|TP|PB) at a rate of)?\s+(\d+)\s+(HP|TP|PB)\s+every\s+(\d+)\s+seconds/i.exec(sentence)
      || /(?:grants|provides)\s+(HP|TP)(?: and (TP))?\s+regeneration at a rate of (\d+)(?: HP| TP)? every (\d+) seconds/i.exec(sentence);
    if (restore) {
      const direct = /^\d+$/.test(restore[1]);
      const stats = direct ? [restore[2]] : [restore[1], restore[2]].filter(Boolean);
      for (const stat of stats) periodic.push({ stat: stat.toUpperCase(), amount: +(direct ? restore[1] : restore[3]), seconds: +(direct ? restore[3] : restore[4]), moving: false });
    } else if (/generat(?:es|ing)\s+(?:Photon Blast|PB)/i.test(sentence)) {
      const pb = /(?:rate of )?(\d+) (?:point|PB) every (\d+) seconds/i.exec(sentence);
      if (pb) periodic.push({ stat: 'PB', amount: +pb[1], seconds: +pb[2], moving: false });
    } else if (/provides passive HP and TP regeneration/i.test(sentence)) {
      const both = /rate of (\d+) every (\d+) seconds/i.exec(sentence);
      if (both) for (const stat of ['HP', 'TP']) periodic.push({ stat, amount: +both[1], seconds: +both[2], moving: false });
    }
  }
  const battle = type === 'Unit' && (/(?:physical )?attack speed by (\d+)%/i.exec(text)
    || /speed of attacks[^.]{0,100}?by (\d+)%/i.exec(text)
    || /grants the user (\d+)% attack speed/i.exec(text));
  const technique = type === 'Unit' && /increases the level of [^.]{0,100}?techniques by (one|two|three|four|five)/i.exec(text);
  return {
    ...(periodic.length ? { periodic } : {}),
    ...(battle ? { attackSpeed: +battle[1] } : {}),
    ...(technique ? { techniqueLevels: ['one', 'two', 'three', 'four', 'five'].indexOf(technique[1].toLowerCase()) + 1 } : {}),
  };
}
