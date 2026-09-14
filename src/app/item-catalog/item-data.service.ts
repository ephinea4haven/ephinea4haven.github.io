import { inject, Injectable, InjectionToken, makeStateKey, TransferState } from '@angular/core';
import { ItemDetail } from './catalog';

export const ITEM_DETAIL_LOADER = new InjectionToken<(id: string) => Promise<ItemDetail>>('ITEM_DETAIL_LOADER', {
  providedIn: 'root',
  factory: () => async id => {
    const response = await fetch(`/assets/data/items/${id}.json`);
    if (!response.ok) throw new Error(`Item request failed: ${response.status}`);
    return response.json();
  },
});
@Injectable({providedIn: 'root'})
export class ItemDataService {
  private readonly transfer = inject(TransferState);
  private readonly loader = inject(ITEM_DETAIL_LOADER);
  private readonly cache = new Map<string, ItemDetail>();
  async load(id: string): Promise<ItemDetail> {
    const key = makeStateKey<ItemDetail | null>(`item:${id}`);
    const cached = this.cache.get(id) || this.transfer.get(key, null);
    if (cached) { this.cache.set(id, cached); return cached; }
    const item = await this.loader(id);
    if (item.id !== id) throw new Error('Item response identity mismatch');
    this.cache.set(id, item);
    this.transfer.set(key, item);
    return item;
  }
}
