import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, PLATFORM_ID, inject } from '@angular/core';
import { MAG_EVOLUTION, MAG_SIMULATION } from '../generated/data/mag-data';
import { BackToTopBehavior } from '../content/content-behaviors.directive';
import { initializeMag } from './mag.runtime.js';

@Directive({ standalone: true, hostDirectives: [BackToTopBehavior] })
export class MagBehavior implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly platformId = inject(PLATFORM_ID);

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) initializeMag(this.host, MAG_EVOLUTION, MAG_SIMULATION);
  }
}
