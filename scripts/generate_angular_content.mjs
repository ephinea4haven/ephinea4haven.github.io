import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseFragment, serialize } from 'parse5';
import vm from 'node:vm';
import { localizeHome } from './home_i18n.mjs';
import { languagesFor, loadPageI18n, localizeBody, localizeLinks, pageMetadata } from './page_i18n.mjs';
import { marked } from 'marked';
import { ItemData } from '../src/app/status/item-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'src', 'app', 'generated', 'pages');
const routeFile = path.join(root, 'src', 'app', 'generated', 'content.routes.ts');
const serverRouteFile = path.join(root, 'src', 'app', 'generated', 'content.routes.server.ts');
const roots = ['data', 'event', 'guide', 'tools'];
const rootPages = ['index.html', '404.html'];
const explicitPages = new Set([
  'data/price_guide.html',
  'data/item-names.html',
  'tools/cc.html',
  'tools/ccopm.html',
  'tools/chartable.html',
  'tools/status.html',
]);
const pageBehaviors = new Map([
  ['index.html', ['LandingPageBehavior']],
  ['404.html', ['NotFoundRedirectBehavior']],
  ['data/bb_items.html', ['ItemTableSearchBehavior']],
  ['data/monsters.html', ['MonsterFilterBehavior', 'BackToTopBehavior']],
  ['data/quest.html', ['BackToTopBehavior']],
  ['guide/class-guide.html', ['ProfessionTabsBehavior']],
  ['guide/ep1ch.html', ['ChallengeGuideBehavior']],
  ['guide/ep2ch.html', ['ChallengeGuideBehavior']],
  ['guide/seabed.html', ['SeabedRouteBehavior']],
  ['tools/materialplan.html', ['BackToTopBehavior']],
  ['tools/id.html', ['SectionIdBehavior']],
  ['event/easter.html', ['EventArchiveBehavior']],
  ['event/halloween.html', ['EventArchiveBehavior']],
  ['event/valentines.html', ['EventArchiveBehavior']],
  ['guide/volopt.html', ['VolOptBehavior']],
  ['guide/rbr.html', ['RbrBehavior']],
  ['tools/mag.html', ['MagBehavior']],
  ['data/protocol/index.html', ['ProtocolReferenceBehavior']],
  ['event/anniversary.html', ['SeasonalEventBehavior']],
  ['event/christmas.html', ['SeasonalEventBehavior']],
]);
const behaviorModules = new Map([
  ['ChallengeGuideBehavior', '../../content/challenge-guide.directive'],
  ['BackToTopBehavior', '../../content/back-to-top.directive'],
  ['EventArchiveBehavior', '../../events/event-archive.directive'],
  ['LandingPageBehavior', '../../content/landing-page.directive'],
  ['VolOptBehavior', '../../data/volopt.directive'],
  ['RbrBehavior', '../../rbr/rbr.directive'],
  ['MagBehavior', '../../mag/mag.directive'],
  ['SeasonalEventBehavior', '../../events/seasonal-event.directive'],
]);

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes || []) visit(child, callback);
  if (node.content) visit(node.content, callback);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  }));
  return nested.flat();
}

function classNameFor(relative) {
  const name = relative.replace(/\.html$/, '').split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join('');
  return `${/^\d/.test(name) ? 'Page' : ''}${name}ContentPage`;
}

function fileNameFor(relative) {
  return relative.replace(/\.html$/, '').replaceAll('/', '__').replaceAll(/[^a-zA-Z0-9_]/g, '-');
}

function canonicalRoute(relative) {
  if (relative === 'index.html') return '';
  return relative.endsWith('/index.html') ? relative.slice(0, -'/index.html'.length) : relative;
}

