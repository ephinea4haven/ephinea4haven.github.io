import { ChangeDetectionStrategy, Component } from '@angular/core';
import * as multiplayerData from '../generated/combo/multi-data';
import { ComboComponent, ComboData } from './combo.component';

@Component({
  selector: 'haven-combo-multiplayer-page',
  imports: [ComboComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<haven-combo [data]="data" [isOpm]="false" />',
})
export class ComboMultiplayerPageComponent {
  readonly data = multiplayerData as unknown as ComboData;
}
