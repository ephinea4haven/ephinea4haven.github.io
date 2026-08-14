import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from 'parse5';
import vm from 'node:vm';
import { marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'src', 'app', 'generated', 'pages');
const routeFile = path.join(root, 'src', 'app', 'generated', 'content.routes.ts');
const serverRouteFile = path.join(root, 'src', 'app', 'generated', 'content.routes.server.ts');
const roots = ['data', 'event', 'guide', 'tools'];
const rootPages = ['index.html', '404.html'];
const explicitPages = new Set([
  'data/price_guide.html',
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
  ['guide/ep1ch.html', ['LanguageSwitchBehavior']],
  ['guide/ep2ch.html', ['LanguageSwitchBehavior']],
  ['tools/materialplan.html', ['BackToTopBehavior']],
  ['tools/id.html', ['SectionIdBehavior']],
  ['data/en2chinese.html', ['ItemLookupBehavior', 'ItemTranslationWidthBehavior']],
  ['data/weapon_special_reduction.html', ['ItemTranslationWidthBehavior']],
  ['data/enemy_weapon_hit.html', ['ItemTranslationWidthBehavior']],
  ['data/equipment_technique_boosts.html', ['ItemTranslationWidthBehavior']],
  ['data/gallons_roulette.html', ['ItemTranslationWidthBehavior']],
  ['event/easter.html', ['EventArchiveBehavior']],
  ['event/halloween.html', ['EventArchiveBehavior']],
  ['event/valentines.html', ['EventArchiveBehavior']],
  ['data/bdp/index.html', ['LanguageSwitchBehavior']],
  ['data/prizelist/index.html', ['LanguageSwitchBehavior']],
  ['guide/banners.html', ['ItemTranslationWidthBehavior']],
  ['guide/volopt.html', ['VolOptBehavior']],
  ['guide/rbr.html', ['RbrBehavior']],
  ['tools/mag.html', ['MagBehavior']],
  ['data/protocol/index.html', ['ProtocolReferenceBehavior']],
  ['event/anniversary.html', ['SeasonalEventBehavior']],
  ['event/christmas.html', ['SeasonalEventBehavior']],
]);
const behaviorModules = new Map([
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

function toHalfwidthItemTranslation(value) {
  return String(value).replace(/[\u3000\uFF01-\uFF5E]/g, (character) => (
    character === '\u3000'
      ? ' '
      : String.fromCharCode(character.charCodeAt(0) - 0xFEE0)
  ));
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
  return value.replaceAll(/[‘’]/g, "'").trim().toLocaleLowerCase('en');
}

const itemTranslationByEnglish = new Map();
for (const item of itemTranslations) {
  const identity = normalizeEnglishItemName(item.en);
  const duplicate = itemTranslationByEnglish.get(identity);
  if (duplicate) {
    throw new Error(
      `items_i18n.js has duplicate English item identity: ${JSON.stringify(duplicate.en)} and ${JSON.stringify(item.en)}`,
    );
  }
  itemTranslationByEnglish.set(identity, item);
}
await mkdir(path.join(root, 'src/app/generated/i18n'), { recursive: true });
await writeFile(path.join(root, 'src/app/generated/i18n/items.ts'), `export interface ItemTranslation {
  readonly en?: string; readonly zh?: string; readonly ja?: string;
}
export const ITEM_TRANSLATIONS: Readonly<Record<string, ItemTranslation>> = ${JSON.stringify(itemTranslationById)};\n`);

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
await writeFile(path.join(root, 'src/app/generated/data/mag-data.ts'),
  `export const MAG_EVOLUTION = ${JSON.stringify(magEvolutionSandbox.window.MAG_EVOLUTION)} as const;\nexport const MAG_SIMULATION = ${JSON.stringify(magSimulationSandbox.window.MAG_SIM)} as const;\n`);

function i18nAttributes(values) {
  return `data-i18n data-zh="${escapeHtml(values.zh)}" data-en="${escapeHtml(values.en)}" data-ja="${escapeHtml(values.ja)}"`;
}

function itemI18nAttributes(values) {
  return `${i18nAttributes(values)} data-item-zh="${escapeHtml(values.zh)}"`;
}

function visibleItemZh(values) {
  return escapeHtml(toHalfwidthItemTranslation(values.zh));
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
  const item = itemTranslationByEnglish.get(normalizeEnglishItemName(cleaned));
  if (!item) throw new Error(`${context}: unknown canonical item ${JSON.stringify(cleaned)}`);
  return {
    zh: item.zh || item.en,
    en: item.en || item.zh,
    ja: item.ja || item.en || item.zh,
  };
}

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

function canonicalItemMarkup(item) {
  return `<span data-item-zh="${escapeHtml(item.zh)}">${visibleItemZh(item)}</span>`;
}

function buildCanonicalItemConsumers(relative, source) {
  if (![
    'data/weapon_special_reduction.html',
    'data/enemy_weapon_hit.html',
    'data/equipment_technique_boosts.html',
    'data/gallons_roulette.html',
  ].includes(relative)) return source;

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
        html: `${english ? `${escapeHtml(english)} ` : ''}${canonicalItemMarkup(item)}`,
      });
      return;
    }
    if (node.tagName !== 'table') return;
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

