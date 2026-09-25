import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ITEM_TRANSLATIONS, type ItemTranslation } from '../generated/i18n/items';
import { PageChromeComponent } from '../shared/page-chrome.component';
import { SiteLanguage, type PageLanguage } from '../shared/site-language.service';

const TEXT = {
  zh: {
    title: '物品名称对照（中日英）', back: '← 返回首页', search: '搜索物品名称',
    placeholder: '搜索中文 / 日文 / 英文物品名…', empty: '没有匹配的物品',
    description: 'PSOBB 物品名称的中文、日文、英文对照表',
    columns: { zh: '中文', ja: '日本語', en: 'English' },
    count: (n: number, total: number, filtered: boolean) => filtered ? `找到 ${n} / ${total} 项` : `共 ${total} 项`,
  },
  en: {
    title: 'Item names (Chinese, Japanese, English)', back: '← Back to home', search: 'Search item names',
    placeholder: 'Search English / Chinese / Japanese item names…', empty: 'No matching items',
    description: 'Look up PSOBB item names side by side in Chinese, Japanese and English.',
    columns: { zh: 'Chinese', ja: 'Japanese', en: 'English' },
    count: (n: number, total: number, filtered: boolean) => filtered ? `Found ${n} / ${total} items` : `${total} items`,
  },
  ja: {
    title: 'アイテム名対照表（中日英）', back: '← ホームに戻る', search: 'アイテム名を検索',
    placeholder: '日本語・中国語・英語のアイテム名を検索…', empty: '該当するアイテムはありません',
    description: 'PSOBB のアイテム名を中国語・日本語・英語で並べて調べられます。',
    columns: { zh: '中国語', ja: '日本語', en: '英語' },
    count: (n: number, total: number, filtered: boolean) => filtered ? `全${total}件中${n}件` : `全${total}件`,
  },
};
/** The page's own language comes first. */
const COLUMN_ORDER: Record<PageLanguage, readonly PageLanguage[]> = {
  zh: ['zh', 'ja', 'en'], en: ['en', 'zh', 'ja'], ja: ['ja', 'zh', 'en'],
};

@Component({
  selector: 'haven-item-lookup',
  imports: [FormsModule, PageChromeComponent],
  templateUrl: './item-lookup.component.html',
  styleUrl: './item-lookup.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemLookupComponent {
  private readonly site = inject(SiteLanguage);
  readonly text = computed(() => TEXT[this.site.language()]);
  readonly columns = computed(() => COLUMN_ORDER[this.site.language()]);
  readonly search = signal('');
  readonly items = ITEM_TRANSLATIONS;
  readonly visibleItems = computed(() => {
    const query = this.normalize(this.search().trim());
    return query
      ? this.items.filter((item) => this.normalize(`${item.en} ${item.zh} ${item.ja ?? ''}`).includes(query))
      : this.items;
  });

  constructor() {
    const meta = inject(Meta);
    effect(() => meta.updateTag({ name: 'description', content: this.text().description }));
  }

  name(item: ItemTranslation, language: PageLanguage): string {
    return item[language] ?? '';
  }

  private normalize(value: string): string {
    return value.normalize('NFKC').toLocaleLowerCase();
  }
}
