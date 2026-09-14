import { DOCUMENT } from '@angular/common';
import { afterNextRender, afterRenderEffect, computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

export type PageLanguage = 'zh' | 'en' | 'ja';
const valid = (value: string | null): value is PageLanguage => value === 'zh' || value === 'en' || value === 'ja';
@Injectable()
export class LanguagePreferenceService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly params = toSignal(this.route.queryParamMap, {initialValue:this.route.snapshot.queryParamMap});
  private readonly preference = signal<PageLanguage>('zh');
  readonly language = computed<PageLanguage>(() => {const value = this.params().get('lang'); return valid(value) ? value : this.preference();});
  readonly htmlLanguage = computed(() => this.language() === 'zh' ? 'zh-CN' : this.language());
  constructor() {
    afterNextRender(() => {try {const value = this.document.defaultView?.localStorage.getItem('haven.catalog.language') ?? null; if (valid(value)) this.preference.set(value);} catch { /* Optional preference storage. */ }});
    afterRenderEffect(() => {this.document.documentElement.lang = this.htmlLanguage();});
    inject(DestroyRef).onDestroy(() => {this.document.documentElement.lang = 'zh-CN';});
  }
  async select(language: PageLanguage): Promise<void> {
    if (await this.router.navigate([], {relativeTo:this.route, queryParams:{lang:language}, queryParamsHandling:'merge', preserveFragment:true, replaceUrl:true})) {
      this.preference.set(language);
      try {this.document.defaultView?.localStorage.setItem('haven.catalog.language',language);} catch { /* Optional preference storage. */ }
    }
  }
}
