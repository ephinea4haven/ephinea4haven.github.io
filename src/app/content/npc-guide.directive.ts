import { Directive, inject } from '@angular/core';
import { BrowserContentBehavior } from './browser-content-behavior.directive';
import { SiteLanguage } from '../shared/site-language.service';

@Directive({ standalone: true })
export class NpcGuideBehavior extends BrowserContentBehavior {
  private readonly site = inject(SiteLanguage);

  protected connect(): void {
    const guide = this.host.querySelector<HTMLElement>('[data-npc-guide]');
    const search = guide?.querySelector<HTMLInputElement>('#npc-search');
    const episode = guide?.querySelector<HTMLSelectElement>('#npc-episode');
    const reset = guide?.querySelector<HTMLButtonElement>('#npc-reset');
    const count = guide?.querySelector<HTMLElement>('#npc-count');
    const empty = guide?.querySelector<HTMLElement>('#npc-empty');
    if (!guide || !search || !episode || !reset || !count || !empty) return;

    const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replaceAll(/[’‘]/g, "'");
    const cards = Array.from(guide.querySelectorAll<HTMLElement>('[data-npc-card]'), (element) => ({
      element,
      episodes: element.dataset['episodes']!.split(' '),
      text: normalize([
        element.dataset['search'],
        ...Array.from(element.querySelectorAll('.npc-name, .npc-role, .npc-desc, .npc-references a'), (field) => field.textContent),
        ...Array.from(element.querySelectorAll<HTMLElement>('[data-item-en]'), (item) => item.dataset['itemEn']),
      ].join(' ')),
    }));
    const groups = Array.from(guide.querySelectorAll<HTMLElement>('[data-npc-group]'));
    const extras = Array.from(guide.querySelectorAll<HTMLElement>('[data-npc-extra]'));
    const countText = {
      zh: (n: number) => `显示 ${n} / ${cards.length} 个条目`,
      en: (n: number) => `Showing ${n} of ${cards.length} entries`,
      ja: (n: number) => `${cards.length}項目中${n}項目を表示`,
    }[this.site.language()];

    const update = () => {
      const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
      let visible = 0;
      for (const card of cards) {
        const matches = (!episode.value || card.episodes.includes(episode.value))
          && terms.every((term) => card.text.includes(term));
        card.element.hidden = !matches;
        if (matches) visible++;
      }
      for (const group of groups) group.hidden = !group.querySelector('[data-npc-card]:not([hidden])');
      for (const extra of extras) extra.hidden = Boolean(terms.length || episode.value);
      count.textContent = countText(visible);
      empty.hidden = visible !== 0;
    };
    const clear = () => {
      search.value = '';
      episode.value = '';
      update();
    };
    this.listen(search, 'input', update);
    this.listen(episode, 'change', update);
    this.listen(reset, 'click', () => { clear(); search.focus(); });
    // Section and relationship links remain useful even while filtering.
    this.listen(guide, 'click', (event) => {
      const link = (event.target as Element).closest('a[href]');
      if (!link) return;
      const url = new URL(link.getAttribute('href')!, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
      clear();
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target?.matches('.npc-story') || target?.closest('.npc-story')) {
        const details = target.matches('.npc-story') ? target : target.closest('.npc-story');
        (details as HTMLDetailsElement).open = true;
      }
    });
    const revealHash = () => {
      if (!window.location.hash) return;
      clear();
      const target = Array.from(guide.querySelectorAll<HTMLElement>('[id]'))
        .find((element) => `#${encodeURIComponent(element.id)}` === window.location.hash);
      const details = target?.closest<HTMLDetailsElement>('.npc-story');
      if (details) details.open = true;
      target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    };
    this.listen(window, 'hashchange', revealHash);
    update();
    revealHash();
    guide.dataset['npcGuide'] = 'ready';
  }
}
