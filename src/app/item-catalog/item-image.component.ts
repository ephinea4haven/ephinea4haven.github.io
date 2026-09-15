import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { CatalogLanguageService } from './catalog-language.service';
import { CatalogItem } from './catalog';

@Component({
  selector: 'item-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item().image && failedUrl() !== item().image) {
      <img [src]="item().image" [alt]="i18n.name(item()) + ' · ' + i18n.t('游戏截图')" width="256" height="192" loading="lazy" (error)="failedUrl.set(item().image)">
    } @else {
      <span class="placeholder"><span aria-hidden="true">{{ item().category === 'weapon' ? '⚔' : '◇' }}</span><small>{{ i18n.t(item().image ? '图片加载失败' : '暂无截图') }}</small></span>
    }
  `,
  styles: `
    :host { position: relative; display: grid; place-items: center; container-type: inline-size; overflow: hidden; width: 100%; aspect-ratio: 4/3; background: #081322; border: 1px solid #26364a; border-radius: 6px; }
    /* Absolute sizing keeps tall screenshots inside the 4:3 frame instead of stretching the grid row. */
    img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
    .placeholder { display: grid; place-items: center; gap: 5px; color: #a0b1c3; }
    .placeholder > span { font-size: 25px; color: #6f8ca3; }
    small { font-size: 10px; text-align: center; line-height: 1.4; overflow-wrap: anywhere; padding: 0 4px; }
    @container (max-width: 100px) { .placeholder > span { display: none; } }
  `,
})
export class ItemImageComponent {
  readonly item = input.required<CatalogItem>();
  readonly failedUrl = signal<string | null>(null);
  readonly i18n = inject(CatalogLanguageService);
}
