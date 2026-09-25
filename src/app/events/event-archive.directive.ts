import { Directive, inject } from '@angular/core';
import { BrowserContentBehavior } from '../content/browser-content-behavior.directive';
import { SiteLanguage, localizedPath } from '../shared/site-language.service';
import { EVENT_TEXT, type EventName } from './event-text';

/** Easter, Halloween and Valentine's archives: year navigation, year loading and image previews. */
@Directive({ standalone: true })
export class EventArchiveBehavior extends BrowserContentBehavior {
  private readonly siteLanguage = inject(SiteLanguage);
  protected connect(): void {
    const language = this.siteLanguage.language();
    const archive = this.host.querySelector<HTMLElement>('[data-event-archive]');
    const yearLabel = this.host.querySelector<HTMLElement>('#eventYear');
    const yearNav = this.host.querySelector<HTMLElement>('#yearNav');
    const content = this.host.querySelector<HTMLElement>('#yearContent');
    const preview = this.host.querySelector<HTMLElement>('#imagePreview');
    const previewImage = preview?.querySelector<HTMLImageElement>('img');
    const previewCaption = preview?.querySelector<HTMLElement>('p');
    if (!archive || !yearLabel || !yearNav || !content || !preview || !previewImage || !previewCaption) return;

    const eventName = archive.dataset['event'] ?? '';
    const titleName = EVENT_TEXT[language][eventName as EventName];
    const years = (archive.dataset['years'] ?? '').split(',').map(Number).filter(Number.isFinite);
    const defaultYear = Number(archive.dataset['defaultYear']);
    const requested = Number(new URLSearchParams(location.search).get('year'));
    const selected = years.includes(requested) ? requested : defaultYear;
    document.title = `${selected} ${titleName} | Ephinea PSOBB`;
    yearLabel.textContent = String(selected);
    yearNav.replaceChildren(...years.map((year) => {
      const element = document.createElement(year === selected ? 'span' : 'a');
      element.textContent = String(year);
      if (element instanceof HTMLAnchorElement) element.href = localizedPath(`/event/${eventName}.html?year=${year}`, language);
      else { element.className = 'year-current'; element.setAttribute('aria-current', 'page'); }
      return element;
    }));

    if (selected !== defaultYear) {
      fetch(localizedPath(`/event/${eventName}/${selected}.html`, language), { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((html) => {
          const parsed = new DOMParser().parseFromString(html, 'text/html');
          parsed.querySelectorAll('script, style').forEach((element) => element.remove());
          parsed.querySelectorAll<HTMLElement>('*').forEach((element) => {
            for (const attribute of [...element.attributes]) {
              if (attribute.name.startsWith('on')) element.removeAttribute(attribute.name);
            }
          });
          content.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
        })
        .catch(() => { content.textContent = EVENT_TEXT[language].loadError(selected, titleName); });
    }

    let anchor: HTMLElement | null = null;
    const close = () => {
      preview.hidden = true;
      previewImage.removeAttribute('src');
      anchor = null;
    };
    const position = () => {
      if (!anchor || preview.hidden) return;
      const margin = 12;
      const gap = 10;
      const anchorRect = anchor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      let left = anchorRect.right + gap;
      let top = anchorRect.top + (anchorRect.height - previewRect.height) / 2;
      if (left + previewRect.width > innerWidth - margin) left = anchorRect.left - previewRect.width - gap;
      if (left < margin) left = Math.min(
        Math.max(margin, anchorRect.left + (anchorRect.width - previewRect.width) / 2),
        innerWidth - previewRect.width - margin,
      );
      top = Math.max(margin, Math.min(top, innerHeight - previewRect.height - margin));
      preview.style.left = `${Math.max(margin, left)}px`;
      preview.style.top = `${top}px`;
    };
    this.listen(this.host, 'click', ((event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target?.closest<HTMLElement>('[data-preview-image]');
      if (trigger) {
        if (anchor === trigger && !preview.hidden) { close(); return; }
        anchor = trigger;
        previewImage.src = trigger.dataset['previewImage'] ?? '';
        previewImage.alt = trigger.dataset['previewCaption'] ?? '';
        previewCaption.textContent = trigger.dataset['previewCaption'] ?? '';
        preview.hidden = false;
        requestAnimationFrame(position);
      } else if (target?.closest('.image-preview-close') || !target?.closest('.image-preview')) {
        close();
      }
    }) as EventListener);
    this.listen(previewImage, 'load', position);
    this.listen(window, 'resize', close);
  }
}

/** Protocol reference: newserv's documents, one tab at a time; each language version carries its own documents. */
