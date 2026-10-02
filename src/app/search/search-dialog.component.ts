import { afterNextRender, afterRenderEffect, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { SiteLanguage } from '../shared/site-language.service';
import { SearchEngine, type SearchResult } from './search-engine.service';
import { NavigationEnd, Router } from '@angular/router';

const COPY = {
  zh: { trigger: '搜索全站', title: '搜索 Haven', close: '关闭搜索', input: '搜索内容', placeholder: '道具、怪物、任务、机制…', hint: '搜索当前语言的页面，也可使用道具的中英日名称与常用缩写。', category: '内容类型', all: '全部内容', items: '道具', enemies: '怪物', guides: '攻略', tools: '工具', events: '活动', reference: '资料与任务', loading: '正在搜索…', empty: '没有找到相关内容，请尝试其他名称或减少关键词。', error: '搜索暂时无法加载，请检查网络后重试。', retry: '重试搜索', more: '显示更多', results: '个结果', showing: '已显示', keyboard: '按 Esc 关闭' },
  en: { trigger: 'Search site', title: 'Search Haven', close: 'Close search', input: 'Search query', placeholder: 'Items, enemies, quests, mechanics…', hint: 'Search pages in this language using English, Japanese or Chinese item names and common abbreviations.', category: 'Content type', all: 'All content', items: 'Items', enemies: 'Enemies', guides: 'Guides', tools: 'Tools', events: 'Events', reference: 'Reference & quests', loading: 'Searching…', empty: 'No results. Try another name or fewer keywords.', error: 'Search could not load. Check your connection and try again.', retry: 'Retry search', more: 'Show more', results: 'results', showing: 'Showing', keyboard: 'Esc to close' },
  ja: { trigger: 'サイト内検索', title: 'Haven を検索', close: '検索を閉じる', input: '検索キーワード', placeholder: 'アイテム、エネミー、クエスト、仕様…', hint: '現在の言語のページを検索します。アイテムの日本語・英語・中国語名や略称も使えます。', category: 'コンテンツの種類', all: 'すべて', items: 'アイテム', enemies: 'エネミー', guides: 'ガイド', tools: 'ツール', events: 'イベント', reference: '資料・クエスト', loading: '検索中…', empty: '見つかりませんでした。別の名前や少ないキーワードでお試しください。', error: '検索を読み込めませんでした。接続を確認して、もう一度お試しください。', retry: '再試行', more: 'さらに表示', results: '件', showing: '表示中', keyboard: 'Esc で閉じる' },
} as const;
type SearchState = 'idle' | 'loading' | 'results' | 'error';

@Component({
  selector: 'haven-search-dialog',
  templateUrl: './search-dialog.component.html',
  styleUrl: './search-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-pagefind-ignore': '' },
})
export class SearchDialogComponent {
  readonly opened = input(false);
  readonly dismissed = output<void>();
  private readonly site = inject(SiteLanguage);
  private readonly engine = inject(SearchEngine);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly resultList = viewChild.required<ElementRef<HTMLOListElement>>('resultList');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('queryInput');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  private limit = 10;
  private language = this.site.language();
  protected readonly copy = computed(() => COPY[this.site.language()]);
  protected readonly categories = ['items', 'enemies', 'guides', 'tools', 'events', 'reference'] as const;
  protected readonly query = signal('');
  protected readonly category = signal('');
  protected readonly state = signal<SearchState>('idle');
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly total = signal(0);

  constructor() {
    const navigation = inject(Router).events.subscribe(event => { if (event instanceof NavigationEnd) this.close(); });
    inject(DestroyRef).onDestroy(() => { navigation.unsubscribe(); this.cancelPending(); });
    afterRenderEffect(() => {
      const opened = this.opened();
      untracked(() => { if (opened) this.open(); else this.close(); });
    });
    effect(() => {
      const language = this.site.language();
      if (language === this.language) return;
      this.language = language;
      this.cancelPending();
      this.query.set('');
      this.category.set('');
      this.results.set([]);
      this.total.set(0);
      this.state.set('idle');
    });
  }

  protected open(): void {
    this.dialog()?.nativeElement.showModal();
    this.input().nativeElement.focus();
    if (this.query().trim() && this.state() !== 'results') void this.search();
  }

  protected close(): void { this.dialog()?.nativeElement.close(); }

  protected closed(): void {
    this.cancelPending();
    if (this.state() === 'loading') this.state.set('idle');
    this.dismissed.emit();
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.limit = 10;
    this.schedule();
  }

  protected onCategory(event: Event): void {
    this.category.set((event.target as HTMLSelectElement).value);
    this.limit = 10;
    this.schedule();
  }

  protected async more(): Promise<void> {
    if (this.state() === 'loading') return;
    const next = this.results().length;
    this.limit += 10;
    await this.search();
    if (this.state() === 'results' && this.results().length > next) {
      afterNextRender(() => this.resultList().nativeElement.querySelectorAll<HTMLAnchorElement>('.result-title')[next]?.focus(), { injector: this.injector });
    }
  }

  protected async search(): Promise<void> {
    this.cancelPending();
    const revision = this.revision;
    const term = this.query().trim();
    if (!term) { this.state.set('idle'); this.results.set([]); this.total.set(0); return; }
    this.state.set('loading');
    try {
      const response = await this.engine.search(term, this.category(), this.site.language(), this.limit);
      if (revision !== this.revision) return;
      this.results.set(response.results);
      this.total.set(response.total);
      this.state.set('results');
    } catch {
      if (revision === this.revision) { this.results.set([]); this.state.set('error'); }
    }
  }

  protected categoryLabel(result: SearchResult): string {
    const category = result.filters.category?.[0];
    return this.categories.includes(category as typeof this.categories[number])
      ? this.copy()[category as typeof this.categories[number]] : this.copy().reference;
  }

  protected sections(result: SearchResult): SearchResult['sub_results'] {
    return result.sub_results.filter(section => section.url.includes('#')).slice(0, 2);
  }

  private schedule(): void {
    this.cancelPending();
    this.results.set([]);
    this.total.set(0);
    if (!this.query().trim()) { this.state.set('idle'); return; }
    this.state.set('loading');
    this.timer = setTimeout(() => { void this.search(); }, 180);
  }

  private cancelPending(): void { clearTimeout(this.timer); this.revision += 1; }
}
