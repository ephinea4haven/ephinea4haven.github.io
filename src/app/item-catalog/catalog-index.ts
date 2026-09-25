import { inject, Injectable, InjectionToken } from '@angular/core';
import { ResolveFn } from '@angular/router';
import types from '../generated/item-catalog/types.json';
import version from '../generated/item-catalog/version.json';
import { CatalogItem, Category, classesOf } from './catalog';

/**
 * The full searchable index, used only by the item list. It is fetched as a
 * versioned, cacheable JSON file rather than bundled into the list's script;
 * prerendering reads the generated file directly (app.config.server.ts). It is
 * deliberately not transferred through the page HTML.
 */
export type IndexRow = [string, string, keyof typeof types, number | null, string, string, [string, string][], string | null, string | null, string, string, number | null, string, string];

export const ITEM_INDEX_LOADER = new InjectionToken<() => Promise<IndexRow[]>>('ITEM_INDEX_LOADER', {
  providedIn: 'root',
  factory: () => async () => {
    const response = await fetch(`/assets/data/item-index.json?v=${version.index}`);
    if (!response.ok) throw new Error(`Item index request failed: ${response.status}`);
    return response.json();
  },
});

export function catalogItems(rows: IndexRow[]): CatalogItem[] {
  return rows.map(([id, en, type, rarity, mask, requirement, stats, image, code, status, alias, atpMax, ja, zh]) => ({
    id, en, title: alias || en, zh, ja: ja || undefined,
    type, subtype: types[type][1], category: types[type][0] as Category,
    rarity, mask, classes: classesOf(mask), requirement,
    stats: stats.map(([label, value]) => ({ label, value })), image, code, status, atpMax,
  }));
}

@Injectable({ providedIn: 'root' })
export class ItemIndexService {
  private readonly loader = inject(ITEM_INDEX_LOADER);
  private items: Promise<readonly CatalogItem[]> | null = null;
  load(): Promise<readonly CatalogItem[]> {
    this.items ??= this.loader().then(catalogItems).catch((error) => { this.items = null; throw error; });
    return this.items;
  }
}

export interface IndexResult { items: readonly CatalogItem[]; failed: boolean }
export const resolveItemIndex: ResolveFn<IndexResult> = async () => {
  try { return { items: await inject(ItemIndexService).load(), failed: false }; }
  catch { return { items: [], failed: true }; }
};
