import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { CATEGORIES, CLASSES, itemPath, normalize } from './catalog';
import { IndexResult } from './catalog-index';
import { CatalogNavigation } from './catalog-navigation.service';
import { Title } from '@angular/platform-browser';
import { CatalogLanguageService } from './catalog-language.service';
import { CatalogLanguageComponent } from './catalog-language.component';
import { ItemImageComponent } from './item-image.component';

@Component({
  selector: 'haven-item-catalog',
  imports: [RouterLink, ItemImageComponent, CatalogLanguageComponent],
  providers: [CatalogLanguageService],
  templateUrl: './item-catalog.component.html',
  styleUrls: ['./item-catalog.component.css', './catalog-visual.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemCatalogComponent {
  readonly i18n = inject(CatalogLanguageService);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly navigation = inject(CatalogNavigation);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly categories = CATEGORIES;
  readonly classes = CLASSES;
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private readonly index = computed(() => this.data()['index'] as IndexResult);
  readonly items = computed(() => this.index().items);
  readonly failed = computed(() => this.index().failed);
  readonly itemPath = itemPath;
  readonly filtersOpen = signal(false);
  readonly query = computed(() => this.params().get('q') ?? '');
  readonly category = computed(() => CATEGORIES.some(({ id }) => id === this.params().get('category')) ? this.params().get('category')! : 'weapon');
  readonly profession = computed(() => this.category() !== 'tool' && CLASSES.includes(this.params().get('class') ?? '') ? this.params().get('class')! : '');
  readonly rarity = computed(() => ['common', '9', '10', '11', '12', 'unknown'].includes(this.params().get('rarity') ?? '') ? this.params().get('rarity')! : '');
  readonly subtypes = computed(() => [...new Set(this.items().filter(i => i.category === this.category()).map(i => i.subtype))]);
  readonly subtype = computed(() => this.subtypes().includes(this.params().get('type') || '') ? this.params().get('type')! : '');
  readonly status = computed(() => ['listed', 'obsolete', 'unavailable'].includes(this.params().get('status') || '') ? this.params().get('status')! : '');
  readonly imagesOnly = computed(() => this.params().get('images') === '1');
  readonly sort = computed(() => {
    const value = this.params().get('sort') ?? 'catalog';
    return ['name', 'rarity'].includes(value) || (value === 'atp' && this.category() === 'weapon') ? value : 'catalog';
  });
  readonly filtered = computed(() => {
    const query = normalize(this.query());
    const items = this.items().filter((item) =>
      (item.category === this.category())
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
    ...(this.query() ? [{ key: 'q', label: this.i18n.t('搜索：') + this.query() }] : []),
    ...(this.subtype() ? [{ key: 'type', label: this.i18n.t(this.subtype()) }] : []),
    ...(this.status() ? [{ key: 'status', label: this.status() === 'listed' ? this.i18n.t('现行目录') : this.i18n.status(this.status()) }] : []),
    ...(this.profession() ? [{ key: 'class', label: this.profession() }] : []),
    ...(this.rarity() ? [{ key: 'rarity', label: this.rarity() === 'unknown' ? this.i18n.t('未标星级') : this.rarity() === 'common' ? this.i18n.t('普通道具') : `${this.rarity()}★` }] : []),
    ...(this.imagesOnly() ? [{ key: 'images', label: this.i18n.t('有截图') }] : []),
  ]);
  readonly listParams = computed<Params>(() => ({ q: this.query() || null, category: this.category(), type: this.subtype() || null, status: this.status() || null, class: this.profession() || null, rarity: this.rarity() || null, images: this.imagesOnly() ? '1' : null, sort: this.sort() === 'catalog' ? null : this.sort(), page: this.page() === 1 ? null : this.page() }));

  constructor() {
    effect(() => this.title.setTitle(`${this.i18n.t('道具图鉴')} | Ephinea PSOBB`));
    afterNextRender(() => this.document.defaultView?.scrollTo({top: this.navigation.scrollY, left: 0, behavior: 'instant'}));
  }
  count(category: string): number { return this.items().filter((item) => item.category === category).length; }
  update(key: string, value: string | null): void {
    const queryParams = { ...this.listParams(), [key]: value || null, page: null };
    if (key === 'category') { queryParams['sort'] = null; queryParams['type'] = null; if (value === 'tool') queryParams['class'] = null; }
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
  retry(): void { this.document.defaultView?.location.reload(); }
  clear(): void { void this.router.navigate([], { relativeTo: this.route, queryParams: {category:this.category()}, replaceUrl: true }); }
  goToPage(page: number): void {
    page = Number.isSafeInteger(page) ? Math.max(1, Math.min(page, this.pageCount())) : 1;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.listParams(), page }, replaceUrl: true }).then(() => {
      this.document.getElementById('catalog-results')?.scrollIntoView({ block: 'start' });
    });
  }
  rememberScroll(): void { this.navigation.scrollY = this.document.defaultView?.scrollY ?? 0; }
}
