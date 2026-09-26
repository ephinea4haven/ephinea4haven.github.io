/* Catalog types and helpers. Data-free: the item list loads the full index
 * (catalog-index.ts); detail and cosmetics pages carry only the items they show. */

import type { LocalizedText } from '../shared/site-language.service';

export type Category = 'weapon' | 'armor' | 'shield' | 'unit' | 'mag' | 'tool';
export interface Stat { label: string; value: string }
/** What a card or link needs to show an item. */
export interface ItemCard { id: string; en: string; zh: string; ja?: string; image: string | null }
/** A referenced item name, localized by the build. */
export interface ItemName { en: string; zh: string; ja?: string }
export interface CatalogItem extends ItemCard {
  title: string;
  category: Category; type: string; subtype: string; rarity: number | null;
  /** The list subcategory: the weapon series (ES, TypeM) when the Wiki lists one, otherwise the subtype. */
  group: string;
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
export interface ItemDetail extends Omit<CatalogItem, 'classes' | 'group'> {
  hdImage: string | null;
  hdSource: 'gallery' | 'model-render' | null;
  id: string; en: string; title: string; summary: LocalizedText; stats: Stat[]; effects: LocalizedText[];
  boosts: Stat[]; sets: { item: string; id: string | null; effect: string }[];
  skins: { item: string; id: string | null; code: string }[];
  cosmetic: Cosmetic | null; cosmetics: { item: ItemLink; kind: Cosmetic['kind']; skin: ItemLink | null; color: string | null }[];
  feeding: { item: string; values: number[] }[];
  drops: { kind: string; sectionId: string; difficulty: string; location: string; area: string; rate: string }[];
  availability: LocalizedText; source: string; revision: number; checkedAt: string;
  excerpts: string[]; imageOrigin: 'wiki' | 'itemkt' | null; imageSource: string | null; imagePage: string | null; related: string[];
  relatedItems: ItemCard[];
  /** Localized names for the item names this page references (sets, skins, feeding, links). */
  names: Record<string, ItemName>;
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
export function categoryLabel(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.label ?? '武器';
}
export function itemPath(item: Pick<CatalogItem, 'id'>): string { return `/data/items/${item.id}.html`; }
export function normalize(value: string): string { return value.normalize('NFKC').toLocaleLowerCase().trim(); }
export function classesOf(mask: string): string[] { return CLASSES.filter((_, i) => mask[i] === '1'); }
export function localizedItemName(value: ItemName | string, language: 'zh' | 'en' | 'ja', names: Readonly<Record<string, ItemName>> = {}): string {
  const item = typeof value === 'string' ? names[value] : value;
  if (!item) return value as string;
  return language === 'zh' ? item.zh : language === 'ja' ? item.ja || item.en : item.en;
}
export function statusLabel(status: string): string { return ({obsolete: '历史道具', unavailable: '当前无法获取'} as Record<string,string>)[status] || ''; }
