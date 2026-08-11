import { Directive } from '@angular/core';
import { BrowserContentBehavior } from './browser-content-behavior.directive';

@Directive({ standalone: true })
export class BackToTopBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const button = this.host.querySelector<HTMLElement>('#backToTop');
    if (!button) return;

    const update = () => button.classList.toggle('show', window.scrollY > 300);
    this.listen(window, 'scroll', update);
    this.listen(button, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    update();
  }
}

@Directive({ standalone: true })
export class ItemTableSearchBehavior extends BrowserContentBehavior {
  protected connect(): void {
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
        const matched = row.textContent?.toLocaleLowerCase().includes(query) ?? false;
        row.hidden = !matched;
        return matched;
      });
      count.textContent = `找到 ${matches.length} 条匹配结果（共 ${rows.length} 条）`;
      if (matches.length > 50) {
        const note = document.createElement('p');
        note.className = 'search-results-note';
        note.textContent = '结果过多，请输入更精确的关键词';
        results.append(note);
        return;
      }
      if (!matches.length) return;

      const table = document.createElement('table');
      table.className = 'search-results-table';
      const head = table.createTHead().insertRow();
      for (const label of ['代码', '名称']) {
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
  protected connect(): void {
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
      count.textContent = `${visible} / ${entries.length} 项`;
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
    if (target) location.replace(target);
  }
}

@Directive({ standalone: true })
export class SectionIdBehavior extends BrowserContentBehavior {
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
    const setResult = (index: number, name: string | null) => {
      const text = this.host.querySelector<HTMLElement>(`#tf${index}`);
      const image = this.host.querySelector<HTMLImageElement>(`#img${index}`);
      if (text) text.textContent = name ?? 'N/A';
      if (image) image.src = `/assets/img/section/${name ?? 'Impossible'}.png`;
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
export class ItemLookupBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const input = this.host.querySelector<HTMLInputElement>('#search-input');
    const count = this.host.querySelector<HTMLElement>('#result-count');
    const empty = this.host.querySelector<HTMLElement>('#no-results');
    const table = this.host.querySelector<HTMLTableElement>('#lookup-table');
    const rows = Array.from(this.host.querySelectorAll<HTMLTableRowElement>('#lookup tr'));
    if (!input || !count || !empty || !table) return;

    const searchable = rows.map((element) => ({
      element,
      text: element.textContent?.toLocaleLowerCase() ?? '',
    }));
    const render = () => {
      const term = input.value.trim().toLocaleLowerCase();
      let shown = 0;
      for (const row of searchable) {
        const visible = !term || row.text.includes(term);
        row.element.hidden = !visible;
        if (visible) shown++;
      }
      table.hidden = shown === 0;
      empty.hidden = shown !== 0;
      count.textContent = term ? `匹配 ${shown} / ${rows.length} 项` : `共 ${rows.length} 项`;
    };
    this.listen(input, 'input', render);
    render();
  }
}
@Directive({ standalone: true })
export class EventArchiveBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const archive = this.host.querySelector<HTMLElement>('[data-event-archive]');
    const yearLabel = this.host.querySelector<HTMLElement>('#eventYear');
    const yearNav = this.host.querySelector<HTMLElement>('#yearNav');
    const content = this.host.querySelector<HTMLElement>('#yearContent');
    const preview = this.host.querySelector<HTMLElement>('#imagePreview');
    const previewImage = preview?.querySelector<HTMLImageElement>('img');
    const previewCaption = preview?.querySelector<HTMLElement>('p');
    if (!archive || !yearLabel || !yearNav || !content || !preview || !previewImage || !previewCaption) return;

    const eventName = archive.dataset['event'] ?? '';
    const titleName = archive.dataset['titleName'] ?? '';
    const years = (archive.dataset['years'] ?? '').split(',').map(Number).filter(Number.isFinite);
    const defaultYear = Number(archive.dataset['defaultYear']);
    const requested = Number(new URLSearchParams(location.search).get('year'));
    const selected = years.includes(requested) ? requested : defaultYear;
    document.title = `${selected} ${titleName} | Ephinea PSOBB`;
    yearLabel.textContent = String(selected);
    yearNav.replaceChildren(...years.map((year) => {
      const element = document.createElement(year === selected ? 'span' : 'a');
      element.textContent = String(year);
      if (element instanceof HTMLAnchorElement) element.href = `?year=${year}`;
      else { element.className = 'year-current'; element.setAttribute('aria-current', 'page'); }
      return element;
    }));

    if (selected !== defaultYear) {
      fetch(`./${eventName}/${selected}.html`, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((html) => {
          const parsed = new DOMParser().parseFromString(html, 'text/html');
          parsed.querySelectorAll('script, style').forEach((element) => element.remove());
          parsed.querySelectorAll<HTMLElement>('*').forEach((element) => {
            for (const attribute of [...element.attributes]) {
              if (attribute.name.startsWith('on')) element.removeAttribute(attribute.name);
            }
          });
          content.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
        })
        .catch(() => { content.textContent = `未能加载 ${selected} 年 ${titleName} 内容。`; });
    }

    let anchor: HTMLElement | null = null;
    const close = () => {
      preview.hidden = true;
      previewImage.removeAttribute('src');
      anchor = null;
    };
    const position = () => {
      if (!anchor || preview.hidden) return;
      const margin = 12;
      const gap = 10;
      const anchorRect = anchor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      let left = anchorRect.right + gap;
      let top = anchorRect.top + (anchorRect.height - previewRect.height) / 2;
      if (left + previewRect.width > innerWidth - margin) left = anchorRect.left - previewRect.width - gap;
      if (left < margin) left = Math.min(
        Math.max(margin, anchorRect.left + (anchorRect.width - previewRect.width) / 2),
        innerWidth - previewRect.width - margin,
      );
      top = Math.max(margin, Math.min(top, innerHeight - previewRect.height - margin));
      preview.style.left = `${Math.max(margin, left)}px`;
      preview.style.top = `${top}px`;
    };
    this.listen(this.host, 'click', ((event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target?.closest<HTMLElement>('[data-preview-image]');
      if (trigger) {
        if (anchor === trigger && !preview.hidden) { close(); return; }
        anchor = trigger;
        previewImage.src = trigger.dataset['previewImage'] ?? '';
        previewImage.alt = trigger.dataset['previewCaption'] ?? '';
        previewCaption.textContent = trigger.dataset['previewCaption'] ?? '';
        preview.hidden = false;
        requestAnimationFrame(position);
      } else if (target?.closest('.image-preview-close') || !target?.closest('.image-preview')) {
        close();
      }
    }) as EventListener);
    this.listen(previewImage, 'load', position);
    this.listen(window, 'resize', close);
  }
}

