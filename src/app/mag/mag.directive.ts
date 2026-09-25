import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';
import { MAG_EVOLUTION, MAG_FEEDING } from '../generated/data/mag-data';
import { BackToTopBehavior } from '../content/back-to-top.directive';
import { SiteLanguage } from '../shared/site-language.service';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';
import { initializeMag } from './mag.runtime.js';

@Directive({ standalone: true, hostDirectives: [BackToTopBehavior] })
export class MagBehavior {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly language = inject(SiteLanguage);

  constructor() {
    afterNextRender(() => initializeMag(this.host, MAG_EVOLUTION, MAG_FEEDING, this.language.language(), ITEM_TRANSLATIONS));
  }
}
