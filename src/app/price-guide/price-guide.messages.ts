export const PRICE_TEXT = {
  zh: { title: "物品价格参考", back: "← 返回首页", heading: "Ephinea 物品价格参考表", notice: "本表仅供参考。物品价格会根据供需关系波动，实际交易价格可能与表中数值不同。所有价格单位为", currency: "PD（Photon Drop / 光子微晶）", estimate: "“无法估价”表示该物品稀有度极高，建议通过拍卖确定价格。", search: "搜索物品名称", placeholder: "搜索物品名称...", categories: "价格分类", all: "全部", empty: "未找到匹配的物品", source: "数据来源：", inestimable: "无法估价", description: "PSOBB Ephinea 物品价格参考", count: (n: number, total: number) => `找到 ${n} / ${total} 项` },
  en: { title: "Item price guide", back: "← Back to home", heading: "Ephinea item price guide", notice: "These prices are a guide only. Prices fluctuate with supply and demand, and actual trades may differ. All prices are in", currency: "PD (Photon Drops)", estimate: "“Inestimable” means the item is exceptionally rare; an auction is recommended to establish its price.", search: "Search item names", placeholder: "Search item names...", categories: "Price categories", all: "All", empty: "No matching items", source: "Source: ", inestimable: "Inestimable", description: "Reference prices for items traded on Ephinea PSOBB.", count: (n: number, total: number) => `Found ${n} / ${total} items` },
  ja: { title: "アイテム価格ガイド", back: "← ホームに戻る", heading: "Ephineaアイテム価格ガイド", notice: "この表は参考価格です。価格は需要と供給によって変動し、実際の取引価格とは異なる場合があります。価格の単位は", currency: "PD", estimate: "「査定困難」は極めて希少なアイテムを示します。価格の決定にはオークションを推奨します。", search: "アイテム名を検索", placeholder: "アイテム名を検索...", categories: "価格の分類", all: "すべて", empty: "該当するアイテムはありません", source: "出典：", inestimable: "査定困難", description: "Ephinea PSOBBで取引されるアイテムの参考価格。", count: (n: number, total: number) => `全${total}件中${n}件` },
};

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
const CHINESE_REFERENCE_LABELS: Readonly<Record<string, string>> = {
  'Combination commons': '普通武器 - 组合', 'Combination items': '合成素材', 'Rare frames': '稀有铠甲',
  Sabers: '光剑', Swords: '大剑', Daggers: '双匕首', Slicers: '投刃', Handguns: '光枪', Shots: '霰弹枪',
  Canes: '短杖', Rods: '长杖', Wands: '魔杖', Cards: '卡片',
  CD5: "Claire's Deal 5", 'note above': '上方备注', below: '见下方',
  'The Forge and required materials': 'The Forge 及所需素材',
};

