export interface NameTierPolicy {
  minimumUntekkedHit: Readonly<Record<string, number>>;
  topTierItems: Readonly<Record<string, string>>;
  rareItems: readonly string[];
}

/** Acquisition method never promotes a rare item to the curated top tier. */
export function itemNameTier(item: {title: string; rarity: number | null}, policy: NameTierPolicy): 'common' | 'rare' | 'top' {
  if (policy.topTierItems[item.title] || policy.minimumUntekkedHit[item.title] === 0) return 'top';
  if ((item.rarity ?? 0) >= 9 || policy.minimumUntekkedHit[item.title] > 0 || policy.rareItems.includes(item.title)) return 'rare';
  return 'common';
}
