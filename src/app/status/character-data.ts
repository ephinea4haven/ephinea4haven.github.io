import { inject, Injectable, InjectionToken } from '@angular/core';
import { ResolveFn } from '@angular/router';
import versions from '../generated/data/versions.json';
import { CharacterData } from './status-domain';

/**
 * Per-class level stats (assets/js/chardata.json), shared by the status
 * simulator and the level-stats table. Fetched as versioned, cacheable data
 * rather than bundled into either page's script; prerendering reads the file
 * directly (app.config.server.ts).
 */
export const CHARACTER_DATA_LOADER = new InjectionToken<() => Promise<CharacterData>>('CHARACTER_DATA_LOADER', {
  providedIn: 'root',
  factory: () => async () => {
    const response = await fetch(`/assets/js/chardata.json?v=${versions.chardata}`);
    if (!response.ok) throw new Error(`Character data request failed: ${response.status}`);
    return response.json();
  },
});

@Injectable({ providedIn: 'root' })
export class CharacterDataService {
  private readonly loader = inject(CHARACTER_DATA_LOADER);
  private data: Promise<CharacterData> | null = null;
  load(): Promise<CharacterData> {
    this.data ??= this.loader().catch((error) => { this.data = null; throw error; });
    return this.data;
  }
}

/** Resolves to null when the data cannot be loaded, so the page can offer a retry. */
export const resolveCharacterData: ResolveFn<CharacterData | null> = async () => {
  try { return await inject(CharacterDataService).load(); }
  catch { return null; }
};
