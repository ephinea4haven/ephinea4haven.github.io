import { Injectable } from '@angular/core';
import { LanguagePreferenceService } from '../shared/language-preference.service';
import { CatalogItem, categoryLabel, localizedItemName, statusLabel } from './catalog';
import { catalogText, catalogValue } from './catalog-messages';

@Injectable()
export class CatalogLanguageService extends LanguagePreferenceService {
  t(text: string): string { return catalogText(text, this.language()); }
  value(value: string): string { return catalogValue(value, this.language()); }
  name(item: CatalogItem | string): string { return localizedItemName(item, this.language()); }
  category(id: string): string { return this.t(categoryLabel(id)); }
  status(status: string): string { return this.t(statusLabel(status)); }
  pageRange(first: number, last: number, total: number): string {
    return this.language() === 'zh' ? `第 ${first}–${last} 件，共 ${total} 件` : this.language() === 'ja' ? `${total} 件中 ${first}–${last} 件` : `${first}–${last} of ${total} items`;
  }
}
