import { DOCUMENT } from '@angular/common';
import { afterNextRender, ApplicationRef, inject, Injectable, Injector } from '@angular/core';
import { Router, Scroll } from '@angular/router';

/** Consume Router history positions after rendering; native anchors honor CSS offsets. */
@Injectable({ providedIn: 'root' })
export class NavigationScroll {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private previousPath = '';

  constructor() {
    const app = inject(ApplicationRef);
    afterNextRender(() => {
      const window = this.document.defaultView!;
      window.history.scrollRestoration = 'manual';
      // Angular suppresses Scroll events during hydration. Restore the initial
      // fragment once lazy page creation and hydration have actually settled.
      void app.whenStable().then(() => {
        this.previousPath = this.router.url.split(/[?#]/)[0];
        const fragment = this.router.parseUrl(this.router.url).fragment;
        if (fragment) this.anchor(fragment);
      });
    });
    this.router.events.subscribe(event => {
      if (!(event instanceof Scroll)) return;
      const url = this.router.url;
      const path = url.split(/[?#]/)[0];
      const changedPage = path !== this.previousPath;
      this.previousPath = path;
      afterNextRender(() => {
        if (this.router.url !== url) return;
        const window = this.document.defaultView!;
        if (event.position) window.scrollTo({ left: event.position[0], top: event.position[1], behavior: 'instant' });
        else if (event.anchor) this.anchor(event.anchor);
        else if (changedPage) {
          let route = this.router.routerState.snapshot.root;
          while (route.firstChild) route = route.firstChild;
          if (route.data['scroll'] !== 'component') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
      }, { injector: this.injector });
    });
  }

  private anchor(id: string): void {
    this.document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}
