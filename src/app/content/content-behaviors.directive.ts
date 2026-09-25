import { afterRenderEffect, Directive, inject, signal } from '@angular/core';
import { BrowserContentBehavior } from './browser-content-behavior.directive';
import { SiteLanguage } from '../shared/site-language.service';

@Directive({ standalone: true })
export class SeabedRouteBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const container = this.host.querySelector<HTMLElement>('[data-seabed-routes]');
    const variants = Array.from(container?.querySelectorAll<HTMLDetailsElement>('details') ?? []);
    if (!container || !variants.length) return;

    const activate = (selected: HTMLDetailsElement) => {
      for (const variant of variants) variant.open = variant === selected;
    };
    activate(variants.find((variant) => variant.open) ?? variants[0]);

    for (const variant of variants) {
      const summary = variant.querySelector<HTMLElement>('summary');
      if (!summary) continue;
      this.listen(summary, 'click', (event) => {
        event.preventDefault();
        activate(variant);
      });
      this.listen(summary, 'keydown', ((event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate(variant);
      }) as EventListener);
    }
    container.dataset['seabedRoutes'] = 'ready';
  }
}

@Directive({ standalone: true })
export class ItemTableSearchBehavior extends BrowserContentBehavior {
  private readonly site = inject(SiteLanguage);
  protected connect(): void {
    const text = {
      zh: { count: (n: number, total: number) => `找到 ${n} 条匹配结果（共 ${total} 条）`, more: '结果过多，请输入更精确的关键词', headers: ['代码', '名称'] },
      en: { count: (n: number, total: number) => `Found ${n} matches (${total} entries)`, more: 'Too many results. Enter a more specific search.', headers: ['Code', 'Name'] },
      ja: { count: (n: number, total: number) => `全${total}件中${n}件が一致`, more: '結果が多すぎます。検索語を絞り込んでください。', headers: ['コード', '名称'] },
    }[this.site.language()];
    const input = this.host.querySelector<HTMLInputElement>('#searchBox');
    const count = this.host.querySelector<HTMLElement>('#searchCount');
    const results = this.host.querySelector<HTMLElement>('#searchResults');
    if (!input || !count || !results) return;

    const rows = Array.from(this.host.querySelectorAll<HTMLTableRowElement>('.compact-table tbody tr'));
    const update = () => {
      const query = input.value.trim().toLocaleLowerCase();
      results.replaceChildren();
      if (!query) {
        rows.forEach((row) => { row.hidden = false; });
        count.textContent = '';
        return;
      }

      const matches = rows.filter((row) => {
        // Match the shown name and the item's English identity.
        const identities = Array.from(row.querySelectorAll<HTMLElement>('[data-item-en]'), (element) => element.dataset['itemEn']);
        const matched = [row.textContent, ...identities].join(' ').toLocaleLowerCase().includes(query);
        row.hidden = !matched;
        return matched;
      });
      count.textContent = text.count(matches.length, rows.length);
      if (matches.length > 50) {
        const note = document.createElement('p');
        note.className = 'search-results-note';
        note.textContent = text.more;
        results.append(note);
        return;
      }
      if (!matches.length) return;

      const table = document.createElement('table');
      table.className = 'search-results-table';
      const head = table.createTHead().insertRow();
      for (const label of text.headers) {
        const cell = document.createElement('th');
        cell.textContent = label;
        head.append(cell);
      }
      const body = table.createTBody();
      for (const match of matches) {
        const sourceCells = match.querySelectorAll('td');
        if (sourceCells.length < 2) continue;
        const row = body.insertRow();
        row.insertCell().textContent = sourceCells[0].textContent?.trim() ?? '';
        row.insertCell().textContent = sourceCells[1].textContent?.trim() ?? '';
      }
      results.append(table);
    };
    this.listen(input, 'input', update);
  }
}

