import { ChangeDetectionStrategy, Component } from '@angular/core';
import * as opmData from '../generated/combo/opm-data';
import { ComboComponent } from './combo.component';
import type { ComboData } from './combo.types';

@Component({
  selector: 'haven-combo-opm-page',
  imports: [ComboComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<haven-combo [data]="data" [isOpm]="true" />',
})
export class ComboOpmPageComponent {
  readonly data: ComboData = opmData;
}
