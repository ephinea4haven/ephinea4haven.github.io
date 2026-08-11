import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

@Directive()
export abstract class BrowserContentBehavior {
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.connect());
  }

  protected abstract connect(): void;

  protected listen(
    target: EventTarget,
    event: string,
    listener: EventListener,
  ): void {
    target.addEventListener(event, listener);
    this.destroyRef.onDestroy(() => target.removeEventListener(event, listener));
  }
}
