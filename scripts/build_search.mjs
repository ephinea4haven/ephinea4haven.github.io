import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decode, encode } from 'cborg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { parse, parseFragment, serialize } from 'parse5';
import * as pagefind from 'pagefind';
import { generatedFiles } from './generated_files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredTags = new Set(['script', 'style', 'link', 'nav', 'footer', 'button', 'select', 'input', 'textarea', 'dialog', 'haven-site-search', 'haven-language-bar', 'catalog-language']);
const ignoredClasses = new Set(['brand', 'back-link', 'related-section', 'source-section', 'toc', 'page-toc']);
const attribute = (node, name) => node.attrs?.find(entry => entry.name === name)?.value;
const textOf = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(textOf).join('');
const key = text => text.normalize('NFKC').toLowerCase().trim();
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const ordered = value => Array.isArray(value) ? value.map(ordered)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const version = '1.5.2';
const prefix = Buffer.from('pagefind_dcd');
const strings = values => Array.isArray(values) && values.every(value => typeof value === 'string');
const integers = values => Array.isArray(values) && values.every(value => Number.isSafeInteger(value) && value >= 0);
const tuple = (value, length) => Array.isArray(value) && value.length === length;
const compareNames = (left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0;

/**
 * Pagefind 1.5.2 encodes filter HashMaps without sorting their values:
 * https://github.com/Pagefind/pagefind/blob/v1.5.2/pagefind/src/index/mod.rs#L405
 * Its browser treats hashes as opaque filenames. Canonicalize the documented-by-source
 * CBOR tuples and replace filter -> metadata -> entry references, leaving page/index
 * order and every other asset intact. Fail closed if an upgrade changes the format.
 */
function canonicalPagefindFiles(files) {
  const output = new Map(files.map(file => [file.path, file]));
  assert.equal(output.size, files.length, 'Pagefind emitted duplicate paths');
  const entryFile = output.get('pagefind-entry.json');
  assert.ok(entryFile, 'Pagefind entry is missing');
  const entry = JSON.parse(Buffer.from(entryFile.content).toString('utf8'));
  assert.equal(entry.version, version, 'Review Pagefind CBOR format before upgrading');
  assert.ok(entry.languages && typeof entry.languages === 'object' && !Array.isArray(entry.languages));

  function unpack(filename) {
    const file = output.get(filename);
    assert.ok(file, `Pagefind reference is missing: ${filename}`);
    const bytes = gunzipSync(file.content);
    assert.ok(bytes.subarray(0, prefix.length).equals(prefix), `Invalid Pagefind prefix: ${filename}`);
    const payload = bytes.subarray(prefix.length);
    const value = decode(payload);
    // Our supported tuples contain only definite arrays, strings, and unsigned integers.
    assert.ok(Buffer.from(encode(value)).equals(payload), `Unexpected Pagefind CBOR encoding: ${filename}`);
    return value;
  }

  function replace(filename, language, value, destination) {
    const payload = encode(value);
    const hash = `${language}_${createHash('sha256').update(payload).digest('hex')}`;
    output.delete(filename);
    const newPath = destination(hash);
    output.set(newPath, { path: newPath, content: gzipSync(Buffer.concat([prefix, payload]), { level: 9 }) });
    return hash;
  }

  for (const [language, details] of Object.entries(entry.languages)) {
    assert.ok(details && typeof details.hash === 'string', `Invalid Pagefind language: ${language}`);
    const filename = `pagefind.${details.hash}.pf_meta`;
    const meta = unpack(filename);
    assert.ok(tuple(meta, 6) && meta[0] === version, 'Unexpected Pagefind metadata schema');
    assert.ok(Array.isArray(meta[1]) && meta[1].every(page => tuple(page, 2) && typeof page[0] === 'string' && integers([page[1]])));
    assert.ok(Array.isArray(meta[2]) && meta[2].every(chunk => tuple(chunk, 3) && strings(chunk)));
    assert.ok(Array.isArray(meta[3]) && meta[3].every(filter => tuple(filter, 2) && strings(filter)));
    assert.ok(Array.isArray(meta[4]) && meta[4].every(sort => tuple(sort, 2) && typeof sort[0] === 'string' && integers(sort[1])));
    assert.ok(strings(meta[5]));
    assert.equal(new Set(meta[3].map(([name]) => name)).size, meta[3].length, 'Duplicate Pagefind filter names');
    for (const filter of meta[3]) {
      const filterPath = `filter/${filter[1]}.pf_filter`;
      const value = unpack(filterPath);
      assert.ok(tuple(value, 2) && value[0] === filter[0] && Array.isArray(value[1]), 'Unexpected Pagefind filter schema');
      assert.ok(value[1].every(item => tuple(item, 2) && typeof item[0] === 'string'
        && integers(item[1]) && item[1].every(page => page < meta[1].length)), 'Invalid Pagefind filter page references');
      assert.equal(new Set(value[1].map(([name]) => name)).size, value[1].length, 'Duplicate Pagefind filter values');
      value[1].sort(compareNames);
      filter[1] = replace(filterPath, language, value, hash => `filter/${hash}.pf_filter`);
    }
    meta[3].sort(compareNames);
    details.hash = replace(filename, language, meta, hash => `pagefind.${hash}.pf_meta`);
  }
  output.set(entryFile.path, { path: entryFile.path, content: Buffer.from(JSON.stringify(entry)) });
  return [...output.values()];
}

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes ?? []) visit(child, callback);
}
function setAttribute(node, name, value) {
  node.attrs = (node.attrs ?? []).filter(entry => entry.name !== name);
  node.attrs.push({ name, value });
}

