import { Injectable, signal } from '@angular/core';
import { LanguagePreferenceService } from '../shared/language-preference.service';
import { categoryLabel, ItemName, localizedItemName, statusLabel } from './catalog';
import { catalogText, catalogValue } from './catalog-messages';

@Injectable()
export class CatalogLanguageService extends LanguagePreferenceService {
  t(text: string): string { return catalogText(text, this.language()); }
  value(value: string): string { return catalogValue(value, this.language()); }
  /** Localized names for the item names a page references; set by pages that show such names. */
  readonly names = signal<Readonly<Record<string, ItemName>>>({});
  name(item: ItemName | string): string { return localizedItemName(item, this.language(), this.names()); }
  category(id: string): string { return this.t(categoryLabel(id)); }
  status(status: string): string { return this.t(statusLabel(status)); }
  pageRange(first: number, last: number, total: number): string {
    return this.language() === 'zh' ? `第 ${first}–${last} 件，共 ${total} 件` : this.language() === 'ja' ? `${total} 件中 ${first}–${last} 件` : `${first}–${last} of ${total} items`;
  }
}
