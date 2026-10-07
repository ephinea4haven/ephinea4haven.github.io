import { inject, Injectable, isDevMode } from '@angular/core';
import { SiteLanguage, type PageLanguage } from '../shared/site-language.service';
import { searchSnippet, type SearchText } from './search-snippet';

interface SearchDocument {
  url: string;
  excerpt: string;
  meta: { title: string };
  filters: { category?: string[] };
  sub_results: { title: string; url: string; excerpt: string }[];
}
export interface SearchResult extends Omit<SearchDocument, 'excerpt' | 'sub_results'> {
  excerpt: SearchText[];
  sub_results: { title: string; url: string; excerpt: SearchText[] }[];
}
interface ResultReference { id: string; data(): Promise<SearchDocument> }
interface Pagefind {
  init(): Promise<void>;
  destroy(): Promise<void>;
  options(options: { excerptLength: number }): Promise<void>;
  search(term: string, options: { filters?: { category: string } }): Promise<{ results: ResultReference[] }>;
}
export interface SearchResponse { total: number; results: SearchResult[] }

/** Browser-only, chunked search. Language transitions serialize with pending searches. */
@Injectable({ providedIn: 'root' })
export class SearchEngine {
  private readonly site = inject(SiteLanguage);
  private module: Promise<Pagefind> | undefined;
  private language: PageLanguage | undefined;
  private retry = 0;
  private pending: Promise<unknown> = Promise.resolve();

  search(term: string, category: string, language: PageLanguage, limit: number): Promise<SearchResponse> {
    const job = this.pending.catch(() => {}).then(async () => {
      if (language !== this.site.language()) throw new Error('Search language changed');
      this.module ??= this.load();
      const engine = await this.module;
      if (language !== this.site.language()) throw new Error('Search language changed');
      if (this.language !== language || isDevMode()) {
        await engine.destroy();
        await engine.options({ excerptLength: 24 });
        await engine.init();
        this.language = language;
      }
      try {
        // Canonicalize fullwidth game-name symbols before Pagefind tokenizes them.
        const response = await engine.search(term.normalize('NFKC'), category ? { filters: { category } } : {});
        const documents = await Promise.all(response.results.slice(0, limit).map(result => result.data()));
        const results = documents.map(result => ({
          url: result.url, meta: result.meta, filters: result.filters,
          excerpt: searchSnippet(result.excerpt),
          sub_results: result.sub_results.map(section => ({ title: section.title, url: section.url, excerpt: searchSnippet(section.excerpt) })),
        }));
        return { total: response.results.length, results };
      } catch (error) {
        // A failed metadata/index/fragment download must be retriable as well as a failed JS import.
        await engine.destroy();
        this.language = undefined;
        throw error;
      }
    });
    this.pending = job;
    return job;
  }

  private async load(): Promise<Pagefind> {
    // Generated after Angular prerendering; a variable import leaves this module outside the app bundle.
    const url = `/assets/search/pagefind.js${this.retry ? `?retry=${this.retry}` : ''}`;
    try { return await import(/* @vite-ignore */ url) as Pagefind; }
    catch (error) { this.module = undefined; this.retry += 1; throw error; }
  }
}