@Directive({ standalone: true })
export class MonsterFilterBehavior extends BrowserContentBehavior {
  private readonly site = inject(SiteLanguage);
  protected connect(): void {
    const language = this.site.language();
    const countText = {
      zh: (visible: number, total: number) => `${visible} / ${total} 项`,
      en: (visible: number, total: number) => `${visible} / ${total} entries`,
      ja: (visible: number, total: number) => `全${total}件中${visible}件`,
    }[language];
    const content = this.host.querySelector<HTMLElement>('.content-container');
    const input = this.host.querySelector<HTMLInputElement>('#monsterSearch');
    const count = this.host.querySelector<HTMLElement>('#monsterCount');
    if (!content || !input || !count) return;

    const starts = Array.from(content.querySelectorAll<HTMLElement>('p:has(> strong)'));
    for (const start of starts) {
      const section = document.createElement('section');
      section.className = 'monster-entry';
      start.before(section);
      let node: Element | null = start;
      while (node && !(node !== start && node.matches('p:has(> strong), h2, h3'))) {
        const next: Element | null = node.nextElementSibling;
        section.append(node);
        node = next;
      }
    }

    const entries = Array.from(content.querySelectorAll<HTMLElement>('.monster-entry'));
    const headings = Array.from(content.querySelectorAll<HTMLElement>('.episode-heading, .area-heading'));
    for (const entry of entries) {
      let cursor = entry.previousElementSibling;
      let area = '';
      let episode = '';
      while (cursor && !episode) {
        if (!area && cursor.matches('.area-heading')) area = cursor.textContent ?? '';
        if (cursor.matches('.episode-heading')) episode = cursor.textContent ?? '';
        cursor = cursor.previousElementSibling;
      }
      entry.dataset['search'] = `${episode} ${area} ${entry.textContent}`.toLocaleLowerCase('zh-CN');
    }

    const update = () => {
      const query = input.value.trim().toLocaleLowerCase('zh-CN');
      let visible = 0;
      for (const entry of entries) {
        const matches = !query || (entry.dataset['search']?.includes(query) ?? false);
        entry.hidden = !matches;
        if (matches) visible++;
      }
      for (const heading of headings) {
        let node = heading.nextElementSibling;
        let hasVisibleEntry = false;
        while (node && !node.matches(heading.matches('h2') ? 'h2' : 'h2, h3')) {
          if (node.matches('.monster-entry') && !(node as HTMLElement).hidden) hasVisibleEntry = true;
          node = node.nextElementSibling;
        }
        heading.hidden = Boolean(query) && !hasVisibleEntry;
      }
      count.textContent = countText(visible, entries.length);
    };
    this.listen(input, 'input', update);
    update();
  }
}

@Directive({ standalone: true })
export class ProfessionTabsBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const names = ['hunter', 'ranger', 'force'];
    const tabs = Array.from(this.host.querySelectorAll<HTMLElement>('[data-profession]'));
    const panels = names.map((name) => this.host.querySelector<HTMLElement>(`#${name}`)).filter(Boolean) as HTMLElement[];

    const activate = (requested: string, updateUrl: boolean) => {
      const name = names.includes(requested) ? requested : names[0];
      for (const tab of tabs) {
        const active = tab.dataset['profession'] === name;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      }
      for (const panel of panels) panel.hidden = panel.id !== name;
      if (updateUrl) history.replaceState(null, '', `#${name}`);
    };
    const activateFromHash = () => {
      const hash = location.hash.slice(1);
      const target = hash ? this.host.querySelector<HTMLElement>(`#${CSS.escape(hash)}`) : null;
      const panel = target?.closest<HTMLElement>('.profession-panel');
      activate(panel?.id ?? hash, false);
      if (target instanceof HTMLDetailsElement) target.open = true;
      if (target && panel) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    };

    tabs.forEach((tab, index) => {
      this.listen(tab, 'click', () => activate(tab.dataset['profession'] ?? '', true));
      this.listen(tab, 'keydown', ((event: KeyboardEvent) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(index + offset + tabs.length) % tabs.length];
        activate(next.dataset['profession'] ?? '', true);
        next.focus();
      }) as EventListener);
    });
    this.listen(window, 'hashchange', activateFromHash);
    activateFromHash();
  }
}

