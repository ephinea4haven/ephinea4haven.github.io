import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { ITEM_TRANSLATIONS } from '../generated/i18n/items';

const OVERRIDES = [
  ['Ultimate Present', '究极礼物'], ['Common Present', '普通礼物'], ['Music Disk', '音乐光盘'],
  ['Random Music Disc', '随机音乐光盘'], ['Item Ticket', '道具兑换券'], ['Red Ring Paint', '红色手镯涂装'],
  ['Photon Crystal', '光子水晶'], ['Mag Kits', '玛古套件'], ['Mag Kit', '玛古套件'],
  ['Sonic Doll', '索尼克人偶'], ['Game Magazine', '游戏杂志'], ['Heart of YN-0117', 'YN-0117之心'],
  ['Magic Rock Heart Key', '魔石「心之钥」'], ['Stealth Kit', '隐形套件'], ['Revival', '速生'],
  ['Material', '材料'], ['Parts', '部件'], ['Coal', '煤炭'],
] as const;
const AMBIGUOUS = new Set(['disk', 'heart', 'hit', 'mind', 'pioneer', 'rappy']);
const ANNIVERSARY_LABELS = new Map([
  ['Bronze / Silver / Gold Shops', '铜牌/银牌/金牌商店'], ['Anniversary Badge Shop', '周年徽章商店'],
  ['Bronze Badge Shop', '铜牌商店'], ['Silver Badge Shop', '银牌商店'], ['Gold Badge Shop', '金牌商店'],
  ['Scavenger from Ragol', '拉古奥拾荒者'], ['Hunter from Ragol', '拉古奥猎人'],
  ['Thief from Ragol', '拉古奥盗贼'], ['Chef from Ragol', '拉古奥厨师'],
  ['Bronze Shop', '铜牌商店'], ['Silver Shop', '银牌商店'], ['Gold Shop', '金牌商店'],
  ['Platinum Badges', '白金牌'], ['Bronze Badges', '铜牌'], ['Silver Badges', '银牌'], ['Gold Badges', '金牌'],
  ['Platinum Badge', '白金牌'], ['Bronze Badge', '铜牌'], ['Silver Badge', '银牌'], ['Gold Badge', '金牌'],
  ['Platinum', '白金牌'], ['Bronze', '铜牌'], ['Silver', '银牌'], ['Gold', '金牌'],
  ["Tyrell's Office", '泰瑞尔总督办公室'], ['Medical Center', '医疗中心'], ["Hunter's Guild", '猎人公会'],
  ['Hit', '命中'], ['We are currently offering the following prizes.', '当前提供以下奖品。'],
  ['LOCAL QST MENU', '本地 QST 菜单'], ['Pioneer 2 services', '先锋2号服务'],
  ['Reward catalog', '奖励目录'], ['Never mind', '不兑换'], ['Badger', '徽章兑换员'], ['Guide', '向导'],
]);
const NPC_IMAGES = new Map<string, readonly [string, string]>([
  ['Bronze Shop', ['/assets/img/event/anniversary/bronze-shop.png', '铜牌商店 · 蓝色士兵']],
  ['Bronze Badge Shop', ['/assets/img/event/anniversary/bronze-shop.png', '铜牌商店 · 蓝色士兵']],
  ['Silver Shop', ['/assets/img/event/anniversary/silver-shop.png', '银牌商店 · 红色士兵']],
  ['Silver Badge Shop', ['/assets/img/event/anniversary/silver-shop.png', '银牌商店 · 红色士兵']],
  ['Gold Shop', ['/assets/img/event/anniversary/gold-shop.png', '金牌商店 · 实验室科学家(QST #2)']],
  ['Gold Badge Shop', ['/assets/img/event/anniversary/gold-shop.png', '金牌商店 · 实验室科学家(QST #2)']],
  ['Hunter from Ragol', ['/assets/img/event/anniversary/hunter.png', '拉古奥猎人']],
  ['Thief from Ragol', ['/assets/img/event/anniversary/thief.png', '拉古奥盗贼']],
  ['Scavenger from Ragol', ['/assets/img/event/anniversary/scavenger.png', '拉古奥拾荒者']],
  ['Guide', ['/assets/img/event/anniversary/guide.png', '向导']],
  ['Badger', ['/assets/img/event/anniversary/badger.png', '徽章兑换员']],
]);

