import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { PageChromeComponent } from '../shared/page-chrome.component';
import characterDataJson from '../../../assets/js/chardata.json';
import { ItemData } from './item-data.js';
import {
  CHARACTER_CLASSES,
  CharacterClass,
  CharacterData,
  StatBreakdown,
  StatusCalculator,
  StatusResult,
} from './status-domain';

interface Option { readonly value: string; readonly label: string }
interface StatRow extends StatBreakdown { readonly key: string; readonly label: string }
type Language = 'zh' | 'en' | 'ja';

const TEXT = {
  zh: {
    eyebrow: 'PSOBB 角色实验室', title: '角色属性模拟器', character: '角色', class: '职业', level: '等级',
    mag: '玛古', materials: '材料', equipment: '装备', reset: '重置', units: '插件', remaining: '剩余', exceeded: '超出上限', resists: '抗性',
    results: '计算结果', base: '基础', material: '材料', magBonus: '玛古', equipmentBonus: '装备', unitBonus: '插件',
    current: '当前', maximum: '上限', difference: '差值', valid: '可装备', invalid: '不可装备', rarity: '稀有度',
    effects: '特殊效果', noEffects: '无特殊效果', share: '当前配置链接', materialLimit: '材料用量', magLevel: '玛古等级',
    fireResist: '火焰', iceResist: '冰冻', thunderResist: '雷电', darkResist: '暗黑', lightResist: '光明',
  },
  en: {
    eyebrow: 'PSOBB character laboratory', title: 'Character Stat Simulator', character: 'Character', class: 'Class', level: 'Level',
    mag: 'Mag', materials: 'Materials', equipment: 'Equipment', reset: 'Reset', units: 'Units', remaining: 'remaining', exceeded: 'over limit', resists: 'Resists',
    results: 'Results', base: 'Base', material: 'Material', magBonus: 'Mag', equipmentBonus: 'Equipment', unitBonus: 'Unit',
    current: 'Current', maximum: 'Max', difference: 'Difference', valid: 'Equipable', invalid: 'Not equipable', rarity: 'Rarity',
    effects: 'Special effects', noEffects: 'No special effects', share: 'Link to this build', materialLimit: 'Material use', magLevel: 'Mag level',
    fireResist: 'Fire', iceResist: 'Ice', thunderResist: 'Thunder', darkResist: 'Dark', lightResist: 'Light',
  },
  ja: {
    eyebrow: 'PSOBB キャラクターラボ', title: 'キャラクターステータスシミュレーター', character: 'キャラクター', class: '職業', level: 'レベル',
    mag: 'マグ', materials: 'マテリアル', equipment: '装備', reset: 'リセット', units: 'ユニット', remaining: '残り', exceeded: '上限超過', resists: '耐性',
    results: '計算結果', base: '基本', material: 'マテリアル', magBonus: 'マグ', equipmentBonus: '装備', unitBonus: 'ユニット',
    current: '現在', maximum: '上限', difference: '差分', valid: '装備可能', invalid: '装備不可', rarity: 'レア度',
    effects: '特殊効果', noEffects: '特殊効果なし', share: '現在の構成リンク', materialLimit: 'マテリアル使用量', magLevel: 'マグレベル',
    fireResist: '炎', iceResist: '氷', thunderResist: '雷', darkResist: '闇', lightResist: '光',
  },
} as const;

