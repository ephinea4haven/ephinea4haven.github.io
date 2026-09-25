import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { SiteLanguage } from '../shared/site-language.service';
import { PRICE_TEXT, JAPANESE_LABELS } from './price-guide.messages';
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
const JAPANESE_TOKENS = new Map(ITEM_TRANSLATIONS.map(item => [item.en, item.ja || item.en]));
for (const [key, value] of Object.entries(JAPANESE_LABELS)) JAPANESE_TOKENS.set(key, value);
const JAPANESE_PATTERN = new RegExp([...JAPANESE_TOKENS.keys()]
  .sort((a, b) => b.length - a.length)
  .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
const SECTION_LABELS: Readonly<Record<string, string>> = {
  'Common weapons - Melee commons': '普通武器 - 近战', 'Common weapons - Ranged commons': '普通武器 - 远程',
  'Common weapons - Technique commons': '普通武器 - 魔法系武器', 'Common weapons - Combination commons': '普通武器 - 组合',
  "Common weapons - Claire's Deal 5 commons": "普通武器 - Claire's Deal 5", 'Common weapons - Event commons': '普通武器 - 活动',
  'Rare weapons - Melee weapons': '稀有武器 - 近战', 'Rare weapons - Ranged weapons': '稀有武器 - 远程',
  'Rare weapons - Technique weapons': '稀有武器 - 魔法系武器', 'Rare weapons - ES weapons': '稀有武器 - ES武器',
  'Rare weapons - TypeM weapons': '稀有武器 - TypeM武器', Frames: '铠甲', 'Frames - Rare frames': '铠甲 - 稀有铠甲',
  Barriers: '盾牌', 'Barriers - Rare barriers': '盾牌 - 稀有盾牌', 'Units - Common units': '插件 - 普通插件',
  'Units - Rare units': '插件 - 稀有插件', 'Mags - Mag types': '玛古 - 玛古类型', 'Mags - Cells': '玛古 - 进化道具',
  'Tools - Currencies': '道具 - 货币', 'Tools - Grinders': '道具 - 打磨石', 'Tools - Materials': '道具 - 能力药',
  'Tools - Combination items': '道具 - 合成素材', 'Tools - Miscellaneous': '道具 - 杂项', 'Tools - Event items': '道具 - 活动物品',
  Techniques: '魔法光盘', 'Techniques - Technique sets': '魔法光盘 - 职业套装价格', 'Techniques - Individual techniques': '魔法光盘 - 单张价格',
  Meseta: '美赛塔', 'Services - Unsealing': '服务 - 解封', 'Services - Instant unsealing': '服务 - 即时解封',
};
const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  'Common weapons': '普通武器', 'Rare weapons': '稀有武器', Frames: '铠甲', Barriers: '盾牌', Units: '插件',
  Mags: '玛古', Tools: '道具', Techniques: '魔法光盘', Meseta: '美赛塔', Services: '服务',
};
const HEADER_LABELS: Readonly<Record<string, string>> = {
  'Weapon Type': '武器类型', Special: '特殊攻击', 'Item Name': '物品名称', Item: '物品', Name: '名称', Price: '价格',
  Hit: '命中', Class: '职业', Level: '等级', Barrier: '盾牌', 'Mag Type': '玛古类型', Amplifier: '增幅器',
  'Photon Drops': '所需光子微晶（PD）', 'Amount per 1 PD': '1 PD 可换数量', 'Price per stack (99x)': '每组(99个)价格',
  Technique: '魔法', 'Technique disks': '魔法光盘', Total: '合计', Merge: '增幅盾', 'Specials Offered': '可添加的特殊攻击',
  'Special Rank': '特殊攻击等级', 'Max Stat': '最高属性', 'Min Stat': '最低属性', 'Med Stat': '中等属性',
  'Med-High Stat': '中高属性', 'High Stat': '高属性', 'Max DFP': '最高防御', 'Max EVP': '最高回避',
  'Episode 1 Weapons': 'EP1 武器', 'Episode 2 Weapons': 'EP2 武器', Guides: '指南', 'Per Kills': '每击杀',
  'New Paints': '新涂装', 'Old Paints': '旧涂装', '1-3 slots': '1-3插槽', '4 slots': '4插槽',
  D: 'Dark（暗）', AB: 'A.Beast（变异兽）', M: 'Machine（机械）', N: 'Native（原生）', RL: 'Rare Lock',
};

