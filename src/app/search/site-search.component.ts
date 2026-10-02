import { ChangeDetectionStrategy, Component, ComponentRef, DestroyRef, ViewContainerRef, computed, inject, signal } from '@angular/core';
import { SiteLanguage } from '../shared/site-language.service';
import type { SearchDialogComponent } from './search-dialog.component';

const COPY = {
  zh: { label: '搜索全站', reload: '刷新重试', error: '搜索界面未能下载，请刷新页面后重试。' },
  en: { label: 'Search site', reload: 'Reload page', error: 'The search interface could not download. Reload this page to try again.' },
  ja: { label: 'サイト内検索', reload: '再読み込み', error: '検索画面を読み込めませんでした。ページを再読み込みしてください。' },
};

/** A small independent entry point; neither the dialog nor its engine is part of the initial bundle. */
@Component({
  selector: 'haven-site-search',
  templateUrl: './site-search.component.html',
  styleUrl: './site-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-pagefind-ignore': '' },
})
export class SiteSearchComponent {
  private readonly site = inject(SiteLanguage);
  private readonly lifetime = inject(DestroyRef);
  private readonly host = inject(ViewContainerRef);
  private dialog: ComponentRef<SearchDialogComponent> | undefined;
  protected readonly copy = computed(() => COPY[this.site.language()]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly opened = signal(false);

  protected async open(trigger: HTMLButtonElement): Promise<void> {
    // Browsers cache failed module imports for this document; a fresh document retries the chunk.
    if (this.failed()) { location.reload(); return; }
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    const navigation = location.href;
    try {
      if (!this.dialog) {
        const { SearchDialogComponent } = await import('./search-dialog.component');
        if (this.lifetime.destroyed || navigation !== location.href) return;
        this.dialog = this.host.createComponent(SearchDialogComponent);
        this.dialog.instance.dismissed.subscribe(() => {
          this.dialog?.setInput('opened', false);
          this.opened.set(false);
          trigger.focus();
        });
      }
      this.dialog.setInput('opened', true);
      this.opened.set(true);
    } catch { this.failed.set(true); }
    finally { this.loading.set(false); }
  }
}