export const JAPANESE_LABELS: Readonly<Record<string, string>> = {
  "Sabers": "セイバー",
  "Daggers": "ダガー",
  "Cards": "カード",
  "Cure/\" \" set": "キュア系ユニット一式",
  "Common weapons": "コモン武器", "Rare weapons": "レア武器", Frames: "鎧", Barriers: "盾", Units: "ユニット", Mags: "マグ", Tools: "道具", Techniques: "テクニックディスク", Meseta: "メセタ", Services: "サービス",
  "Melee commons": "近接武器", "Ranged commons": "射撃武器", "Technique commons": "法撃武器", "Combination commons": "合成用武器", "Claire\u0027s Deal 5 commons": "クレアの取引5用武器", "Event commons": "イベント用武器",
  "Melee weapons": "近接武器", "Ranged weapons": "射撃武器", "Technique weapons": "法撃武器", "ES weapons": "ES武器", "TypeM weapons": "TypeM武器", "Rare frames": "レア鎧", "Rare barriers": "レア盾", "Common units": "コモンユニット", "Rare units": "レアユニット", "Mag types": "マグの種類", Cells: "マグ進化アイテム", Currencies: "通貨", Grinders: "グラインダー", Materials: "マテリアル", "Combination items": "合成素材", Miscellaneous: "その他", "Event items": "イベントアイテム", "Technique sets": "職業別セット", "Individual techniques": "個別ディスク", Unsealing: "封印解除", "Instant unsealing": "即時封印解除",
  "Weapon Type": "武器種", Special: "エクストラアタック", "Item Name": "アイテム名", Item: "アイテム", Name: "名称", Price: "価格", Hit: "Hit属性", Class: "職業", Level: "レベル", Barrier: "盾", "Mag Type": "マグの種類", Amplifier: "アンプ", "Photon Drops": "必要PD数", "Amount per 1 PD": "1 PDあたりの個数", "Price per stack (99x)": "99個の価格", Technique: "テクニック", "Technique disks": "テクニックディスク", Total: "合計", Merge: "マージ", "Specials Offered": "追加可能なエクストラアタック", "Special Rank": "エクストラアタックのランク", "Max Stat": "最大補正", "Min Stat": "最低補正", "Med Stat": "中程度の補正", "Med-High Stat": "やや高い補正", "High Stat": "高補正", "Max DFP": "最大DFP", "Max EVP": "最大EVP", "Episode 1 Weapons": "EP1武器", "Episode 2 Weapons": "EP2武器", Guides: "ガイド", "Per Kills": "撃破数あたり", "New Paints": "新しいペイント", "Old Paints": "従来のペイント", "1-3 slots": "1～3スロット", "4 slots": "4スロット",
  Arrest: "アレスト", Berserk: "バーサーク", Blizzard: "ブリザード", Charge: "チャージ", Demons: "デーモン", "Demon\u0027s": "デーモン", Hell: "ヘル", Spirit: "スピリット", Elemental: "属性攻撃", Gush: "ガッシュ", "None or Any": "なし・任意", None: "なし", Shock: "ショック", Ice: "アイス", Soul: "ソウル", Riot: "ライオット", Flame: "フレイム", "Master\u0027s": "マスター", Shadow: "シャドウ", "Devil\u0027s": "デビル", Seize: "シーズ", Heart: "ハート", Draw: "ドロー", "King\u0027s": "キング",
  Swords: "ソード", Slicers: "スライサー", Handguns: "ハンドガン", Shots: "ショット", Wands: "ウォンド", Canes: "ケイン", Rods: "ロッド", "Common frames": "コモンフレーム", "Common armors": "コモンアーマー", "Common Barriers": "コモンバリア", "Common Shields": "コモンシールド", "Common Units": "コモンユニット", Basic: "標準", "Min/Max": "レベル200の最大ステータス用", Pure: "単一能力特化", Console: "ゲーム機型", Custom: "指定育成", Varies: "条件による", "Basic Mag": "未育成マグ", "Music disks": "音楽ディスク", "Team Points": "チームポイント", Force: "フォース",
  Foie: "フォイエ", Gifoie: "ギフォイエ", Rafoie: "ラフォイエ", Barta: "バータ", Gibarta: "ギバータ", Rabarta: "ラバータ", Zonde: "ゾンデ", Gizonde: "ギゾンデ", Razonde: "ラゾンデ", Grants: "グランツ", Megid: "メギド", Resta: "レスタ", Anti: "アンティ", Reverser: "リバーサー", Ryuker: "リューカー", Shifta: "シフタ", Deband: "デバンド", Jellen: "ジェルン", Zalure: "ザルア",
  "Foie, Barta, Zonde": "フォイエ、バータ、ゾンデ", "Gifoie, Gibarta, Gizonde": "ギフォイエ、ギバータ、ギゾンデ", "Rafoie, Rabarta, Razonde": "ラフォイエ、ラバータ、ラゾンデ", "Shifta, Deband Jellen, Zalure": "シフタ、デバンド、ジェルン、ザルア", "Jellen (Lv. 21), Zalure (Lv. 21)": "ジェルン（Lv21）、ザルア（Lv21）",
  "HP Revival*, TP Revival*": "HP自動回復*、TP自動回復*", "Blizzard, Burning, Tempest": "ブリザード、バーニング、テンペスト", "Berserk, Chaos, Geist, Gush, King\u0027s, Spirit": "バーサーク、カオス、ガイスト、ガッシュ、キング、スピリット", "Arrest, Demon\u0027s, Hell": "アレスト、デーモン、ヘル", "D-Rank": "Dランク", "C-Rank": "Cランク", "B-Rank": "Bランク", "A-Rank": "Aランク", "S-Rank": "Sランク",
  "See note above": "上の注記を参照", "See CD5": "クレアの取引5を参照", "See The Forge and required materials": "The Forgeと必要素材を参照", "0 (see \"RL\" note)": "0（RLの注記を参照）",
};

const CHINESE_LABELS: Readonly<Record<string, string>> = {
  ...SECTION_LABELS, ...CATEGORY_LABELS, ...HEADER_LABELS, ...CHINESE_REFERENCE_LABELS,
  'Common frames': '普通铠甲（Frame）', 'Common armors': '普通铠甲（Armor）',
  'Common Barriers': '普通盾牌（Barrier）', 'Common Shields': '普通盾牌（Shield）', 'Common Units': '普通插件',
  Basic: '常规配点', 'Min/Max': '200 级满属性配点', Pure: '单项属性极限配点', Console: '游戏机型', Custom: '定制',
  Varies: '视具体要求而定', 'Basic Mag': '初始玛古', 'Music disks': '音乐光盘', 'Team Points': '队伍点数', Force: '法师',
  'Cure/" " set': 'Cure 系列插件套装', Elemental: '火／雷属性特殊攻击', 'None or Any': '无或任意特殊攻击', None: '无',
  'HP Revival*': 'HP 自动恢复*', 'TP Revival*': 'TP 自动恢复*',
};

