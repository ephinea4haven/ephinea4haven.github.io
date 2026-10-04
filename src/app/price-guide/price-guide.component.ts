import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { SiteLanguage } from '../shared/site-language.service';
import { PRICE_TEXT, PriceLocalizer } from './price-guide.messages';
import { FormsModule } from '@angular/forms';
import { PRICE_DATA } from '../generated/data/price-data';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';
import { PageChromeComponent } from '../shared/page-chrome.component';

interface PriceSection {
  readonly section: string;
  readonly headers: readonly string[];
  readonly data: readonly Readonly<Record<string, string | null | undefined>>[];
}

const SECTIONS = PRICE_DATA as readonly PriceSection[];
const LOCALIZER = new PriceLocalizer(ITEM_TRANSLATIONS);
@Component({
  selector: 'haven-price-guide',
  imports: [FormsModule, PageChromeComponent],
  templateUrl: './price-guide.component.html',
  styleUrl: './price-guide.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceGuideComponent {
  readonly site = inject(SiteLanguage);
  readonly text = computed(() => PRICE_TEXT[this.site.language()]);
  constructor() {
    const meta = inject(Meta);
    effect(() => meta.updateTag({ name: 'description', content: this.text().description }));
  }
  readonly category = signal('all');
  readonly search = signal('');
  readonly categories = [...new Set(SECTIONS.map((section) => this.categoryFor(section.section)))];
  readonly visibleSections = computed(() => {
    const query = this.normalizeSearch(this.search().trim());
    return SECTIONS
      .filter((section) => this.category() === 'all' || this.categoryFor(section.section) === this.category())
      .map((section) => ({
        ...section,
        rows: section.data.filter((row) => !query || this.searchText(section, row).includes(query)),
      }))
      .filter((section) => section.rows.length > 0);
  });
  readonly totalRows = computed(() => SECTIONS
    .filter((section) => this.category() === 'all' || this.categoryFor(section.section) === this.category())
    .reduce((total, section) => total + section.data.length, 0));
  readonly matchedRows = computed(() => this.visibleSections().reduce((total, section) => total + section.rows.length, 0));

  categoryFor(section: string): string { return section.includes(' - ') ? section.split(' - ')[0] : section; }
  categoryLabel(category: string): string { return LOCALIZER.text(category, this.site.language()); }
  sectionLabel(section: string): string { return LOCALIZER.text(section, this.site.language()); }
  headerLabel(header: string): string { return LOCALIZER.text(header.replace(/ \[\d+\]$/, ''), this.site.language()); }
  itemName(value: string | null | undefined): string {
    return value ? LOCALIZER.secondaryName(value, this.site.language()) : '';
  }
  cellClass(value: string | null | undefined): string {
    if (value == null || value === 'N/A') return 'val-na';
    if (value === '0') return 'val-zero';
    return value.toLocaleLowerCase().includes('inestimable') ? 'val-inest' : '';
  }
  cellText(value: string | null | undefined): string {
    return LOCALIZER.cell(value, this.site.language());
  }
  selectCategory(category: string): void { this.category.set(category); }

  private searchText(section: PriceSection, row: Readonly<Record<string, string | null | undefined>>): string {
    return this.normalizeSearch(Object.values(row).flatMap(value =>
      value ? [value, ...(['zh', 'ja'] as const).map(language => LOCALIZER.text(value, language))] : [],
    ).join(' '));
  }

  private normalizeSearch(value: string): string { return value.normalize('NFKC').toLocaleLowerCase(); }
}
