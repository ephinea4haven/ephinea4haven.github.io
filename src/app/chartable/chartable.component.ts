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
import { PageChromeComponent } from '../shared/page-chrome.component';
import characterData from '../../../assets/js/chardata.json';

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
  readonly selectedClass = signal('');
  readonly requestedLevel = signal<number | null>(null);
  readonly highlightedLevel = signal<number | null>(null);
  readonly data = characterData as unknown as CharacterData;

  constructor() {
    this.meta.updateTag({ name: 'description', content: 'PSOBB 全等级人物能力表' });
  }

  classesIn(group: CharacterClass['group']): readonly CharacterClass[] {
    return this.classes.filter((characterClass) => characterClass.group === group);
  }

  rowsFor(classId: string): readonly [string, StatRow][] {
    return Object.entries(this.data[classId]?.lv ?? {});
  }

  show(): void {
    const classId = this.selectedClass();
    if (!classId) {
      window.alert('请选择职业');
      return;
    }
    const level = this.requestedLevel();
    if (level !== null && (level < 1 || level > 200)) {
      window.alert('请输入有效的等级（1-200）');
      return;
    }
    this.highlightedLevel.set(level);
    afterNextRender(() => {
      const target = level === null
        ? this.table()?.nativeElement
        : this.table()?.nativeElement.querySelector(`tbody tr:nth-child(${level})`);
      target?.scrollIntoView({ behavior: 'smooth', block: level === null ? 'start' : 'center' });
    }, { injector: this.injector });
  }

  reset(): void {
    this.selectedClass.set('');
    this.requestedLevel.set(null);
    this.highlightedLevel.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollToTop(event: Event): void {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
