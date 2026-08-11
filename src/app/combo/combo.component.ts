import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { PageChromeComponent } from '../shared/page-chrome.component';
import {
  barriers,
  createMonsterRow,
  formatAccuracyText,
  getEvpModifier,
  getFrameDataForWeapon,
  getFramesForCombo,
  getSetEffectAta,
  getSetEffectAtp,
} from '../generated/combo/engine';

type AttackType = 'NORMAL' | 'HEAVY' | 'SPECIAL' | 'NONE';
type ComboSelection = [AttackType, AttackType, AttackType];
type HitSelection = [number, number, number];

const EDITABLE_SPECIALS = [
  'Charge', 'Berserk', 'Spirit', 'Arrest', 'Gush', "Devil's", "Demon's",
  'Lavis Cannon', 'Lavis Blade', 'Raikiri', 'Orotiagito', 'TJS', 'Dark Flow',
  'Frozen Shooter', 'Vjaya', 'Mille Marteaux',
] as const;

interface WeaponPreset {
  readonly attack1?: AttackType | '';
  readonly attack1Hits?: number;
  readonly attack2?: AttackType | '';
  readonly attack2Hits?: number;
  readonly attack3?: AttackType | '';
  readonly attack3Hits?: number;
}

interface Weapon {
  readonly minAtp: number;
  readonly maxAtp: number;
  readonly ata: number;
  readonly grind: number;
  readonly maxHit?: number;
  readonly maxAttr?: number;
  readonly special?: string;
  readonly horizontalDistance: number;
  readonly comboPreset?: WeaponPreset;
}

export interface ComboEnemy {
  readonly name: string;
  readonly type: string;
  readonly hp: number;
  readonly evp: number;
  readonly dfp: number;
}

export interface ComboData {
  readonly weapons: Readonly<Record<string, Weapon>>;
  frames: Record<string, { atp: number; ata: number }>;
  classStats: Record<string, { minAtp: number; maxAtp: number; ata: number; animation: string }>;
  enemyNameSort: Record<string, string[]>;
  readonly enemies: Readonly<Record<string, ComboEnemy>>;
}

interface ComboRow {
  name: string;
  hp: number;
  type: string;
  percentDamage: number;
  comboDamage: number;
  overallAccuracy: number;
  overallMinAccuracy: number;
  a1Damage: number;
  a1Type: string;
  a1Accuracy: number;
  a1MinAccuracy: number;
  a2Damage: number;
  a2Type: string;
  a2Accuracy: number;
  a2MinAccuracy: number;
  a3Damage: number;
  a3Type: string;
  a3Accuracy: number;
  a3MinAccuracy: number;
}

