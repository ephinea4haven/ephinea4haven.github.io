// Build-time page localization. Each language version of a page is compiled into
// its own template: interface keys, long-form document regions, localized map
// images and links are resolved here, so a published page contains only its own
// language. See docs/ARCHITECTURE.md ("Languages and URLs", "Translation sources").
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFragment } from 'parse5';

export const LANGUAGES = ['zh', 'en', 'ja'];
export const SITE_ORIGIN = 'https://www.psohaven.com';
// Angular feature pages that render every language from the URL (their own
// keyed dictionaries); a key ending in / covers a whole route family.
export const FEATURE_PAGES = ['index.html', 'data/items.html', 'data/items/', 'data/cosmetics.html', 'data/enemies.html', 'data/enemies/', 'tools/status.html'];

/** Page key: no leading slash, directory indexes by directory, the homepage as index.html. */
export function pageKey(relative) {
  const key = relative.split(/[?#]/)[0].replace(/^\/+/, '').replace(/\/(index\.html)?$/, '').replace(/^index\.html$/, '');
  return key || 'index.html';
}

export async function loadPageI18n(root) {
  const coverage = JSON.parse(await readFile(path.join(root, 'content/i18n/pages.json'), 'utf8')).pages;
  const messages = Object.fromEntries(await Promise.all(LANGUAGES.map(async (language) => [
    language, JSON.parse(await readFile(path.join(root, `content/i18n/messages/${language}.json`), 'utf8')),
  ])));
  // The first listed language is the one at the historical (unprefixed) URL; only
  // pages published in Chinese there get /en/ and /ja/ versions.
  const prefixed = Object.entries(coverage).filter(([, page]) => (page.languages ?? ['zh'])[0] === 'zh');
  const localized = Object.fromEntries(LANGUAGES.filter((language) => language !== 'zh').map((language) => [
    language,
    [...new Set([...FEATURE_PAGES, ...prefixed.filter(([, page]) => page.languages?.includes(language)).map(([key]) => key)])].sort(),
  ]));
  const unprefixed = Object.fromEntries(Object.entries(coverage)
    .filter(([, page]) => (page.languages ?? ['zh'])[0] !== 'zh').map(([key, page]) => [key, page.languages[0]]));
  return { root, coverage, messages, localized, unprefixed };
}

/** Versions to build for a page: 'zh' is the unprefixed page, others are /<language>/ versions. */
export function languagesFor(i18n, relative) {
  const key = pageKey(relative);
  if (FEATURE_PAGES.includes(key)) return LANGUAGES;
  if (i18n.unprefixed[key]) return ['zh'];
  return ['zh', ...(i18n.coverage[key]?.languages ?? []).filter((language) => language !== 'zh')];
}

export function hasVersion(i18n, key, language) {
  if (language === 'zh') return true;
  return i18n.localized[language].some((candidate) => candidate.endsWith('/') ? key.startsWith(candidate) : key === candidate);
}

/** URL of a page in a language: Chinese keeps the historical path, others are prefixed. */
export function localizedPath(href, language) {
  if (language === 'zh') return href;
  return `/${language}${href === '/' ? '' : href}`;
}

export function message(i18n, language, key, args = {}) {
  const template = i18n.messages[language][key];
  if (typeof template !== 'string') throw new Error(`Missing ${language} message: ${key}`);
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = args[name];
    if (value === undefined) throw new Error(`Missing argument ${name} for message ${key}`);
    return value.startsWith('@') ? message(i18n, language, value.slice(1)) : value;
  });
}

function parseArgs(value = '') {
  return Object.fromEntries(value.split(';').filter(Boolean).map((pair) => {
    const index = pair.indexOf('=');
    return [pair.slice(0, index), pair.slice(index + 1)];
  }));
}

const documentCache = new Map();
function documentParts(i18n, relative, language) {
  const file = path.join(i18n.root, 'content/i18n/pages', language, relative);
  if (!documentCache.has(file)) {
    const parts = new Map();
    if (existsSync(file)) {
      for (const node of parseFragment(readFileSync(file, 'utf8')).childNodes) {
        const part = node.attrs?.find((attribute) => attribute.name === 'data-part')?.value;
        if (part) parts.set(part, node.childNodes);
      }
    }
    documentCache.set(file, parts);
  }
  return documentCache.get(file);
}

