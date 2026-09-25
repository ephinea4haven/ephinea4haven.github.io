import type { PageLanguage } from '../shared/site-language.service';

export const EVENT_TEXT = {
  zh: {
    anniversary: '周年活动', christmas: '圣诞活动', easter: 'Easter 活动',
    halloween: 'Halloween 活动', valentines: 'Valentine’s 活动',
    loadError: (year: number, name: string) => `未能加载 ${year} 年${name}内容。`,
    appearance: '外观', expand: '展开年份导航', collapse: '收起年份导航',
    enlarge: (caption: string) => `查看 ${caption} 大图`,
  },
  en: {
    anniversary: 'Anniversary event', christmas: 'Christmas event', easter: 'Easter event',
    halloween: 'Halloween event', valentines: 'Valentine’s event',
    loadError: (year: number, name: string) => `Could not load the ${year} ${name.toLowerCase()} archive.`,
    appearance: 'Appearance', expand: 'Expand year navigation', collapse: 'Collapse year navigation',
    enlarge: (caption: string) => `Enlarge ${caption}`,
  },
  ja: {
    anniversary: '周年イベント', christmas: 'クリスマスイベント', easter: 'イースターイベント',
    halloween: 'ハロウィンイベント', valentines: 'バレンタインイベント',
    loadError: (year: number, name: string) => `${year}年の${name}を読み込めませんでした。`,
    appearance: '外見', expand: '年の一覧を開く', collapse: '年の一覧を閉じる',
    enlarge: (caption: string) => `${caption}の画像を拡大`,
  },
} satisfies Record<PageLanguage, unknown>;

export type EventName = 'anniversary' | 'christmas' | 'easter' | 'halloween' | 'valentines';
