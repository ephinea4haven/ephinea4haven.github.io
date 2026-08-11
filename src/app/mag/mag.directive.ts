import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';
import { MAG_EVOLUTION, MAG_SIMULATION } from '../generated/data/mag-data';
import { BackToTopBehavior } from '../content/content-behaviors.directive';
import { initializeMag } from './mag.runtime.js';

@Directive({ standalone: true, hostDirectives: [BackToTopBehavior] })
export class MagBehavior {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterNextRender(() => initializeMag(this.host, MAG_EVOLUTION, MAG_SIMULATION));
  }
}
