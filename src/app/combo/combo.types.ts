export type AttackType = 'NORMAL' | 'HEAVY' | 'SPECIAL' | 'NONE';
export type EnemyType = 'Native' | 'A.Beast' | 'Machine' | 'Dark';

export interface WeaponPreset {
  readonly attack1: AttackType | '';
  readonly attack1Hits: number;
  readonly attack2: AttackType | '';
  readonly attack2Hits: number;
  readonly attack3: AttackType | '';
  readonly attack3Hits: number;
}

export interface ComboWeapon {
  readonly name: string;
  readonly minAtp: number;
  readonly maxAtp: number;
  readonly ata: number;
  readonly grind: number;
  readonly maxHit: number;
  readonly maxAttr: number;
  readonly special: string;
  readonly animation: string;
  readonly horizontalDistance: number;
  readonly horizontalAngle: number;
  readonly comboPreset: WeaponPreset;
}

export interface ComboFrame {
  readonly name: string;
  readonly atp: number;
  readonly ata: number;
}

export interface ComboClassStats {
  readonly name: string;
  readonly minAtp: number;
  readonly maxAtp: number;
  readonly ata: number;
  readonly maxShifta: number;
  readonly animation: string;
}

export interface ComboEnemy {
  readonly name: string;
  readonly type: EnemyType;
  readonly hp: number;
  readonly atp: number;
  readonly dfp: number;
  readonly mst: number;
  readonly ata: number;
  readonly evp: number;
  readonly lck: number;
  readonly efr: number;
  readonly eic: number;
  readonly eth: number;
  readonly edk: number;
  readonly elt: number;
  readonly esp: number;
  readonly xp: number;
  readonly location: string;
  readonly ccaMiniboss: boolean;
  readonly unitxtId: number;
}

export interface ComboData {
  readonly weapons: Readonly<Record<string, ComboWeapon>>;
  readonly frames: Readonly<Record<string, ComboFrame>>;
  readonly classStats: Readonly<Record<string, ComboClassStats>>;
  readonly enemyNameSort: Readonly<Record<string, readonly string[]>>;
  readonly enemies: Readonly<Record<string, ComboEnemy>>;
}
