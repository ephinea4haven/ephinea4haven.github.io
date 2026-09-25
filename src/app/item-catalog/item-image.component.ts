import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { CatalogLanguageService } from './catalog-language.service';
import { ItemCard } from './catalog';

@Component({
  selector: 'item-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item().image && failedUrl() !== item().image) {
      <img [src]="item().image" [alt]="i18n.name(item()) + ' · ' + i18n.t('游戏截图')" width="256" height="192" loading="lazy" (error)="failedUrl.set(item().image)">
    } @else {
      <img src="/assets/img/items/no-image.webp" [alt]="i18n.t(item().image ? '图片加载失败' : '暂无截图')" width="512" height="376" loading="lazy">
      @if (item().image) { <small>{{ i18n.t('图片加载失败') }}</small> }
    }
  `,
  styles: `
    :host { position: relative; display: grid; place-items: center; overflow: hidden; width: 100%; aspect-ratio: 4/3; background: #081322; border: 1px solid #26364a; border-radius: 6px; }
    /* Absolute sizing keeps tall screenshots inside the 4:3 frame instead of stretching the grid row. */
    img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
    small { position: absolute; inset: auto 0 0; background: #081322e6; color: #a0b1c3; font-size: 10px; text-align: center; line-height: 1.4; overflow-wrap: anywhere; padding: 2px 4px; }
  `,
})
export class ItemImageComponent {
  readonly item = input.required<ItemCard>();
  readonly failedUrl = signal<string | null>(null);
  readonly i18n = inject(CatalogLanguageService);
}
