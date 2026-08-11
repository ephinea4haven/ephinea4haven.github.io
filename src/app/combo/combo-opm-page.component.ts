import { ChangeDetectionStrategy, Component } from '@angular/core';
import * as opmData from '../generated/combo/opm-data';
import { ComboComponent, ComboData } from './combo.component';

@Component({
  selector: 'haven-combo-opm-page',
  imports: [ComboComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<haven-combo [data]="data" [isOpm]="true" />',
})
export class ComboOpmPageComponent {
  readonly data = opmData as unknown as ComboData;
}
