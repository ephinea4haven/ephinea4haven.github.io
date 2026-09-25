import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';
import { SiteLanguage } from '../shared/site-language.service';
import { initializeRbr } from './rbr.runtime.js';

@Directive({ standalone: true })
export class RbrBehavior {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly site = inject(SiteLanguage);

  constructor() {
    afterNextRender(() => initializeRbr(this.host, this.site.language()));
  }
}
