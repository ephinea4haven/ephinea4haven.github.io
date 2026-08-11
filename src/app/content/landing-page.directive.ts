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

  protected connect(): void {
    const tick = () => {
      const now = new Date();
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

    const date = new Date();
    const month = date.getMonth() + 1;
    const monthDay = month * 100 + date.getDate();
    const active: Record<string, boolean> = {
      valentines: month === 2,
      easter: monthDay >= 301 && monthDay <= 515,
      anniversary: monthDay >= 801 && monthDay <= 915,
      halloween: monthDay >= 1001 && monthDay <= 1110,
      christmas: monthDay >= 1201 || monthDay <= 115,
    };
    for (const link of this.host.querySelectorAll<HTMLElement>('[data-holiday]')) {
      link.classList.toggle('holiday-active', active[link.dataset['holiday'] ?? ''] === true);
    }
  }
}
