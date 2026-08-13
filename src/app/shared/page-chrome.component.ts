import { afterNextRender, booleanAttribute, ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ItemTranslationWidth, ItemTranslationWidthService } from '../i18n/item-translation-width.service';

@Component({
  selector: 'page-chrome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header><h1 id="project_title">{{ title() }}</h1></header>
    @if (itemWidth()) {
      <div class="item-width-switch" role="group" aria-label="中文道具译名字符宽度">
        <span class="item-width-label">中文译名</span>
        <button type="button" [class.active]="width.width() === 'half'"
                [attr.aria-pressed]="width.width() === 'half'" (click)="setWidth('half')">半角</button>
        <button type="button" [class.active]="width.width() === 'full'"
                [attr.aria-pressed]="width.width() === 'full'" (click)="setWidth('full')">全角</button>
      </div>
    }
    <a [href]="backHref()" class="back-link">{{ backText() }}</a>
  `,
})
export class PageChromeComponent {
  readonly width = inject(ItemTranslationWidthService);
  readonly title = input('');
  readonly backHref = input('/index.html', { alias: 'back-href' });
  readonly backText = input('← 返回首页', { alias: 'back-text' });
  readonly itemWidth = input(false, { alias: 'item-width', transform: booleanAttribute });

  constructor() {
    afterNextRender(() => this.width.load());
  }

  setWidth(width: ItemTranslationWidth): void {
    this.width.setWidth(width);
  }
}
