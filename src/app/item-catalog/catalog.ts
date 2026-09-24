import rawIndex from '../generated/item-catalog/index.json';
import types from '../generated/item-catalog/types.json';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';

export type Category = 'weapon' | 'armor' | 'shield' | 'unit' | 'mag' | 'tool';
export interface Stat { label: string; value: string }
export interface CatalogItem {
  id: string; en: string; zh: string; ja?: string; title: string;
  category: Category; type: string; subtype: string; rarity: number | null;
  mask: string; classes: string[]; requirement: string; stats: Stat[];
  image: string | null; code: string | null; status: string; atpMax: number | null;
}
export interface ItemLink { item: string; id: string }
export interface Cosmetic {
  kind: 'heart' | 'paint' | 'plating'; item: ItemLink; targets: ItemLink[]; skin: ItemLink | null; color: string | null; reverts?: boolean;
  photonFilter: { color: string; weapons: ItemLink[] } | null;
  trade: (ItemLink & { quantity: number })[];
}
export const COSMETICS_PATH = '/data/cosmetics.html';
export interface ItemDetail {
  hdImage: string | null;
  hdSource: 'gallery' | 'model-render' | null;
  id: string; en: string; title: string; summary: string; stats: Stat[]; effects: string[];
  boosts: Stat[]; sets: { item: string; id: string | null; effect: string }[];
  skins: { item: string; id: string | null; code: string }[];
  cosmetic: Cosmetic | null; cosmetics: { item: ItemLink; kind: Cosmetic['kind']; skin: ItemLink | null; color: string | null }[];
  feeding: { item: string; values: number[] }[];
  drops: { kind: string; sectionId: string; difficulty: string; location: string; area: string; rate: string }[];
  availability: string; source: string; revision: number; checkedAt: string;
  excerpts: string[]; imageSource: string | null; imagePage: string | null; related: string[];
}
export const CATEGORIES = [
  { id: 'weapon', label: '武器', icon: '⚔' },
  { id: 'armor', label: '铠甲', icon: '◇' },
  { id: 'shield', label: '盾牌', icon: '⬡' },
  { id: 'unit', label: '插件', icon: '▣' },
  { id: 'mag', label: '玛古', icon: '◉' },
  { id: 'tool', label: '其他道具', icon: '▧' },
] as const;
export const CLASSES = ['HUmar', 'HUnewearl', 'HUcast', 'HUcaseal', 'RAmar', 'RAmarl', 'RAcast', 'RAcaseal', 'FOmar', 'FOmarl', 'FOnewm', 'FOnewearl'];
const names = new Map(ITEM_TRANSLATIONS.map(item => [item.en, item]));
type IndexRow = [string, string, keyof typeof types, number | null, string, string, [string,string][], string | null, string | null, string, string, number | null, string];
export const ITEMS: readonly CatalogItem[] = (rawIndex as IndexRow[]).map(([id, en, type, rarity, mask, requirement, stats, image, code, status, alias, atpMax, ja]) => ({
  id, en, title: alias || en, zh: names.get(en)?.zh || en, ja: names.get(en)?.ja || ja,
  type, subtype: types[type][1], category: types[type][0] as Category,
  rarity, mask, classes: CLASSES.filter((_, i) => mask[i] === '1'), requirement,
  stats: stats.map(([label,value]) => ({label,value})), image, code, status, atpMax,
}));
export const ITEM_BY_ID = new Map(ITEMS.map(item => [item.id, item]));
export function categoryLabel(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.label ?? '武器';
}
export function itemPath(item: Pick<CatalogItem, 'id'>): string { return `/data/items/${item.id}.html`; }
export function normalize(value: string): string { return value.normalize('NFKC').toLocaleLowerCase().trim(); }
export function localizedItemName(value: CatalogItem | string, language: 'zh' | 'en' | 'ja'): string {
  const item = typeof value === 'string' ? ITEMS.find(i => i.en === value || i.title === value) || names.get(value) : value;
  if (!item) return value as string;
  return language === 'zh' ? item.zh : language === 'ja' ? item.ja || item.en : item.en;
}
export function statusLabel(status: string): string { return ({obsolete: '历史道具', unavailable: '当前无法获取'} as Record<string,string>)[status] || ''; }
