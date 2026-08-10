import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Directive, ElementRef, PLATFORM_ID, inject } from '@angular/core';
import { initializeRbr } from './rbr.runtime.js';

@Directive({ standalone: true })
export class RbrBehavior implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly platformId = inject(PLATFORM_ID);

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) initializeRbr(this.host);
  }
}