/** Only actual rendered routes enter the index, with one URL per directory page. */
export function searchRoutes(routes) {
  return [...new Set(routes.flatMap(route => {
    const parsed = new URL(route, 'https://www.psohaven.com');
    let pathname = parsed.pathname.replace(/\/index\.html$/, '/');
    if (/\/(?:404\.html|event\/(?:anniversary|christmas|easter|halloween|valentines)\/\d{4}\.html)$/.test(pathname)) return [];
    if (!/\.[a-z]+$/i.test(pathname) && !pathname.endsWith('/')) pathname += '/';
    return [`${pathname}${parsed.search}`];
  }))].sort();
}

/** Historical content is a year on its host page, never a standalone fragment URL. */
export function archiveEntries(html, url) {
  const host = /^(\/(?:en|ja))?\/event\/(anniversary|christmas|easter|halloween|valentines)\.html$/.exec(url);
  if (!host) return [];
  let marker;
  let title;
  let language;
  visit(parse(html), node => {
    if (attribute(node, 'data-event') === host[2] && attribute(node, 'data-years')) marker = node;
    if (node.tagName === 'h1' && !title) title = textOf(node).trim();
    if (node.tagName === 'html') language = attribute(node, 'lang');
  });
  if (!marker || !title || !language) throw new Error(`Search archive lacks host metadata: ${url}`);
  const defaultYear = attribute(marker, 'data-default-year');
  const years = attribute(marker, 'data-years').split(',').filter(year => /^\d{4}$/.test(year) && year !== defaultYear);
  return years.sort().map(year => ({
    url: `${url}?year=${year}`,
    language,
    title: (title.includes(defaultYear) ? title.replace(defaultYear, year) : `${year} ${title}`)
      .replace(/([A-Za-z’])(\d{4})/g, '$1 $2').replace(/(\d{4})([A-Za-z])/g, '$1 $2'),
    fragment: `${host[1] ?? ''}/event/${host[2]}/${year}.html`,
  }));
}

export function searchCategory(route) {
  const plain = route.replace(/^\/(?:en|ja)(?=\/)/, '');
  if (/^\/data\/(?:items(?:\/|\.html)|cosmetics\.html)/.test(plain)) return 'items';
  if (/^\/data\/enemies(?:\/|\.html)/.test(plain)) return 'enemies';
  if (plain.startsWith('/guide/') || plain === '/tools/mechanics.html') return 'guides';
  if (plain.startsWith('/tools/')) return 'tools';
  if (plain.startsWith('/event/')) return 'events';
  return 'reference';
}

/** Use maintained identities; a shared abbreviation can legitimately match several items. */
export function glossaryAliases(html) {
  const aliases = new Map();
  visit(parse(html), node => {
    if (node.tagName !== 'tr') return;
    const cells = (node.childNodes ?? []).filter(child => child.tagName === 'td');
    if (cells.length < 2) return;
    const codes = [];
    visit(cells[0], child => { if (child.tagName === 'code') codes.push(textOf(child).trim()); });
    const identities = textOf(cells[1]).split(/\s+\/\s+/).map(key);
    if (!codes.length || (identities.length > 1 && codes.length > 1 && identities.length !== codes.length)) return;
    identities.forEach((identity, index) => {
      const names = identities.length === 1 ? codes : [codes.length === 1 ? codes[0] : codes[index]];
      aliases.set(identity, [...new Set([...(aliases.get(identity) ?? []), ...names])]);
    });
  });
  return aliases;
}

