export const CHARACTER_CLASSES = [
  'humar', 'hunewearl', 'hucast', 'hucaseal',
  'ramar', 'ramarl', 'racast', 'racaseal',
  'fomar', 'fomarl', 'fonewm', 'fonewearl',
] as const;

export type CharacterClass = typeof CHARACTER_CLASSES[number];
type SixStats = readonly [number, number, number, number, number, number];
type LevelStats = readonly [number, number, number, number, number, number, number];
type EquipMask = readonly [number, number, number, number, number, number, number, number];
export type ArmorShieldItem = readonly [string, number, number, number, number, number, number, EquipMask];
export type UnitItem = readonly [string, number, number, number, number, number, number, number, number, number, number, number, number, number, number, EquipMask];

export interface ItemCatalog {
  readonly armors: Readonly<Record<string, ArmorShieldItem>>;
  readonly shields: Readonly<Record<string, ArmorShieldItem>>;
  readonly units: Readonly<Record<string, UnitItem>>;
}

interface CharacterRecord {
  readonly min: SixStats;
  readonly max: SixStats;
  readonly mat: readonly [number, number, number];
  readonly lv: Readonly<Record<string, LevelStats>>;
}

export type CharacterData = {
  readonly clazz: Readonly<Record<CharacterClass, readonly [string]>>;
} & Readonly<Record<CharacterClass, CharacterRecord>>;

export interface StatusInput {
  readonly characterClass: CharacterClass;
  readonly level: number;
  readonly mag: Readonly<{ def: number; pow: number; dex: number; mind: number }>;
  readonly materials: Readonly<{ hp: number; tp: number; pow: number; def: number; mind: number; evade: number; luck: number }>;
  readonly armor: string;
  readonly shield: string;
  readonly units: readonly [string, string, string, string];
}

export interface StatBreakdown {
  readonly base: number;
  readonly material: number;
  readonly mag: number;
  readonly equipment: number;
  readonly unit: number;
  readonly current: number;
  readonly maximum: number | null;
  readonly difference: number | null;
}

export interface EquipmentResult {
  readonly code: string;
  readonly name: string;
  readonly equipable: boolean;
  readonly stars: number;
}

export interface StatusResult {
  readonly stats: Readonly<Record<'hp' | 'tp' | 'atp' | 'dfp' | 'mst' | 'ata' | 'evp' | 'lck', StatBreakdown>>;
  readonly mag: Readonly<{ def: number; pow: number; dex: number; mind: number; level: number }>;
  readonly materials: Readonly<{ used: number; maximum: number; hpUsed: number; hpMaximum: number; tpUsed: number; tpMaximum: number }>;
  readonly equipment: Readonly<{ armor: EquipmentResult; shield: EquipmentResult; units: readonly EquipmentResult[] }>;
  readonly resists: Readonly<{ fire: number; ice: number; thunder: number; dark: number; light: number }>;
  readonly effects: Readonly<{
    nonBattleAtp: number; nonBattleAta: number; attackSpeed: number; techniqueSpeed: boolean;
    techniqueLevel: number; smartlink: boolean; v50x: 0 | 1 | 2;
    curePoison: boolean; cureParalysis: boolean; cureSlow: boolean; cureConfuse: boolean;
    cureFreeze: boolean; cureShock: boolean; trapVision: boolean;
  }>;
}

const CLASS_MASK: Record<CharacterClass, readonly [number, number, number]> = {
  humar: [0, 3, 6], hunewearl: [0, 5, 7], hucast: [0, 4, 6], hucaseal: [0, 4, 7],
  ramar: [1, 3, 6], ramarl: [1, 3, 7], racast: [1, 4, 6], racaseal: [1, 4, 7],
  fomar: [2, 3, 6], fomarl: [2, 3, 7], fonewm: [2, 5, 6], fonewearl: [2, 5, 7],
};

const ANDROIDS = new Set<CharacterClass>(['hucast', 'hucaseal', 'racast', 'racaseal']);
const FORCES = new Set<CharacterClass>(['fomar', 'fomarl', 'fonewm', 'fonewearl']);

function equipable(mask: EquipMask, characterClass: CharacterClass): boolean {
  return CLASS_MASK[characterClass].every((index) => mask[index] > 0);
}

