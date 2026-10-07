import { inject, Injectable, InjectionToken, makeStateKey, TransferState } from '@angular/core';
import type { CardDetail } from './card';
import version from '../generated/ep3-card-catalog/version.json';
export const EP3_CARD_LOADER = new InjectionToken<(id:string)=>Promise<CardDetail>>('EP3_CARD_LOADER', {
  providedIn:'root', factory:() => async id => {
    const response=await fetch(`/assets/data/ep3-cards/${id}.json?v=${version.details}`);
    if (!response.ok) throw new Error(`Card request failed: ${response.status}`);
    return response.json();
  },
});
@Injectable({providedIn:'root'})
export class Ep3CardDataService {
  private readonly state=inject(TransferState);
  private readonly loader=inject(EP3_CARD_LOADER);
  private readonly cache=new Map<string,CardDetail>();
  async load(id:string):Promise<CardDetail> {
    const key=makeStateKey<CardDetail|null>(`ep3-card:${id}`);
    const cached=this.cache.get(id) || this.state.get(key,null);
    if (cached) return cached;
    const detail=await this.loader(id);
    if (String(detail.id)!==id) throw new Error('Card response identity mismatch');
    this.cache.set(id,detail); this.state.set(key,detail); return detail;
  }
}
