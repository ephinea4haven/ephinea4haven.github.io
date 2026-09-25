import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { NavigationEnd, ResolveEnd, Router } from '@angular/router';
import published from '../generated/localized-pages.json';

export type PageLanguage = 'zh' | 'en' | 'ja';
export const PAGE_LANGUAGES: readonly PageLanguage[] = ['zh', 'en', 'ja'];
/** Text resolved at build time in every site language (catalog notes and mechanics). */
export type LocalizedText = Record<PageLanguage, string>;

const STORAGE_KEY = 'haven.language';
const ORIGIN = 'https://www.psohaven.com';
const HREFLANG: Record<PageLanguage, string> = { zh: 'zh-CN', en: 'en', ja: 'ja' };
const versions = published.versions as Record<'en' | 'ja', string[]>;
const valid = (value: unknown): value is PageLanguage => PAGE_LANGUAGES.includes(value as PageLanguage);

/** Split a URL into its language prefix and the unprefixed path. */
export function splitLanguage(url: string): { language: PageLanguage | null; path: string } {
  const [pathname] = url.split(/[?#]/);
  const match = /^\/(en|ja)(?=\/|$)(.*)$/.exec(pathname);
  return match ? { language: match[1] as PageLanguage, path: match[2] || '/' } : { language: null, path: pathname || '/' };
}

/** Page key: no leading slash, directory indexes by directory, the homepage as index.html. */
export function pageKey(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/(index\.html)?$/, '').replace(/^index\.html$/, '') || 'index.html';
}

/** Whether a page (by unprefixed path) is published in a language. */
export function hasVersion(path: string, language: PageLanguage): boolean {
  const key = pageKey(path);
  if (language === 'zh') return true;
  return versions[language].some((candidate) => candidate.endsWith('/') ? key.startsWith(candidate) : key === candidate);
}

/** URL of a page (by unprefixed path) in a language. */
export function localizedPath(path: string, language: PageLanguage): string {
  if (language === 'zh') return path;
  return `/${language}${path === '/' ? '' : path}`;
}

/** Published URL: directory pages (data/protocol) are served with a trailing slash. */
function publicUrl(path: string): string {
  return path === '/' || /\.[a-z]+$/i.test(path) || path.endsWith('/') ? path : `${path}/`;
}

/**
 * The site's language is the URL's: Chinese at the historical URLs, English and
 * Japanese under /en/ and /ja/ (docs/ARCHITECTURE.md, "Languages and URLs").
 * The reader's choice is remembered and applied when a page has that version.
 */
@Injectable({ providedIn: 'root' })
export class SiteLanguage {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly url = signal(this.router.url);

  private readonly location = computed(() => splitLanguage(this.url()));
  /** Unprefixed path of the current page. */
  readonly path = computed(() => this.location().path);
  /** Language the current page is written in. */
  readonly language = computed<PageLanguage>(() => this.location().language ?? 'zh');
  /** Languages the current page is published in. */
  readonly available = computed(() => PAGE_LANGUAGES.filter((language) => hasVersion(this.path(), language)));

  constructor() {
    // The remembered language applies once the entry URL is known (after the first navigation).
    let entered = !isPlatformBrowser(inject(PLATFORM_ID));
    const enter = () => {
      if (entered) return;
      entered = true;
      this.applyRememberedLanguage();
    };
    this.router.events.subscribe((event) => {
      // ResolveEnd precedes activation, so components created for the new page
      // already read its language.
      if (event instanceof ResolveEnd) this.url.set(event.urlAfterRedirects);
      if (!(event instanceof NavigationEnd)) return;
      this.url.set(event.urlAfterRedirects);
      enter();
    });
    if (this.router.navigated) enter();
    effect(() => this.applyDocumentLanguage());
  }

  /** Choose a language: open this page's version in it, or remember it for pages that have one. */
  async select(language: PageLanguage): Promise<void> {
    this.remember(language);
    if (language !== this.language() && hasVersion(this.path(), language)) await this.go(language);
  }

  /** Link to another page, in the current page's language when that page has a version in it. */
  link(path: string): string {
    const language = this.language();
    return language !== 'zh' && hasVersion(path, language) ? localizedPath(path, language) : path;
  }

  /** An unprefixed entry opens the reader's remembered language when the page has it. */
  private applyRememberedLanguage(): void {
    let saved: string | null = null;
    try { saved = this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null; } catch { /* Optional. */ }
    if (!valid(saved)) return;
    if (!this.location().language && saved !== this.language() && hasVersion(this.path(), saved)) void this.go(saved);
  }

  private async go(language: PageLanguage): Promise<void> {
    const current = this.router.parseUrl(this.router.url);
    const target = this.router.parseUrl(localizedPath(this.path(), language));
    target.queryParams = current.queryParams;
    target.fragment = current.fragment;
    await this.router.navigateByUrl(target, { replaceUrl: true });
  }

  private remember(language: PageLanguage): void {
    try { this.document.defaultView?.localStorage.setItem(STORAGE_KEY, language); } catch { /* Optional. */ }
  }

  /** <html lang>, the canonical URL and hreflang alternates for the current page. */
  private applyDocumentLanguage(): void {
    const head = this.document.head;
    const language = this.language();
    this.document.documentElement.lang = HREFLANG[language];
    for (const link of head.querySelectorAll('link[data-site-language]')) link.remove();
    const add = (rel: string, href: string, hreflang?: string) => {
      const link = this.document.createElement('link');
      link.setAttribute('rel', rel);
      link.setAttribute('href', `${ORIGIN}${publicUrl(href)}`);
      if (hreflang) link.setAttribute('hreflang', hreflang);
      link.setAttribute('data-site-language', '');
      head.appendChild(link);
    };
    add('canonical', localizedPath(this.path(), language));
    for (const available of this.available()) add('alternate', localizedPath(this.path(), available), HREFLANG[available]);
    if (this.available().includes('zh')) add('alternate', this.path(), 'x-default');
  }
}