@Component({
  selector: 'haven-price-guide',
  imports: [FormsModule, PageChromeComponent],
  templateUrl: './price-guide.component.html',
  styleUrl: './price-guide.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceGuideComponent {
  readonly site = inject(SiteLanguage);
  readonly text = computed(() => PRICE_TEXT[this.site.language()]);
  constructor() {
    const meta = inject(Meta);
    effect(() => meta.updateTag({ name: 'description', content: this.text().description }));
  }
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
  categoryLabel(category: string): string { return this.site.language() === 'zh' ? CATEGORY_LABELS[category] ?? category : this.label(category); }
  sectionLabel(section: string): string { return this.site.language() === 'zh' ? SECTION_LABELS[section] ?? section : section.split(' - ').map(part => this.label(part)).join(' - '); }
  headerLabel(header: string): string { return this.site.language() === 'zh' ? HEADER_LABELS[header] ?? header : this.label(header); }
  nameKey(headers: readonly string[]): string {
    return ['Item Name', 'Weapon Type', 'Item', 'Name'].find((key) => headers.includes(key)) ?? headers[0];
  }
  itemName(value: string | null | undefined): string {
    const language = this.site.language();
    if (language === 'en') return '';
    const item = value ? ITEM_TRANSLATIONS.find(item => item.en === value) ?? ITEM_NAMES.get(value.toLocaleLowerCase()) : undefined;
    return item?.[language] ?? '';
  }
  cellClass(value: string | null | undefined): string {
    if (value == null || value === 'N/A') return 'val-na';
    if (value === '0') return 'val-zero';
    return value.toLocaleLowerCase().includes('inestimable') ? 'val-inest' : '';
  }
  cellText(value: string | null | undefined): string {
    if (value == null) return '-';
    if (value.toLocaleLowerCase().includes('inestimable')) return this.text().inestimable;
    return this.site.language() === 'ja' ? this.label(value) : value;
  }
  selectCategory(category: string): void { this.category.set(category); }

  private label(value: string): string {
    if (this.site.language() !== 'ja') return value;
    if (JAPANESE_LABELS[value]) return JAPANESE_LABELS[value];
    const item = ITEM_TRANSLATIONS.find(item => item.en === value) ?? ITEM_NAMES.get(value.toLocaleLowerCase());
    if (item) return item.ja || item.en;
    if (value.startsWith('ES ')) return value.split(/ (?=ES )/).map(name => {
      const item = ITEM_TRANSLATIONS.find(item => item.en === name);
      return item?.ja || name;
    }).join(' / ');
    if (value.startsWith('Reminder High Attributes')) return '高属性とは50以上です。' + this.label('Excalibur') + 'は、Native属性ならEP4のリザード、A.Beast属性ならデ・ロル・レ、Machine属性ならボルオプトの拘束などに使用されます。7～15 PDは属性値50未満の価格です。';
    if (/^(See |Black Paint |Chartreuse Paint )/.test(value)) {
      value = value.replace(JAPANESE_PATTERN, token => JAPANESE_TOKENS.get(token)!);
    }
    return value.replace(/^See /, '参照：').replace(/ & /g, '・').replace(/\(below\)/g, '（下記）').replace(/Level (\d+)/g, 'レベル$1').replace(/1 per (\d+)/g, '$1体につき1');
  }

  private searchText(section: PriceSection, row: Readonly<Record<string, string | null | undefined>>): string {
    const name = row[this.nameKey(section.headers)];
    const translation = name ? ITEM_NAMES.get(name.toLocaleLowerCase()) ? Object.values(ITEM_NAMES.get(name.toLocaleLowerCase())!).join(' ') : '' : '';
    return this.normalizeSearch(`${Object.values(row).filter(Boolean).join(' ')} ${translation}`);
  }

  private normalizeSearch(value: string): string { return value.normalize('NFKC').toLocaleLowerCase(); }
}
