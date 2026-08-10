import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
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

interface ComboData {
  weapons: Record<string, any>;
  frames: Record<string, { atp: number; ata: number }>;
  classStats: Record<string, { minAtp: number; maxAtp: number; ata: number; animation: string }>;
  enemyNameSort: Record<string, string[]>;
  enemies: Record<string, any>;
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
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboComponent {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private data?: ComboData;

  readonly isOpm = this.router.url.includes('ccopm.html');
  readonly classes = ['HUmar', 'HUnewearl', 'HUcast', 'HUcaseal', 'RAmar', 'RAmarl',
    'RAcast', 'RAcaseal', 'FOmar', 'FOmarl', 'FOnewm', 'FOnewearl'];
  readonly units = ['NONE', 'POSS1', 'POSS2', 'POSS3', 'POSS4'];
  readonly specials = ['None', 'Charge', 'Berserk', 'Spirit', 'Arrest', 'Gush', "Devil's",
    "Demon's", 'Lavis Cannon', 'Lavis Blade', 'Raikiri', 'Orotiagito', 'TJS', 'Dark Flow',
    'Frozen Shooter', 'Vjaya', 'Mille Marteaux'];
  readonly attacks = ['NORMAL', 'HEAVY', 'SPECIAL', 'NONE'];
  readonly hits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  weaponNames: string[] = [];
  frameNames: string[] = [];
  selectedEnemies: any[] = [];
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
  attack1 = 'NORMAL';
  attack2 = 'NORMAL';
  attack3 = 'NORMAL';
  hits1 = 1;
  hits2 = 1;
  hits3 = 1;
  sortColumn = '';
  sortAscending: boolean | null = null;

  constructor() {
    const mode = this.isOpm ? import('../generated/combo/opm-data')
      : import('../generated/combo/multi-data');
    mode.then((data) => {
      this.data = data as unknown as ComboData;
      this.weaponNames = Object.keys(this.data.weapons);
      this.frameNames = Object.keys(this.data.frames);
      this.updateClass();
      this.updateWeapon();
      this.changeDetector.markForCheck();
    });
    this.meta.updateTag({
      name: 'description',
      content: `PSOBB ${this.isOpm ? 'one-person mode' : 'multiplayer'} Combo damage calculator`,
    });
  }

  get loaded(): boolean {
    return Boolean(this.data);
  }

  get barrierNames(): string[] {
    return Object.keys(barriers);
  }

  get rows(): ComboRow[] {
    if (!this.data) return [];
    const weapon = this.data.weapons[this.selectedWeaponName];
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
      a1Type: this.attack1, a1Hits: Number(this.hits1),
      a2Type: this.attack2, a2Hits: Number(this.hits2),
      a3Type: this.attack3, a3Hits: Number(this.hits3),
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
      this.data?.classStats,
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
    if (!this.data) return '';
    const weapon = this.data.weapons[this.selectedWeaponName];
    const result = getFrameDataForWeapon(weapon, this.selectedClass, this.data.classStats);
    const frames = getFramesForCombo(
      this.attack1,
      this.attack2,
      this.attack3,
      result.animationFrameData,
    );
    return `Total Frames: ${frames}${result.animationSource}`;
  }

  updateClass(): void {
    if (!this.data) return;
    const selected = this.data.classStats[this.selectedClass];
    this.classMinAtp = selected.minAtp;
    this.classMaxAtp = selected.maxAtp;
    this.updateEquipment();
  }

  updateWeapon(): void {
    if (!this.data) return;
    const weapon = this.data.weapons[this.selectedWeaponName];
    this.hit = weapon.maxHit ?? 100;
    this.sphere = weapon.maxAttr ?? 100;
    this.special = weapon.special || 'Charge';
    const preset = weapon.comboPreset;
    if (preset?.attack1) this.attack1 = preset.attack1;
    if (preset?.attack2) this.attack2 = preset.attack2;
    if (preset?.attack3) this.attack3 = preset.attack3;
    this.hits1 = preset?.attack1Hits || 1;
    this.hits2 = preset?.attack2Hits || 1;
    this.hits3 = preset?.attack3Hits || 1;
    this.updateEquipment();
  }

  updateEquipment(): void {
    if (!this.data) return;
    const weapon = this.data.weapons[this.selectedWeaponName];
    const frame = this.data.frames[this.selectedFrame];
    const barrier = (barriers as Record<string, { atp: number; ata: number }>)[
      this.selectedBarrier
    ];
    const bonusAtp = getSetEffectAtp(weapon, this.selectedFrame, this.selectedBarrier);
    this.minAtp = weapon.minAtp + (2 * weapon.grind) + frame.atp + barrier.atp + bonusAtp;
    this.maxAtp = weapon.maxAtp + (2 * weapon.grind) + frame.atp + barrier.atp + bonusAtp;
    const selectedClass = this.data.classStats[this.selectedClass];
    this.ata = selectedClass.ata + weapon.ata + frame.ata + barrier.ata
      + getSetEffectAta(weapon, this.selectedFrame, this.selectedBarrier, this.selectedUnit)
      + Number(this.hit) + (this.commanderBlade ? 20 : 0);
  }

  addEnemies(type: string): void {
    if (!this.data) return;
    const existing = new Set(this.selectedEnemies);
    for (const enemy of Object.values(this.data.enemies)) {
      if (enemy.type === type && !existing.has(enemy)) this.selectedEnemies.push(enemy);
    }
  }

  clearEnemies(): void {
    this.selectedEnemies = [];
  }

  removeEnemy(enemy: any): void {
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
    const weapon = this.data?.weapons[this.selectedWeaponName];
    const ranged = !this.smartlink && !this.selectedClass.startsWith('RA')
      && weapon?.horizontalDistance > 0;
    return formatAccuracyText(value, minimum, ranged);
  }
}
