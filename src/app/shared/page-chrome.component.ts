import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'page-chrome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header><h1 id="project_title">{{ title() }}</h1></header>
    <a [href]="backHref()" class="back-link">{{ backText() }}</a>
  `,
})
export class PageChromeComponent {
  readonly title = input('');
  readonly backHref = input('/index.html', { alias: 'back-href' });
  readonly backText = input('← 返回首页', { alias: 'back-text' });
}
