import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CatalogLanguageService } from './catalog-language.service';

@Component({
  selector: 'catalog-language',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="language-control" role="group" aria-label="语言 / Language / 言語">
    @for (option of options; track option.id) {
      <button type="button" [lang]="option.id" [attr.aria-label]="option.label" [attr.aria-pressed]="i18n.language() === option.id" (click)="i18n.select(option.id)">{{ option.short }}</button>
    }
  </div>`,
  styles: `
    .language-control { display:flex; padding:3px; gap:3px; border:1px solid #4b697c; border-radius:7px; background:#0b1b2c; }
    button { min-width:40px; min-height:34px; border:0; border-radius:4px; padding:6px 10px; color:#c1d1df; background:transparent; font:inherit; font-size:12px; cursor:pointer; }
    button[aria-pressed=true] { color:#061d24; background:#9aedde; font-weight:700; box-shadow:0 0 14px #6fe8d52b; }
    button:hover:not([aria-pressed=true]) { color:#fff; background:#2b4659; }
    button:focus-visible { outline:2px solid #b7fff0; outline-offset:3px; }
  `,
})
export class CatalogLanguageComponent {
  readonly i18n = inject(CatalogLanguageService);
  readonly options = [{id:'zh',label:'中文',short:'中'},{id:'en',label:'English',short:'EN'},{id:'ja',label:'日本語',short:'日'}] as const;
}