@Directive({ standalone: true })
export class SeasonalEventBehavior {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private previewAnchor: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => this.connect());
  }

  private connect(): void {
    const masthead = this.host.querySelector<HTMLElement>('[data-seasonal-event]');
    const content = this.host.querySelector<HTMLElement>('#content');
    if (!masthead || !content) return;
    const eventName = masthead.dataset['event'] ?? '';
    const years = (masthead.dataset['years'] ?? '').split(',').map(Number).filter(Number.isFinite);
    const defaultYear = Number(masthead.dataset['defaultYear']);
    const requested = Number(new URLSearchParams(location.search).get('year'));
    const selected = years.includes(requested) ? requested : defaultYear;
    const label = eventName === 'anniversary' ? '周年活动' : '圣诞活动';
    if (eventName === 'anniversary') {
      let hue = 188;
      if (selected <= 2018) hue = 38;
      else if (selected <= 2021) hue = 272;
      else if (selected === 2025) hue = 43;
      this.host.style.setProperty('--anniv-year-hue', String(hue));
      content.dataset['anniversaryYear'] = String(selected);
    }
    document.title = `${selected}${label} | Ephinea PSOBB`;
    this.host.querySelector<HTMLElement>('#project_year')!.textContent = String(selected);
    const emblem = this.host.querySelector<HTMLElement>('.emblem-number');
    if (emblem && eventName === 'anniversary') emblem.textContent = String(selected - 2015);
    const nav = this.host.querySelector<HTMLElement>('#yearNav');
    nav?.replaceChildren(...years.map((year) => {
      const element = document.createElement(year === selected ? 'span' : 'a');
      element.textContent = String(year);
      if (element instanceof HTMLAnchorElement) element.href = `/event/${eventName}.html?year=${year}`;
      else { element.className = 'year-current'; element.setAttribute('aria-current', 'page'); }
      return element;
    }));

    const finish = () => {
      if (eventName === 'anniversary') {
        this.normalizeAnniversaryLayout(content);
        this.markAnniversaryLabels(content);
        this.decorateNpcTables(content);
      }
      this.localizeItems(eventName === 'christmas'
        ? this.host.querySelector<HTMLElement>('.christmas-overview')! : content);
      if (eventName === 'anniversary') this.localizeAnniversaryLabels(content);
      const anchor = location.hash ? this.host.querySelector<HTMLElement>(location.hash) : null;
      anchor?.scrollIntoView();
    };
    if (selected === defaultYear) finish();
    else {
      fetch(`/event/${eventName}/${selected}.html`, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((html) => {
          const parsed = new DOMParser().parseFromString(html, 'text/html');
          parsed.querySelectorAll('script, style').forEach((element) => element.remove());
          content.replaceChildren(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
          finish();
        })
        .catch(() => { content.textContent = `未能加载 ${selected} 年${label}内容。`; });
    }
    const click = (event: Event) => this.handleClick(event);
    const resize = () => this.closePreview();
    this.host.addEventListener('click', click);
    window.addEventListener('resize', resize);
    this.destroyRef.onDestroy(() => {
      this.host.removeEventListener('click', click);
      window.removeEventListener('resize', resize);
    });
  }

  private normalizeAnniversaryLayout(container: HTMLElement): void {
    if (container.querySelector('.anniv-2025') || container.querySelector('.anniv-legacy')) return;

    container.classList.add('anniv-legacy');
    const hero = container.querySelector<HTMLElement>('.year-hero');
    if (hero) hero.dataset['year'] = container.dataset['anniversaryYear'] ?? '';
    const headings = Array.from(container.children).filter((element) => element.tagName === 'H3');
    for (const heading of headings) {
      const section = document.createElement('section');
      section.className = 'event-section archive-section';
      heading.before(section);
      section.append(heading);
      while (section.nextElementSibling
        && section.nextElementSibling.tagName !== 'H3'
        && !section.nextElementSibling.classList.contains('source-links')) {
        section.append(section.nextElementSibling);
      }
    }
  }

  private localizeItems(container: HTMLElement | null): void {
    if (!container) return;
    const translations = [...OVERRIDES, ...Object.values(ITEM_TRANSLATIONS)
      .filter((item) => item.en && item.zh && item.en !== item.zh && !AMBIGUOUS.has(item.en.toLocaleLowerCase()))
      .map((item) => [item.en!, item.zh!] as const)];
    const source = container.textContent?.toLocaleLowerCase() ?? '';
    const seen = new Set<string>();
    const matches = translations.filter(([en]) => {
      const key = en.toLocaleLowerCase();
      if (seen.has(key) || !source.includes(key)) return false;
      seen.add(key); return true;
    }).sort(([left], [right]) => right.length - left.length);
    if (!matches.length) return;
    const byName = new Map(matches.map(([en, zh]) => [en.toLocaleLowerCase(), zh]));
    const escaped = matches.map(([en]) => en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, 'gi');
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => !node.nodeValue?.trim() || node.parentElement?.closest('.event-ui-label, .event-verbatim, .item-bilingual, script, style')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const text = node.nodeValue ?? '';
      pattern.lastIndex = 0;
      if (!pattern.test(text)) continue;
      pattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      text.replace(pattern, (match, prefix: string, english: string, offset: number) => {
        const start = offset + prefix.length;
        fragment.append(text.slice(cursor, start).replace(/([\u3400-\u9fff])\s+$/, '$1'));
        const wrapper = document.createElement('span');
        wrapper.className = 'item-bilingual';
        const zh = document.createElement('span'); zh.className = 'item-zh'; zh.textContent = byName.get(english.toLocaleLowerCase()) ?? '';
        const en = document.createElement('span'); en.className = 'item-en'; en.textContent = ` (${english})`;
        wrapper.append(zh, en); fragment.append(wrapper);
        cursor = start + english.length;
        return match;
      });
      fragment.append(text.slice(cursor)); node.replaceWith(fragment);
    }
  }

  private markAnniversaryLabels(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('h3, .badge-card > strong, .quest-menu-bar span, .quest-menu-bar strong, .quest-menu-speaker, .quest-menu-source, .tier-card > strong, .special-card > strong, .shop-table tbody td:first-child')
      .forEach((element) => element.classList.add('event-ui-label'));
    container.querySelectorAll<HTMLElement>('.ta-ranking-table tbody td:nth-child(3)')
      .forEach((element) => element.classList.add('event-verbatim'));
  }

  private localizeAnniversaryLabels(container: HTMLElement): void {
    const pattern = new RegExp([...ANNIVERSARY_LABELS.keys()].sort((a, b) => b.length - a.length)
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => !node.nodeValue?.trim() || node.parentElement?.closest('.event-verbatim, .item-bilingual, script, style')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    nodes.forEach((node) => { node.nodeValue = (node.nodeValue ?? '').replace(pattern, (match) => ANNIVERSARY_LABELS.get(match) ?? match); });
  }

  private decorateNpcTables(container: HTMLElement): void {
    for (const table of container.querySelectorAll<HTMLTableElement>('.shop-table')) {
      if (!table.tBodies.length || table.dataset['npcImages'] === 'ready') continue;
      const rows = Array.from(table.tBodies[0].rows);
      if (!rows.some((row) => NPC_IMAGES.has(row.cells[0]?.textContent?.trim() ?? '')
        || row.cells[0]?.textContent?.trim() === 'Bronze / Silver / Gold Shops')) continue;
      const header = table.tHead?.rows[0];
      if (!header) continue;
      const imageHeader = document.createElement('th'); imageHeader.textContent = '外观';
      header.insertBefore(imageHeader, header.cells[1] ?? null);
      for (const row of rows) {
        const label = row.cells[0]?.textContent?.trim() ?? '';
        const images = label === 'Bronze / Silver / Gold Shops'
          ? ['Bronze Shop', 'Silver Shop', 'Gold Shop'].map((key) => NPC_IMAGES.get(key)!)
          : (NPC_IMAGES.has(label) ? [NPC_IMAGES.get(label)!] : []);
        const cell = row.insertCell(1); cell.className = 'npc-image-cell';
        if (!images.length) { cell.textContent = '—'; cell.classList.add('npc-image-missing'); continue; }
        if (images.length > 1) cell.classList.add('npc-image-cell-multiple');
        for (const [src, caption] of images) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'npc-thumbnail-button';
          button.dataset['image'] = src; button.dataset['caption'] = caption; button.setAttribute('aria-label', `查看 ${caption} 大图`);
          const image = document.createElement('img'); image.src = src; image.alt = caption; image.loading = 'lazy';
          button.append(image); cell.append(button);
        }
      }
      table.dataset['npcImages'] = 'ready';
    }
  }

  private handleClick(event: Event): void {
    const target = event.target instanceof Element ? event.target : null;
    const menuTab = target?.closest<HTMLElement>('[data-quest-panel-target]');
    if (menuTab) {
      const menu = menuTab.closest<HTMLElement>('[data-quest-menu]');
      menu?.querySelectorAll<HTMLElement>('[data-quest-panel-target]').forEach((button) => button.classList.toggle('is-active', button === menuTab));
      menu?.querySelectorAll<HTMLElement>('[data-quest-panel]').forEach((panel) => { panel.hidden = panel.dataset['questPanel'] !== menuTab.dataset['questPanelTarget']; });
      return;
    }
    const option = target?.closest<HTMLElement>('[data-quest-response]');
    if (option) {
      const panel = option.closest<HTMLElement>('.quest-menu-panel, .quest-menu-demo');
      panel?.querySelectorAll<HTMLElement>('[data-quest-response]').forEach((button) => button.classList.toggle('is-active', button === option));
      const response = panel?.querySelector<HTMLElement>('.quest-menu-response');
      if (response) response.textContent = option.dataset['questResponse'] ?? '';
      return;
    }
    const thumbnail = target?.closest<HTMLElement>('.npc-thumbnail-button');
    if (thumbnail) { this.previewAnchor === thumbnail ? this.closePreview() : this.showPreview(thumbnail); return; }
    if (target?.closest('.npc-preview-close') || !target?.closest('.npc-preview-popover')) this.closePreview();
  }

  private showPreview(anchor: HTMLElement): void {
    const popover = this.host.querySelector<HTMLElement>('#npcPreviewPopover');
    const image = this.host.querySelector<HTMLImageElement>('#npcPreviewImage');
    const caption = this.host.querySelector<HTMLElement>('#npcPreviewCaption');
    if (!popover || !image || !caption) return;
    this.previewAnchor = anchor; image.src = anchor.dataset['image'] ?? ''; image.alt = anchor.dataset['caption'] ?? '';
    caption.textContent = anchor.dataset['caption'] ?? ''; popover.hidden = false;
  }

  private closePreview(): void {
    const popover = this.host.querySelector<HTMLElement>('#npcPreviewPopover');
    const image = this.host.querySelector<HTMLImageElement>('#npcPreviewImage');
    if (popover) popover.hidden = true; image?.removeAttribute('src'); this.previewAnchor = null;
  }
}