@Component({
  selector: 'haven-status',
  imports: [FormsModule, PageChromeComponent],
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.css', './status-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly characterData = characterDataJson as unknown as CharacterData;
  private readonly itemData = new ItemData();
  private readonly calculator = new StatusCalculator(this.itemData, this.characterData);

  readonly levels = Array.from({ length: 200 }, (_, index) => index + 1);
  readonly language = signal<Language>('zh');
  classes: Option[] = [];
  armors: Option[] = [];
  shields: Option[] = [];
  unitOptions: Option[] = [];
  selectedClass: CharacterClass = 'humar';
  level = 200;
  magDef = 5;
  magPow = 0;
  magDex = 0;
  magMind = 0;
  matHP = 0;
  matTP = 0;
  matPow = 0;
  matDef = 0;
  matMind = 0;
  matEva = 0;
  matLck = 0;
  armor = '-';
  shield = '-';
  units: [string, string, string, string] = ['-', '-', '-', '-'];
  result: StatusResult | null = null;
  statRows: StatRow[] = [];
  effectLabels: string[] = [];
  shareUrl = '';

  constructor() {
    this.meta.updateTag({ name: 'description', content: 'PSOBB 角色属性模拟器' });
    this.classes = CHARACTER_CLASSES.map((value) => ({ value, label: this.characterData.clazz[value][0] }));
    this.armors = this.options(this.itemData.armors);
    this.shields = this.options(this.itemData.shields);
    this.unitOptions = this.options(this.itemData.units);
    this.recalculate();
    afterNextRender(() => {
      this.applyPreset();
      this.recalculate();
    });
  }

  private options(items: Readonly<Record<string, readonly [string, ...unknown[]]>>): Option[] {
    return [{ value: '-', label: '-' }, ...Object.entries(items)
      .map(([value, item]) => ({ value, label: item[0] }))
      .sort((left, right) => left.label.localeCompare(right.label))];
  }

  private applyPreset(): void {
    const params = this.route.snapshot.queryParamMap;
    const requestedClass = params.get('c');
    if (requestedClass && CHARACTER_CLASSES.includes(requestedClass as CharacterClass)) {
      this.selectedClass = requestedClass as CharacterClass;
    }
    this.level = this.presetNumber('lv', this.level, 1, 200);
    this.magDef = this.presetNumber('mdef', this.magDef);
    this.magPow = this.presetNumber('mpow', this.magPow);
    this.magDex = this.presetNumber('mdex', this.magDex);
    this.magMind = this.presetNumber('mmind', this.magMind);
    this.matHP = this.presetNumber('hp', this.matHP);
    this.matTP = this.presetNumber('tp', this.matTP);
    this.matPow = this.presetNumber('pow', this.matPow);
    this.matDef = this.presetNumber('def', this.matDef);
    this.matMind = this.presetNumber('mind', this.matMind);
    this.matEva = this.presetNumber('eva', this.matEva);
    this.matLck = this.presetNumber('lck', this.matLck);
    this.armor = this.presetItem('armor', this.itemData?.armors, this.armor);
    this.shield = this.presetItem('shield', this.itemData?.shields, this.shield);
    this.units = [0, 1, 2, 3].map((index) => this.presetItem(`unit${index + 1}`, this.itemData?.units, '-')) as [string, string, string, string];
  }

  private presetNumber(name: string, fallback: number, minimum = 0, maximum = 999): number {
    const raw = this.route.snapshot.queryParamMap.get(name);
    if (raw === null || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
  }

  private presetItem(name: string, items: Readonly<Record<string, unknown>> | undefined, fallback: string): string {
    const value = this.route.snapshot.queryParamMap.get(name);
    return value && items?.[value] ? value : fallback;
  }

  classChanged(): void { this.recalculate(); }

  recalculate(): void {
    this.result = this.calculator.calculate({
      characterClass: this.selectedClass,
      level: Number(this.level),
      mag: { def: Number(this.magDef), pow: Number(this.magPow), dex: Number(this.magDex), mind: Number(this.magMind) },
      materials: {
        hp: Number(this.matHP), tp: Number(this.matTP), pow: Number(this.matPow), def: Number(this.matDef),
        mind: Number(this.matMind), evade: Number(this.matEva), luck: Number(this.matLck),
      },
      armor: this.armor,
      shield: this.shield,
      units: this.units,
    });
    this.statRows = (['hp', 'tp', 'atp', 'dfp', 'mst', 'ata', 'evp', 'lck'] as const)
      .map((key) => ({ key, label: key.toUpperCase(), ...this.result!.stats[key] }));
    this.effectLabels = this.describeEffects(this.result);
    this.shareUrl = this.buildShareUrl();
  }

  private describeEffects(result: StatusResult): string[] {
    const effects = result.effects;
    const labels: string[] = [];
    if (effects.nonBattleAtp) labels.push(`ATP ${effects.nonBattleAtp > 0 ? '+' : ''}${effects.nonBattleAtp}`);
    if (effects.nonBattleAta) labels.push(`ATA ${effects.nonBattleAta > 0 ? '+' : ''}${effects.nonBattleAta}`);
    if (effects.attackSpeed) labels.push(`Attack speed +${effects.attackSpeed}%`);
    if (effects.techniqueSpeed) labels.push('Technique speed ×1.5');
    if (effects.techniqueLevel) labels.push(`Technique level +${effects.techniqueLevel}`);
    if (effects.smartlink) labels.push('Smartlink');
    if (effects.v50x) labels.push(effects.v50x === 2 ? 'V502' : 'V501');
    const booleans: readonly [boolean, string][] = [
      [effects.curePoison, 'Cure/Poison'], [effects.cureParalysis, 'Cure/Paralysis'],
      [effects.cureSlow, 'Cure/Slow'], [effects.cureConfuse, 'Cure/Confuse'],
      [effects.cureFreeze, 'Cure/Freeze'], [effects.cureShock, 'Cure/Shock'], [effects.trapVision, 'Trap Vision'],
    ];
    for (const [active, label] of booleans) if (active) labels.push(label);
    return labels;
  }

  private buildShareUrl(): string {
    const url = new URL('/tools/status.html', 'https://psohaven.invalid');
    const entries: Record<string, string | number> = {
      c: this.selectedClass, lv: this.level, mdef: this.magDef, mpow: this.magPow, mdex: this.magDex, mmind: this.magMind,
      hp: this.matHP, tp: this.matTP, pow: this.matPow, def: this.matDef, mind: this.matMind, eva: this.matEva, lck: this.matLck,
      armor: this.armor, shield: this.shield,
    };
    this.units.forEach((unit, index) => { entries[`unit${index + 1}`] = unit; });
    for (const [key, value] of Object.entries(entries)) url.searchParams.set(key, String(value));
    return `${url.pathname}${url.search}`;
  }

  displayValue(row: StatRow, value: number): number { return row.key === 'ata' ? value / 10 : value; }
  currentClassName(): string { return this.classes.find((option) => option.value === this.selectedClass)?.label ?? this.selectedClass; }

  resetMag(): void { this.magDef = 5; this.magPow = 0; this.magDex = 0; this.magMind = 0; this.recalculate(); }
  resetMaterials(): void {
    this.matHP = 0; this.matTP = 0; this.matPow = 0; this.matDef = 0;
    this.matMind = 0; this.matEva = 0; this.matLck = 0; this.recalculate();
  }
  resetEquipment(): void { this.armor = '-'; this.shield = '-'; this.recalculate(); }
  resetUnits(): void { this.units = ['-', '-', '-', '-']; this.recalculate(); }
  setLanguage(language: Language): void {
    this.language.set(language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
    document.title = `${this.t('title')} | Ephinea PSOBB`;
  }

  t(key: keyof typeof TEXT.zh): string { return TEXT[this.language()][key]; }
}