function assertHalfwidthItemFirstPaint(relative, source) {
  const document = parse(source);
  visit(document, (node) => {
    if (!node.attrs?.some((attribute) => attribute.name === 'data-item-zh')) return;
    const visible = nodeText(node);
    if (/[\u3000\uFF01-\uFF5E]/.test(visible)) {
      throw new Error(`${relative}: item translation is not halfwidth on first paint: ${visible}`);
    }
  });
}

function languageButtons() {
  return '<button type="button" class="lang-btn active" data-lang="zh" aria-pressed="true">中</button><button type="button" class="lang-btn" data-lang="en" aria-pressed="false">EN</button><button type="button" class="lang-btn" data-lang="ja" aria-pressed="false">日</button><span class="item-width-switch" role="group" aria-label="中文道具译名字符宽度"><span class="item-width-label">中文译名</span><button type="button" class="active" data-item-width="half" aria-pressed="true">半角</button><button type="button" data-item-width="full" aria-pressed="false">全角</button></span>';
}

function buildBdpContent(source) {
  const labels = {
    title: { zh: '黑页危险交易掉落表', en: "Black Paper's Deal Drop Charts", ja: 'ブラックペーパーズディール ドロップ表' },
    subtitle: { zh: "Black Paper's Deal Drop Charts", en: '', ja: "Black Paper's Deal Drop Charts" },
    back: { zh: '← 返回首页', en: '← Back to Home', ja: '← ホームへ戻る' },
    monster: { zh: '怪物', en: 'Enemy', ja: 'モンスター' },
  };
  const difficulties = [
    { zh: '普通', en: 'Normal', ja: 'ノーマル' },
    { zh: '苦难', en: 'Hard', ja: 'ハード' },
    { zh: '极难', en: 'Very Hard', ja: 'ベリーハード' },
    { zh: '极限', en: 'Ultimate', ja: 'アルティメット' },
  ];
  const head = [labels.monster, ...difficulties]
    .map((label) => `<td><strong ${i18nAttributes(label)}>${escapeHtml(label.zh)}</strong></td>`).join('');
  const rows = bdpData.map((section, index) => {
    const label = itemI18n(section.label_id);
    const cells = section.columns.map((column) => `<td valign="top">${column.map((id) => {
      const item = itemI18n(id);
      return `<span ${itemI18nAttributes(item)}>${visibleItemZh(item)}</span>`;
    }).join('<br>')}</td>`).join('');
    return `<tr class="bdp-row bdp-row-${index}"><td class="monster-label"><strong ${itemI18nAttributes(label)}>${visibleItemZh(label)}</strong></td>${cells}</tr>`;
  }).join('');
  return source
    .replace('<h1 id="pageTitle">黑页危险交易掉落表</h1>', `<h1 id="pageTitle" ${i18nAttributes(labels.title)}>${labels.title.zh}</h1>`)
    .replace('<div id="pageSubtitle"></div>', `<div id="pageSubtitle" ${i18nAttributes(labels.subtitle)}>${labels.subtitle.zh}</div>`)
    .replace('<div id="langSwitch"></div>', `<div id="langSwitch">${languageButtons()}</div>`)
    .replace('<a href="/index.html" class="back-link">← 返回首页</a>', `<a href="/index.html" class="back-link" ${i18nAttributes(labels.back)}>${labels.back.zh}</a>`)
    .replace('<div id="bdpContainer"></div>', `<div id="bdpContainer"><table class="bdp-table"><tbody><tr class="bdp-head">${head}</tr>${rows}</tbody></table></div>`);
}