/** Rendered height of an SVG at a given width, from its viewBox (translations may change a map's height). */
function svgHeight(root, source, width) {
  const file = path.join(root, source.split(/[?#]/)[0].replace(/^\//, ''));
  const viewBox = readFileSync(file, 'utf8').match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!viewBox) throw new Error(`SVG has no viewBox: ${source}`);
  return String(Math.round(width * Number(viewBox[2]) / Number(viewBox[1])));
}

const attribute = (node, name) => node.attrs?.find((entry) => entry.name === name)?.value;
const setAttribute = (node, name, value) => {
  const entry = node.attrs.find((candidate) => candidate.name === name);
  if (entry) entry.value = value; else node.attrs.push({ name, value });
};
const removeAttributes = (node, names) => { node.attrs = node.attrs.filter((entry) => !names.includes(entry.name)); };
const textNode = (parent, value) => ({ nodeName: '#text', value, parentNode: parent });

/**
 * Resolve one language version of a page body (a parse5 tree, edited in place).
 * Translated document regions name items as <span data-item-en="…"></span>;
 * itemName(english, language) supplies the authoritative name.
 */
export function localizeBody(i18n, body, language, relative, { itemName }) {
  const parts = language === 'zh' ? null : documentParts(i18n, relative, language);
  const usedParts = new Set();
  const visitNode = (node) => {
    if (!node.childNodes) return;
    node.childNodes = node.childNodes.filter((child) => {
      if (!child.attrs) return true;
      const only = attribute(child, 'data-lang-content') ?? attribute(child, 'data-home-language-only');
      return only === undefined || only === language;
    });
    for (const child of node.childNodes) {
      if (!child.attrs) continue;
      removeAttributes(child, ['data-lang-content', 'data-home-language-only', ...(attribute(child, 'data-lang-content') !== undefined ? ['hidden'] : [])]);
      const part = attribute(child, 'data-part');
      if (part !== undefined && parts) {
        if (!parts.has(part)) throw new Error(`Missing ${language} document region "${part}" for ${relative}`);
        child.childNodes = structuredClone(parts.get(part).map(({ parentNode, ...rest }) => rest));
        usedParts.add(part);
      }
      const key = attribute(child, 'data-i18n');
      if (key !== undefined || attribute(child, 'data-home-i18n') !== undefined) {
        const value = key ? message(i18n, language, key) : attribute(child, `data-${language}`);
        if (value === undefined) throw new Error(`Missing ${language} text in ${relative}: ${attribute(child, 'data-zh')}`);
        child.childNodes = [textNode(child, value)];
        removeAttributes(child, ['data-i18n', 'data-home-i18n', 'data-zh', 'data-en', 'data-ja']);
      }
      for (const name of ['aria-label', 'title', 'alt']) {
        const value = attribute(child, `data-home-${name}-${language}`);
        if (value !== undefined) setAttribute(child, name, value);
        removeAttributes(child, LANGUAGES.map((candidate) => `data-home-${name}-${candidate}`));
      }
      // An empty element naming an item is a placeholder for its authoritative name.
      const item = attribute(child, 'data-item-en');
      if (item !== undefined && child.childNodes.length === 0) {
        child.childNodes = [textNode(child, itemName(item, language))];
        removeAttributes(child, ['data-item-en']);
      }
      // Localized images live in a /zh/ directory with /en/ and /ja/ siblings.
      if (child.tagName === 'img' && attribute(child, 'data-i18n-src') !== undefined) {
        const zhSource = attribute(child, 'src');
        if (zhSource.split('/zh/').length !== 2) throw new Error(`Localized image needs one /zh/ directory: ${zhSource}`);
        const source = zhSource.replace('/zh/', `/${language}/`);
        setAttribute(child, 'src', source);
        setAttribute(child, 'height', svgHeight(i18n.root, source, Number(attribute(child, 'width'))));
        setAttribute(child, 'alt', message(i18n, language, attribute(child, 'data-i18n-alt'), parseArgs(attribute(child, 'data-i18n-args'))));
        removeAttributes(child, ['data-i18n-src', 'data-i18n-alt', 'data-i18n-args']);
      }
      if (child.tagName === 'a' && language !== 'zh') {
        const href = attribute(child, 'href');
        if (href?.startsWith('/') && !href.startsWith('//') && hasVersion(i18n, pageKey(href), language)) {
          setAttribute(child, 'href', localizedPath(href, language));
        }
      }
      visitNode(child);
    }
  };
  visitNode(body);
  if (parts) for (const part of parts.keys()) {
    if (!usedParts.has(part)) throw new Error(`Unused ${language} document region "${part}" for ${relative}`);
  }
}

export function pageMetadata(i18n, relative, language, zhTitle, zhDescription) {
  if (language === 'zh') return { title: zhTitle, description: zhDescription };
  const page = i18n.coverage[pageKey(relative)];
  const title = page?.title?.[language];
  const description = page?.description?.[language];
  if (!title || !description) throw new Error(`Missing ${language} title or description for ${relative} in content/i18n/pages.json`);
  return { title, description };
}
