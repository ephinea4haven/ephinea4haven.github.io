import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ITEMS, CLASSES, categoryLabel, itemPath } from './catalog';
import { ItemImageComponent } from './item-image.component';

@Component({
  selector: 'haven-item-detail',
  imports: [RouterLink, ItemImageComponent],
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-catalog.component.css', './item-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly queryParams = toSignal(this.route.queryParams, { initialValue: this.route.snapshot.queryParams });
  private readonly fragment = toSignal(this.route.fragment, { initialValue: this.route.snapshot.fragment });
  readonly item = computed(() => ITEMS.find((item) => `${item.id}.html` === this.params().get('item')));
  readonly related = computed(() => ITEMS.filter((candidate) => this.item()?.related.includes(candidate.id)));
  readonly classes = CLASSES;
  readonly categoryLabel = categoryLabel;
  readonly itemPath = itemPath;
  constructor() {
    effect(() => this.title.setTitle(`${this.item()?.zh ?? '未找到道具'} | 道具图鉴 · Ephinea PSOBB`));
    afterRenderEffect(() => {
      this.item();
      const fragment = this.fragment();
      if (fragment) this.document.getElementById(fragment)?.scrollIntoView();
      else this.document.defaultView?.scrollTo(0, 0);
    });
  }
}
