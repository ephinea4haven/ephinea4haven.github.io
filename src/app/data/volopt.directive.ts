import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { VOL_OPT_DATA } from '../generated/data/volopt-data';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';

type WeaponValues = Readonly<Record<string, Readonly<Record<string, number>>>>;
type ShiftaValues = Readonly<Record<string, WeaponValues>>;
type ClassValues = Readonly<Record<string, ShiftaValues>>;
type ModeValues = Readonly<Record<string, ClassValues>>;

const PERCENTS = [0, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const DISPLAY: Readonly<Record<string, { readonly icon: string; readonly className: string }>> = {
  Excalibur: { icon: '⚔', className: 'weapon-sword' },
  Galatine: { icon: '⚔', className: 'weapon-sword' },
  'Sacred Duster': { icon: '★', className: 'weapon-fist' },
  'Angry Fist': { icon: '★', className: 'weapon-fist' },
  'Red Saber + Crimson Coat': { icon: '◆', className: 'set-name' },
  'Orotiagito + Samurai Armor': { icon: '◆', className: 'set-name' },
  Vivienne: { icon: '⚔', className: 'weapon-sword' },
};
const ITEM_NAMES = new Map(Object.values(ITEM_TRANSLATIONS)
  .filter((item) => item.en && item.zh)
  .map((item) => [item.en!.toLocaleLowerCase(), item.zh!] as const));

@Directive({ standalone: true })
export class VolOptBehavior {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = VOL_OPT_DATA as ModeValues;
  private mode = 'normal';
  private playerClass = 'humar';
  private shifta: string | null = null;

  constructor() {
    afterNextRender(() => this.connect());
  }

  private connect(): void {
    this.localizeStaticItemNames();
    this.connectTabs('mode-tabs', (button) => { this.mode = button.dataset['mode'] ?? this.mode; });
    this.connectTabs('class-tabs', (button) => { this.playerClass = button.dataset['class'] ?? this.playerClass; });
    const shiftaTabs = this.host.querySelector<HTMLElement>('#shifta-tabs');
    if (shiftaTabs) this.listen(shiftaTabs, 'click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button[data-shifta]') : null;
      if (!button) return;
      shiftaTabs.querySelector('.active')?.classList.remove('active');
      button.classList.add('active');
      this.shifta = button.dataset['shifta'] ?? null;
      this.render();
    });
    this.rebuildShifta();
    this.render();
  }

  private connectTabs(id: string, update: (button: HTMLButtonElement) => void): void {
    const tabs = this.host.querySelector<HTMLElement>(`#${id}`);
    if (!tabs) return;
    this.listen(tabs, 'click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button') : null;
      if (!button) return;
      tabs.querySelector('.active')?.classList.remove('active');
      button.classList.add('active');
      update(button);
      this.rebuildShifta();
      this.render();
    });
  }

  private shiftaLevels(): string[] {
    return Object.keys(this.data[this.mode]?.[this.playerClass] ?? {})
      .sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
  }

  private rebuildShifta(): void {
    const tabs = this.host.querySelector<HTMLElement>('#shifta-tabs');
    if (!tabs) return;
    const levels = this.shiftaLevels();
    tabs.replaceChildren(...levels.map((level, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = level.toUpperCase();
      button.dataset['shifta'] = level;
      button.classList.toggle('active', index === 0);
      return button;
    }));
    this.shifta = levels[0] ?? null;
  }

  private render(): void {
    const header = this.host.querySelector<HTMLTableRowElement>('#pct-header');
    const body = this.host.querySelector<HTMLTableSectionElement>('#cast-body');
    const table = this.host.querySelector<HTMLTableElement>('#cast-table');
    const empty = this.host.querySelector<HTMLElement>('#no-data-msg');
    if (!header || !body || !table || !empty) return;
    header.replaceChildren(...PERCENTS.map((percent) => {
      const cell = document.createElement('th');
      cell.textContent = String(percent);
      return cell;
    }));
    const weapons = this.shifta
      ? this.data[this.mode]?.[this.playerClass]?.[this.shifta] : undefined;
    if (!weapons || Object.keys(weapons).length === 0) {
      body.replaceChildren(); table.hidden = true; empty.hidden = false; return;
    }
    table.hidden = false;
    empty.hidden = true;
    body.replaceChildren(...Object.entries(weapons).map(([name, values]) => {
      const row = document.createElement('tr');
      const label = row.insertCell();
      const display = DISPLAY[name] ?? { icon: '', className: '' };
      const icon = document.createElement('span');
      icon.className = display.className;
      icon.textContent = display.icon ? `${display.icon} ` : '';
      label.append(icon, name);
      const itemNames = name.split(' + ');
      const translations = itemNames.map((itemName) => ITEM_NAMES.get(itemName.toLocaleLowerCase()));
      const translation = translations.every((itemName): itemName is string => Boolean(itemName))
        ? translations.join(' + ') : '';
      if (translation) {
        const translatedName = document.createElement('span');
        translatedName.textContent = translation;
        label.append(' ', translatedName);
      }
      for (const percent of PERCENTS) {
        const cell = row.insertCell();
        const value = values[String(percent)];
        cell.textContent = value === undefined ? '-' : String(value);
        cell.className = value === undefined ? 'no-val' : 'has-val';
      }
      return row;
    }));
  }

  private localizeStaticItemNames(): void {
    for (const element of this.host.querySelectorAll<HTMLElement>('[data-item-name]')) {
      const translation = ITEM_NAMES.get((element.dataset['itemName'] ?? '').toLocaleLowerCase());
      if (!translation) continue;
      const translatedName = document.createElement('span');
      translatedName.textContent = translation;
      element.append(' ', translatedName);
    }
  }

  private listen(target: EventTarget, event: string, listener: EventListener): void {
    target.addEventListener(event, listener);
    this.destroyRef.onDestroy(() => target.removeEventListener(event, listener));
  }
}
