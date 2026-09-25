import { computed, inject, Injectable } from '@angular/core';
import { LocalizedText, PageLanguage, SiteLanguage } from './site-language.service';

export type { PageLanguage } from './site-language.service';

/** Base for feature dictionaries (catalogs, homepage) that read the URL's language. */
@Injectable()
export class LanguagePreferenceService {
  private readonly site = inject(SiteLanguage);
  readonly language = this.site.language;
  readonly htmlLanguage = computed(() => this.language() === 'zh' ? 'zh-CN' : this.language());
  select(language: PageLanguage): Promise<void> { return this.site.select(language); }
  /** Link to a page in the current language when that page has a version in it. */
  link(path: string): string { return this.site.link(path); }
  /** Build-time text in the current language. */
  localized(text: LocalizedText): string { return text[this.language()]; }
}
