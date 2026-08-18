import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatUtc8Timestamp } from './utc8-timestamp';

@Component({
  selector: 'page-update-stamp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span>最后更新</span>
    <time [attr.datetime]="timestamp()">{{ localizedTimestamp() }}</time>
  `,
  styles: `
    :host {
      display: flex;
      align-items: baseline;
      gap: 7px;
      width: fit-content;
      padding: 6px 10px;
      border: 1px solid hsl(188 92% 62% / 0.72);
      border-top-color: hsl(188 100% 84% / 0.88);
      border-bottom-color: hsl(204 82% 34% / 0.76);
      border-radius: 4px;
      background:
        linear-gradient(110deg, hsl(188 92% 58% / 0.09), transparent 52%),
        hsl(222 52% 10% / 0.42);
      color: hsl(190 34% 78%);
      font-size: 12px;
      font-weight: 400;
      line-height: 1.4;
      box-shadow:
        0 9px 18px hsl(225 90% 3% / 0.62),
        0 2px 0 hsl(204 82% 30% / 0.72),
        0 0 12px hsl(188 92% 58% / 0.48),
        0 0 30px hsl(188 92% 58% / 0.26),
        0 0 52px hsl(188 92% 58% / 0.12),
        inset 0 0 14px hsl(188 92% 58% / 0.1);
      transform: rotate(var(--update-stamp-tilt, -1deg)) scale(var(--update-stamp-scale, 1));
      transform-origin: center;
      animation: update-stamp-glow 2.4s ease-in-out infinite alternate;
      isolation: isolate;
    }

    :host::before {
      align-self: center;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: hsl(188 100% 70%);
      box-shadow: 0 0 6px hsl(188 100% 70%), 0 0 14px hsl(188 92% 58%);
      content: '';
    }

    :host::after {
      position: absolute;
      inset: 5px -4px -6px 4px;
      z-index: -1;
      border-radius: 4px;
      background: hsl(225 74% 4% / 0.58);
      filter: blur(3px);
      content: '';
    }

    span {
      color: hsl(188 72% 78%);
      font-size: 10px;
      letter-spacing: 0.1em;
      text-shadow: 0 0 9px hsl(188 92% 58% / 0.64);
    }

    time {
      color: hsl(190 44% 90%);
      font-weight: 400;
      text-shadow: 0 0 11px hsl(188 92% 58% / 0.48);
    }

    @keyframes update-stamp-glow {
      to {
        border-color: hsl(188 100% 72% / 0.92);
        box-shadow:
          0 11px 22px hsl(225 90% 3% / 0.68),
          0 2px 0 hsl(204 82% 30% / 0.78),
          0 0 16px hsl(188 100% 62% / 0.66),
          0 0 38px hsl(188 92% 58% / 0.34),
          0 0 64px hsl(188 92% 58% / 0.18),
          inset 0 0 18px hsl(188 92% 58% / 0.14);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class PageUpdateStampComponent {
  readonly timestamp = input.required<string>();
  readonly localizedTimestamp = computed(() => formatUtc8Timestamp(this.timestamp()));
}