@Directive({ standalone: true })
export class NotFoundRedirectBehavior extends BrowserContentBehavior {
  private readonly site = inject(SiteLanguage);
  /** GitHub Pages serves one 404 page for every missing URL; it speaks the URL's language. */
  private static readonly text = {
    zh: { title: '页面未找到 - PSO Haven', heading: '404 - 页面未找到', before: '您访问的页面不存在，', link: '返回首页' },
    en: { title: 'Page not found - PSO Haven', heading: '404 - Page not found', before: 'The page you requested does not exist. ', link: 'Back to Home' },
    ja: { title: 'ページが見つかりません - PSO Haven', heading: '404 - ページが見つかりません', before: 'お探しのページは存在しません。', link: 'ホームに戻る' },
  };

  protected connect(): void {
    const dropChartsOrigin = 'https://dropcharts.psohaven.com';
    const pathTargets: Record<string, string> = {
      '/tools/mag-sim.html': `https://magfeeder.psohaven.com/${location.search}${location.hash}`,
      '/droptable/cn/CNormal.html': `${dropChartsOrigin}/bb/?lang=zh&diff=Normal`,
      '/droptable/cn/CHard.html': `${dropChartsOrigin}/bb/?lang=zh&diff=Hard`,
      '/droptable/cn/CVeryHard.html': `${dropChartsOrigin}/bb/?lang=zh&diff=VeryHard`,
      '/droptable/cn/CUltimate.html': `${dropChartsOrigin}/bb/?lang=zh&diff=Ultimate`,
      '/droptable/en/Normal.html': `${dropChartsOrigin}/bb/?lang=en&diff=Normal`,
      '/droptable/en/Hard.html': `${dropChartsOrigin}/bb/?lang=en&diff=Hard`,
      '/droptable/en/VeryHard.html': `${dropChartsOrigin}/bb/?lang=en&diff=VeryHard`,
      '/droptable/en/Ultimate.html': `${dropChartsOrigin}/bb/?lang=en&diff=Ultimate`,
    };
    const legacy = location.pathname.match(/^\/data\/droptable\/(bb|dc|ngc)(?:\/index\.html)?\/?$/);
    const target = pathTargets[location.pathname]
      ?? (legacy ? `${dropChartsOrigin}/${legacy[1]}/${location.search}${location.hash}` : null);
    if (target) {
      location.replace(target);
      return;
    }
    const language = this.site.language();
    const text = NotFoundRedirectBehavior.text[language];
    const heading = this.host.querySelector('h1');
    const message = this.host.querySelector('h1 + p');
    if (!heading || !message) return;
    document.title = text.title;
    heading.textContent = text.heading;
    const home = document.createElement('a');
    home.href = language === 'zh' ? '/' : `/${language}/`;
    home.textContent = text.link;
    message.replaceChildren(text.before, home);
  }
}

@Directive({ standalone: true })
export class SectionIdBehavior extends BrowserContentBehavior {
  private readonly site = inject(SiteLanguage);
  private static readonly names = [
    'Viridia', 'Greenill', 'Skyly', 'Bluefull', 'Purplenum',
    'Pinkal', 'Redria', 'Oran', 'Yellowboze', 'Whitill',
  ];
  private static readonly classOffsets = [0, 1, 2, 9, 3, 11, 4, 5, 10, 6, 7, 8];