@Directive({ standalone: true })
export class LanguageSwitchBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const supported = ['zh', 'en', 'ja'] as const;
    type Language = typeof supported[number];
    const host = this.host.querySelector<HTMLElement>('#langSwitch');
    if (!host) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem('siteLang'); } catch { /* storage may be disabled */ }
    let language: Language = supported.includes(saved as Language) ? saved as Language : 'zh';

    const apply = () => {
      document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
      for (const element of this.host.querySelectorAll<HTMLElement>('[data-i18n]')) {
        element.textContent = element.dataset[language] ?? element.dataset['en'] ?? '';
      }
      for (const element of this.host.querySelectorAll<HTMLElement>('[data-lang-content]')) {
        element.hidden = element.dataset['langContent'] !== language;
      }
      for (const button of host.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
        button.classList.toggle('active', button.dataset['lang'] === language);
        button.setAttribute('aria-pressed', String(button.dataset['lang'] === language));
      }
      const title = this.host.querySelector<HTMLElement>('#pageTitle')?.textContent;
      if (title) document.title = `${title} — PSOBB Wiki`;
    };
    this.listen(host, 'click', ((event: MouseEvent) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-lang]') : null;
      const requested = button?.dataset['lang'];
      if (!supported.includes(requested as Language)) return;
      language = requested as Language;
      try { localStorage.setItem('siteLang', language); } catch { /* storage may be disabled */ }
      apply();
    }) as EventListener);
    apply();
  }
}

@Directive({ standalone: true })
export class ProtocolReferenceBehavior extends BrowserContentBehavior {
  protected connect(): void {
    const tabList = this.host.querySelector<HTMLElement>('#tab-list');
    const sectionList = this.host.querySelector<HTMLElement>('#section-list');
    const content = this.host.querySelector<HTMLElement>('#proto-content');
    const languageHost = this.host.querySelector<HTMLElement>('#langSwitch');
    if (!tabList || !sectionList || !content || !languageHost) return;
    type Language = 'zh' | 'en';
    let saved: string | null = null;
    try { saved = localStorage.getItem('siteLang'); } catch { /* storage may be disabled */ }
    let language: Language = saved === 'zh' ? 'zh' : 'en';
    const validTabs = ['protocol', 'subcommands'];
    const requestedHash = location.hash.slice(1);
    let currentTab = validTabs.includes(requestedHash) ? requestedHash : validTabs[0];

    const slugify = (value: string) => value.toLocaleLowerCase()
      .replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
    const buildSectionList = (section: HTMLElement) => {
      const list = document.createElement('ul');
      for (const heading of section.querySelectorAll<HTMLElement>('h2')) {
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
        item.append(link); list.append(item);
      }
      sectionList.replaceChildren(list);
    };
    const render = () => {
      document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
      for (const element of this.host.querySelectorAll<HTMLElement>('[data-i18n]')) {
        element.textContent = element.dataset[language] ?? element.dataset['en'] ?? '';
      }
      for (const element of this.host.querySelectorAll<HTMLElement>('[data-lang-content]')) {
        element.hidden = element.dataset['langContent'] !== language;
      }
      for (const button of languageHost.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
        const active = button.dataset['lang'] === language;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      }
      for (const tab of tabList.querySelectorAll<HTMLElement>('[data-tab]')) {
        tab.classList.toggle('active', tab.dataset['tab'] === currentTab);
      }
      const sections = Array.from(content.querySelectorAll<HTMLElement>('section[data-tab][data-lang]'));
      for (const section of sections) {
        section.classList.toggle('active', section.dataset['tab'] === currentTab && section.dataset['lang'] === language);
      }
      const active = sections.find((section) => section.classList.contains('active'));
      if (active) buildSectionList(active);
      const title = this.host.querySelector<HTMLElement>('#project_title')?.textContent;
      if (title) document.title = `${title} | Ephinea PSOBB`;
    };
    this.listen(languageHost, 'click', ((event: MouseEvent) => {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-lang]') : null;
      const requested = button?.dataset['lang'];
      if (requested !== 'zh' && requested !== 'en') return;
      language = requested;
      try { localStorage.setItem('siteLang', language); } catch { /* storage may be disabled */ }
      render();
    }) as EventListener);
    this.listen(tabList, 'click', ((event: MouseEvent) => {
      const tab = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-tab]') : null;
      if (!tab?.dataset['tab']) return;
      event.preventDefault();
      currentTab = tab.dataset['tab'];
      history.replaceState(null, '', `#${currentTab}`);
      render();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }) as EventListener);
    render();
  }
}
