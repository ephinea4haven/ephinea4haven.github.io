import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { CATEGORIES, CLASSES, ITEMS, categoryLabel, itemPath, normalize, statusLabel } from './catalog';
import { CatalogNavigation } from './catalog-navigation.service';
import { ItemImageComponent } from './item-image.component';

@Component({
  selector: 'haven-item-catalog',
  imports: [FormsModule, RouterLink, ItemImageComponent],
  templateUrl: './item-catalog.component.html',
  styleUrl: './item-catalog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemCatalogComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly navigation = inject(CatalogNavigation);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly categories = CATEGORIES;
  readonly classes = CLASSES;
  readonly items = ITEMS;
  readonly categoryLabel = categoryLabel;
  readonly itemPath = itemPath;
  readonly statusLabel = statusLabel;
  readonly filtersOpen = signal(false);
  readonly query = computed(() => this.params().get('q') ?? '');
  readonly category = computed(() => CATEGORIES.some(({ id }) => id === this.params().get('category')) ? this.params().get('category')! : 'all');
  readonly profession = computed(() => this.category() !== 'tool' && CLASSES.includes(this.params().get('class') ?? '') ? this.params().get('class')! : '');
  readonly rarity = computed(() => ['common', '9', '10', '11', '12', 'unknown'].includes(this.params().get('rarity') ?? '') ? this.params().get('rarity')! : '');
  readonly subtypes = computed(() => [...new Set(ITEMS.filter(i => this.category() === 'all' || i.category === this.category()).map(i => i.subtype))]);
  readonly subtype = computed(() => this.subtypes().includes(this.params().get('type') || '') ? this.params().get('type')! : '');
  readonly status = computed(() => ['listed', 'obsolete', 'unavailable'].includes(this.params().get('status') || '') ? this.params().get('status')! : '');
  readonly imagesOnly = computed(() => this.params().get('images') === '1');
  readonly sort = computed(() => {
    const value = this.params().get('sort') ?? 'catalog';
    return ['name', 'rarity'].includes(value) || (value === 'atp' && this.category() === 'weapon') ? value : 'catalog';
  });
  readonly filtered = computed(() => {
    const query = normalize(this.query());
    const items = ITEMS.filter((item) =>
      (this.category() === 'all' || item.category === this.category())
      && (!this.subtype() || item.subtype === this.subtype())
      && (!this.status() || item.status === this.status())
      && (!this.profession() || item.category !== 'tool' && item.classes.includes(this.profession()))
      && (!this.rarity() || (this.rarity() === 'unknown' ? item.rarity === null : this.rarity() === 'common' ? item.rarity !== null && item.rarity < 9 : item.rarity === Number(this.rarity())))
      && (!this.imagesOnly() || !!item.image)
      && (!query || normalize(`${item.en} ${item.title} ${item.zh} ${item.ja ?? ''} ${item.code ?? ''}`).includes(query)));
    if (this.sort() === 'name') items.sort((a, b) => a.en.localeCompare(b.en, 'en'));
    if (this.sort() === 'rarity') items.sort((a, b) => (b.rarity ?? -1) - (a.rarity ?? -1));
    if (this.sort() === 'atp') items.sort((a, b) => (b.atpMax ?? -1) - (a.atpMax ?? -1));
    return items;
  });
  readonly pageSize = 24;
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly page = computed(() => {
    const value = Number(this.params().get('page') ?? 1);
    return Number.isSafeInteger(value) ? Math.max(1, Math.min(value, this.pageCount())) : 1;
  });
  readonly visible = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  readonly activeFilters = computed(() => [
    ...(this.query() ? [{ key: 'q', label: `搜索：${this.query()}` }] : []),
    ...(this.category() !== 'all' ? [{ key: 'category', label: categoryLabel(this.category()) }] : []),
    ...(this.subtype() ? [{ key: 'type', label: this.subtype() }] : []),
    ...(this.status() ? [{ key: 'status', label: this.status() === 'listed' ? '现行目录' : statusLabel(this.status()) }] : []),
    ...(this.profession() ? [{ key: 'class', label: this.profession() }] : []),
    ...(this.rarity() ? [{ key: 'rarity', label: this.rarity() === 'unknown' ? '未标星级' : this.rarity() === 'common' ? '普通道具' : `${this.rarity()}★` }] : []),
    ...(this.imagesOnly() ? [{ key: 'images', label: '有截图' }] : []),
  ]);
  readonly listParams = computed<Params>(() => ({ q: this.query() || null, category: this.category() === 'all' ? null : this.category(), type: this.subtype() || null, status: this.status() || null, class: this.profession() || null, rarity: this.rarity() || null, images: this.imagesOnly() ? '1' : null, sort: this.sort() === 'catalog' ? null : this.sort(), page: this.page() === 1 ? null : this.page() }));

  constructor() {
    afterNextRender(() => this.document.defaultView?.scrollTo(0, this.navigation.scrollY));
  }
  count(category: string): number { return category === 'all' ? ITEMS.length : ITEMS.filter((item) => item.category === category).length; }
  update(key: string, value: string | null): void {
    const queryParams = { ...this.listParams(), [key]: value || null, page: null };
    if (key === 'category') { queryParams['sort'] = null; queryParams['type'] = null; if (value === 'tool') queryParams['class'] = null; }
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
  clear(): void { void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true }); }
  goToPage(page: number): void {
    page = Number.isSafeInteger(page) ? Math.max(1, Math.min(page, this.pageCount())) : 1;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.listParams(), page }, replaceUrl: true }).then(() => {
      this.document.getElementById('catalog-results')?.scrollIntoView({ block: 'start' });
    });
  }
  rememberScroll(): void { this.navigation.scrollY = this.document.defaultView?.scrollY ?? 0; }
}
