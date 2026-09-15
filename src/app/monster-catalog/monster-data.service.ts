import { inject, Injectable, InjectionToken, makeStateKey, TransferState } from '@angular/core';
import type { MonsterDetail } from './monster';
import version from '../generated/monster-catalog/version.json';
export const MONSTER_LOADER = new InjectionToken<(id:string)=>Promise<MonsterDetail>>('MONSTER_LOADER', {
  providedIn:'root', factory:() => async id => {
    const response = await fetch(`/assets/data/monsters/${id}.json?v=${version.details}`);
    if (!response.ok) throw new Error(`Monster request failed: ${response.status}`);
    return response.json();
  },
});
@Injectable({providedIn:'root'})
export class MonsterDataService {
  private readonly state = inject(TransferState);
  private readonly loader = inject(MONSTER_LOADER);
  private readonly cache = new Map<string,MonsterDetail>();
  async load(id:string):Promise<MonsterDetail> {
    const key = makeStateKey<MonsterDetail|null>(`monster:${id}`);
    const cached = this.cache.get(id) || this.state.get(key,null);
    if (cached) return cached;
    const detail = await this.loader(id);
    if (detail.id !== id) throw new Error('Monster response identity mismatch');
    this.cache.set(id,detail); this.state.set(key,detail); return detail;
  }
}