function buildPrizeContent(source) {
  const weekdays = {
    monday: { zh: '星期一', en: 'Monday', ja: '月曜日' }, tuesday: { zh: '星期二', en: 'Tuesday', ja: '火曜日' },
    wednesday: { zh: '星期三', en: 'Wednesday', ja: '水曜日' }, thursday: { zh: '星期四', en: 'Thursday', ja: '木曜日' },
    friday: { zh: '星期五', en: 'Friday', ja: '金曜日' }, saturday: { zh: '星期六', en: 'Saturday', ja: '土曜日' },
    sunday: { zh: '星期日', en: 'Sunday', ja: '日曜日' },
  };
  const title = { zh: '科伦赌博奖品列表', en: "Coren's Prize List", ja: 'コーレン賞品リスト' };
  const subtitle = { zh: "Coren's Prize List", en: '', ja: "Coren's Prize List" };
  const back = { zh: '← 返回首页', en: '← Back to Home', ja: '← ホームへ戻る' };
  const nav = prizeData.map((day) => `<a href="#day-${day.key}" class="btn" ${i18nAttributes(weekdays[day.key])}>${weekdays[day.key].zh}</a>`).join('');
  const tables = prizeData.map((day) => {
    const itemCells = day.columns.map((column) => `<td valign="top">${column.map((id) => {
      const item = itemI18n(id);
      return `<span ${itemI18nAttributes(item)}>${visibleItemZh(item)}</span>`;
    }).join('<br>')}</td>`).join('');
    return `<section id="day-${day.key}" class="day-section"><table class="prize-table"><tbody><tr class="day-head"><td colspan="3" ${i18nAttributes(weekdays[day.key])}>${weekdays[day.key].zh}</td></tr><tr class="odds-head">${day.odds.map((odds) => `<td><strong>${escapeHtml(odds)}</strong></td>`).join('')}</tr><tr class="items-row">${itemCells}</tr></tbody></table></section>`;
  }).join('');
  const notes = `<p id="note1"><span data-lang-content="zh">请记住，<strong>科伦遵守 UTC 时间（中国 UTC+8）</strong>，并且高额赌博更容易同时获得低额奖品。</span><span data-lang-content="en" hidden>Remember, <strong>Coren follows UTC time</strong>, and higher-tier gambling is more likely to drop lower-tier prizes alongside its own.</span><span data-lang-content="ja" hidden><strong>コーレンは UTC 時刻に従います</strong>。高額ギャンブルほど同時に低ランクの賞品が出やすくなります。</span></p><p id="note2"><span data-lang-content="zh"><strong>1,000</strong> — 第一列 4%<br><strong>10,000</strong> — 第一列 8%、第二列 4%<br><strong>100,000</strong> — 第一列 12%、第二列 8%、第三列 4%</span><span data-lang-content="en" hidden><strong>1,000</strong> — 4% for column 1<br><strong>10,000</strong> — 8% for column 1, 4% for column 2<br><strong>100,000</strong> — 12% for column 1, 8% for column 2, 4% for column 3</span><span data-lang-content="ja" hidden><strong>1,000</strong> — 1列目 4%<br><strong>10,000</strong> — 1列目 8%、2列目 4%<br><strong>100,000</strong> — 1列目 12%、2列目 8%、3列目 4%</span></p>`;
  return source
    .replace('<h1 id="pageTitle">科伦赌博奖品列表</h1>', `<h1 id="pageTitle" ${i18nAttributes(title)}>${title.zh}</h1>`)
    .replace('<div id="pageSubtitle"></div>', `<div id="pageSubtitle" ${i18nAttributes(subtitle)}>${subtitle.zh}</div>`)
    .replace('<div id="langSwitch"></div>', `<div id="langSwitch">${languageButtons()}</div>`)
    .replace('<a href="/index.html" class="back-link">← 返回首页</a>', `<a href="/index.html" class="back-link" ${i18nAttributes(back)}>${back.zh}</a>`)
    .replace('<p id="note1"></p>\n        <p id="note2"></p>', notes)
    .replace('<div id="dayNav"></div>', `<div id="dayNav">${nav}</div>`)
    .replace('<div id="tablesContainer"></div>', `<div id="tablesContainer">${tables}</div>`);
}