/** Annotate an indexing copy; published Angular HTML and hydration metadata stay untouched. */
export function searchDocument(html, route, aliases = []) {
  const document = parse(html);
  let body;
  let title;
  const prune = node => {
    node.childNodes = (node.childNodes ?? []).filter(child => !ignoredTags.has(child.tagName)
      && !attribute(child, 'class')?.split(/\s+/).some(name => ignoredClasses.has(name))
      && attribute(child, 'data-pagefind-ignore') === undefined);
    if (node.tagName === 'body') body = node;
    if (node.tagName === 'h1' && !title) title = node;
    // Pagefind section links use an existing anchor, including headings inside <section id>.
    if (/^h[2-6]$/.test(node.tagName) && !attribute(node, 'id')
      && node.parentNode?.tagName === 'section' && attribute(node.parentNode, 'id')
      && node.parentNode.childNodes.find(child => /^h[2-6]$/.test(child.tagName)) === node) {
      setAttribute(node, 'id', attribute(node.parentNode, 'id'));
    }
    for (const child of node.childNodes) prune(child);
  };
  prune(document);
  if (!body || !title) throw new Error(`Search page has no body or heading: ${route}`);
  setAttribute(title, 'data-pagefind-meta', 'title');
  setAttribute(body, 'data-pagefind-filter', `category:${searchCategory(route)}`);
  if (aliases.length) {
    const fragment = parseFragment(`<p data-pagefind-weight="5">${aliases.map(escape).join(' · ')}</p>`);
    body.childNodes.push(...fragment.childNodes);
  }
  return serialize(document);
}

async function searchAliases() {
  const [items, monsters, glossary] = await Promise.all([
    readFile(path.join(root, 'src/app/generated/item-catalog/index.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'src/app/generated/monster-catalog/index.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'guide/acronym.html'), 'utf8'),
  ]);
  const abbreviations = glossaryAliases(glossary);
  const aliases = new Map(items.map(row => [
    `/data/items/${row[0]}.html`,
    [...new Set([row[1], row[10], row[12], row[13], ...(abbreviations.get(key(row[1])) ?? []), ...(abbreviations.get(key(row[10])) ?? [])].filter(Boolean))],
  ]));
  for (const monster of monsters) {
    const names = [...Object.values(monster.names), ...Object.values(monster.ultimateNames ?? {})];
    aliases.set(`/data/enemies/${monster.id}.html`, [...new Set([...names, ...names.flatMap(name => abbreviations.get(key(name)) ?? [])])]);
  }
  return aliases;
}

/** The same indexing pipeline consumes production HTML and the dev server's current SSR responses. */
export async function buildSearchFromDocuments({ documents, outputDirectory }) {
  const aliases = await searchAliases();
  const seen = new Set();
  let archivePages = 0;
  const check = (response, context) => {
    if (response.errors?.length) throw new Error(`Pagefind ${context}: ${response.errors.join('; ')}`);
    return response;
  };
  try {
    const { index } = check(await pagefind.createIndex(), 'create');
    if (!index) throw new Error('Pagefind did not create an index');
    for await (const document of documents) {
      const [url] = searchRoutes([document.url]);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const html = document.html;
      check(await index.addHTMLFile({ url, content: searchDocument(html, url, aliases.get(url.replace(/^\/(?:en|ja)(?=\/)/, '')) ?? []) }), url);
      for (const archive of archiveEntries(html, url)) {
        if (seen.has(archive.url)) continue;
        const fragment = await readFile(path.join(root, 'src/app/generated/event-fragments', archive.fragment), 'utf8');
        const page = `<html lang="${escape(archive.language)}"><body><h1>${escape(archive.title)}</h1>${fragment}</body></html>`;
        check(await index.addHTMLFile({ url: archive.url, content: searchDocument(page, archive.url) }), archive.url);
        seen.add(archive.url);
        archivePages += 1;
      }
    }
    const { files } = check(await index.getFiles(), 'files');
    // The app owns its search UI. Ship only the runtime, worker and content-addressed index chunks.
    const output = canonicalPagefindFiles(files).filter(file => !/^pagefind-(?:ui|modular-ui|component-ui|highlight)\./.test(file.path))
      // Dev rebuilds keep existing content-addressed chunks available; publish the new entry last.
      .sort((left, right) => Number(left.path === 'pagefind-entry.json') - Number(right.path === 'pagefind-entry.json') || left.path.localeCompare(right.path));
    const generated = generatedFiles();
    for (const file of output) {
      const destination = path.join(outputDirectory, file.path);
      // Pagefind's language map comes from a HashMap; stabilize its JSON key order for the artifact manifest.
      const content = file.path.endsWith('.json')
        ? `${JSON.stringify(ordered(JSON.parse(Buffer.from(file.content).toString('utf8'))))}\n` : file.content;
      generated.write(destination, content);
    }
    // Keep identical resources and their mtimes; atomically replace changed files, entry last.
    // Do not clean old content-addressed chunks: an open dev tab may still need them.
    generated.commit();
    const javascript = output.filter(file => file.path.endsWith('.js'));
    return {
      pages: seen.size,
      archivePages,
      files: output.length,
      javascriptGzipBytes: javascript.reduce((bytes, file) => bytes + gzipSync(file.content).length, 0),
    };
  } finally {
    await pagefind.close();
  }
}

export async function buildSearch({ directory, routes }) {
  async function* documents() {
    for (const url of searchRoutes(routes)) {
      const filename = path.join(directory, url.endsWith('/') ? `${url}index.html` : url);
      yield { url, html: await readFile(filename, 'utf8') };
    }
  }
  return buildSearchFromDocuments({ documents: documents(), outputDirectory: path.join(directory, 'assets/search') });
}
