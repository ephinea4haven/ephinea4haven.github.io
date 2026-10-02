import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageBarComponent } from './shared/language-bar.component';
import { SiteSearchComponent } from './search/site-search.component';

@Component({
  selector: 'haven-tools-app',
  imports: [RouterOutlet, LanguageBarComponent, SiteSearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<haven-language-bar /><router-outlet /><haven-site-search />',
})
export class AppComponent {}
