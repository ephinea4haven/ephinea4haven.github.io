import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import data from '../generated/item-catalog/cosmetics.json';
import types from '../generated/item-catalog/types.json';
import { CatalogItem, ITEM_BY_ID, itemPath } from './catalog';
import { CatalogLanguageService } from './catalog-language.service';
import { cosmeticsText } from './cosmetics-messages';
import { CatalogLanguageComponent } from './catalog-language.component';
import { ItemImageComponent } from './item-image.component';

// Generated rows omit empty facts; drops are [Section ID, difficulty, location, rate, 'box' for box drops].
interface Row {
  item: string; skin?: string; color?: string; reverts?: boolean; targets?: string[];
  photonFilter?: { color: string; weapons: string[] };
  trade?: [string, number][];
  shop?: { quest: string; price: number; currency: string };
  event?: { event: string; via: string };
  freeQuests?: string[];
  drops?: [string, string, string, string, 'box'?][];
  group?: string;
}
const item = (id: string): CatalogItem => {
  const found = ITEM_BY_ID.get(id);
  if (!found) throw new Error(`Cosmetics overview references a missing item: ${id}`);
  return found;
};
const resolve = (row: Row) => {
  const skin = row.skin ? item(row.skin) : null;
  const self = item(row.item);
  return {
    ...row, self, skinItem: skin,
    // Hearts have no screenshot of their own, so their card shows the weapon they turn into.
    picture: self.image || !skin ? self : skin,
    targetItems: (row.targets ?? []).map(item),
    filterItems: row.photonFilter?.weapons.map(item) ?? [],
    tradeItems: (row.trade ?? []).map(([id, quantity]) => ({ item: item(id), quantity })),
    freeQuests: row.freeQuests ?? [],
    drops: row.drops ?? [],
    currency: row.shop ? item(row.shop.currency) : null,
    via: row.event ? item(row.event.via) : null,
  };
};
const hearts = (data.hearts as Row[]).map(resolve);
const EVENTS: Record<string, string> = { 'Christmas event': '圣诞活动' };

@Component({
  selector: 'haven-cosmetics',
  imports: [RouterLink, ItemImageComponent, CatalogLanguageComponent],
  providers: [CatalogLanguageService],
  templateUrl: './cosmetics.component.html',
  styleUrls: ['./item-catalog.component.css', './catalog-sections.css', './catalog-visual.css', './cosmetics.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CosmeticsComponent {
  readonly i18n = inject(CatalogLanguageService);
  private readonly title = inject(Title);
  readonly heartGroups = [...new Set(hearts.map(row => row.group!))].map(group => ({
    id: group.toLowerCase().replaceAll(' ', '-'),
    label: group === 'Multiple' ? '多种武器' : (types as Record<string, string[]>)[group][1],
    rows: hearts.filter(row => row.group === group),
  }));
  readonly hearts = hearts;
  readonly paints = (data.paints as Row[]).map(resolve);
  readonly platings = (data.platings as Row[]).map(resolve);
  readonly sources = data.sources;
  readonly redRing = item('red-ring');
  readonly redPaint = item('red-paint');
  readonly neutralizer = item('neutralizer');
  readonly photonFilter = item('photon-filter');
  readonly itemPath = itemPath;
  readonly lang = computed(() => ({ lang: this.i18n.language() }));
  eventLabel(event: string): string { return EVENTS[event] || event; }
  copy(text: string): string { return cosmeticsText(text, this.i18n.language()); }
  constructor() {
    effect(() => this.title.setTitle(`${this.i18n.t('外观道具')} | ${this.i18n.t('道具图鉴')} · Ephinea PSOBB`));
  }
}
