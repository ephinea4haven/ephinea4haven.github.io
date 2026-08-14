import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';
import { PageChromeComponent } from '../shared/page-chrome.component';

@Component({
  selector: 'haven-item-lookup',
  imports: [FormsModule, PageChromeComponent],
  templateUrl: './item-lookup.component.html',
  styleUrl: './item-lookup.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemLookupComponent {
  readonly search = signal('');
  readonly items = ITEM_TRANSLATIONS;
  readonly visibleItems = computed(() => {
    const query = this.normalize(this.search().trim());
    return query
      ? this.items.filter((item) => this.normalize(`${item.en} ${item.zh} ${item.ja ?? ''}`).includes(query))
      : this.items;
  });

  private normalize(value: string): string {
    return value.normalize('NFKC').toLocaleLowerCase();
  }
}
