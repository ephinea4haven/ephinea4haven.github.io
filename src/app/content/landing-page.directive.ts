import { afterRenderEffect, Directive, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { LanguagePreferenceService } from '../shared/language-preference.service';
import { BrowserContentBehavior } from './browser-content-behavior.directive';

@Directive({ standalone: true, providers: [LanguagePreferenceService] })
export class LandingPageBehavior extends BrowserContentBehavior {
  private readonly i18n = inject(LanguagePreferenceService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly ready = signal(false);
  private labels: HTMLElement[] = [];
  private accessibleLabels: HTMLElement[] = [];
  private languageLinks: {anchor: HTMLAnchorElement; url: URL; home: boolean}[] = [];
  constructor() {
    super();
    afterRenderEffect(() => {
      const language = this.i18n.language();
      if (!this.ready()) return;
      for (const element of this.labels) element.textContent = element.dataset[language]!;
      for (const element of this.accessibleLabels) for (const attribute of ['aria-label', 'title', 'alt']) {
        const value = element.getAttribute(`data-home-${attribute}-${language}`);
        if (value !== null) element.setAttribute(attribute, value);
      }
      const controls = this.host.querySelector<HTMLElement>('#home-language')!;
      for (const button of controls.querySelectorAll<HTMLElement>('[data-home-lang]')) button.setAttribute('aria-pressed', String(button.dataset['homeLang'] === language));
      const suffix = language[0].toUpperCase() + language.slice(1);
      this.title.setTitle(controls.dataset[`title${suffix}`]!);
      this.meta.updateTag({name:'description',content:controls.dataset[`description${suffix}`]!});
      for (const {anchor,url,home} of this.languageLinks) {
        const localized = new URL(url);
        localized.searchParams.set('lang',language);
        // In-page links keep the current query and fragment navigation intact.
        if (home) localized.search = new URL(window.location.href).search;
        anchor.href = localized.href;
      }
      for (const element of this.host.querySelectorAll<HTMLElement>('[data-home-language-only]')) {
        element.hidden = element.dataset['homeLanguageOnly'] !== language;
      }
      this.tick();
    });
  }
  private text(zh: string, en: string, ja: string): string {
    return this.i18n.language() === 'zh' ? zh : this.i18n.language() === 'en' ? en : ja;
  }

  private static readonly galatineRanges: ReadonlyArray<readonly [number, number, string, string]> = [
    [0, 124, '0.33×', '110–140'], [125, 249, '0.5×', '165–210'],
    [250, 374, '1×', '330–420'], [375, 499, '2×', '660–840'],
    [500, 624, '3×', '990–1260'], [625, 749, '2×', '660–840'],
    [750, 874, '1×', '330–420'], [875, 999, '0.5×', '165–210'],
  ];
  private static readonly buffs: ReadonlyArray<readonly [string, string, string]> = [
    ['稀有怪率 (RER)  +50%', 'Rare enemy rate (RER) +50%', 'レアエネミー出現率 (RER) +50%'],
    ['掉宝率 (RDR)  +25%', 'Rare drop rate (RDR) +25%', 'レアドロップ率 (RDR) +25%'],
    ['经验值 (EXP)  +50%', 'Experience (EXP) +50%', '経験値 (EXP) +50%'],
    ['掉物率 (DAR)  +25%', 'Drop anything rate (DAR) +25%', 'アイテムドロップ率 (DAR) +25%'],
  ] as const;

  private updateActivityVisibility(now: Date): void {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    const today = `${value('year')}-${value('month')}-${value('day')}`;
    const activeIds = new Set<string>();
    for (const activity of this.host.querySelectorAll<HTMLElement>('[data-current-activity]')) {
      const activeFrom = activity.dataset['activeFrom'];
      const activeThrough = activity.dataset['activeThrough'];
      activity.hidden = !activeFrom || !activeThrough || today < activeFrom || today > activeThrough;
      if (!activity.hidden) activeIds.add(activity.dataset['currentActivity']!);
    }
    for (const link of this.host.querySelectorAll<HTMLElement>('[data-holiday]')) {
      link.classList.toggle('holiday-active', activeIds.has(link.dataset['holiday']!));
    }
  }

  private updateRbrFreshness(now: Date): void {
    const panel = this.host.querySelector<HTMLElement>('[data-rbr-week]');
    if (!panel) return;
    const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));
    const week = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' }).format(sunday);
    const fresh = panel.dataset['rbrWeek'] === week;
    const status = fresh ? 'fresh' : 'stale';
    panel.dataset['status'] = status;
    panel.querySelector('h2')!.textContent = fresh ? this.text('本周 RBR 任务', "This week's RBR quests", '今週の RBR クエスト') : this.text('RBR 任务 · 待更新', 'RBR quests · Update pending', 'RBR クエスト · 更新待ち');
    panel.querySelector('.home-rbr-status')!.textContent = fresh
      ? this.text(`记录周：${week} · UTC 周日轮替`, `Recorded week: ${week} · Rotates on Sunday UTC`, `記録週：${week} · UTC 日曜日に更新`)
      : this.text(`以下为 ${panel.dataset['rbrWeek']} 的记录，本周轮替尚待核对。`, `Showing the record for ${panel.dataset['rbrWeek']}; this week's rotation is awaiting verification.`, `${panel.dataset['rbrWeek']} の記録です。今週のローテーションは確認待ちです。`);
  }

  private tick(): void {
    const now = new Date();
    this.updateActivityVisibility(now);
    this.updateRbrFreshness(now);
    const hour = now.getUTCHours() === 23 ? 0 : now.getUTCHours() + 1;
    const beats = Math.abs((((hour * 60 + now.getUTCMinutes()) * 60) + now.getUTCSeconds()) / 86.4);
    const [whole, fraction] = beats.toFixed(2).split('.');
    const even = Math.floor(beats / 100) % 2 === 0;
    const swatch = this.host.querySelector<HTMLElement>('#swatchTime');
    const period = this.host.querySelector<HTMLElement>('#beat-period-label');
    if (swatch) {
      swatch.textContent = `@${whole.padStart(3, '0')}.${fraction}`;
      swatch.dataset['period'] = even ? 'divine' : 'normal';
    }
    if (period) {
      period.textContent = even ? this.text('当前：天罚时段', 'Now: Divine Punishment active', '現在：天罰の発動時間') : this.text('当前：普通时段', 'Now: Divine Punishment inactive', '現在：天罰の非発動時間');
      period.dataset['period'] = even ? 'divine' : 'normal';
    }

    const range = LandingPageBehavior.galatineRanges.find(([start, end]) => (
      Math.floor(beats) >= start && Math.floor(beats) <= end
    ));
    const atp = this.host.querySelector<HTMLElement>('#galatine-atp');
    const rangeLabel = this.host.querySelector<HTMLElement>('#galatine-period');
    if (range && atp && rangeLabel) {
      atp.textContent = `${range[2]} · ATP ${range[3]}`;
      atp.dataset['multiplier'] = range[2];
      rangeLabel.textContent = this.text(`当前区间：beat ${range[0]}–${range[1]}`, `Current range: beat ${range[0]}–${range[1]}`, `現在の範囲：beat ${range[0]}–${range[1]}`);
    }

    // Weekly boosts rotate at Sunday 00:00 UTC, independent of the player's zone.
    // https://wiki.pioneer2.net/w/Weekly_boosts
    const epoch = Date.UTC(2019, 8, 22);
    const weeks = Math.floor((now.getTime() - epoch) / 86_400_000 / 7);
    const offset = ((weeks % 4) + 4) % 4;
    const current = this.host.querySelector<HTMLElement>('#buf-current');
    const next = this.host.querySelector<HTMLElement>('#buf-next');
    if (current) current.textContent = this.text(...LandingPageBehavior.buffs[offset]);
    if (next) next.textContent = this.text('下周轮替：', 'Next week: ', '来週：') + this.text(...LandingPageBehavior.buffs[(offset + 1) % 4]);
  }
  protected connect(): void {
    this.labels = [...this.host.querySelectorAll<HTMLElement>('[data-home-i18n]')];
    this.accessibleLabels = [...this.host.querySelectorAll<HTMLElement>('[data-home-aria-label-zh],[data-home-title-zh],[data-home-alt-zh]')];
    const catalogs = new Set(['/data/items.html', '/data/enemies.html', '/data/cosmetics.html']);
    for (const anchor of this.host.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const url = new URL(anchor.href);
      const local = url.origin === window.location.origin;
      const home = local && ['/', '/index.html'].includes(url.pathname);
      if (home || (local && catalogs.has(url.pathname)) || url.hostname === 'dropcharts.psohaven.com') this.languageLinks.push({anchor,url,home});
    }
    this.listen(this.host.querySelector('#home-language')!, 'click', ((event: MouseEvent) => {
      const requested = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-home-lang]')?.dataset['homeLang'] : null;
      if (requested === 'zh' || requested === 'en' || requested === 'ja') void this.i18n.select(requested);
    }) as EventListener);
    this.ready.set(true);
    const timer = window.setInterval(() => this.tick(), 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));
  }

}