function buildBannersContent(source) {
  const candidates = new Map();
  for (const item of itemTranslations) {
    if (item.en === item.zh) continue;
    const names = [item.en, item.en.replace(/"([^"]+)"/g, '“$1”')];
    for (const name of names) candidates.set(escapeHtml(name), item.zh);
  }
  const names = [...candidates.keys()].sort((left, right) => right.length - left.length);
  const candidatesByName = new Map(
    [...candidates].map(([name, zh]) => [name.toLocaleLowerCase(), zh]),
  );
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, 'gi');
  const document = parse(source, { sourceCodeLocationInfo: true });
  const ranges = [];
  visit(document, (node) => {
    if (node.tagName !== 'td'
        || !node.attrs?.some(({ name, value }) => name === 'class' && value.split(/\s+/).includes('item-list'))
        || !node.sourceCodeLocation?.startTag
        || !node.sourceCodeLocation?.endTag) return;
    ranges.push([
      node.sourceCodeLocation.startTag.endOffset,
      node.sourceCodeLocation.endTag.startOffset,
    ]);
  });

  for (const [start, end] of ranges.reverse()) {
    const localized = source.slice(start, end).replace(pattern, (match, prefix, english) => {
      const zh = candidatesByName.get(english.toLocaleLowerCase());
      if (!zh) return match;
      return `${prefix}<span class="item-bilingual"><span class="item-zh" data-item-zh="${escapeHtml(zh)}">${escapeHtml(toHalfwidthItemTranslation(zh))}</span><span class="item-en">(${english})</span></span>`;
    });
    source = `${source.slice(0, start)}${localized}${source.slice(end)}`;
  }
  return source;
}

async function buildProtocolContent(source) {
  const documents = [
    { id: 'protocol', en: 'protocol-commands.md', zh: 'protocol-commands.zh.md', enLabel: 'Protocol', zhLabel: '协议命令', hint: 'Protocol' },
    { id: 'subcommands', en: 'subcommands.md', zh: 'subcommands.zh.md', enLabel: 'Subcommands', zhLabel: '子命令', hint: '0x60/0x62' },
  ];
  const sections = [];
  for (const document of documents) {
    for (const language of ['zh', 'en']) {
      const markdown = await readFile(path.join(root, 'data/protocol', document[language]), 'utf8');
      sections.push(`<section data-tab="${document.id}" data-lang="${language}"${document.id === 'protocol' && language === 'zh' ? ' class="active"' : ''}>${await marked.parse(markdown)}</section>`);
    }
  }
  const tabs = documents.map((document) => `<a class="toc-tab${document.id === 'protocol' ? ' active' : ''}" href="#${document.id}" data-tab="${document.id}"><span data-i18n data-zh="${document.zhLabel}" data-en="${document.enLabel}">${document.zhLabel}</span><span style="float:right;color:#64748b;font-size:11px;font-weight:400">${document.hint}</span></a>`).join('');
  const sourceNote = '<span data-lang-content="zh">本页内容整理自 <a href="https://github.com/fuzziqersoftware/newserv" target="_blank" rel="noopener noreferrer">newserv</a> 项目的 <code>docs/</code> 目录，覆盖 PSOBB 客户端与服务器之间的网络协议及游戏内子命令（0x60/0x62/0x6C/0x6D 载荷）两部分。操作码与处理函数名保持英文，以便与源码/抓包记录对照。</span><span data-lang-content="en" hidden>This page is compiled from the <code>docs/</code> directory of <a href="https://github.com/fuzziqersoftware/newserv" target="_blank" rel="noopener noreferrer">newserv</a>. It covers the PSOBB network protocol between the client and server and in-game subcommands (0x60/0x62/0x6C/0x6D payloads). Opcodes and handler names are kept in English to match source code and packet captures.</span>';
  return source
    .replace('<h1 id="project_title">协议命令参考</h1>', '<h1 id="project_title" data-i18n data-zh="协议命令参考" data-en="Protocol Reference">协议命令参考</h1>')
    .replace('<button type="button" class="lang-btn" data-lang="zh">中</button>', '<button type="button" class="lang-btn active" data-lang="zh" aria-pressed="true">中</button>')
    .replace('<button type="button" class="lang-btn" data-lang="en">EN</button>', '<button type="button" class="lang-btn" data-lang="en" aria-pressed="false">EN</button>')
    .replace('<a href="/index.html" class="back-link">← 返回首页</a>', '<a href="/index.html" class="back-link" data-i18n data-zh="← 返回首页" data-en="← Back to Home">← 返回首页</a>')
    .replace('<div class="source-note" id="sourceNote"></div>', `<div class="source-note" id="sourceNote">${sourceNote}</div>`)
    .replace('<h3 id="tocDocsHead">文档</h3>', '<h3 id="tocDocsHead" data-i18n data-zh="文档" data-en="Documents">文档</h3>')
    .replace('<div id="tab-list"></div>', `<div id="tab-list">${tabs}</div>`)
    .replace('<h3 id="tocSectionsHead" style="margin-top: 20px;">章节</h3>', '<h3 id="tocSectionsHead" style="margin-top: 20px;" data-i18n data-zh="章节" data-en="Sections">章节</h3>')
    .replace('<div class="loading">正在加载文档…</div>', sections.join(''));
}

