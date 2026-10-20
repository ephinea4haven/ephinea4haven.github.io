import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PAGE_LANGUAGES, PageLanguage, pageKey, SiteLanguage } from './site-language.service';

const SHORT: Record<PageLanguage, string> = { zh: '中', en: 'EN', ja: '日' };
/** Accessible names start with the visible short label (WCAG 2.5.3 Label in Name). */
const LABEL: Record<PageLanguage, string> = { zh: '中文', en: 'EN (English)', ja: '日本語' };
/** Pages that render their own language switcher (homepage and catalogs). */
const OWN_SWITCHER = ['index.html', 'data/items.html', 'data/items/', 'data/cosmetics.html', 'data/enemies.html', 'data/enemies/', 'data/ep3-cards.html', 'data/ep3-cards/'];

/** Site-wide language switch. Each language is a separate URL. */
@Component({
  selector: 'haven-language-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[hidden]': 'hidden()' },
  template: `
    <div class="bar">
      <div role="group" aria-label="语言 / Language / 言語">
        @for (option of languages; track option) {
          <button type="button" [lang]="option" [attr.aria-label]="label[option]"
            [attr.aria-pressed]="site.language() === option" (click)="site.select(option)">{{ short[option] }}</button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    :host([hidden]) { display: none; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; max-width: 1200px; margin: 0 auto; padding: 10px 16px 0; }
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
  protected readonly label = LABEL;

  protected readonly hidden = computed(() => {
    const key = pageKey(this.site.path());
    return OWN_SWITCHER.some((candidate) => candidate.endsWith('/') ? key.startsWith(candidate) : key === candidate);
  });
}
