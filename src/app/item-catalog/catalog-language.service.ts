import { DOCUMENT } from '@angular/common';
import { afterNextRender, afterRenderEffect, computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CatalogItem, categoryLabel, localizedItemName, statusLabel } from './catalog';
import { CatalogLanguage, catalogText, catalogValue } from './catalog-messages';

const validLanguage = (value: string | null): value is CatalogLanguage => value === 'zh' || value === 'en' || value === 'ja';

@Injectable()
export class CatalogLanguageService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly params = toSignal(this.route.queryParamMap, {initialValue: this.route.snapshot.queryParamMap});
  private readonly preference = signal<CatalogLanguage>('zh');
  readonly language = computed<CatalogLanguage>(() => {
    const value = this.params().get('lang');
    return validLanguage(value) ? value : this.preference();
  });
  readonly htmlLanguage = computed(() => this.language() === 'zh' ? 'zh-CN' : this.language());
  constructor() {
    afterNextRender(() => {
      try {
        const value = this.document.defaultView?.localStorage.getItem('haven.catalog.language') ?? null;
        if (validLanguage(value)) this.preference.set(value);
      } catch { /* URL language works even when storage is unavailable. */ }
    });
    afterRenderEffect(() => { this.document.documentElement.lang = this.htmlLanguage(); });
    inject(DestroyRef).onDestroy(() => { this.document.documentElement.lang = 'zh-CN'; });
  }
  async select(language: CatalogLanguage): Promise<void> {
    const changed = await this.router.navigate([], {relativeTo:this.route, queryParams:{lang:language}, queryParamsHandling:'merge', preserveFragment:true, replaceUrl:true});
    if (changed) {
      this.preference.set(language);
      try { this.document.defaultView?.localStorage.setItem('haven.catalog.language', language); } catch { /* Optional preference storage. */ }
    }
  }
  t(text: string): string { return catalogText(text, this.language()); }
  value(value: string): string { return catalogValue(value, this.language()); }
  name(item: CatalogItem | string): string { return localizedItemName(item, this.language()); }
  category(id: string): string { return this.t(categoryLabel(id)); }
  status(status: string): string { return this.t(statusLabel(status)); }
  pageRange(first: number, last: number, total: number): string {
    return this.language() === 'zh' ? `第 ${first}–${last} 件，共 ${total} 件` : this.language() === 'ja' ? `${total} 件中 ${first}–${last} 件` : `${first}–${last} of ${total} items`;
  }
}