async function buildSeasonalContent(relative, source) {
  const eventName = relative.includes('anniversary') ? 'anniversary' : 'christmas';
  const yearsByEvent = {
    anniversary: [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016],
    christmas: [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015],
  };
  const years = yearsByEvent[eventName];
  const defaultYear = years[0];
  const fragment = await readFile(path.join(root, 'event', eventName, `${defaultYear}.html`), 'utf8');
  const nav = years.map((year) => year === defaultYear
    ? `<span class="year-current">${year}</span>` : `<a href="/event/${eventName}.html?year=${year}">${year}</a>`).join('');
  return source
    .replace('<section class="event-masthead', `<section data-seasonal-event data-event="${eventName}" data-years="${years.join(',')}" data-default-year="${defaultYear}" class="event-masthead`)
    .replace(/<nav id="yearNav"([^>]*)><\/nav>/, `<nav id="yearNav"$1>${nav}</nav>`)
    .replace('<p>载入中…</p>', fragment);
}

async function applyBuildTimeContent(relative, source) {
  source = buildCanonicalItemConsumers(relative, source);
  if (relative === 'data/en2chinese.html') {
    const rows = itemTranslations.map((item) => `<tr><td>${escapeHtml(item.en)}</td><td>${escapeHtml(toHalfwidthItemTranslation(item.zh))}</td><td${item.ja ? '' : ' class="empty"'}>${escapeHtml(item.ja || '—')}</td></tr>`).join('');
    return source.replace('<tbody id="lookup"></tbody>', `<tbody id="lookup">${rows}</tbody>`);
  }
  if (relative === 'data/bdp/index.html') return buildBdpContent(source);
  if (relative === 'data/prizelist/index.html') return buildPrizeContent(source);
  if (relative === 'data/protocol/index.html') return buildProtocolContent(source);
  if (relative === 'guide/banners.html') return buildBannersContent(source);
  if (relative === 'event/anniversary.html' || relative === 'event/christmas.html') {
    return buildSeasonalContent(relative, source);
  }
  if (!['event/easter.html', 'event/halloween.html', 'event/valentines.html'].includes(relative)) {
    return source;
  }
  const eventName = source.match(/data-event="([^"]+)"/)?.[1];
  const years = source.match(/data-years="([^"]+)"/)?.[1];
  const defaultYear = source.match(/data-default-year="([^"]+)"/)?.[1];
  const titleName = source.match(/data-title-name="([^"]+)"/)?.[1];
  if (!eventName || !years || !defaultYear || !titleName) {
    throw new Error(`${relative} has an invalid event archive contract`);
  }
  const fragment = await readFile(path.join(root, 'event', eventName, `${defaultYear}.html`), 'utf8');
  const nav = years.split(',').map((year) => (
    year === defaultYear
      ? `<span class="year-current" aria-current="page">${year}</span>`
      : `<a href="?year=${year}">${year}</a>`
  )).join('');
  return source
    .replace('<section class="archive-masthead"', `<section class="archive-masthead" data-event-archive data-event="${eventName}" data-years="${years}" data-default-year="${defaultYear}" data-title-name="${titleName}"`)
    .replace('<nav id="yearNav" class="archive-year-nav" aria-label=', `<nav id="yearNav" class="archive-year-nav" data-prerendered aria-label=`)
    .replace('</nav>', `${nav}</nav>`)
    .replace(/<section id="yearContent" class="archive-content">[\s\S]*?<\/section>/, `<section id="yearContent" class="archive-content">${fragment}</section>`);
}

