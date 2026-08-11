import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';
import { initializeRbr } from './rbr.runtime.js';

@Directive({ standalone: true })
export class RbrBehavior {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterNextRender(() => initializeRbr(this.host));
  }
}
