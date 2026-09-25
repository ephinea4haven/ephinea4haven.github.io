import { Directive } from '@angular/core';
import { BrowserContentBehavior } from './browser-content-behavior.directive';

@Directive({ standalone: true })
export class BackToTopBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const button = this.host.querySelector<HTMLElement>('#backToTop');
    if (!button) return;

    const update = () => button.classList.toggle('show', window.scrollY > 300);
    this.listen(window, 'scroll', update);
    this.listen(button, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    update();
  }
}
