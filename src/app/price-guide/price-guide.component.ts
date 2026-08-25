import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PRICE_DATA } from '../generated/data/price-data';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';
import { PageChromeComponent } from '../shared/page-chrome.component';

interface PriceSection {
  readonly section: string;
  readonly headers: readonly string[];
  readonly data: readonly Readonly<Record<string, string | null | undefined>>[];
}

const SECTIONS = PRICE_DATA as readonly PriceSection[];
const ITEM_NAMES = new Map(Object.values(ITEM_TRANSLATIONS)
  .filter((item) => item.en)
  .map((item) => [item.en!.toLocaleLowerCase(), item] as const));
const SECTION_LABELS: Readonly<Record<string, string>> = {
  'Common weapons - Melee commons': '普通武器 - 近战', 'Common weapons - Ranged commons': '普通武器 - 远程',
  'Common weapons - Technique commons': '普通武器 - 法术', 'Common weapons - Combination commons': '普通武器 - 合成',
  "Common weapons - Claire's Deal 5 commons": "普通武器 - Claire's Deal 5", 'Common weapons - Event commons': '普通武器 - 活动',
  'Rare weapons - Melee weapons': '稀有武器 - 近战', 'Rare weapons - Ranged weapons': '稀有武器 - 远程',
  'Rare weapons - Technique weapons': '稀有武器 - 法术', 'Rare weapons - ES weapons': '稀有武器 - ES武器',
  'Rare weapons - TypeM weapons': '稀有武器 - TypeM武器', Frames: '装甲', 'Frames - Rare frames': '装甲 - 稀有装甲',
  Barriers: '护盾', 'Barriers - Rare barriers': '护盾 - 稀有护盾', 'Units - Common units': '插件 - 普通插件',
  'Units - Rare units': '插件 - 稀有插件', 'Mags - Mag types': '玛古 - 玛古类型', 'Mags - Cells': '玛古 - 进化细胞',
  'Tools - Currencies': '道具 - 货币', 'Tools - Grinders': '道具 - 研磨石', 'Tools - Materials': '道具 - 能力药',
  'Tools - Combination items': '道具 - 合成物品', 'Tools - Miscellaneous': '道具 - 杂项', 'Tools - Event items': '道具 - 活动物品',
  Techniques: '法术', 'Techniques - Technique sets': '法术 - 法术套装', 'Techniques - Individual techniques': '法术 - 单个法术',
  Meseta: '美赛塔', 'Services - Unsealing': '服务 - 解封', 'Services - Instant unsealing': '服务 - 即时解封',
};
const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  'Common weapons': '普通武器', 'Rare weapons': '稀有武器', Frames: '装甲', Barriers: '护盾', Units: '插件',
  Mags: '玛古', Tools: '道具', Techniques: '法术', Meseta: '美赛塔', Services: '服务',
};
const HEADER_LABELS: Readonly<Record<string, string>> = {
  'Weapon Type': '武器类型', Special: '特殊攻击', 'Item Name': '物品名称', Item: '物品', Name: '名称', Price: '价格',
  Hit: '命中', Class: '职业', Level: '等级', Barrier: '护盾', 'Mag Type': '玛古类型', Amplifier: '增幅器',
  'Photon Drops': '光子水滴', 'Amount per 1 PD': '1 PD 可换数量', 'Price per stack (99x)': '每组(99个)价格',
  Technique: '法术', 'Technique disks': '法术盘', Total: '合计', Merge: '合并', 'Specials Offered': '可提供的特殊攻击',
  'Special Rank': '特殊等级', 'Max Stat': '最高属性', 'Min Stat': '最低属性', 'Med Stat': '中等属性',
  'Med-High Stat': '中高属性', 'High Stat': '高属性', 'Max DFP': '最高防御', 'Max EVP': '最高回避',
  'Episode 1 Weapons': 'EP1 武器', 'Episode 2 Weapons': 'EP2 武器', Guides: '指南', 'Per Kills': '每击杀',
  'New Paints': '新涂装', 'Old Paints': '旧涂装', '1-3 slots': '1-3插槽', '4 slots': '4插槽',
  D: '防御', AB: '吸收', M: '魔防', N: '普通', RL: '稀有锁',
};

@Component({
  selector: 'haven-price-guide',
  imports: [FormsModule, PageChromeComponent],
  templateUrl: './price-guide.component.html',
  styleUrl: './price-guide.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceGuideComponent {
  readonly category = signal('all');
  readonly search = signal('');
  readonly categories = [...new Set(SECTIONS.map((section) => this.categoryFor(section.section)))];
  readonly visibleSections = computed(() => {
    const query = this.normalizeSearch(this.search().trim());
    return SECTIONS
      .filter((section) => this.category() === 'all' || this.categoryFor(section.section) === this.category())
      .map((section) => ({
        ...section,
        rows: section.data.filter((row) => !query || this.searchText(section, row).includes(query)),
      }))
      .filter((section) => section.rows.length > 0);
  });
  readonly totalRows = computed(() => SECTIONS
    .filter((section) => this.category() === 'all' || this.categoryFor(section.section) === this.category())
    .reduce((total, section) => total + section.data.length, 0));
  readonly matchedRows = computed(() => this.visibleSections().reduce((total, section) => total + section.rows.length, 0));

  categoryFor(section: string): string { return section.includes(' - ') ? section.split(' - ')[0] : section; }
  categoryLabel(category: string): string { return CATEGORY_LABELS[category] ?? category; }
  sectionLabel(section: string): string { return SECTION_LABELS[section] ?? section; }
  headerLabel(header: string): string { return HEADER_LABELS[header] ?? header; }
  nameKey(headers: readonly string[]): string {
    return ['Item Name', 'Weapon Type', 'Item', 'Name'].find((key) => headers.includes(key)) ?? headers[0];
  }
  itemName(value: string | null | undefined): string {
    const translation = value ? ITEM_NAMES.get(value.toLocaleLowerCase())?.zh : '';
    return translation ?? '';
  }
  cellClass(value: string | null | undefined): string {
    if (value == null || value === 'N/A') return 'val-na';
    if (value === '0') return 'val-zero';
    return value.toLocaleLowerCase().includes('inestimable') ? 'val-inest' : '';
  }
  cellText(value: string | null | undefined): string {
    if (value == null) return '-';
    return value.toLocaleLowerCase().includes('inestimable') ? '无法估价' : value;
  }
  selectCategory(category: string): void { this.category.set(category); }

  private searchText(section: PriceSection, row: Readonly<Record<string, string | null | undefined>>): string {
    const name = row[this.nameKey(section.headers)];
    const translation = name ? ITEM_NAMES.get(name.toLocaleLowerCase())?.zh ?? '' : '';
    return this.normalizeSearch(`${Object.values(row).filter(Boolean).join(' ')} ${translation}`);
  }

  private normalizeSearch(value: string): string { return value.normalize('NFKC').toLocaleLowerCase(); }
}