@Component({
  selector: 'haven-combo',
  imports: [FormsModule, PageChromeComponent],
  templateUrl: './combo.component.html',
  styleUrl: './combo.component.css',
  host: {
    style: 'display: flex; flex-direction: column; align-items: center; width: 100%; min-width: 0; --native: #a5ffaa; --abeast: #f5ff99; --machine: #ff958b; --dark: #e1a9ff',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboComponent implements OnInit {
  private readonly meta = inject(Meta);
  private comboData!: ComboData;

  readonly data = input.required<ComboData>();
  readonly isOpm = input.required<boolean>();
  readonly classes = ['HUmar', 'HUnewearl', 'HUcast', 'HUcaseal', 'RAmar', 'RAmarl',
    'RAcast', 'RAcaseal', 'FOmar', 'FOmarl', 'FOnewm', 'FOnewearl'];
  readonly units = ['NONE', 'POSS1', 'POSS2', 'POSS3', 'POSS4'];
  readonly specials = computed(() => ['None', ...new Set([
    ...EDITABLE_SPECIALS,
    ...Object.values(this.data().weapons)
      .map((weapon) => weapon.special)
      .filter((special): special is string => Boolean(special)),
  ])]);
  readonly attacks: readonly AttackType[] = ['NORMAL', 'HEAVY', 'SPECIAL', 'NONE'];
  readonly hits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  weaponNames: string[] = [];
  frameNames: string[] = [];
  selectedEnemies: ComboEnemy[] = [];
  selectedClass = 'HUcast';
  selectedFrame = 'None';
  selectedBarrier = 'Red Ring';
  selectedUnit = 'NONE';
  selectedWeaponName = 'Unarmed';
  special = 'Charge';
  classMinAtp = 1634;
  classMaxAtp = 1639;
  ata = 191;
  shifta = 0;
  zalure = 0;
  sphere = 0;
  hit = 0;
  minAtp = 0;
  maxAtp = 0;
  commanderBlade = false;
  smartlink = true;
  ataGlitch = false;
  autoCombo = false;
  frozen = false;
  paralyzed = false;
  maxDamage = false;
  selectedAttacks: ComboSelection = ['NORMAL', 'NORMAL', 'NORMAL'];
  selectedHits: HitSelection = [1, 1, 1];
  sortColumn = '';
  sortAscending: boolean | null = null;

  ngOnInit(): void {
    this.comboData = this.data();
    this.weaponNames = Object.keys(this.comboData.weapons);
    this.frameNames = Object.keys(this.comboData.frames);
    this.updateClass();
    this.updateWeapon();
    this.meta.updateTag({
      name: 'description',
      content: `PSOBB ${this.isOpm() ? 'one-person mode' : 'multiplayer'} Combo damage calculator`,
    });
  }

  get barrierNames(): string[] {
    return Object.keys(barriers);
  }

  get rows(): ComboRow[] {
    const weapon = this.comboData.weapons[this.selectedWeaponName];
    const range = this.smartlink || this.selectedClass.startsWith('RA')
      ? 0
      : weapon.horizontalDistance;
    const atpInput = {
      playerClass: this.selectedClass,
      classMinAtp: Number(this.classMinAtp),
      classMaxAtp: Number(this.classMaxAtp),
      minAtp: Number(this.minAtp),
      maxAtp: Number(this.maxAtp),
      areaPercent: Number(this.sphere),
      useMaxDamageRoll: this.maxDamage,
      shifta: Number(this.shifta),
      zalure: Number(this.zalure),
    };
    const baseCombo = {
      a1Type: this.selectedAttacks[0], a1Hits: this.effectiveHits(0),
      a2Type: this.selectedAttacks[1], a2Hits: this.effectiveHits(1),
      a3Type: this.selectedAttacks[2], a3Hits: this.effectiveHits(2),
    };
    const evpModifier = getEvpModifier(this.frozen, this.paralyzed);
    const rows = this.selectedEnemies.map((enemy) => createMonsterRow(
      this.special,
      this.autoCombo,
      weapon,
      enemy,
      evpModifier,
      Number(this.ata),
      this.ataGlitch,
      atpInput,
      { ...baseCombo },
      range,
      this.comboData.classStats,
    )) as ComboRow[];
    if (this.sortAscending === null) return rows;
    const direction = this.sortAscending ? 1 : -1;
    return rows.sort((left, right) => {
      if (this.sortColumn === 'name') return direction * left.name.localeCompare(right.name);
      if (this.sortColumn === 'damage') return direction * (left.percentDamage - right.percentDamage);
      return direction * (left.overallAccuracy - right.overallAccuracy);
    });
  }

  get totalFrames(): string {
    const weapon = this.comboData.weapons[this.selectedWeaponName];
    const result = getFrameDataForWeapon(weapon, this.selectedClass, this.comboData.classStats);
    const frames = getFramesForCombo(
      this.selectedAttacks[0],
      this.selectedAttacks[1],
      this.selectedAttacks[2],
      result.animationFrameData,
    );
    return `Total Frames: ${frames}${result.animationSource}`;
  }

  updateClass(): void {
    const selected = this.comboData.classStats[this.selectedClass];
    this.classMinAtp = selected.minAtp;
    this.classMaxAtp = selected.maxAtp;
    this.updateEquipment();
  }

  updateWeapon(): void {
    const weapon = this.comboData.weapons[this.selectedWeaponName];
    this.hit = weapon.maxHit ?? 100;
    this.sphere = weapon.maxAttr ?? 100;
    this.special = weapon.special || 'Charge';
    const preset = weapon.comboPreset;
    const attacks: ComboSelection = [
      preset?.attack1 || 'NORMAL',
      preset?.attack2 || 'NORMAL',
      preset?.attack3 || 'NORMAL',
    ];
    this.selectedAttacks = attacks;
    this.selectedHits = [
      attacks[0] === 'NONE' ? 0 : preset?.attack1Hits || 1,
      attacks[1] === 'NONE' ? 0 : preset?.attack2Hits || 1,
      attacks[2] === 'NONE' ? 0 : preset?.attack3Hits || 1,
    ];
    this.updateEquipment();
  }

  updateAttack(index: number, attack: AttackType): void {
    const attacks: ComboSelection = [...this.selectedAttacks];
    const hits: HitSelection = [...this.selectedHits];
    attacks[index] = attack;
    if (attack === 'NONE') hits[index] = 0;
    else if (hits[index] === 0) hits[index] = 1;
    this.selectedAttacks = attacks;
    this.selectedHits = hits;
  }

  updateEquipment(): void {
    const weapon = this.comboData.weapons[this.selectedWeaponName];
    const frame = this.comboData.frames[this.selectedFrame];
    const barrier = (barriers as Record<string, { atp: number; ata: number }>)[
      this.selectedBarrier
    ];
    const bonusAtp = getSetEffectAtp(weapon, this.selectedFrame, this.selectedBarrier);
    this.minAtp = weapon.minAtp + (2 * weapon.grind) + frame.atp + barrier.atp + bonusAtp;
    this.maxAtp = weapon.maxAtp + (2 * weapon.grind) + frame.atp + barrier.atp + bonusAtp;
    const selectedClass = this.comboData.classStats[this.selectedClass];
    this.ata = selectedClass.ata + weapon.ata + frame.ata + barrier.ata
      + getSetEffectAta(weapon, this.selectedFrame, this.selectedBarrier, this.selectedUnit)
      + Number(this.hit) + (this.commanderBlade ? 20 : 0);
  }

  addEnemies(type: string): void {
    const existing = new Set(this.selectedEnemies);
    for (const enemy of Object.values(this.comboData.enemies)) {
      if (enemy.type === type && !existing.has(enemy)) this.selectedEnemies.push(enemy);
    }
  }

  clearEnemies(): void {
    this.selectedEnemies = [];
  }

  removeEnemy(enemy: ComboEnemy): void {
    this.selectedEnemies = this.selectedEnemies.filter((candidate) => candidate !== enemy);
  }

  sort(column: string): void {
    if (column !== this.sortColumn) {
      this.sortColumn = column;
      this.sortAscending = true;
    } else if (this.sortAscending === null) {
      this.sortAscending = true;
    } else if (this.sortAscending) {
      this.sortAscending = false;
    } else {
      this.sortAscending = null;
    }
  }

  sortLabel(column: string, label: string): string {
    if (this.sortColumn !== column || this.sortAscending === null) return label;
    return `${label} ${this.sortAscending ? '▲' : '▼'}`;
  }

  accuracy(value: number, minimum: number): string {
    const weapon = this.comboData.weapons[this.selectedWeaponName];
    const ranged = !this.smartlink && !this.selectedClass.startsWith('RA')
      && weapon?.horizontalDistance > 0;
    return formatAccuracyText(value, minimum, ranged);
  }

  private effectiveHits(index: 0 | 1 | 2): number {
    return this.selectedAttacks[index] === 'NONE' ? 0 : Number(this.selectedHits[index]);
  }
}
