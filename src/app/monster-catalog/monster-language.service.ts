import { Injectable } from '@angular/core';
import { LanguagePreferenceService } from '../shared/language-preference.service';
import type { Names } from './monster';
const messages: Record<string,[string,string]> = {
  '图片版本':['Image version','画像の種類'], '高清图片':['HD image','高精細画像'], '现有图片':['Wiki image','Wiki 画像'],
  '查看原图 ↗':['View full image ↗','元の画像を見る ↗'],
  '图片来源：高清图库':['Image source: HD gallery','画像出典：高精細ギャラリー'],
  '图片来源：Ephinea Wiki':['Image source: Ephinea Wiki','画像出典：Ephinea Wiki'],
  '暂无此条件下的机制表格，请结合说明与来源阅读。':['No mechanic tables recorded for these conditions; see the notes and sources.','この条件の仕様表は未収録です。解説と出典を参照してください。'],
  '怪物图鉴':['Bestiary','エネミー図鑑'], '返回主页':['Home','ホーム'], '道具图鉴':['Item Database','アイテム図鑑'],
  '怪物周回指南':['Hunting Guide','周回ガイド'], '搜寻拉古奥尔的每一个威胁。':['Know what awaits on Ragol.','ラグオルの脅威を知る。'],
  '按章节、难度与模式查看属性、行为机制和掉落。':['Explore stats, mechanics and drops by episode, difficulty and mode.','エピソード・難易度・モード別に能力値、行動、ドロップを確認。'],
  '搜索怪物名称或区域':['Search enemies or areas','エネミー名・エリアを検索'], '全部区域':['All areas','全エリア'],
  '全部类型':['All types','全種類'], '普通怪物':['Regular enemies','通常エネミー'], '稀有怪物':['Rare enemies','レアエネミー'], '首领':['Bosses','ボス'], '部位与召唤物':['Parts & summons','部位・召喚体'],
  '章节':['Episode','エピソード'], '区域':['Area','エリア'], '类型':['Type','種類'], '难度':['Difficulty','難易度'], '模式':['Mode','モード'],
  '多人模式':['Multiplayer','通常モード'], '单人模式':['One Person','一人用モード'], '怪物':['Enemies','エネミー'], '属性':['Attribute','属性'],
  '没有匹配的怪物':['No matching enemies','一致するエネミーがありません'], '清除筛选':['Clear filters','絞り込みを解除'],
  '上一页':['Previous','前へ'], '下一页':['Next','次へ'], '返回列表':['Back to list','一覧に戻る'], '图片暂缺':['Image unavailable','画像なし'],
  '基础属性':['Base stats','基本能力値'], '行为与特殊机制':['Behavior & mechanics','行動・特殊仕様'], '攻击与机制数据':['Attack & mechanic data','攻撃・仕様データ'],
  '稀有掉落':['Rare drops','レアドロップ'], '资料来源':['Sources','出典'], '暂无此难度与模式的属性记录':['No stats recorded for this difficulty and mode','この難易度・モードの能力値は未収録です'],
  '机制说明（中文整理）':['Mechanics notes (Chinese)','仕様の解説（中国語）'], '来源表格（英文原文）':['Source tables (English)','出典の表（英語原文）'],
  '来源未填写':['Not specified by source','出典に記載なし'], '行为说明尚未收录，可查阅来源页面。':['Behavior notes are not yet documented; see the source page.','行動の解説は未収録です。出典を参照してください。'],
  '数值需结合攻击类型、抗性、部位及触发条件阅读；未填写不代表 0。':['Read values with their damage type, resistances, part and trigger conditions. Blank does not mean zero.','攻撃の種類・耐性・部位・発動条件を併せて確認してください。未記載は 0 を意味しません。'],
  '此条目未关联独立的稀有掉落记录。':['No independent rare-drop row is linked to this entry.','この項目に独立したレアドロップは登録されていません。'],
  '以下为首领击破奖励，不是各部位分别掉落。':['These are boss-clear drops, not separate drops from each part.','以下はボス撃破時のドロップです。各部位の個別ドロップではありません。'],
  '掉落概率来自 droptable，为每次击杀的基础 DR，已包含 DAR；不要再次相乘。未计活动及队伍加成。':['Rates come from droptable: base per-kill DR already includes DAR. Do not multiply again. Event and party boosts are excluded.','確率は droptable の基本 DR（撃破ごと）で、DAR を含みます。再度掛け合わせないでください。イベント・パーティ補正は含みません。'],
  '没有稀有掉落':['No rare drop','レアドロップなし'], '打开掉落表':['Open drop chart','ドロップ表を開く'], '核对日期':['Checked','確認日'], '图片来源':['Image source','画像の出典'],
  '返回并重试':['Reload and retry','再読み込み'], '资料暂时无法加载':['Unable to load data','データを読み込めません'], '未找到怪物':['Enemy not found','エネミーが見つかりません'],
  '森林':['Forest','森'], '洞窟':['Cave','洞窟'], '坑道':['Mine','坑道'], '遗迹':['Ruins','遺跡'],
  '天幻怪物图鉴':['FFSKY bestiary','天幻エネミー図鑑'], '部位':['Part','部位'], '稀有':['Rare','レア'], '首领与部位的属性分别记录。':['Boss and part stats are recorded separately.','ボスと部位の能力値は個別に収録しています。'],
  '统计条目':['Entries','項目'], '数据核对':['Data checked','データ確認'], '排序':['Sort','並べ替え'], '图鉴顺序':['Catalog order','図鑑順'], 'HP 从高到低':['HP: high to low','HP の高い順'],
  '生命值':['Hit points','HP'], '攻击力':['Attack power','攻撃力'], '防御力':['Defense','防御力'], '精神力':['Mental strength','精神力'], '命中':['Accuracy','命中力'], '回避':['Evasion','回避力'], '运气':['Luck','運'], '经验':['Experience','経験値'],
  '火抗性':['Fire resistance','炎耐性'], '冰抗性':['Ice resistance','氷耐性'], '雷抗性':['Lightning resistance','雷耐性'], '暗抗性':['Dark resistance','闇耐性'], '光抗性':['Light resistance','光耐性'], '异常抗性':['Status resistance','状態異常耐性'], '普通掉落类型':['Common drop type','通常ドロップ種別'],
  '深绿':['Viridia','Viridia'], '黄绿':['Greenill','Greenill'], '天蓝':['Skyly','Skyly'], '蓝':['Bluefull','Bluefull'], '紫':['Purplenum','Purplenum'], '粉':['Pinkal','Pinkal'], '红':['Redria','Redria'], '橙':['Oran','Oran'], '黄':['Yellowboze','Yellowboze'], '白':['Whitill','Whitill'],
};
const areas: Record<string,[string,string]> = {'Forest':['森林','森'],'Cave':['洞窟','洞窟'],'Mine':['坑道','坑道'],'Ruins':['遗迹','遺跡'],'VR Temple':['VR 神殿','VR 神殿'],'VR Spaceship':['VR 宇宙船','VR 宇宙船'],'Central Control Area':['中央管理区','中央管理区'],'Control Tower':['控制塔','制御塔'],'Seabed':['海底','海底プラント'],'Crater':['陨石坑','クレーター'],'Subterranean Desert':['地下沙漠','地下砂漠'],'Under the Dome':['中央圆顶地下','ドーム地下'],'Underground Channel':['地下水道','地下水路'],'Monitor Room':['监控室','モニタールーム'],'Meteor Impact Site':['陨石撞击点','隕石落下地点'],'Cliffs of Gal Da Val':['加尔达瓦悬崖','ガル・ダ・バルの断崖'],'Test Subject Disposal Area':['实验体处理场','実験体廃棄場']};
@Injectable()
export class MonsterLanguageService extends LanguagePreferenceService {
  t(key:string):string {return this.language() === 'zh' ? key : messages[key]?.[this.language() === 'en' ? 0 : 1] || key;}
  name(names:Names):string {return names[this.language()];}
  area(value:string, language=this.language()):string {
    if (language === 'en') return value;
    for (const [en,translated] of Object.entries(areas)) if (value === en || value.startsWith(en+' ')) return translated[language === 'zh' ? 0 : 1]+value.slice(en.length);
    return value;
  }
}
