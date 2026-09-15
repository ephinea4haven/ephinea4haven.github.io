import type { CatalogLanguage } from './catalog-messages';

// Long explanatory copy used only by the cosmetics overview, kept out of the shared catalog bundle.
export const COSMETICS_MESSAGES: Record<string, readonly [string, string]> = {
  '先装备适用武器，再在道具栏使用对应的武器之心。': ['Equip a compatible weapon, then use the matching heart from your inventory.', '対応する武器を装備してから、アイテム欄で武器の心を使います。'],
  '只改变武器或红色手镯的外观，性能保持不变的 Ephinea 限定道具。': ['Ephinea-exclusive items that change how a weapon or Red Ring looks without changing its performance.', '武器やレッドリングの見た目だけを変え、性能は変えない Ephinea 限定アイテムです。'],
  '使用中和剂可恢复原本外观，但已使用的武器之心不会返还。中和剂可在任务 The Forge 与 Seasons Shop 免费领取。': ['A Neutralizer restores the original look, but the heart is not returned. Neutralizers are free from the quests The Forge and Seasons Shop.', 'Neutralizer で元の見た目に戻せますが、使った武器の心は戻りません。Neutralizer はクエスト The Forge と Seasons Shop で無料で入手できます。'],
  '武器之心的适用武器取自各道具页面，并与 Weapon hearts 列表逐项核对；戒指染色与戒指外观取自红色手镯及各道具页面。掉落概率取自各道具引用的修订，未计入活动与队伍加成。': ["Weapon heart compatibility comes from each item page and is checked entry by entry against the Weapon hearts list. Ring paints and platings come from the Red Ring page and each item page. Drop rates come from each item's cited revision and exclude event and party boosts.", '武器の心の対応武器は各アイテムページから取得し、Weapon hearts 一覧と 1 件ずつ照合しています。リングのペイントとメッキはレッドリングと各アイテムのページに基づきます。ドロップ率は各アイテムの引用版に基づき、イベントやパーティーのボーナスは含みません。'],
  '米尔·马尔托与圣枪「天罚」若同时带有外观和神罚滤镜或锁定滤镜，第一次使用中和剂只移除滤镜效果，第二次才移除外观。': ['If a Mille Marteaux or Heaven Punisher has both a skin and a Divine Filter or Lock-on Filter, the first Neutralizer removes only the filter and a second one removes the skin.', 'Mille Marteaux やヘブンパニッシャーに外観と Divine Filter または Lock-on Filter の両方がある場合、1 回目の Neutralizer はフィルターだけを外し、2 回目で外観が外れます。'],
  '镀层只能在任务 The Forge 中向 Montague 交换获得。换外观后名称后会加上 *，使用红色涂料可恢复原版外观，但已使用的镀层不会返还。': ['Platings are only available by trading with Montague in the quest The Forge. A plated ring gets an asterisk (*) after its name. Red Paint restores the original look, but used platings are not returned.', 'メッキはクエスト The Forge で Montague との交換でのみ入手できます。外観を変えたリングの名前には * が付き、Red Paint で元の見た目に戻せますが、使ったメッキは戻りません。'],
  '装备红色手镯（原版或已染色）后在道具栏使用，只改变戒指颜色，性能与普通红色手镯相同。': ['Equip a Red Ring, original or already painted, then use the paint from your inventory. Only the color changes; it performs exactly like a normal Red Ring.', 'レッドリング（元の状態または塗装済み）を装備してアイテム欄で使います。色だけが変わり、性能は通常のレッドリングと同じです。'],
  '染色后名称后会加上 *。使用红色涂料可恢复原版外观，但已使用的涂料不会返还。': ['A painted ring gets an asterisk (*) after its name. Red Paint restores the original look, but used paints are not returned.', '塗装したリングの名前には * が付きます。Red Paint で元の見た目に戻せますが、使ったペイントは戻りません。'],
  '武器外观改变，攻击力、特殊攻击等参数保持原武器；武器磨数会被重置。': ["Only the weapon's look changes; its ATP, special attack and other parameters stay the same. Its grind is reset.", '見た目だけが変わり、攻撃力や EX などの性能は元の武器のままです。グラインドはリセットされます。'],
  '武器名称后会加上 *，道具说明中显示“Skin: 外观名”。': ['An asterisk (*) is added to the weapon name, and its description shows "Skin: <skin name>".', '武器名の後ろに * が付き、説明文に「Skin: 外観名」と表示されます。'],
  '装备红色手镯后在道具栏使用，外观变为另一面盾牌，性能与普通红色手镯相同。': ['Equip a Red Ring, then use the plating from your inventory. The ring takes the look of another barrier and performs exactly like a normal Red Ring.', 'レッドリングを装備してアイテム欄で使うと、別の盾の見た目になります。性能は通常のレッドリングと同じです。'],
  '光子滤镜只对下表标注颜色的组合有效；每次使用消耗一个，并按固定顺序切换颜色。': ['A Photon Filter only works on the combinations marked with a color below. Each use consumes one filter and moves to the next color in a fixed cycle.', 'フォトンフィルターは下の一覧で色が記載された組み合わせにのみ有効です。使うたびに 1 つ消費し、決まった順番で色が変わります。'],
};

export function cosmeticsText(text: string, language: CatalogLanguage): string {
  return language === 'zh' ? text : COSMETICS_MESSAGES[text]?.[language === 'en' ? 0 : 1] ?? text;
}