  protected connect(): void {
    const input = this.host.querySelector<HTMLInputElement>('#name');
    const buttons = Array.from(this.host.querySelectorAll<HTMLButtonElement>('.tablink'));
    if (!input || buttons.length < 2) return;

    const selectMode = (mode: 'BB' | 'Legacy', active: HTMLButtonElement) => {
      for (const panel of this.host.querySelectorAll<HTMLElement>('.calc')) {
        const visible = panel.id === mode;
        panel.hidden = !visible;
        panel.style.display = visible ? 'block' : 'none';
      }
      for (const button of buttons) button.classList.toggle('active', button === active);
    };
    buttons.forEach((button, index) => this.listen(button, 'click', () => (
      selectMode(index === 0 ? 'BB' : 'Legacy', button)
    )));
    selectMode('BB', buttons[0]);

    const valueFor = (name: string) => {
      let flag = 0;
      let value = 0;
      for (const character of name) {
        const code = character.charCodeAt(0);
        value += code;
        if (code >= 0x100 && code < 0xff61) {
          if (flag !== 2) { flag = 2; value += 83; }
        } else if (code <= 0xff91 && flag !== 1) {
          flag = 1; value += 45;
        }
      }
      return value;
    };
    const unavailable = { zh: '不适用', en: 'N/A', ja: '該当なし' }[this.site.language()];
    const setResult = (index: number, name: string | null) => {
      const text = this.host.querySelector<HTMLElement>(`#tf${index}`);
      const image = this.host.querySelector<HTMLImageElement>(`#img${index}`);
      if (text) text.textContent = name ?? unavailable;
      if (image) {
        image.src = `/assets/img/section/${name ?? 'Impossible'}.png`;
        image.alt = name ?? unavailable;
      }
    };
    const update = () => {
      const value = input.value;
      const score = valueFor(value);
      const ascii = /^[\x20-\x7e]+$/.test(value);
      setResult(0, value.length > 0 && value.length <= 12 && ascii
        ? SectionIdBehavior.names[(score + 5) % 10] : null);
      SectionIdBehavior.classOffsets.forEach((offset, index) => {
        setResult(index + 1, value.length > 0 && value.length <= 10
          ? SectionIdBehavior.names[(score + offset) % 10] : null);
      });
    };
    this.listen(input, 'input', update);
    update();
  }
}

@Directive({ standalone: true })
export class ProtocolReferenceBehavior extends BrowserContentBehavior {
  private readonly connected = signal(false);
  private readonly currentTab = signal('protocol');

  constructor() {
    super();
    afterRenderEffect(() => {
      const currentTab = this.currentTab();
      if (this.connected()) this.render(currentTab);
    });
  }

  private render(currentTab: string): void {
    const tabList = this.host.querySelector<HTMLElement>('#tab-list')!;
    const sectionList = this.host.querySelector<HTMLElement>('#section-list')!;
    const content = this.host.querySelector<HTMLElement>('#proto-content')!;
    for (const tab of tabList.querySelectorAll<HTMLElement>('[data-tab]')) {
      tab.classList.toggle('active', tab.dataset['tab'] === currentTab);
    }
    const sections = Array.from(content.querySelectorAll<HTMLElement>('section[data-tab]'));
    for (const section of sections) section.classList.toggle('active', section.dataset['tab'] === currentTab);
    const active = sections.find((section) => section.classList.contains('active'));
    if (!active) return;
    const slugify = (value: string) => value.toLocaleLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
    const list = document.createElement('ul');
    for (const heading of active.querySelectorAll<HTMLElement>('h2')) {
      heading.id ||= slugify(heading.textContent ?? '');
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${heading.id}`);
      });
      item.append(link);
      list.append(item);
    }
    sectionList.replaceChildren(list);
  }

  protected connect(): void {
    const tabList = this.host.querySelector<HTMLElement>('#tab-list');
    if (!tabList || !this.host.querySelector('#section-list') || !this.host.querySelector('#proto-content')) return;
    const validTabs = ['protocol', 'subcommands'];
    const requested = location.hash.slice(1);
    if (validTabs.includes(requested)) this.currentTab.set(requested);
    this.listen(tabList, 'click', ((event: MouseEvent) => {
      const tab = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tab]') : null;
      if (!tab?.dataset['tab']) return;
      event.preventDefault();
      this.currentTab.set(tab.dataset['tab']);
      history.replaceState(null, '', `#${tab.dataset['tab']}`);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }) as EventListener);
    this.connected.set(true);
  }
}