type Language = 'zh' | 'en' | 'ja';
interface ItemTranslation { readonly en: string; readonly zh?: string; readonly ja?: string; }

/** Whole identities and explicit phrase boundaries only; never replace inside names. */
export class PriceLocalizer {
  private readonly exact: ReadonlyMap<string, ItemTranslation>;
  private readonly folded = new Map<string, ItemTranslation | null>();

  constructor(items: readonly ItemTranslation[]) {
    this.exact = new Map(items.map(item => [item.en, item]));
    for (const item of items) {
      const key = item.en.toLowerCase();
      this.folded.set(key, this.folded.has(key) ? null : item);
    }
  }

  private item(value: string): ItemTranslation | undefined {
    return this.exact.get(value) ?? this.folded.get(value.toLowerCase()) ?? undefined;
  }

  private labels(language: Exclude<Language, 'en'>): Readonly<Record<string, string>> {
    return language === 'zh' ? CHINESE_LABELS : JAPANESE_LABELS;
  }

  secondaryName(value: string, language: Language): string {
    if (language !== 'zh' || CHINESE_LABELS[value]) return '';
    return this.item(value)?.zh ?? '';
  }

  cell(value: string | null | undefined, language: Language): string {
    if (value == null) return '-';
    // Chinese retains the in-game English identity alongside the generated name.
    if (this.secondaryName(value, language)) return value;
    return this.text(value, language);
  }

  text(value: string, language: Language): string {
    if (language === 'en') return value;
    const labels = this.labels(language);
    if (labels[value]) return labels[value];
    if (value === 'Inestimable') return PRICE_TEXT[language].inestimable;
    if (value === 'Demons') return this.text("Demon's", language);
    const item = this.item(value);
    if (item) return item[language] || value;
    if (value.startsWith('Reminder High Attributes')) {
      const name = this.text('Excalibur', language);
      return language === 'zh'
        ? `注意：高属性指属性值达到 50 或以上。${name}（Excalibur）有多种用途：Native（原生）属性用于对付 EP4 的蜥蜴，A.Beast（变异兽）属性用于对付迪·洛尔·雷（De Rol Le），Machine（机械）属性用于压制波鲁欧普（Vol Opt）的行动。7–15 PD 的价格区间适用于属性值低于 50 的武器。`
        : `高属性とは50以上です。${name}は、Native属性ならEP4のリザード、A.Beast属性ならデ・ロル・レ、Machine属性ならボルオプトの拘束などに使用されます。7～15 PDは属性値50未満の価格です。`;
    }
    if (value === '0 (see "RL" note)') return language === 'zh' ? '0（参见“RL”备注）' : '0（RLの注記を参照）';
    if (value.startsWith('See ')) {
      return (language === 'zh' ? '参见：' : '参照：') + value.slice(4).split(/(\(|\)| & )/).map(token => {
        if (token === '(') return '（';
        if (token === ')') return '）';
        if (token === ' & ') return language === 'zh' ? '及' : '・';
        const name = token.trim();
        if (name === 'below') return language === 'zh' ? '见下方' : '下記';
        return this.text(name, language);
      }).join('');
    }
    if (value.includes(' - ')) return value.split(' - ').map(part => this.text(part, language)).join(' - ');
    if (/^Level \d+$/.test(value)) return value.replace('Level ', language === 'zh' ? '等级 ' : 'レベル');
    if (/^Unlabeled column \d+$/.test(value)) return value.replace('Unlabeled column ', language === 'zh' ? '未标注列 ' : '見出しなし列 ');
    if (/^[A-DS]-Rank$/.test(value)) return value[0] + (language === 'zh' ? ' 级' : 'ランク');
    if (/^1 per \d+$/.test(value)) return language === 'zh' ? `每 ${value.slice(6)} 次击杀 1 PD` : `${value.slice(6)}体につき1 PD`;
    if (value.startsWith('ES ')) return value.split(/ (?=ES )/).map(name => this.item(name)?.[language] || name).join(' / ');
    if (/^(?:\w+ Paint)(?: \w+ Paint)+$/.test(value)) return value.match(/\w+ Paint/g)!.map(name => this.text(name, language)).join(' / ');
    // The source omits one comma in this four-technique list.
    if (value === 'Shifta, Deband Jellen, Zalure') value = 'Shifta, Deband, Jellen, Zalure';
    if (value.includes(', ')) return value.split(', ').map(part => this.text(part, language)).join('、');
    const level = /^(.*) \(Lv\. (\d+)\)$/.exec(value);
    if (level) return `${this.text(level[1], language)}（Lv. ${level[2]}）`;
    return value;
  }
}
