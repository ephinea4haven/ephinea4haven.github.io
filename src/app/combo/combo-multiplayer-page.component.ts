import { ChangeDetectionStrategy, Component } from '@angular/core';
import * as multiplayerData from '../generated/combo/multi-data';
import { ComboComponent } from './combo.component';
import type { ComboData } from './combo.types';

@Component({
  selector: 'haven-combo-multiplayer-page',
  imports: [ComboComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<haven-combo [data]="data" [isOpm]="false" />',
})
export class ComboMultiplayerPageComponent {
  readonly data: ComboData = multiplayerData;
}
