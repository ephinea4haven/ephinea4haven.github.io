import { Directive } from '@angular/core';
import { BrowserContentBehavior } from './browser-content-behavior.directive';

/** Shared navigation and vector-map inspection for the two challenge guides. */
@Directive({ standalone: true })
export class ChallengeGuideBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const navigation = this.host.querySelector<HTMLElement>('.challenge-stage-nav');
    const sections = [...this.host.querySelectorAll<HTMLElement>('.challenge-stage')];
    if (navigation && sections.length) {
      const links = [...navigation.querySelectorAll<HTMLAnchorElement>('a')];
      let scheduled = 0;
      let selected: HTMLAnchorElement | undefined;
      const update = () => {
        scheduled = 0;
        const boundary = navigation.getBoundingClientRect().bottom + 40;
        const current = sections.filter(section => section.getBoundingClientRect().top <= boundary).at(-1);
        for (const link of links) {
          const active = current ? link.dataset['stageLink'] === current.id : !link.dataset['stageLink'];
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
          if (active && selected !== link) {
            selected = link;
            const tab = link.getBoundingClientRect();
            const rail = navigation.getBoundingClientRect();
            if (tab.left < rail.left) navigation.scrollLeft += tab.left - rail.left;
            else if (tab.right > rail.right) navigation.scrollLeft += tab.right - rail.right;
          }
        }
      };
      this.listen(window, 'scroll', () => { if (!scheduled) scheduled = requestAnimationFrame(update); });
      this.listen(window, 'resize', update);
      this.destroyRef.onDestroy(() => cancelAnimationFrame(scheduled));
      update();
    }

    const dialog = this.host.querySelector<HTMLDialogElement>('.challenge-viewer');
    const canvas = dialog?.querySelector<HTMLElement>('.challenge-viewer-canvas');
    const image = canvas?.querySelector<HTMLImageElement>('img');
    const title = dialog?.querySelector<HTMLElement>('#map-viewer-title');
    if (!dialog || !canvas || !image || !title) return;
    const zoomButtons = [...dialog.querySelectorAll<HTMLButtonElement>('[data-map-zoom]')];
    let width = 0;
    let trigger: HTMLButtonElement | null = null;
    let previousOverflow = '';
    const resize = (next: number) => {
      const viewport = canvas.getBoundingClientRect();
      const before = image.getBoundingClientRect();
      const centerX = viewport.left + canvas.clientWidth / 2;
      const centerY = viewport.top + canvas.clientHeight / 2;
      const anchorX = before.width ? (centerX - before.left) / before.width : 0;
      const anchorY = before.height ? (centerY - before.top) / before.height : 0;
      width = next;
      image.style.width = width ? `${width}px` : '100%';
      if (before.width && before.height) {
        const after = image.getBoundingClientRect();
        canvas.scrollLeft += after.left + anchorX * after.width - centerX;
        canvas.scrollTop += after.top + anchorY * after.height - centerY;
      }
      for (const button of zoomButtons) {
        button.disabled = button.dataset['mapZoom'] === 'in' ? width >= 2400
          : button.dataset['mapZoom'] === 'out' && width === 0;
      }
    };
    this.listen(this.host, 'click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const figure = target?.closest<HTMLElement>('.challenge-map');
      if (!figure || (!target?.closest('[data-map-open]') && target?.tagName !== 'IMG')) return;
      const source = figure.querySelector<HTMLImageElement>('img');
      if (!source) return;
      trigger = figure.querySelector<HTMLButtonElement>('[data-map-open]');
      image.src = source.src;
      image.alt = source.alt;
      // Reserve the selected language's aspect ratio before the image loads.
      image.width = Number(source.getAttribute('width'));
      image.height = Number(source.getAttribute('height'));
      title.textContent = source.alt;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      resize(0);
      dialog.showModal();
      canvas.scrollTo(0, 0);
    });
    for (const button of zoomButtons) {
      this.listen(button, 'click', () => {
        const direction = button.dataset['mapZoom'];
        const current = width || canvas.clientWidth;
        if (direction === 'fit') resize(0);
        else if (direction === 'in') resize(Math.min(2400, Math.max(1000, current + 400)));
        else resize(current - 400 <= canvas.clientWidth ? 0 : current - 400);
      });
    }
    let pan: { pointer: number; x: number; y: number; left: number; top: number } | undefined;
    const endPan = () => {
      const pointer = pan?.pointer;
      pan = undefined;
      canvas.classList.remove('is-panning');
      if (pointer !== undefined && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    };
    this.listen(canvas, 'pointerdown', ((event: PointerEvent) => {
      // Touch keeps native one-finger scrolling and browser pinch zoom.
      if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      pan = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
        left: canvas.scrollLeft, top: canvas.scrollTop };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-panning');
    }) as EventListener);
    this.listen(canvas, 'pointermove', ((event: PointerEvent) => {
      if (!pan || pan.pointer !== event.pointerId) return;
      canvas.scrollLeft = pan.left + pan.x - event.clientX;
      canvas.scrollTop = pan.top + pan.y - event.clientY;
    }) as EventListener);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.listen(canvas, event, endPan);
    }
    this.listen(image, 'dragstart', event => event.preventDefault());
    const close = dialog.querySelector<HTMLButtonElement>('[data-map-close]');
    if (close) this.listen(close, 'click', () => dialog.close());
    this.listen(dialog, 'close', () => {
      endPan();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
      image.removeAttribute('src');
    });
    this.destroyRef.onDestroy(() => {
      endPan();
      if (dialog.open) {
        document.body.style.overflow = previousOverflow;
        dialog.close();
      }
    });
  }
}