function makeRelativeUrlsRootRelative(body, relative) {
  const pageUrl = new URL(relative, 'https://psohaven.invalid/');
  visit(body, (node) => {
    for (const attribute of node.attrs || []) {
      if (!['href', 'src', 'action', 'poster'].includes(attribute.name)
          || !attribute.value
          || attribute.value.startsWith('/')
          || /^[a-z][a-z0-9+.-]*:/i.test(attribute.value)) continue;
      const resolved = new URL(attribute.value, pageUrl);
      attribute.value = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
  });
}

// A local asset URL ending in a bare `?v` is stamped with its content hash, so cache busting never needs a manual number.
const assetVersions = new Map();
function stampAssetVersions(body, relative) {
  visit(body, (node) => {
    for (const attribute of node.attrs || []) {
      if (!['href', 'src', 'poster'].includes(attribute.name) || !attribute.value.startsWith('/')) continue;
      if (/\?(?:[^#]*&)?v=/.test(attribute.value)) {
        throw new Error(`${relative}: replace the manual version in ${attribute.value} with a bare ?v`);
      }
      const match = /^(\/[^?#]+)\?v(#.*)?$/.exec(attribute.value);
      if (!match) continue;
      if (!assetVersions.has(match[1])) {
        let bytes;
        try {
          bytes = readFileSync(path.join(root, decodeURIComponent(match[1]).slice(1)));
        } catch {
          throw new Error(`${relative}: versioned asset does not exist: ${match[1]}`);
        }
        assetVersions.set(match[1], createHash('sha256').update(bytes).digest('hex').slice(0, 12));
      }
      attribute.value = `${match[1]}?v=${assetVersions.get(match[1])}${match[2] || ''}`;
    }
  });
}

function textBetween(source, node) {
  const location = node.sourceCodeLocation;
  if (!location?.startTag || !location.endTag) return '';
  return source.slice(location.startTag.endOffset, location.endTag.startOffset);
}

function escapeAngularText(html) {
  return html.replaceAll('@', '&#64;').replaceAll('{', '&#123;').replaceAll('}', '&#125;');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const itemTranslationSource = await readFile(path.join(root, 'assets/js/i18n/items_i18n.js'), 'utf8');
const itemTranslationSandbox = { window: {} };
vm.runInNewContext(itemTranslationSource, itemTranslationSandbox, {
  filename: 'items_i18n.js', timeout: 1000,
});
const itemTranslations = Object.values(itemTranslationSandbox.window.ITEMS_I18N || {})
  .filter((item) => item?.en && item?.zh)
  .sort((left, right) => left.en.localeCompare(right.en, 'en', { sensitivity: 'base' }));
const itemTranslationById = itemTranslationSandbox.window.ITEMS_I18N || {};
function normalizeEnglishItemName(value) {
  return value.normalize('NFKC').replaceAll(/[‘’']/g, '-').trim();
}

function foldEnglishItemName(value) {
  return normalizeEnglishItemName(value).toLocaleLowerCase('en');
}

const itemTranslationByEnglish = new Map();
const itemTranslationsByFoldedEnglish = new Map();
for (const item of itemTranslations) {
  const identity = normalizeEnglishItemName(item.en);
  const duplicate = itemTranslationByEnglish.get(identity);
  if (duplicate) {
    throw new Error(
      `items_i18n.js has duplicate English item identity: ${JSON.stringify(duplicate.en)} and ${JSON.stringify(item.en)}`,
    );
  }
  itemTranslationByEnglish.set(identity, item);
  const folded = foldEnglishItemName(item.en);
  const foldedItems = itemTranslationsByFoldedEnglish.get(folded) || [];
  foldedItems.push(item);
  itemTranslationsByFoldedEnglish.set(folded, foldedItems);
}
await mkdir(path.join(root, 'src/app/generated/i18n'), { recursive: true });
await writeFile(path.join(root, 'src/app/generated/i18n/items.ts'), `export interface ItemTranslation {
  readonly en: string; readonly zh: string; readonly ja?: string;
}
export const ITEM_TRANSLATIONS: readonly ItemTranslation[] = ${JSON.stringify(itemTranslations)};\n`);

async function evaluateWindowData(file, property) {
  const sandbox = { window: {} };
  vm.runInNewContext(await readFile(path.join(root, file), 'utf8'), sandbox, {
    filename: file, timeout: 1000,
  });
  const value = sandbox.window[property];
  if (!Array.isArray(value)) throw new Error(`${file} did not define ${property}`);
  return value;
}

const [bdpData, prizeData] = await Promise.all([
  evaluateWindowData('data/bdp/data.js', 'BDP_DATA'),
  evaluateWindowData('data/prizelist/data.js', 'PRIZE_DATA'),
]);
const volOptSandbox = {};
vm.runInNewContext(`${await readFile(path.join(root, 'assets/js/volopt_data.js'), 'utf8')}\n;globalThis.__VOL_OPT_DATA = DATA;`, volOptSandbox, {
  filename: 'assets/js/volopt_data.js', timeout: 1000,
});
await mkdir(path.join(root, 'src/app/generated/data'), { recursive: true });
// Data fetched at runtime is addressed by content hash, so updates are never served stale.
const characterDataHash = createHash('sha256').update(await readFile(path.join(root, 'assets/js/chardata.json'))).digest('hex').slice(0, 12);
await writeFile(path.join(root, 'src/app/generated/data/versions.json'), `${JSON.stringify({ chardata: characterDataHash })}\n`);
await writeFile(path.join(root, 'src/app/generated/data/volopt-data.ts'),
  `export const VOL_OPT_DATA = ${JSON.stringify(volOptSandbox.__VOL_OPT_DATA)} as const;\n`);
const priceSandbox = {};
vm.runInNewContext(`${await readFile(path.join(root, 'assets/js/price_guide_data.js'), 'utf8')}\n;globalThis.__PRICE_DATA = PRICE_DATA;`, priceSandbox, {
  filename: 'assets/js/price_guide_data.js', timeout: 1000,
});
const priceData = priceSandbox.__PRICE_DATA;
await writeFile(path.join(root, 'src/app/generated/data/price-data.ts'),
  `export const PRICE_DATA = ${JSON.stringify(priceData)} as const;\n`);
const magEvolutionSandbox = { window: {} };
const magSimulationSandbox = { window: {} };
vm.runInNewContext(await readFile(path.join(root, 'assets/js/mag-evolution.js'), 'utf8'), magEvolutionSandbox, {
  filename: 'assets/js/mag-evolution.js', timeout: 1000,
});
vm.runInNewContext(await readFile(path.join(root, 'assets/js/mag-sim-data.js'), 'utf8'), magSimulationSandbox, {
  filename: 'assets/js/mag-sim-data.js', timeout: 1000,
});
// The chart consumes feeding values only, not the simulator's evolution and cell rules.
const { feedTables, itemOrder } = magSimulationSandbox.window.MAG_SIM;
await writeFile(path.join(root, 'src/app/generated/data/mag-data.ts'),
  `export const MAG_EVOLUTION = ${JSON.stringify(magEvolutionSandbox.window.MAG_EVOLUTION)} as const;\nexport const MAG_FEEDING = ${JSON.stringify({ feedTables, itemOrder })} as const;\n`);

function i18nAttributes(values) {
  return `data-i18n data-zh="${escapeHtml(values.zh)}" data-en="${escapeHtml(values.en)}" data-ja="${escapeHtml(values.ja)}"`;
}

function itemI18nAttributes(values) {
  return `${i18nAttributes(values)} data-item-zh="${escapeHtml(values.zh)}"`;
}

function visibleItemZh(values) {
  return escapeHtml(values.zh);
}

function itemI18n(id) {
  const item = itemTranslationById[id];
  if (!item?.en || !item?.zh) {
    throw new Error(`Unknown canonical item translation id: ${JSON.stringify(id)}`);
  }
  return {
    zh: item.zh,
    en: item.en,
    ja: item.ja || item.en,
  };
}

function itemByEnglish(name, context) {
  const cleaned = name.replace(/\s*⭐.*$/, '').trim();
  let item = itemTranslationByEnglish.get(normalizeEnglishItemName(cleaned));
  if (!item) {
    const foldedItems = itemTranslationsByFoldedEnglish.get(foldEnglishItemName(cleaned)) || [];
    const translations = new Set(foldedItems.map((candidate) => candidate.zh));
    if (translations.size === 1) [item] = foldedItems;
    else if (foldedItems.length > 1) {
      throw new Error(`${context}: ambiguous canonical item ${JSON.stringify(cleaned)}`);
    }
  }
  if (!item) throw new Error(`${context}: unknown canonical item ${JSON.stringify(cleaned)}`);
  return {
    zh: item.zh || item.en,
    en: item.en || item.zh,
    ja: item.ja || item.en || item.zh,
  };
}


// Resolve every status-catalog display name at build time. Unit modifiers belong
// to the catalog variant; translate its base identity and preserve the modifier.
const statusCatalog = new ItemData();
const statusItemNames = {};
for (const kind of ['armors', 'shields', 'units']) {
  for (const [code, [name]] of Object.entries(statusCatalog[kind])) {
    const variant = kind === 'units' && /^([0-9a-f]{2})-([1-5])$/.exec(code);
    const base = variant ? statusCatalog.units[`${variant[1]}-3`]?.[0] : name;
    const suffix = variant ? ['', '--', '-', '', '+', '++'][Number(variant[2])] : '';
    if (!base || name !== base + suffix) {
      throw new Error(`Status catalog has an invalid unit variant: ${code} ${name}`);
    }
    statusItemNames[name] = itemByEnglish(base, `Status ${kind} ${code}`).zh + suffix;
  }
}
// Effects are named by the calculation domain independently of catalog casing.
for (const name of ['Smartlink', 'V501', 'V502', 'Cure/Poison', 'Cure/Paralysis',
  'Cure/Slow', 'Cure/Confuse', 'Cure/Freeze', 'Cure/Shock', 'Trap Vision']) {
  statusItemNames[name] = itemByEnglish(name, 'Status effect').zh;
}
await writeFile(path.join(root, 'src/app/generated/i18n/status-items.ts'),
  `export const STATUS_ITEM_NAMES: Readonly<Record<string, string>> = ${JSON.stringify(statusItemNames)};\n`);

function nodeText(node) {
  if (node.nodeName === '#text') return node.value || '';
  return (node.childNodes || []).map(nodeText).join('');
}

function replaceInnerHtml(source, replacements) {
  for (const { node, html } of replacements.sort((left, right) => (
    right.node.sourceCodeLocation.startTag.endOffset - left.node.sourceCodeLocation.startTag.endOffset
  ))) {
    source = `${source.slice(0, node.sourceCodeLocation.startTag.endOffset)}${html}${source.slice(node.sourceCodeLocation.endTag.startOffset)}`;
  }
  return source;
}

// Carries all three authority names, so pages with a language switch show the item
// in the reader's language; Japanese falls back to the English identity.
function canonicalItemMarkup(item) {
  return `<span ${itemI18nAttributes({ zh: item.zh, en: item.en, ja: item.ja || item.en })}>${visibleItemZh(item)}</span>`;
}

function buildCanonicalItemConsumers(relative, source) {
  const pairedTablePage = [
    'data/weapon_special_reduction.html',
    'data/enemy_weapon_hit.html',
    'data/equipment_technique_boosts.html',
    'data/gallons_roulette.html',
  ].includes(relative);

  const document = parse(source, { sourceCodeLocationInfo: true });
  const replacements = [];
  visit(document, (node) => {
    if (!node.sourceCodeLocation?.startTag || !node.sourceCodeLocation?.endTag) return;
    const attributes = new Map((node.attrs || []).map(({ name, value }) => [name, value]));
    const explicitEnglish = attributes.get('data-item-en');
    if (explicitEnglish) {
      const item = itemByEnglish(explicitEnglish, relative);
      const english = nodeText(node).trim();
      replacements.push({
        node,
        html: `${english ? `${escapeHtml(english)} ` : ''}${relative === 'index.html' ? `<span data-home-i18n ${i18nAttributes({zh:item.zh,en:item.en,ja:item.ja || item.en})} data-item-zh="${escapeHtml(item.zh)}">${visibleItemZh(item)}</span>` : canonicalItemMarkup(item)}`,
      });
      return;
    }
    if (!pairedTablePage || node.tagName !== 'table') return;
    const rows = [];
    visit(node, (child) => {
      if (child.tagName === 'tr') rows.push(child);
    });
    const headers = rows[0]?.childNodes?.filter((child) => child.tagName === 'th') || [];
    const zhIndex = headers.findIndex((header) => nodeText(header).trim() === '中文名');
    const enIndex = headers.findIndex((header) => nodeText(header).trim() === '武器');
    if (zhIndex < 0 || enIndex < 0) return;
    for (const [index, row] of rows.slice(1).entries()) {
      const cells = row.childNodes?.filter((child) => child.tagName === 'td') || [];
      if (!cells[enIndex] || !cells[zhIndex]) continue;
      const item = itemByEnglish(nodeText(cells[enIndex]), `${relative} row ${index + 1}`);
      replacements.push({ node: cells[zhIndex], html: canonicalItemMarkup(item) });
    }
  });
  return replaceInnerHtml(source, replacements);
}

/** An element's attributes for interface text from content/i18n/messages (resolved per language at build). */
function messageAttributes(key) {
  return `data-i18n="${key}"`;
}

function zhMessage(key) {
  return escapeHtml(pageI18n.messages.zh[key]);
}

function buildBdpContent(source) {
  const difficulties = ['difficulty.normal', 'difficulty.hard', 'difficulty.veryHard', 'difficulty.ultimate'];
  const head = ['bdp.enemy', ...difficulties]
    .map((key) => `<td><strong ${messageAttributes(key)}>${zhMessage(key)}</strong></td>`).join('');
  const rows = bdpData.map((section, index) => {
    const label = itemI18n(section.label_id);
    const cells = section.columns.map((column) => `<td valign="top">${column.map((id) => {
      const item = itemI18n(id);
      return `<span ${itemI18nAttributes(item)}>${visibleItemZh(item)}</span>`;
    }).join('<br>')}</td>`).join('');
    return `<tr class="bdp-row bdp-row-${index}"><td class="monster-label"><strong ${itemI18nAttributes(label)}>${visibleItemZh(label)}</strong></td>${cells}</tr>`;
  }).join('');
  return source
    .replace('<h1 id="pageTitle">黑页危险交易掉落表</h1>', `<h1 id="pageTitle" ${messageAttributes('bdp.title')}>${zhMessage('bdp.title')}</h1>`)
    .replace('<div id="pageSubtitle"></div>', `<div id="pageSubtitle" ${messageAttributes('bdp.subtitle')}>${zhMessage('bdp.subtitle')}</div>`)
    .replace('<a href="/index.html" class="back-link">← 返回首页</a>', `<a href="/index.html" class="back-link" ${messageAttributes('common.backHome')}>${zhMessage('common.backHome')}</a>`)
    .replace('<div id="bdpContainer"></div>', `<div id="bdpContainer"><table class="bdp-table"><tbody><tr class="bdp-head">${head}</tr>${rows}</tbody></table></div>`);
}

function buildPrizeContent(source) {
  const nav = prizeData.map((day) => `<a href="#day-${day.key}" class="btn" ${messageAttributes(`weekday.${day.key}`)}>${zhMessage(`weekday.${day.key}`)}</a>`).join('');
  const tables = prizeData.map((day) => {
    const itemCells = day.columns.map((column) => `<td valign="top">${column.map((id) => {
      const item = itemI18n(id);
      return `<span ${itemI18nAttributes(item)}>${visibleItemZh(item)}</span>`;
    }).join('<br>')}</td>`).join('');
    return `<section id="day-${day.key}" class="day-section"><table class="prize-table"><tbody><tr class="day-head"><td colspan="3" ${messageAttributes(`weekday.${day.key}`)}>${zhMessage(`weekday.${day.key}`)}</td></tr><tr class="odds-head">${day.odds.map((odds) => `<td><strong>${escapeHtml(odds)}</strong></td>`).join('')}</tr><tr class="items-row">${itemCells}</tr></tbody></table></section>`;
  }).join('');
  return source
    .replace('<h1 id="pageTitle">科伦赌博奖品列表</h1>', `<h1 id="pageTitle" ${messageAttributes('prizes.title')}>${zhMessage('prizes.title')}</h1>`)
    .replace('<div id="pageSubtitle"></div>', `<div id="pageSubtitle" ${messageAttributes('prizes.subtitle')}>${zhMessage('prizes.subtitle')}</div>`)
    .replace('<a href="/index.html" class="back-link">← 返回首页</a>', `<a href="/index.html" class="back-link" ${messageAttributes('common.backHome')}>${zhMessage('common.backHome')}</a>`)
    .replace('<div id="dayNav"></div>', `<div id="dayNav">${nav}</div>`)
    .replace('<div id="tablesContainer"></div>', `<div id="tablesContainer">${tables}</div>`);
}

/**
 * Banner item lists name items in English, as the in-game banners do. After the
 * page's language is in place, each known name gains the authority name in that
 * language, with the English kept in brackets; the English edition shows the
 * English name alone.
 */
const bannerNamePatterns = new Map();
function bannerNamePattern(language) {
  if (!bannerNamePatterns.has(language)) {
    const candidates = new Map();
    for (const item of itemTranslations) {
      const local = item[language];
      if (!local || local === item.en) continue;
      for (const name of [item.en, item.en.replace(/"([^"]+)"/g, '“$1”')]) {
        candidates.set(escapeHtml(name).toLocaleLowerCase(), local);
      }
    }
    const escaped = [...candidates.keys()].sort((left, right) => right.length - left.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    bannerNamePatterns.set(language, {
      candidates,
      pattern: new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, 'gi'),
    });
  }
  return bannerNamePatterns.get(language);
}

function localizeBannerItems(body, language) {
  if (language === 'en') return;
  const { candidates, pattern } = bannerNamePattern(language);
  visit(body, (node) => {
    if (node.tagName !== 'td'
        || !node.attrs?.some(({ name, value }) => name === 'class' && value.split(/\s+/).includes('item-list'))) return;
    const localized = serialize(node).replace(pattern, (match, prefix, english) => {
      const local = candidates.get(english.toLocaleLowerCase());
      if (!local) return match;
      return `${prefix}<span class="item-bilingual"><span class="item-local">${escapeHtml(local)}</span><span class="item-en">(${english})</span></span>`;
    });
    node.childNodes = parseFragment(localized).childNodes;
    for (const child of node.childNodes) child.parentNode = node;
  });
}

async function buildProtocolContent(source) {
  const documents = [
    { id: 'protocol', en: 'protocol-commands.md', zh: 'protocol-commands.zh.md', ja: 'protocol-commands.ja.md', label: 'protocol.protocolTab', hint: 'Protocol' },
    { id: 'subcommands', en: 'subcommands.md', zh: 'subcommands.zh.md', ja: 'subcommands.ja.md', label: 'protocol.subcommandsTab', hint: '0x60/0x62' },
  ];
  const sections = [];
  for (const document of documents) {
    for (const language of ['zh', 'en', 'ja']) {
      const markdown = await readFile(path.join(root, 'data/protocol', document[language]), 'utf8');
      sections.push(`<section data-tab="${document.id}" data-lang-content="${language}"${document.id === 'protocol' ? ' class="active"' : ''}>${await marked.parse(markdown)}</section>`);
    }
  }
  const tabs = documents.map((document) => `<a class="toc-tab${document.id === 'protocol' ? ' active' : ''}" href="#${document.id}" data-tab="${document.id}"><span ${messageAttributes(document.label)}>${zhMessage(document.label)}</span><span style="float:right;color:#64748b;font-size:11px;font-weight:400">${document.hint}</span></a>`).join('');
  return source
    .replace('<h1 id="project_title">协议命令参考</h1>', `<h1 id="project_title" ${messageAttributes('protocol.title')}>${zhMessage('protocol.title')}</h1>`)
    .replace('<a href="/index.html" class="back-link">← 返回首页</a>', `<a href="/index.html" class="back-link" ${messageAttributes('common.backHome')}>${zhMessage('common.backHome')}</a>`)
    .replace('<h3 id="tocDocsHead">文档</h3>', `<h3 id="tocDocsHead" ${messageAttributes('protocol.documents')}>${zhMessage('protocol.documents')}</h3>`)
    .replace('<div id="tab-list"></div>', `<div id="tab-list">${tabs}</div>`)
    .replace('<h3 id="tocSectionsHead" style="margin-top: 20px;">章节</h3>', `<h3 id="tocSectionsHead" style="margin-top: 20px;" ${messageAttributes('protocol.sections')}>${zhMessage('protocol.sections')}</h3>`)
    .replace('<div class="loading">正在加载文档…</div>', sections.join(''));
}

async function applyBuildTimeContent(relative, source) {
  source = buildCanonicalItemConsumers(relative, source);
  if (relative === 'index.html') {
    const data = JSON.parse(await readFile(path.join(root, 'data/rbr/source.json'), 'utf8'));
    const { rbr: ratings } = JSON.parse(await readFile(path.join(root, 'data/rbr/tiers.json'), 'utf8'));
    const dropSource = await readFile(path.join(root, 'data/droptable/bb/data/zh.js'), 'utf8');
    const sectionIds = JSON.parse(dropSource.match(/"sectionIds"\s*:\s*(\[[^\]]+\])/)[1]);
    const sectionColors = JSON.parse(dropSource.match(/"sectionColors"\s*:\s*(\[[^\]]+\])/)[1]);
    const quests = data.current.quests.map(quest => {
      const tier = Object.entries(ratings.tiers).find(([, quests]) => quests.includes(quest.abbreviation))?.[0];
      const section = ratings.recommendedSectionIds[quest.abbreviation];
      const color = sectionColors[sectionIds.indexOf(section)];
      if (!tier || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Missing RBR recommendation: ${quest.abbreviation}`);
      return `<a class="home-rbr-quest" href="/guide/rbr.html" style="--section-color:${color}" data-tier="${escapeHtml(tier)}"><span class="home-rbr-episode">EPISODE 0${quest.episode}</span><strong>${escapeHtml(quest.abbreviation)}</strong><small>${escapeHtml(quest.name)}</small><div class="home-rbr-tags"><span class="home-rbr-tier">Tier ${escapeHtml(tier)}</span><span class="home-rbr-section"><img src="/assets/img/section/icon/${encodeURIComponent(section)}.png" alt="" width="28" height="28"><span data-home-i18n data-zh="推荐 ID" data-en="Recommended ID" data-ja="おすすめ ID">推荐 ID</span> · ${escapeHtml(section)}</span></div><b aria-hidden="true">↗</b></a>`;
    }).join('');
    const withRbr = source.replace('<!-- home-language -->', '<div id="home-language" class="home-language" role="group" aria-label="Language / 言語 / 语言"><button type="button" data-home-lang="zh" lang="zh-CN" aria-pressed="true">中文</button><button type="button" data-home-lang="en" lang="en" aria-pressed="false">English</button><button type="button" data-home-lang="ja" lang="ja" aria-pressed="false">日本語</button></div>').replace('<!-- home-rbr -->', `<section class="home-rbr" id="rbr" data-rbr-week="${escapeHtml(data.current.week)}" aria-labelledby="home-rbr-title"><div class="home-rbr-heading"><div><p>RAGOL BOOST ROAD</p><h2 id="home-rbr-title" data-home-live data-home-i18n data-zh="RBR 任务" data-en="RBR quests" data-ja="RBR クエスト">RBR 任务</h2></div><a href="/guide/rbr.html">任务详情与周回推荐 →</a></div><p class="home-rbr-status" data-home-live data-home-i18n data-zh="记录周：${escapeHtml(data.current.week)} · UTC 周日轮替" data-en="Recorded week: ${escapeHtml(data.current.week)} · Rotates on Sunday UTC" data-ja="記録週：${escapeHtml(data.current.week)} · UTC 日曜日に更新">记录周：${escapeHtml(data.current.week)} · UTC 周日轮替</p><div class="home-rbr-quests">${quests}</div><p class="home-rbr-note" data-home-i18n data-zh="颜色表示推荐 Section ID · Tier 为周回收益评级（${escapeHtml(ratings.asOf)}，非官方）" data-en="Colors indicate recommended Section IDs · Tiers rate farming returns (${escapeHtml(ratings.asOf)}, unofficial)" data-ja="色はおすすめのセクション ID · Tier は周回効率の評価（${escapeHtml(ratings.asOf)}、非公式）">颜色表示推荐 Section ID · Tier 为周回收益评级（${escapeHtml(ratings.asOf)}，非官方）</p></section>`);
    return localizeHome(withRbr, JSON.parse(await readFile(path.join(root, 'content/home-i18n.json'), 'utf8')));
  }
  if (relative === 'data/bdp/index.html') return buildBdpContent(source);
  if (relative === 'data/prizelist/index.html') return buildPrizeContent(source);
  if (relative === 'data/protocol/index.html') return buildProtocolContent(source);
  return source;
}

function removeScripts(node) {
  if (node.childNodes) {
    node.childNodes = node.childNodes.filter((child) => child.tagName !== 'script');
    for (const child of node.childNodes) removeScripts(child);
  }
  if (node.content) removeScripts(node.content);
}

function pageDetails(file, source, relative, language) {
  const document = parse(source, { sourceCodeLocationInfo: true });
  let body;
  let title = '';
  let description = '';
  const scripts = [];
  const inlineScripts = [];
  const inlineStyles = [];
  const stylesheetFiles = [];

  visit(document, (node) => {
    if (node.tagName === 'body') body = node;
    if (node.tagName === 'title') title = textBetween(source, node).trim();
    const attributes = new Map((node.attrs || []).map(({ name, value }) => [name, value]));
    if (node.tagName === 'meta' && attributes.get('name')?.toLowerCase() === 'description') {
      description = attributes.get('content') || '';
    }
    if (node.tagName === 'script') {
      if (attributes.has('src')) scripts.push(attributes.get('src'));
      else if (textBetween(source, node).trim()) inlineScripts.push(node);
    }
    if (node.tagName === 'style') inlineStyles.push(textBetween(source, node));
    if (node.tagName === 'link' && attributes.get('rel') === 'stylesheet') {
      const href = attributes.get('href')?.split(/[?#]/, 1)[0];
      if (!href || /^(?:[a-z]+:)?\/\//i.test(href)) return;
      const absolute = href.startsWith('/')
        ? path.join(root, href.slice(1))
        : path.resolve(path.dirname(file), href);
      if (absolute !== path.join(root, 'assets', 'css', 'unified-style.css')) {
        stylesheetFiles.push(absolute);
      }
    }
  });

  const bodySource = body ? textBetween(source, body) : '';
  const hasAngularBehavior = pageBehaviors.has(relative);
  const unsupportedEventHandlers = bodySource
    .replaceAll(/\sonerror=["']this\.remove\(\)["']/gi, '')
    .replaceAll(/\son(?:focus|blur)=["'][^"']*["']/gi, '')
    .match(/\son[a-z]+\s*=/i);
  const isPassive = Boolean(body?.sourceCodeLocation?.startTag && body.sourceCodeLocation.endTag)
    && scripts.length === 0
    && inlineScripts.length === 0
    && (!unsupportedEventHandlers || hasAngularBehavior);
  if (!isPassive) return null;

  removeScripts(body);
  let homeMetadata = null;
  if (relative === 'index.html') {
    // The homepage's language control carries its translated title and description;
    // its pressed button and the drop chart site's ?lang follow this version's language.
    visit(body, (node) => {
      const attributes = new Map((node.attrs || []).map(({ name, value }) => [name, value]));
      if (attributes.get('id') === 'home-language') {
        homeMetadata = { title: attributes.get(`data-title-${language}`), description: attributes.get(`data-description-${language}`) };
      }
      for (const attribute of node.attrs || []) {
        if (attribute.name === 'aria-pressed' && attributes.has('data-home-lang')) attribute.value = String(attributes.get('data-home-lang') === language);
        if (attribute.name === 'href' && attribute.value.startsWith('https://dropcharts.psohaven.com/')) {
          const url = new URL(attribute.value);
          url.searchParams.set('lang', language);
          attribute.value = url.href;
        }
      }
    });
  }
  // The shared page chrome: its back link text is the site message; a translated
  // page must give its title as a message key.
  visit(body, (node) => {
    if (node.tagName !== 'page-chrome') return;
    const names = new Set(node.attrs.map(({ name }) => name));
    if (!names.has('back-text')) node.attrs.push({ name: 'data-i18n-back-text', value: 'common.backHome' });
    if (language !== 'zh' && !names.has('data-i18n-title')) throw new Error(`${relative}: page-chrome title needs data-i18n-title for ${language}`);
  });
  localizeBody(pageI18n, body, language, relative, {
    itemName: (english, itemLanguage) => itemByEnglish(english, relative)[itemLanguage],
  });
  if (relative === 'guide/banners.html') localizeBannerItems(body, language);
  // Regions replace the overview before the selected edition's default year is
  // inserted. The same compiled fragment is published for later year requests.
  const eventName = /^event\/(anniversary|christmas|easter|halloween|valentines)\.html$/.exec(relative)?.[1];
  if (eventName) {
    const years = eventYears.get(eventName);
    const prefix = language === 'zh' ? '' : `/${language}`;
    visit(body, (node) => {
      const attrs = new Map((node.attrs ?? []).map(({ name, value }) => [name, value]));
      if ((attrs.get('class') ?? '').split(' ').some((name) => name === 'event-masthead' || name === 'archive-masthead')) {
        for (const [name, value] of Object.entries({
          [eventName === 'anniversary' || eventName === 'christmas' ? 'data-seasonal-event' : 'data-event-archive']: '',
          'data-event': eventName, 'data-years': years.join(','), 'data-default-year': String(years[0]),
        })) {
          node.attrs = node.attrs.filter((entry) => entry.name !== name);
          node.attrs.push({ name, value });
        }
      }
      if (attrs.get('id') === 'content' || attrs.get('id') === 'yearContent') {
        node.childNodes = parseFragment(eventFragments.get(`${language}/event/${eventName}/${years[0]}.html`)).childNodes;
      }
      if (attrs.get('id') === 'yearNav') {
        node.childNodes = parseFragment(years.map((year) => year === years[0]
          ? `<span class="year-current" aria-current="page">${year}</span>`
          : `<a href="${prefix}/event/${eventName}.html?year=${year}">${year}</a>`).join('')).childNodes;
      }
    });
  }
  // Translated regions are in place; make every link root-relative, then point it at this language.
  makeRelativeUrlsRootRelative(body, relative);
  localizeLinks(pageI18n, body, language);
  stampAssetVersions(body, relative);
  const template = serialize(body).replaceAll(
    /\sonerror="this\.remove\(\)"/gi,
    ' (error)="$any($event.target).remove()"',
  ).replaceAll(hasAngularBehavior ? /\son[a-z]+="[^"]*"/gi : /\son(?:focus|blur)="[^"]*"/gi, '');

  const metadata = homeMetadata ?? pageMetadata(pageI18n, relative, language, title, description);
  return {
    title: metadata.title,
    // Classes on the source <body> (page themes) belong to the page's host element.
    hostClass: body.attrs?.find(({ name }) => name === 'class')?.value ?? '',
    description: metadata.description,
    template: escapeAngularText(template.trim()),
    styles: inlineStyles.join('\n'),
    styleUrls: [...new Set(stylesheetFiles)],
  };
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const candidates = [
  ...rootPages.map((file) => path.join(root, file)),
  ...(await Promise.all(roots.map(async (directory) => (
  (await walk(path.join(root, directory)))
    .filter((file) => file.endsWith('.html'))
    .filter((file) => !file.startsWith(path.join(root, 'data', 'droptable')))
  )))).flat(),
].sort();

const pageI18n = await loadPageI18n(root);
const eventYears = new Map();
const eventFragments = new Map();
const fragmentDirectory = path.join(root, 'src/app/generated/event-fragments');
await rm(fragmentDirectory, { recursive: true, force: true });
for (const eventName of ['anniversary', 'christmas', 'easter', 'halloween', 'valentines']) {
  const files = (await readdir(path.join(root, 'event', eventName))).filter((file) => /^\d{4}\.html$/.test(file)).sort().reverse();
  eventYears.set(eventName, files.map((file) => Number(file.slice(0, 4))));
  for (const file of files) {
    const relative = `event/${eventName}/${file}`;
    const source = await readFile(path.join(root, relative), 'utf8');
    for (const language of ['zh', 'en', 'ja']) {
      const body = parseFragment(source);
      localizeBody(pageI18n, body, language, relative, {
        itemName: (english, itemLanguage) => itemByEnglish(english, relative)[itemLanguage],
      });
      // A fragment's section navigation belongs to its archive host, not to the
      // fetched resource (nor to the application's base URL).
      visit(body, (node) => {
        const href = node.attrs?.find((attribute) => attribute.name === 'href');
        if (href?.value.startsWith('#')) href.value = `/event/${eventName}.html?year=${file.slice(0, 4)}${href.value}`;
      });
      makeRelativeUrlsRootRelative(body, relative);
      localizeLinks(pageI18n, body, language);
      // Keep the historical Chinese fragment's bytes apart from item placeholders.
      const html = language === 'zh' ? source.replace(/ data-part="content\d+"/g, '').replace(/<span data-item-en="([^"]+)"><\/span>/g,
        (_, name) => escapeHtml(itemByEnglish(name.replaceAll('&quot;', '"').replaceAll('&amp;', '&'), relative).zh)) : serialize(body);
      eventFragments.set(`${language}/${relative}`, html);
      const destination = path.join(fragmentDirectory, language === 'zh' ? relative : `${language}/${relative}`);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, html);
    }
  }
}
await writeFile(path.join(root, 'src/app/generated/localized-pages.json'), `${JSON.stringify({ versions: pageI18n.localized })}\n`);
const pages = [];
for (const file of candidates) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  if (explicitPages.has(relative) || ['data/items.html', 'data/cosmetics.html'].includes(relative) || relative.startsWith('data/items/')) continue;
  const source = await applyBuildTimeContent(relative, await readFile(file, 'utf8'));
  for (const language of languagesFor(pageI18n, relative)) {
  const details = pageDetails(file, source, relative, language);
  if (!details) continue;

  const suffix = language === 'zh' ? '' : `${language[0].toUpperCase()}${language.slice(1)}`;
  const className = `${classNameFor(relative)}${suffix}`;
  const generatedFileName = `${fileNameFor(relative)}${suffix ? `.${language}` : ''}`;
  const styleUrls = details.styleUrls.map((styleFile) => {
    const generatedFile = path.join(outputDirectory, `${generatedFileName}.ts`);
    let value = path.relative(path.dirname(generatedFile), styleFile).split(path.sep).join('/');
    if (!value.startsWith('.')) value = `./${value}`;
    return value;
  });
  const usesPageChrome = details.template.includes('<page-chrome');
  const usesPageUpdateStamp = details.template.includes('<page-update-stamp');
  const behaviors = pageBehaviors.get(relative) || [];
  const groupedBehaviorImports = Map.groupBy(behaviors, (behavior) => (
    behaviorModules.get(behavior) || '../../content/content-behaviors.directive'
  ));
  const behaviorImport = [...groupedBehaviorImports]
    .map(([module, names]) => `import { ${names.join(', ')} } from '${module}';`)
    .join('\n');
  const component = `import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
${usesPageChrome ? "import { PageChromeComponent } from '../../shared/page-chrome.component';" : ''}
${usesPageUpdateStamp ? "import { PageUpdateStampComponent } from '../../shared/page-update-stamp.component';" : ''}
${behaviorImport}

@Component({
  selector: 'haven-content-page',
  imports: [${[usesPageChrome ? 'PageChromeComponent' : '', usesPageUpdateStamp ? 'PageUpdateStampComponent' : ''].filter(Boolean).join(', ')}],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [${behaviors.join(', ')}],${details.hostClass ? `
  host: { class: ${JSON.stringify(details.hostClass)} },` : ''}
  template: ${JSON.stringify(details.template)},
  styles: [${JSON.stringify(details.styles)}],
  styleUrls: ${JSON.stringify(styleUrls)},
})
export class ${className} {
  private readonly meta = inject(Meta);

  constructor() {
    this.meta.updateTag({ name: 'description', content: ${JSON.stringify(details.description)} });
  }
}
`;
  await writeFile(path.join(outputDirectory, `${generatedFileName}.ts`), component);
  pages.push({ relative, language, title: details.title, className, generatedFileName });
  }
}
const routePath = (language, value) => (language === 'zh' ? value : `${language}${value ? `/${value}` : ''}`);

const routeEntries = pages.map(({ relative, language, title, className, generatedFileName }) => `  {
    path: ${JSON.stringify(routePath(language, canonicalRoute(relative)))},
    title: ${JSON.stringify(title)},
    loadComponent: () => import('./pages/${generatedFileName}').then(({ ${className} }) => ${className}),
  },`).join('\n');
const indexAliases = pages.filter(({ relative }) => relative.endsWith('index.html')).map(({
  relative, language, title, className, generatedFileName,
}) => `  {
    path: ${JSON.stringify(routePath(language, relative))},
    title: ${JSON.stringify(title)},
    loadComponent: () => import('./pages/${generatedFileName}').then(({ ${className} }) => ${className}),
  },`).join('\n');
await writeFile(routeFile, `import { Routes } from '@angular/router';

export const contentRoutes: Routes = [
${routeEntries}
${indexAliases}
${pages.some(({ relative }) => relative === '404.html') ? `  {
    path: '**',
    title: '页面未找到 - PSO Haven',
    loadComponent: () => import('./pages/404').then(({ Page404ContentPage }) => Page404ContentPage),
  },` : ''}
];
`);

const serverEntries = pages.map(({ relative, language }) => (
  `  { path: ${JSON.stringify(routePath(language, canonicalRoute(relative)))}, renderMode: RenderMode.Prerender },`
)).join('\n');
const indexAliasServerEntries = pages.filter(({ relative }) => relative.endsWith('index.html'))
  .map(({ relative, language }) => `  { path: ${JSON.stringify(routePath(language, relative))}, renderMode: RenderMode.Client },`)
  .join('\n');
await writeFile(serverRouteFile, `import { RenderMode, ServerRoute } from '@angular/ssr';

export const contentServerRoutes: ServerRoute[] = [
${serverEntries}
${indexAliasServerEntries}
${pages.some(({ relative }) => relative === '404.html') ? `  { path: '**', renderMode: RenderMode.Client },` : ''}
];
`);

console.log(`Generated ${pages.length} Angular content routes.`);
