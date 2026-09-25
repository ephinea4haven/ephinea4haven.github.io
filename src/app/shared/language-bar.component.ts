import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PAGE_LANGUAGES, PageLanguage, pageKey, SiteLanguage } from './site-language.service';

const SHORT: Record<PageLanguage, string> = { zh: '中', en: 'EN', ja: '日' };
/** Pages that render their own language switcher (homepage and catalogs). */
const OWN_SWITCHER = ['index.html', 'data/items.html', 'data/items/', 'data/cosmetics.html', 'data/enemies.html', 'data/enemies/'];
/** A language's name written in another language, e.g. "Chinese" or "中国語". */
const nameIn = (reader: PageLanguage, language: PageLanguage) =>
  new Intl.DisplayNames([reader], { type: 'language' }).of(language) ?? language;

/**
 * Site-wide language switch. Each language is a separate URL; when the reader
 * chooses a language this page is not written in, it says so in that language.
 */
@Component({
  selector: 'haven-language-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[hidden]': 'hidden()' },
  template: `
    <div class="bar">
      @if (notice(); as text) {
        <p [lang]="site.missing()" role="status">{{ text }}</p>
      }
      <div role="group" aria-label="语言 / Language / 言語">
        @for (option of languages; track option) {
          <button type="button" [lang]="option" [attr.aria-label]="nameIn(option, option)"
            [attr.aria-pressed]="site.language() === option" (click)="site.select(option)">{{ short[option] }}</button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    :host([hidden]) { display: none; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; max-width: 1200px; margin: 0 auto; padding: 10px 16px 0; }
    p { margin: 0; padding: 5px 12px; font-size: 13px; color: #fde68a; border: 1px solid #fbbf2466; border-radius: 8px; background: #fbbf2414; }
    [role=group] { display: flex; gap: 3px; padding: 3px; border: 1px solid #00d4ff4d; border-radius: 99px; background: #081937b8; }
    button { min-width: 40px; min-height: 30px; padding: 4px 10px; border: 0; border-radius: 99px; color: #94a3b8; background: none; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
    button[aria-pressed=true] { color: #06152b; background: linear-gradient(135deg, #00d4ff, #00a0ff); }
    button:hover:not([aria-pressed=true]) { color: #e2e8f0; background: #00d4ff1f; }
    button:focus-visible { outline: 2px solid #00d4ff; outline-offset: 2px; }
  `,
})
export class LanguageBarComponent {
  protected readonly site = inject(SiteLanguage);
  protected readonly languages = PAGE_LANGUAGES;
  protected readonly short = SHORT;
  protected readonly nameIn = nameIn;

  protected readonly hidden = computed(() => {
    const key = pageKey(this.site.path());
    return OWN_SWITCHER.some((candidate) => candidate.endsWith('/') ? key.startsWith(candidate) : key === candidate);
  });

  protected readonly notice = computed(() => {
    const reader = this.site.missing();
    if (!reader) return '';
    const names = new Intl.ListFormat([reader], { type: 'conjunction' }).format(this.site.available().map((language) => nameIn(reader, language)));
    return {
      zh: `本页目前只有${names}版。`,
      en: `This page is currently available in ${names} only.`,
      ja: `このページは現在、${names}版のみです。`,
    }[reader];
  });
}
