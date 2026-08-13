import { Injectable, signal } from '@angular/core';

export type ItemTranslationWidth = 'half' | 'full';

export const ITEM_TRANSLATION_WIDTH_CHANGE = 'item-translation-width-change';
const STORAGE_KEY = 'itemZhWidth';

export function toHalfwidthItemTranslation(value: string): string {
  return value.replace(/[\u3000\uFF01-\uFF5E]/g, (character) => (
    character === '\u3000'
      ? ' '
      : String.fromCharCode(character.charCodeAt(0) - 0xFEE0)
  ));
}

export function toFullwidthItemTranslation(value: string): string {
  return value.replace(/[\u0020-\u007E]/g, (character) => (
    character === ' '
      ? '\u3000'
      : String.fromCharCode(character.charCodeAt(0) + 0xFEE0)
  ));
}

@Injectable({ providedIn: 'root' })
export class ItemTranslationWidthService {
  readonly width = signal<ItemTranslationWidth>('half');
  private loaded = false;

  load(): void {
    if (this.loaded || typeof window === 'undefined') return;
    this.loaded = true;
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage may be disabled */ }
    if (saved === 'half' || saved === 'full') this.width.set(saved);
  }

  setWidth(width: ItemTranslationWidth): void {
    this.loaded = true;
    this.width.set(width);
    try { localStorage.setItem(STORAGE_KEY, width); } catch { /* storage may be disabled */ }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<ItemTranslationWidth>(ITEM_TRANSLATION_WIDTH_CHANGE, {
        detail: width,
      }));
    }
  }

  format(value: string): string {
    return this.width() === 'full'
      ? toFullwidthItemTranslation(value)
      : toHalfwidthItemTranslation(value);
  }

  apply(root: ParentNode): void {
    for (const element of root.querySelectorAll<HTMLElement>('[data-item-zh]')) {
      element.textContent = this.format(element.dataset['itemZh'] ?? '');
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-item-width]')) {
      const active = button.dataset['itemWidth'] === this.width();
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
}
