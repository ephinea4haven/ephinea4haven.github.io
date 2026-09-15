import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ITEMS, CLASSES, itemPath, ITEM_BY_ID, COSMETICS_PATH, ItemDetail } from './catalog';
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
  readonly queryParams = computed(() => ({...this.rawQueryParams(), lang:this.i18n.language()}));
  private readonly fragment = toSignal(this.route.fragment, { initialValue: this.route.snapshot.fragment });
  readonly item = computed(() => { const detail = this.result().detail; const summary = detail ? ITEM_BY_ID.get(detail.id) : null; return detail && summary ? { ...summary, ...detail } : null; });
  readonly related = computed(() => ITEMS.filter((candidate) => this.item()?.related.includes(candidate.id)));
  readonly classes = CLASSES;
  readonly itemPath = itemPath;
  readonly cosmeticsPath = COSMETICS_PATH;
  cosmeticSection(entry: Pick<ItemDetail, 'cosmetic' | 'cosmetics'>): string {
    const kind = entry.cosmetic?.kind ?? entry.cosmetics[0]?.kind ?? 'heart';
    return kind === 'heart' ? 'weapon-hearts' : kind === 'paint' ? 'ring-paints' : 'ring-platings';
  }
  retry(): void { this.document.defaultView?.location.reload(); }
  constructor() {
    effect(() => this.title.setTitle(`${this.item() ? this.i18n.name(this.item()!) : this.i18n.t(this.result().failed ? '道具资料暂时未能加载' : '未找到这件道具')} | ${this.i18n.t('道具图鉴')} · Ephinea PSOBB`));
    afterRenderEffect(() => {
      this.item();
      const fragment = this.fragment();
      if (fragment) this.document.getElementById(fragment)?.scrollIntoView({behavior: 'instant'});
      else this.document.defaultView?.scrollTo({top: 0, left: 0, behavior: 'instant'});
    });
  }
}
