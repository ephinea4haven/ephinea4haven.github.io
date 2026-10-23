import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SiteLanguage } from './site-language.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'page-chrome',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header><h1 id="project_title">{{ title() }}</h1></header>
    <a [routerLink]="backLink()" class="back-link">{{ backText() }}</a>
  `,
})
export class PageChromeComponent {
  readonly title = input('');
  readonly backHref = input('/', { alias: 'back-href' });
  /** Set at build time from the page's language (common.backHome) unless the page gives its own. */
  readonly backText = input.required<string>({ alias: 'back-text' });
  private readonly site = inject(SiteLanguage);
  /** The back link opens the current language's version when it exists. */
  protected readonly backLink = computed(() => this.site.link(this.backHref()));
}
