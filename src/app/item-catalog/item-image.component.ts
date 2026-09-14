import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { CatalogItem, categoryLabel } from './catalog';

@Component({
  selector: 'item-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item().image && failedUrl() !== item().image) {
      <img [src]="item().image" [alt]="item().zh + '游戏截图'" width="256" height="192" loading="lazy" (error)="failedUrl.set(item().image)">
    } @else {
      <span class="placeholder"><span aria-hidden="true">{{ item().category === 'weapon' ? '⚔' : '◇' }}</span><small>{{ categoryLabel(item().category) }} · 暂无截图</small></span>
    }
  `,
  styles: `
    :host { display: grid; place-items: center; overflow: hidden; width: 100%; aspect-ratio: 4/3; background: #081322; border: 1px solid #26364a; border-radius: 6px; }
    img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .placeholder { display: grid; place-items: center; gap: 5px; color: #a0b1c3; }
    .placeholder > span { font-size: 25px; color: #6f8ca3; }
    small { font-size: 10px; white-space: nowrap; }
  `,
})
export class ItemImageComponent {
  readonly item = input.required<CatalogItem>();
  readonly failedUrl = signal<string | null>(null);
  readonly categoryLabel = categoryLabel;
}