function selection(code: string, item: ArmorShieldItem | UnitItem | undefined, valid: boolean): EquipmentResult {
  return { code, name: item?.[0] ?? '-', equipable: code === '-' || valid, stars: item?.[item.length - 2] as number ?? 0 };
}

function breakdown(
  base: number,
  material: number,
  mag: number,
  equipment: number,
  unit: number,
  minimum: number,
  maximum: number | null,
): StatBreakdown {
  const current = Math.max(minimum, base + material + mag + equipment + unit);
  return { base, material, mag, equipment, unit, current, maximum, difference: maximum === null ? null : current - maximum };
}

export class StatusCalculator {
  constructor(
    private readonly items: ItemCatalog,
    private readonly characters: CharacterData,
  ) {}

  calculate(input: StatusInput): StatusResult {
    const character = this.characters[input.characterClass];
    const levelStats = character.lv[String(input.level)];
    if (!levelStats) throw new RangeError(`Unsupported level: ${input.level}`);

    const [baseAtp, baseDfp, baseMst, baseAta, baseEvp, baseLck, baseHp] = levelStats;
    const mag = {
      def: Number(input.mag.def), pow: Number(input.mag.pow),
      dex: Number(input.mag.dex), mind: Number(input.mag.mind),
      level: Number(input.mag.def) + Number(input.mag.pow) + Number(input.mag.dex) + Number(input.mag.mind),
    };
    const materials = {
      hp: Number(input.materials.hp), tp: Number(input.materials.tp), pow: Number(input.materials.pow),
      def: Number(input.materials.def), mind: Number(input.materials.mind),
      evade: Number(input.materials.evade), luck: Number(input.materials.luck),
    };

    const armorItem = this.items.armors[input.armor];
    const shieldItem = this.items.shields[input.shield];
    const armorValid = Boolean(armorItem && equipable(armorItem[7], input.characterClass));
    const shieldValid = Boolean(shieldItem && equipable(shieldItem[7], input.characterClass));
    const resists = { fire: 0, ice: 0, thunder: 0, dark: 0, light: 0 };
    const addResists = (item: ArmorShieldItem | UnitItem): void => {
      const offset = item.length === 8 ? 1 : 9;
      resists.fire += item[offset] as number;
      resists.ice += item[offset + 1] as number;
      resists.thunder += item[offset + 2] as number;
      resists.dark += item[offset + 3] as number;
      resists.light += item[offset + 4] as number;
    };
    if (armorValid) addResists(armorItem);
    if (shieldValid) addResists(shieldItem);

    if (armorValid && shieldValid && input.armor === '56' && input.shield === '9b') {
      resists.fire += 20; resists.ice += 20; resists.thunder += 20; resists.dark += 20; resists.light += 20;
    } else if (armorValid && shieldValid && input.armor === '45' && input.shield === '2a') {
      resists.fire += 2; resists.ice += 2; resists.thunder += 2; resists.dark += 5; resists.light += 5;
    }

    let mstByEquipment = 0;
    let lckByEquipment = 0;
    let hpByUnit = 0;
    let tpByUnit = 0;
    let atpByUnit = 0;
    let dfpByUnit = 0;
    let mstByUnit = 0;
    let ataByUnit = 0;
    let evpByUnit = 0;
    let lckByUnit = 0;
    const effects = {
      nonBattleAtp: 0, nonBattleAta: 0, attackSpeed: 0, techniqueSpeed: false,
      techniqueLevel: 0, smartlink: false, v50x: 0 as 0 | 1 | 2,
      curePoison: false, cureParalysis: false, cureSlow: false, cureConfuse: false,
      cureFreeze: false, cureShock: false, trapVision: false,
    };
    const setAttackSpeed = (value: number): void => { effects.attackSpeed = Math.max(effects.attackSpeed, value); };

    if (armorValid) {
      switch (input.armor) {
        case '1e': effects.nonBattleAtp += 35; break;
        case '1f': effects.nonBattleAtp += 10; break;
        case '23': case '54': effects.trapVision = true; break;
        case '24': effects.nonBattleAta -= 10; break;
        case '33': effects.cureParalysis = true; break;
        case '38': setAttackSpeed(10); break;
        case '39': case '56': setAttackSpeed(20); break;
        case '3a': setAttackSpeed(30); break;
        case '3b': setAttackSpeed(40); break;
      }
    }
    if (shieldValid) {
      switch (input.shield) {
        case '16': effects.curePoison = true; break;
        case '18': effects.nonBattleAta += 15; break;
        case '1b': mstByEquipment += 20; break;
        case '1c': effects.nonBattleAta += 20; break;
        case '1d': effects.nonBattleAtp += 15; break;
        case '20': case '2b': case '8a': effects.nonBattleAtp += 35; break;
        case '27': mstByEquipment += 20; lckByEquipment += 20; effects.nonBattleAtp += 20; effects.nonBattleAta += 20; break;
        case '31': effects.trapVision = true; break;
      }
    }

    const unitResults = input.units.map((code): EquipmentResult => {
      const item = this.items.units[code];
      const valid = Boolean(item && equipable(item[15], input.characterClass));
      if (valid) {
        hpByUnit += item[1]; tpByUnit += item[2]; atpByUnit += item[3]; dfpByUnit += item[4];
        mstByUnit += item[5]; ataByUnit += item[6]; evpByUnit += item[7]; lckByUnit += item[8];
        addResists(item);
        switch (code) {
          case '3c': effects.techniqueLevel += 1; break;
          case '3d': effects.techniqueLevel += 2; break;
          case '3e': effects.techniqueLevel += 3; break;
          case '3f': setAttackSpeed(5); break;
          case '40': setAttackSpeed(10); break;
          case '41': setAttackSpeed(20); break;
          case '42': effects.curePoison = true; break;
          case '43': effects.cureParalysis = true; break;
          case '44': effects.cureSlow = true; break;
          case '45': effects.cureConfuse = true; break;
          case '46': effects.cureFreeze = true; break;
          case '47': effects.cureShock = true; break;
          case '49': case '53': setAttackSpeed(40); break;
          case '4a': if (effects.v50x === 0) effects.v50x = 1; break;
          case '4b': effects.v50x = 2; break;
          case '4c': effects.techniqueSpeed = true; break;
          case '51': effects.smartlink = true; break;
          case '52': lckByUnit += baseLck + materials.luck * 2; break;
          case '60': effects.techniqueLevel += 4; break;
        }
      }
      return selection(code, item, valid);
    });

    for (const key of Object.keys(resists) as (keyof typeof resists)[]) resists[key] = Math.max(0, resists[key]);
    const [minAtp, minDfp, minMst, minAta, minEvp, minLck] = character.min;
    const [maxAtp, maxDfp, maxMst, maxAta, maxEvp, maxLck] = character.max;
    const mst = breakdown(baseMst, materials.mind * 2, mag.mind * 2, mstByEquipment, mstByUnit, minMst, maxMst);
    const cappedMst = Math.min(mst.current, maxMst);
    const baseTp = ANDROIDS.has(input.characterClass)
      ? 0
      : FORCES.has(input.characterClass)
        ? Math.floor((cappedMst + input.level - 1) * 1.5)
        : cappedMst + input.level - 1;

    return {
      stats: {
        hp: breakdown(baseHp, materials.hp * 2, 0, 0, hpByUnit, 0, null),
        tp: ANDROIDS.has(input.characterClass)
          ? breakdown(0, 0, 0, 0, 0, 0, null)
          : breakdown(baseTp, materials.tp * 2, 0, 0, tpByUnit, 0, null),
        atp: breakdown(baseAtp, materials.pow * 2, mag.pow * 2, 0, atpByUnit, minAtp, maxAtp),
        dfp: breakdown(baseDfp, materials.def * 2, mag.def, 0, dfpByUnit, minDfp, maxDfp),
        mst,
        ata: breakdown(baseAta, 0, mag.dex * 5, 0, ataByUnit, minAta, maxAta),
        evp: breakdown(baseEvp, materials.evade * 2, 0, 0, evpByUnit, minEvp, maxEvp),
        lck: breakdown(baseLck, materials.luck * 2, 0, lckByEquipment, lckByUnit, minLck, maxLck),
      },
      mag,
      materials: {
        used: materials.pow + materials.def + materials.mind + materials.evade + materials.luck,
        maximum: character.mat[0], hpUsed: materials.hp, hpMaximum: character.mat[1],
        tpUsed: materials.tp, tpMaximum: character.mat[2],
      },
      equipment: {
        armor: selection(input.armor, armorItem, armorValid),
        shield: selection(input.shield, shieldItem, shieldValid),
        units: unitResults,
      },
      resists,
      effects,
    };
  }
}
