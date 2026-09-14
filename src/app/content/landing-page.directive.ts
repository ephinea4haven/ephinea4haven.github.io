import { Directive } from '@angular/core';
import { BrowserContentBehavior } from './browser-content-behavior.directive';

@Directive({ standalone: true })
export class LandingPageBehavior extends BrowserContentBehavior {
  private static readonly galatineRanges: ReadonlyArray<readonly [number, number, string, string]> = [
    [0, 124, '0.33×', '110–140'], [125, 249, '0.5×', '165–210'],
    [250, 374, '1×', '330–420'], [375, 499, '2×', '660–840'],
    [500, 624, '3×', '990–1260'], [625, 749, '2×', '660–840'],
    [750, 874, '1×', '330–420'], [875, 999, '0.5×', '165–210'],
  ];
  private static readonly buffs = [
    '稀有怪率 (RER)  +50%', '掉宝率 (RDR)  +25%',
    '经验值 (EXP)  +50%', '掉物率 (DAR)  +25%',
  ];

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
    if (panel.dataset['status'] === status) return;
    panel.dataset['status'] = status;
    panel.querySelector('h2')!.textContent = fresh ? '本周 RBR 任务' : 'RBR 任务 · 待更新';
    panel.querySelector('.home-rbr-status')!.textContent = fresh
      ? `记录周：${week} · UTC 周日轮替`
      : `以下为 ${panel.dataset['rbrWeek']} 的记录，本周轮替尚待核对。`;
  }

  protected connect(): void {
    const tick = () => {
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
        period.textContent = even ? '当前：天罚时段' : '当前：普通时段';
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
        rangeLabel.textContent = `当前区间：beat ${range[0]}–${range[1]}`;
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));

    const epoch = new Date(2019, 8, 22, 8).getTime();
    const offset = Math.floor((Date.now() - epoch) / 86_400_000 / 7) % 4;
    const current = this.host.querySelector<HTMLElement>('#buf-current');
    const next = this.host.querySelector<HTMLElement>('#buf-next');
    if (current) current.textContent = LandingPageBehavior.buffs[offset];
    if (next) next.textContent = `下周轮替：${LandingPageBehavior.buffs[(offset + 1) % 4]}`;
  }
}
