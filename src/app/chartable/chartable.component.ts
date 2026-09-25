import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PageChromeComponent } from '../shared/page-chrome.component';

type StatRow = readonly [number, number, number, number, number, number, number];
type CharacterData = Record<string, { lv?: Record<string, StatRow> }>;

interface CharacterClass {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly group: '战士 Hunter' | '游骑兵 Ranger' | '法师 Force';
}

const CLASSES: readonly CharacterClass[] = [
  { id: 'humar', name: '废材', code: 'HUmar', group: '战士 Hunter' },
  { id: 'hunewearl', name: '花瓶', code: 'HUnewearl', group: '战士 Hunter' },
  { id: 'hucast', name: '男战', code: 'HUcast', group: '战士 Hunter' },
  { id: 'hucaseal', name: '女忍', code: 'HUcaseal', group: '战士 Hunter' },
  { id: 'ramar', name: '军哥', code: 'RAmar', group: '游骑兵 Ranger' },
  { id: 'ramarl', name: '军嫂', code: 'RAmarl', group: '游骑兵 Ranger' },
  { id: 'racast', name: '坦克', code: 'RAcast', group: '游骑兵 Ranger' },
  { id: 'racaseal', name: '女仆', code: 'RAcaseal', group: '游骑兵 Ranger' },
  { id: 'fomar', name: '爆法', code: 'FOmar', group: '法师 Force' },
  { id: 'fomarl', name: '人妻', code: 'FOmarl', group: '法师 Force' },
  { id: 'fonewm', name: '猴子', code: 'FOnewm', group: '法师 Force' },
  { id: 'fonewearl', name: '萝莉', code: 'FOnewearl', group: '法师 Force' },
];

@Component({
  selector: 'haven-chartable',
  imports: [FormsModule, PageChromeComponent],
  templateUrl: './chartable.component.html',
  styleUrl: '../../../assets/css/chartable.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartableComponent {
  private readonly meta = inject(Meta);
  private readonly injector = inject(Injector);
  readonly table = viewChild<ElementRef<HTMLTableElement>>('statTable');
  readonly classes = CLASSES;
  readonly groups = ['战士 Hunter', '游骑兵 Ranger', '法师 Force'] as const;
  readonly selectedClass = signal('humar');
  readonly levelError = signal('');
  readonly quickLevels = [1, 50, 100, 150, 200];
  readonly requestedLevel = signal<number | null>(null);
  readonly highlightedLevel = signal<number | null>(null);
  readonly data = inject(ActivatedRoute).snapshot.data['characterData'] as CharacterData | null;
  retry(): void { location.reload(); }

  constructor() {
    this.meta.updateTag({ name: 'description', content: 'PSOBB 全等级人物能力表' });
  }

  classesIn(group: CharacterClass['group']): readonly CharacterClass[] {
    return this.classes.filter((characterClass) => characterClass.group === group);
  }

  rowsFor(classId: string): readonly [string, StatRow][] {
    return Object.entries(this.data?.[classId]?.lv ?? {});
  }

  selectClass(classId: string): void {
    this.selectedClass.set(classId);
    this.scrollToLevel();
  }

  onTabKeydown(event: KeyboardEvent): void {
    const tabs = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    this.selectClass(this.classes[next].id);
    tabs[next].focus();
  }

  show(): void {
    const level = this.requestedLevel();
    if (level === null || !Number.isInteger(level) || level < 1 || level > 200) {
      this.levelError.set('请输入 1–200 之间的整数等级');
      return;
    }
    this.levelError.set('');
    this.highlightedLevel.set(level);
    this.scrollToLevel();
  }

  jumpTo(level: number): void {
    this.requestedLevel.set(level);
    this.show();
  }

  private scrollToLevel(): void {
    afterNextRender(() => {
      const table = this.table()?.nativeElement;
      const container = table?.parentElement;
      const level = this.highlightedLevel();
      const row = level === null ? null : table?.querySelector<HTMLElement>('tbody tr:nth-child(' + level + ')');
      if (!container) return;
      const top = row
        ? row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - container.clientHeight / 2 + row.offsetHeight / 2
        : 0;
      container.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, { injector: this.injector });
  }
}
