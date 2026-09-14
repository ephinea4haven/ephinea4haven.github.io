import rawItems from './catalog.json';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';

export type Category = 'weapon' | 'armor' | 'shield' | 'unit';
export interface CatalogItem {
  id: string; en: string; zh: string; ja?: string; code: string;
  category: Category; rarity: number; classes: string[]; summary: string;
  requirement: string; stats: { label: string; value: string }[];
  weapon?: { atp: number[]; ata: number; grind: number; special: string };
  effects: string[]; availability: string; source: string; checkedAt: string;
  image: string | null; imageSource: string | null; imagePage: string | null; related: string[];
}
export const CATEGORIES = [
  { id: 'all', label: '全部道具', icon: '◈' },
  { id: 'weapon', label: '武器', icon: '⚔' },
  { id: 'armor', label: '铠甲', icon: '◇' },
  { id: 'shield', label: '盾牌', icon: '⬡' },
  { id: 'unit', label: '插件', icon: '▣' },
] as const;
export const CLASSES = ['HUmar', 'HUnewearl', 'HUcast', 'HUcaseal', 'RAmar', 'RAmarl', 'RAcast', 'RAcaseal', 'FOmar', 'FOmarl', 'FOnewm', 'FOnewearl'];
export const ITEMS: readonly CatalogItem[] = rawItems.map((raw) => {
  const name = ITEM_TRANSLATIONS.find(({ en }) => en === raw.en);
  if (!name) throw new Error(`Missing canonical item name: ${raw.en}`);
  return { ...raw, ...name, category: raw.category as Category };
});
export function categoryLabel(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.label ?? '全部道具';
}
export function itemPath(item: CatalogItem): string { return `/data/items/${item.id}.html`; }
export function normalize(value: string): string { return value.normalize('NFKC').toLocaleLowerCase().trim(); }
