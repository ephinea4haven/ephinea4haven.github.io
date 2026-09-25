import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CATEGORIES, CLASSES, classesOf, itemPath, COSMETICS_PATH, ItemDetail } from './catalog';
import type { DetailResult } from './item-detail.routes';
import { CatalogLanguageService } from './catalog-language.service';
import { CatalogLanguageComponent } from './catalog-language.component';
import { ItemImageComponent } from './item-image.component';

@Component({
  selector: 'haven-item-detail',
  imports: [RouterLink, ItemImageComponent, CatalogLanguageComponent],
  providers: [CatalogLanguageService],
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-catalog.component.css', './catalog-sections.css', './item-detail.component.css', './catalog-visual.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  readonly i18n = inject(CatalogLanguageService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  readonly result = computed(() => this.data()['result'] as DetailResult);
  private readonly rawQueryParams = toSignal(this.route.queryParams, { initialValue: this.route.snapshot.queryParams });
  readonly queryParams = computed(() => ({...this.rawQueryParams(), category: CATEGORIES.some(({id}) => id === this.rawQueryParams()['category']) ? this.rawQueryParams()['category'] : this.item()?.category ?? 'weapon'}));
  private readonly fragment = toSignal(this.route.fragment, { initialValue: this.route.snapshot.fragment });
  readonly item = computed(() => { const detail = this.result().detail; return detail ? { ...detail, classes: classesOf(detail.mask) } : null; });
  readonly related = computed(() => this.item()?.relatedItems ?? []);
  readonly imageMode = linkedSignal({
    source: () => this.item()?.id,
    computation: (): 'hd' | 'wiki' => 'hd',
  });
  readonly showingHd = computed(() => !!this.item()?.hdImage && this.imageMode() === 'hd');
  readonly picturedItem = computed(() => {
    const item = this.item();
    return item ? { ...item, image: this.showingHd() ? item.hdImage : item.image } : null;
  });
  readonly classes = CLASSES;
  readonly itemPath = itemPath;
  readonly cosmeticsPath = COSMETICS_PATH;
  cosmeticSection(entry: Pick<ItemDetail, 'cosmetic' | 'cosmetics'>): string {
    const kind = entry.cosmetic?.kind ?? entry.cosmetics[0]?.kind ?? 'heart';
    return kind === 'heart' ? 'weapon-hearts' : kind === 'paint' ? 'ring-paints' : 'ring-platings';
  }
  retry(): void { this.document.defaultView?.location.reload(); }
  constructor() {
    effect(() => this.i18n.names.set(this.item()?.names ?? {}));
    effect(() => this.title.setTitle(`${this.item() ? this.i18n.name(this.item()!) : this.i18n.t(this.result().failed ? '道具资料暂时未能加载' : '未找到这件道具')} | ${this.i18n.t('道具图鉴')} · Ephinea PSOBB`));
    afterRenderEffect(() => {
      this.item();
      const fragment = this.fragment();
      if (fragment) this.document.getElementById(fragment)?.scrollIntoView({behavior: 'instant'});
      else this.document.defaultView?.scrollTo({top: 0, left: 0, behavior: 'instant'});
    });
  }
}