function removeScripts(node) {
  if (node.childNodes) {
    node.childNodes = node.childNodes.filter((child) => child.tagName !== 'script');
    for (const child of node.childNodes) removeScripts(child);
  }
  if (node.content) removeScripts(node.content);
}

function pageDetails(file, source, relative) {
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
  const template = serialize(body).replaceAll(
    /\sonerror="this\.remove\(\)"/gi,
    ' (error)="$any($event.target).remove()"',
  ).replaceAll(hasAngularBehavior ? /\son[a-z]+="[^"]*"/gi : /\son(?:focus|blur)="[^"]*"/gi, '');

  return {
    title,
    description,
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

const pages = [];
for (const file of candidates) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  if (explicitPages.has(relative)) continue;
  const source = await applyBuildTimeContent(relative, await readFile(file, 'utf8'));
  assertHalfwidthItemFirstPaint(relative, source);
  const details = pageDetails(file, source, relative);
  if (!details) continue;

  const className = classNameFor(relative);
  const generatedFileName = fileNameFor(relative);
  const styleUrls = details.styleUrls.map((styleFile) => {
    const generatedFile = path.join(outputDirectory, `${generatedFileName}.ts`);
    let value = path.relative(path.dirname(generatedFile), styleFile).split(path.sep).join('/');
    if (!value.startsWith('.')) value = `./${value}`;
    return value;
  });
  const usesPageChrome = details.template.includes('<page-chrome');
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
${behaviorImport}

@Component({
  selector: 'haven-content-page',
  imports: [${usesPageChrome ? 'PageChromeComponent' : ''}],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [${behaviors.join(', ')}],
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
  pages.push({ relative, title: details.title, className, generatedFileName });
}

function canonicalRoute(relative) {
  if (relative === 'index.html') return '';
  return relative.endsWith('/index.html') ? relative.slice(0, -'/index.html'.length) : relative;
}

const routeEntries = pages.map(({ relative, title, className, generatedFileName }) => `  {
    path: ${JSON.stringify(canonicalRoute(relative))},
    title: ${JSON.stringify(title)},
    loadComponent: () => import('./pages/${generatedFileName}').then(({ ${className} }) => ${className}),
  },`).join('\n');
const indexAliases = pages.filter(({ relative }) => relative.endsWith('index.html')).map(({
  relative, title, className, generatedFileName,
}) => `  {
    path: ${JSON.stringify(relative)},
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

const serverEntries = pages.map(({ relative }) => (
  `  { path: ${JSON.stringify(canonicalRoute(relative))}, renderMode: RenderMode.Prerender },`
)).join('\n');
const indexAliasServerEntries = pages.filter(({ relative }) => relative.endsWith('index.html'))
  .map(({ relative }) => `  { path: ${JSON.stringify(relative)}, renderMode: RenderMode.Client },`)
  .join('\n');
await writeFile(serverRouteFile, `import { RenderMode, ServerRoute } from '@angular/ssr';

export const contentServerRoutes: ServerRoute[] = [
${serverEntries}
${indexAliasServerEntries}
${pages.some(({ relative }) => relative === '404.html') ? `  { path: '**', renderMode: RenderMode.Client },` : ''}
];
`);

console.log(`Generated ${pages.length} Angular content routes.`);
