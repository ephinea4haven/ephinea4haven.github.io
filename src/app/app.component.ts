import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageBarComponent } from './shared/language-bar.component';

@Component({
  selector: 'haven-tools-app',
  imports: [RouterOutlet, LanguageBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<haven-language-bar /><router-outlet />',
})
export class AppComponent {}
