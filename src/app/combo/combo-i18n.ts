import type { PageLanguage } from '../shared/site-language.service';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';
import monsterNames from '../../../content/monster-catalog/names.json';

export const COMBO_TEXT = {
  "zh": {
    "titleMulti": "连击伤害计算器（多人模式）",
    "titleOpm": "连击伤害计算器（单人模式）",
    "back": "← 返回首页",
    "kicker": "PSO 伤害计算",
    "switchMulti": "切换到多人模式",
    "switchOpm": "切换到单人模式",
    "Character": "角色",
    "Class": "职业",
    "Frame": "铠甲",
    "Barrier": "盾牌",
    "Units": "插件",
    "Minimum class ATP": "角色最低 ATP",
    "Maximum class ATP": "角色最高 ATP",
    "Shifta": "强攻术（Shifta）",
    "Zalure": "降防术（Zalure）",
    "Weapon": "武器",
    "Special": "特殊攻击",
    "Attribute %": "属性 %",
    "Minimum weapon ATP": "武器最低 ATP",
    "Maximum weapon ATP": "武器最高 ATP",
    "Combo": "连击",
    "Accuracy (SN) Glitch": "命中率（SN）漏洞",
    "Auto Combo": "自动连击",
    "Attack": "攻击",
    "Hits": "命中次数",
    "Enemies": "怪物",
    "Frozen": "冰冻",
    "Paralyzed": "麻痹",
    "Max Damage": "最大伤害",
    "Native": "Native（原生）",
    "A.Beast": "A.Beast（变异兽）",
    "Machine": "Machine（机械）",
    "Dark": "Dark（暗）",
    "Clear": "清空",
    "Remove": "移除",
    "Monster": "怪物",
    "Damage": "伤害",
    "Accuracy": "命中率",
    "Total Frames": "总帧数",
    "classAnimation": "（职业专用动作）",
    "femaleAnimation": "（女性动作）",
    "baseAnimation": "（基本动作）",
    "NONE": "无",
    "NORMAL": "普通攻击",
    "HEAVY": "重攻击",
    "SPECIAL": "特殊攻击",
    "Unarmed": "空手",
    "Charge": "金祭（Charge）",
    "Berserk": "血祭（Berserk）",
    "Spirit": "灵祭（Spirit）",
    "Arrest": "麻痹（Arrest）",
    "Gush": "吸取 HP（Gush）",
    "Devil's": "削减 HP（Devil’s）",
    "Demon's": "削减 HP（Demon’s）",
    "Hell": "即死（Hell）",
    "Fill": "吸取 HP（Fill）",
    "Seize": "麻痹（Seize）",
    "Ruins": "遗迹",
    "Temple": "VR 神殿",
    "Mines": "矿坑",
    "Space": "VR 宇宙船",
    "Ring": "环阵",
    "Caves": "洞窟",
    "Shell": "外壳",
    "Form 1": "形态 1",
    "Form 2": "形态 2",
    "Form 3": "形态 3",
    "Falz": "Dark Falz 战",
    "Crater": "陨石坑",
    "Desert": "地下沙漠",
    "Forest": "森林",
    "Phase 1": "阶段 1",
    "Phase 2": "阶段 2"
  },
  "en": {
    "titleMulti": "Combo Calculator Multiplayer",
    "titleOpm": "Combo Calculator OPM",
    "back": "← Back to Home",
    "kicker": "PSO damage laboratory",
    "switchMulti": "Switch to Multiplayer",
    "switchOpm": "Switch to OPM",
    "Character": "Character",
    "Class": "Class",
    "Frame": "Frame",
    "Barrier": "Barrier",
    "Units": "Units",
    "Minimum class ATP": "Minimum class ATP",
    "Maximum class ATP": "Maximum class ATP",
    "Shifta": "Shifta",
    "Zalure": "Zalure",
    "Weapon": "Weapon",
    "Special": "Special",
    "Attribute %": "Attribute %",
    "Minimum weapon ATP": "Minimum weapon ATP",
    "Maximum weapon ATP": "Maximum weapon ATP",
    "Combo": "Combo",
    "Accuracy (SN) Glitch": "Accuracy (SN) Glitch",
    "Auto Combo": "Auto Combo",
    "Attack": "Attack",
    "Hits": "Hits",
    "Enemies": "Enemies",
    "Frozen": "Frozen",
    "Paralyzed": "Paralyzed",
    "Max Damage": "Max Damage",
    "Native": "Native",
    "A.Beast": "A.Beast",
    "Machine": "Machine",
    "Dark": "Dark",
    "Clear": "Clear",
    "Remove": "Remove",
    "Monster": "Monster",
    "Damage": "Damage",
    "Accuracy": "Accuracy",
    "Total Frames": "Total Frames",
    "classAnimation": " (class specific animation)",
    "femaleAnimation": " (female animation)",
    "baseAnimation": " (base animation)",
    "NONE": "None",
    "NORMAL": "Normal",
    "HEAVY": "Heavy",
    "SPECIAL": "Special",
    "Unarmed": "Unarmed",
    "Charge": "Charge",
    "Berserk": "Berserk",
    "Spirit": "Spirit",
    "Arrest": "Arrest",
    "Gush": "Gush",
    "Devil's": "Devil's",
    "Demon's": "Demon's",
    "Hell": "Hell",
    "Fill": "Fill",
    "Seize": "Seize",
    "Ruins": "Ruins",
    "Temple": "Temple",
    "Mines": "Mines",
    "Space": "Space",
    "Ring": "Ring",
    "Caves": "Caves",
    "Shell": "Shell",
    "Form 1": "Form 1",
    "Form 2": "Form 2",
    "Form 3": "Form 3",
    "Falz": "Falz",
    "Crater": "Crater",
    "Desert": "Desert",
    "Forest": "Forest",
    "Phase 1": "Phase 1",
    "Phase 2": "Phase 2"
  },
  "ja": {
    "titleMulti": "コンボ計算機（マルチモード）",
    "titleOpm": "コンボ計算機（ソロモード）",
    "back": "← ホームへ戻る",
    "kicker": "PSOダメージ計算",
    "switchMulti": "マルチモードへ切り替え",
    "switchOpm": "ソロモードへ切り替え",
    "Character": "キャラクター",
    "Class": "クラス",
    "Frame": "鎧",
    "Barrier": "盾",
    "Units": "ユニット",
    "Minimum class ATP": "キャラクター最小ATP",
    "Maximum class ATP": "キャラクター最大ATP",
    "Shifta": "シフタ",
    "Zalure": "ザルア",
    "Weapon": "武器",
    "Special": "エクストラアタック",
    "Attribute %": "属性%",
    "Minimum weapon ATP": "武器最小ATP",
    "Maximum weapon ATP": "武器最大ATP",
    "Combo": "コンボ",
    "Accuracy (SN) Glitch": "命中率（SN）バグ",
    "Auto Combo": "自動コンボ",
    "Attack": "攻撃",
    "Hits": "ヒット数",
    "Enemies": "エネミー",
    "Frozen": "凍結",
    "Paralyzed": "麻痺",
    "Max Damage": "最大ダメージ",
    "Native": "Native（原生生物）",
    "A.Beast": "A.Beast（変異獣）",
    "Machine": "Machine（機械）",
    "Dark": "Dark（D型生命体）",
    "Clear": "クリア",
    "Remove": "削除：",
    "Monster": "エネミー",
    "Damage": "ダメージ",
    "Accuracy": "命中率",
    "Total Frames": "合計フレーム数",
    "classAnimation": "（クラス固有モーション）",
    "femaleAnimation": "（女性モーション）",
    "baseAnimation": "（基本モーション）",
    "NONE": "なし",
    "NORMAL": "通常攻撃",
    "HEAVY": "強攻撃",
    "SPECIAL": "エクストラアタック",
    "Unarmed": "素手",
    "Charge": "チャージ",
    "Berserk": "バーサーク",
    "Spirit": "スピリット",
    "Arrest": "アレスト",
    "Gush": "ガッシュ",
    "Devil's": "デビル",
    "Demon's": "デーモン",
    "Hell": "ヘル",
    "Fill": "フィル",
    "Seize": "シーズ",
    "Ruins": "遺跡",
    "Temple": "VR神殿",
    "Mines": "坑道",
    "Space": "VR宇宙船",
    "Ring": "リング",
    "Caves": "洞窟",
    "Shell": "外殻",
    "Form 1": "第1形態",
    "Form 2": "第2形態",
    "Form 3": "第3形態",
    "Falz": "ダークファルス戦",
    "Crater": "クレーター",
    "Desert": "地下砂漠",
    "Forest": "森",
    "Phase 1": "第1段階",
    "Phase 2": "第2段階"
  }
} as const;

