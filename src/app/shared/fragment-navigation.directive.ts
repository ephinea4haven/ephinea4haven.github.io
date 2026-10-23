import { Directive, ElementRef, inject } from '@angular/core';
import { Router } from '@angular/router';

/** Fetched document fragments are inert HTML, not Angular templates. */
@Directive({ standalone: true, host: { '(click)': 'navigate($event)' } })
export class FragmentNavigationDirective {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected navigate(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || !this.host.contains(link) || !link.closest('[data-router-fragment]')
      || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('/')) return;
    event.preventDefault();
    void this.router.navigateByUrl(`${url.pathname}${url.search}${url.hash}`);
  }
}