export type ComboTextKey = keyof typeof COMBO_TEXT.en;
const items = new Map(ITEM_TRANSLATIONS.map(item => [item.en, item]));
const foldedItems = new Map<string, typeof ITEM_TRANSLATIONS[number][]>();
for (const item of ITEM_TRANSLATIONS) {
  const key = item.en.toLowerCase();
  foldedItems.set(key, [...(foldedItems.get(key) ?? []), item]);
}
// These are upstream identifiers for the same authoritative item, not translations.
const itemAliases: Record<string, string> = { TJS: 'TSUMIKIRI J-SWORD', PHF: 'PLANTAIN HUGE FAN' };

export function comboText(key: ComboTextKey, language: PageLanguage): string {
  return COMBO_TEXT[language][key];
}

export function comboItemName(name: string, language: PageLanguage): string {
  if (name === 'None' || name === 'NONE') return comboText('NONE', language);
  if (name === 'Unarmed') return comboText('Unarmed', language);
  const poss = /^POSS([1-4])$/.exec(name);
  const variant = /^(Sweetheart|Black Ring) \(([1-3])\)$/.exec(name);
  const identity = poss ? 'PROOF OF SWORD-SAINT' : variant ? variant[1]
    : name.startsWith('ES ') ? name.slice(3).toUpperCase() : itemAliases[name] ?? name;
  const matches = foldedItems.get(identity.toLowerCase());
  const item = items.get(identity) ?? (!name.startsWith('ES ') && matches?.length === 1 ? matches[0] : undefined);
  const label = item?.[language] ?? name;
  if (poss) return language === 'en' ? name : label + ' ×' + poss[1];
  if (variant) return language === 'en' ? name : label + ' (' + variant[2] + ')';
  return language === 'en' ? name : label;
}

export function comboSpecialName(name: string, language: PageLanguage): string {
  if (name === 'None') return comboText('NONE', language);
  if (name === 'Hell*') return comboText('Hell', language) + '*';
  if (Object.hasOwn(COMBO_TEXT.en, name)) return comboText(name as ComboTextKey, language);
  return comboItemName(name, language);
}

export function comboMonsterName(name: string, language: PageLanguage): string {
  if (language === 'en') return name;
  const match = /^(.*?)(?: \((.+)\))?$/.exec(name)!;
  const names = monsterNames as Record<string, { zh?: string; ja?: string }>;
  const label = names[match[1]]?.[language] ?? match[1];
  const suffix = match[2];
  return suffix ? label + '（' + comboText(suffix as ComboTextKey, language) + '）' : label;
}
