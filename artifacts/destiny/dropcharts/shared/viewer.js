/**
 * Shared drop chart viewer.
 *
 * Call initViewer(config) from each version's index.html.
 *
 * config = {
 *   version:    'bb' | 'dc' | 'ngc' | 'destiny',
 *   languages:  ['en', 'ja', 'zh'],       // available languages
 *   episodes:   ['Episode 1', 'Episode 2', 'Episode 4'],  // or null to hide
 *   hasTypes:   true,                      // show monsters/boxes toggle
 *   rateFormat: 'fraction' | 'percent',    // native rate format in data
 *   hasRateToggle: true,                   // show fraction/percent toggle
 * }
 */

(function () {
  'use strict';

  var CFG, I18N_DATA;

  // State
  var lang = 'en';
  var currentDifficulty = 'Normal';
  var currentType = 'monsters';
  var currentEpisode = 'all';
  var searchTerm = '';
  var rateFormat = 'percent';

  var DATA_MAP = {};
  var IMG_VARIANTS = null;
  var IMG_INFO = null;
  var IMG_BLEND = null;
  var IMG_MAP = null;  // item name -> image filename

  // Area (layer) groupings within each episode, in canonical order.
  // Keyed by the monster's English pre-'/' name. BB uses Normal-tier names;
  // DC/NGC use difficulty-specific (Ultimate-tier) names, so each area also
  // lists those English variants. A divider row is drawn whenever the area
  // changes down a table. Japanese aliases cover NGC's legacy en data.
  // Groups follow Ephinea Wiki's monster lists, not every quest spawn.
  var AREAS = {
    "Episode 1": [
      { name: "Forest", keys: ["Booma", "Gobooma", "Gigobooma", "Rag Rappy", "Al Rappy", "Mothmant", "Monest", "Savage Wolf", "Barbarous Wolf", "Hildebear", "Hildeblue", "Dragon",
        "Bartle", "Barble", "Tollaw", "El Rappy", "Pal Rappy", "Mothvert", "Gulgus", "Gulgus-Gue", "Gulgus-gue", "Hildelt", "Hildetorr", "Hidelt", "Hildetor", "Sil Dragon",
        "ブーマ", "ゴブーマ", "ジゴブーマ", "ラグ・ラッピー", "アル・ラッピー", "モスマント", "モネスト", "サベージウルフ", "バーベラスウルフ", "ヒルデベア", "ヒルデブルー", "ドラゴン", "バートル", "バーブル", "トーロウ", "エル・ラッピー", "パル・ラッピー", "モスバートン", "グルグス", "グルグス・グー", "ヒルデルト", "ヒルデトゥール", "ヒデルト", "シル　ドラゴン", "Mothvist"] },
      { name: "Cave", keys: ["Evil Shark", "Pal Shark", "Guil Shark", "Poison Lily", "Nar Lily", "Grass Assassin", "Nano Dragon", "Pofuilly Slime", "Pouilly Slime", "Pan Arms", "Migium", "Hidoom", "De Rol Le",
        "Vulmer", "Govulmer", "GoVulmer", "Melqueek", "Ob Lily", "Mil Lily", "Crimson Assassin", "Pouifully Slime", "Dal Ral Lie",
        "エビルシャーク", "パルシャーク", "ギルシャーク", "ポイゾナスリリー", "ナルリリー", "グラスアサッシン", "ナノノドラゴ", "プフィスライム", "プイィスライム", "パンアームズ", "ミギウム", "ヒドゥーム", "デ・ロル・レ", "バルマー", "ゴバルマ", "メルクィーク", "オブリリー", "ミルリリー", "クリムゾンアサシン", "プイィフリースライム", "ダル・ラ・リー"] },
      { name: "Mine", keys: ["Gilchic", "Dubchic", "Canadine", "Canane", "Sinow Beat", "Sinow Gold", "Garanz", "Vol Opt",
        "Gilchich", "Dubchich", "Gillchich", "Canabin", "Canune", "Sinow Blue", "Sinow Red", "Baranz", "Vol Opt ver.2",
        "ギルチック", "ダブチック", "カナディン", "カナン", "シノワビート", "シノワゴールド", "ギャランゾ", "ボルオプト", "ギルチッチ", "ダブチッチ", "カナバイン", "カヌーン", "シノワブルー", "シノワレッド", "バランゾ", "ボルオプト ver.2", "Gillchic", "Vol Opt ver. 2"] },
      { name: "Ruins", keys: ["Dimenian", "La Dimenian", "So Dimenian", "Delsaber", "Claw", "Bulk", "Bulclaw", "Dark Belra", "Dark Gunner", "Death Gunner", "Chaos Sorcerer", "Chaos Bringer", "Dark Falz",
        "Arlan", "Merlan", "Del-D", "Indi Belra", "Dark Bringer", "Gran Sorcerer",
        "ディメニアン", "ラ・ディメニアン", "ソ・ディメニアン", "デルセイバー", "クロー", "バルク", "バルクロー", "ダークベルラ", "ダークガンナー", "デスガンナー", "カオスソーサラー", "カオスブリンガー", "ダークファルス", "アラン", "メラン", "デルディー", "インディベルラ", "ダークブリンガー", "グランソーサラー"] }
    ],
    "Episode 2": [
      { name: "VR Temple", keys: ["Dimenian", "La Dimenian", "So Dimenian", "Rag Rappy", "Love Rappy", "Egg Rappy", "Halo Rappy", "St. Rappy", "Hildebear", "Hildeblue", "Mothmant", "Monest", "Grass Assassin", "Poison Lily", "Nar Lily", "Dark Belra", "Barba Ray",
        "Arlan", "Merlan", "Del-D", "Mothvert", "El Rappy", "Hidelt", "Hildetor", "Crimson Assassin", "Ob Lily", "Mil Lily", "Indi Belra",
        "ディメニアン", "ラ・ディメニアン", "ソ・ディメニアン", "ラグ・ラッピー", "ラブ・ラッピー", "エグ・ラッピー", "ハロ・ラッピー", "セント・ラッピー", "ヒルデベア", "ヒルデブルー", "モスマント", "モネスト", "グラスアサッシン", "ポイゾナスリリー", "ナルリリー", "ダークベルラ", "バルバレイ", "アラン", "メラン", "デルディー", "モスバートン", "エル・ラッピー", "ヒデルト", "ヒルデトゥール", "クリムゾンアサシン", "オブリリー", "ミルリリー", "インディベルラ", "Mothvist", "Hildelt", "Hildetorr", "Hallo Rappy", "St Rappy"] },
      { name: "VR Spaceship", keys: ["Dubchic", "Gilchic", "Savage Wolf", "Barbarous Wolf", "Pan Arms", "Migium", "Hidoom", "Garanz", "Delsaber", "Chaos Sorcerer", "Gol Dragon",
        "Dubchich", "Gilchich", "Gillchich", "Gulgus", "Gulgus-gue", "Baranz", "Gran Sorcerer",
        "ダブチック", "ギルチック", "サベージウルフ", "バーベラスウルフ", "パンアームズ", "ミギウム", "ヒドゥーム", "ギャランゾ", "デルセイバー", "カオスソーサラー", "ゴル　ドラゴン", "ダブチッチ", "ギルチッチ", "グルグス", "バランゾ", "グランソーサラー", "Gillchic", "ゴルドラゴン"] },
      { name: "Central Control Area", keys: ["Ul Gibbon", "Zol Gibbon", "Merillia", "Meriltas", "Gee", "Sinow Berill", "Sinow Spigell", "Mericarol", "Merikle", "Mericus", "Gibbles", "Gi Gue", "Gal Gryphon",
        "ウル・ギボン", "ゾル・ギボン", "メリルリア", "メリルタス", "ギー", "シノワベリル", "シノワスピゲル", "メリカロル", "メリクル", "メリキュス", "ギブルス", "ギ・グー", "ガル・グリフォン"] },
      { name: "Seabed", keys: ["Dolmolm", "Dolmdarl", "Recon", "Morfos", "Sinow Zoa", "Sinow Zele", "Deldepth", "Delbiter", "Olga Flow",
        "ドルムオルム", "ドルムダール", "レコン", "モルフォス", "シノワゾア", "シノワゼレ", "デルデプス", "デルバイツァ", "オルガ・フロウ"] },
      { name: "Tower", keys: ["Ill Gill", "Del Lily", "Epsilon",
        "イルギル", "デルリリー", "イプシロン"] }
    ],
    "Episode 4": [
      { name: "Crater", keys: ["Boota", "Ze Boota", "Ba Boota", "Astark", "Dorphon", "Dorphon Eclair",
        "ブータ", "ゼ・ブータ", "バ・ブータ", "アスターク", "ドルフォン", "ドルフォン・エクレール"] },
      { name: "Crater / Subterranean Desert", keys: ["Sand Rappy", "Del Rappy", "Satellite Lizard", "Yowie", "Zu", "Pazuzu",
        "サンド・ラッピー", "デル・ラッピー", "サテライト・リザード", "ヨーウィ", "ズー", "パズズ"] },
      { name: "Subterranean Desert", keys: ["Goran", "Pyro Goran", "Goran Detonator", "Merissa A", "Merissa AA", "Girtablulu", "Saint Million", "Shambertin", "Kondrieu",
        "ゴラン", "ピロ・ゴラン", "ゴラン・デトナータ", "メリッサ・エー", "メリッサ・エー・エー", "ギルタブリル", "サンテミリオン", "シャンベルタン", "コンドリュー"] }
    ]
  };

  // episode -> { prekey(lowercased) : areaName }, built lazily.
  var AREA_LOOKUP = {};
  function areaFor(ep, englishName) {
    var groups = AREAS[ep];
    if (!groups) return null;
    var map = AREA_LOOKUP[ep];
    if (!map) {
      map = AREA_LOOKUP[ep] = {};
      groups.forEach(function (g) {
        g.keys.forEach(function (k) { map[k.toLowerCase()] = g.name; });
      });
    }
    if (!englishName) return null;
    return map[englishName.split('/')[0].trim().replace(/\?$/, '').toLowerCase()] || null;
  }

  // --- tooltip ---

  function initTooltip() {
    var destinyTip = CFG.version === 'destiny';
    var tip = document.createElement(destinyTip ? 'div' : 'img');
    if (destinyTip) { tip.style.width = '180px'; tip.style.height = 'auto'; tip.style.isolation = 'isolate'; }
    tip.id = 'item-tooltip';
    document.body.appendChild(tip);
    var rateTip = document.createElement('div');
    rateTip.id = 'rate-tooltip';
    document.body.appendChild(rateTip);
    var lastCell = null;
    var dismissed = null;
    var pendingHide = null;
    tip.alt = '';

    function previewAt(e) {
      if (e.target === tip || (destinyTip && tip.contains(e.target))) { clearTimeout(pendingHide); pendingHide = null; return; }
      var rate = e.target.closest('.drop-rate.has-rdr');
      if (rate) {
        rateTip.textContent = rate.dataset.rdr;
        rateTip.style.display = 'block';
        var rateX = e.clientX + 12;
        var rateY = e.clientY + 16;
        if (rateX + rateTip.offsetWidth > window.innerWidth - 4) {
          rateX = e.clientX - rateTip.offsetWidth - 12;
        }
        if (rateY + rateTip.offsetHeight > window.innerHeight - 4) {
          rateY = e.clientY - rateTip.offsetHeight - 12;
        }
        rateTip.style.left = rateX + 'px';
        rateTip.style.top = rateY + 'px';
        tip.style.display = 'none';
        lastCell = null;
        return;
      }
      rateTip.style.display = 'none';

      var option = e.target.closest('.drop-option, .monster-link');
      if (option !== dismissed) dismissed = null;
      if (option && option !== dismissed) {
        var img = option.querySelector('.item-tooltip-img, .monster-tooltip-img');
        if (img) {
          clearTimeout(pendingHide);
          pendingHide = null;
          var changed = option !== lastCell;
          if (changed) {
            if (destinyTip) {
              var previews = option.querySelectorAll('.item-tooltip-img, .monster-tooltip-img');
              tip.innerHTML = Array.prototype.map.call(previews, function (preview) {
                return '<div style="text-align:center"><img src="' + escapeHtml(preview.src) + '" alt="" style="width:100%;height:140px;object-fit:contain;mix-blend-mode:' + (preview.dataset.blend === 'additive' ? 'plus-lighter' : 'normal') + '"><div style="font-size:11px;line-height:1.4;color:#aab8ce">' + escapeHtml(preview.dataset.caption || '') + '</div></div>';
              }).join('');
            } else { tip.src = img.src; }
            lastCell = option;
          }
          var wasVisible = tip.style.display === 'block';
          tip.style.display = 'block';
          var tipWidth = destinyTip ? 194 : 92;
          var tipHeight = destinyTip ? tip.offsetHeight + 4 : 92;
          var x = e.clientX + 12;
          var y = e.clientY - tipHeight;
          if (y < 4) y = e.clientY + 16;
          if (x + tipWidth > window.innerWidth) x = e.clientX - tipWidth;
          if (changed || !wasVisible) {
            tip.style.left = Math.max(4, Math.min(x, window.innerWidth - tipWidth)) + 'px';
            tip.style.top = Math.max(4, Math.min(y, window.innerHeight - tipHeight)) + 'px';
          }
          return;
        }
      }
      if (!pendingHide) pendingHide = setTimeout(function () {
        tip.style.display = 'none';
        lastCell = null;
        pendingHide = null;
      }, 120);
    }
    document.addEventListener('mousemove', previewAt);
    document.addEventListener('focusin', function (e) {
      var rect = e.target.getBoundingClientRect();
      previewAt({target: e.target, clientX: rect.right, clientY: rect.bottom});
    });
    document.addEventListener('scroll', function () { tip.style.display = 'none'; rateTip.style.display = 'none'; }, true);
    document.addEventListener('focusout', function () { tip.style.display = 'none'; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        dismissed = lastCell;
        tip.style.display = 'none';
        rateTip.style.display = 'none';
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget) {
        tip.style.display = 'none';
        rateTip.style.display = 'none';
      }
    });
  }

  // --- helpers ---

  function t(key) {
    return (I18N_DATA[lang] || {})[key] || (I18N_DATA.en || {})[key] || '';
  }

  function fmtPercent(probability) {
    var pct = probability * 100;
    if (pct >= 100) return '100%';
    if (pct >= 10)  return pct.toFixed(1) + '%';
    if (pct >= 1)   return pct.toFixed(2) + '%';
    if (pct >= 0.1) return pct.toFixed(3) + '%';
    return pct.toFixed(4) + '%';
  }

  // Trim long source percentages such as 0.009918212890625% to three significant digits.
  function shortPercent(raw) {
    var match = /^([<>]?)(\d+(?:\.\d+)?)%$/.exec(raw);
    if (!match || !parseFloat(match[2])) return raw;
    var digits = parseFloat(match[2]).toPrecision(3);
    if (digits.indexOf('e') !== -1) return raw;
    if (digits.indexOf('.') !== -1) digits = digits.replace(/0+$/, '').replace(/\.$/, '');
    return match[1] + digits + '%';
  }

  function fmtRate(raw) {
    if (!raw) return '';
    if (CFG.version === 'destiny' && !Number.isFinite(parseRate(raw))) return t('rateUnknown');
    if (!CFG.hasRateToggle) return shortPercent(raw); // DC/NGC: source percentages
    if (rateFormat === 'fraction') return raw;     // BB fraction mode
    // Convert fraction to percent
    var parts = raw.split('/');
    if (parts.length !== 2) return raw;
    return fmtPercent(parseFloat(parts[0]) / parseFloat(parts[1]));
  }

  function parseRate(raw) {
    if (!raw) return NaN;
    if (raw.endsWith('%')) return parseFloat(raw) / 100;
    var parts = raw.split('/');
    if (parts.length !== 2) return NaN;
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }

  function fmtDerivedRate(probability) {
    if (!CFG.hasRateToggle || rateFormat === 'percent') return fmtPercent(probability);
    var denominator = Math.round((1 / probability) * 10) / 10;
    return '1/' + denominator;
  }

  function rdrTooltip(drRaw, darRaw) {
    var dr = parseRate(drRaw);
    var dar = parseRate(darRaw);
    if (!Number.isFinite(dr) || !Number.isFinite(dar) || dr <= 0 || dar <= 0) return '';
    var rdr = dr / dar;
    if (rdr > 1.000001) return '';
    return 'RDR \u2248 ' + fmtDerivedRate(Math.min(rdr, 1));
  }

  function D() { return DATA_MAP[lang] || DATA_MAP.en; }

  function cellDrops(cell) {
    return cell && Array.isArray(cell.items) ? cell.items : [cell];
  }

  function monsterProfile(episode, englishName) {
    if (CFG.version !== 'bb' || currentType !== 'monsters') return null;
    return window.BB_MONSTERS[episode][englishName];
  }

  function monsterVariant(profile) {
    return profile[currentDifficulty === 'Ultimate' ? 'ultimate' : 'normal'];
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, function (char) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char];
    });
  }

  // --- controls ---

  function buildControls() {
    // Language
    var langContainer = document.getElementById('langBtns');
    langContainer.innerHTML = '';
    var langLabels = { en: 'EN', ja: '\u65e5\u672c\u8a9e', zh: '\u4e2d\u6587' };
    CFG.languages.forEach(function (code) {
      var btn = document.createElement('button');
      btn.className = 'btn' + (code === lang ? ' active' : '');
      btn.dataset.lang = code;
      btn.textContent = langLabels[code] || code.toUpperCase();
      btn.onclick = function () { setLang(code); };
      langContainer.appendChild(btn);
    });

    // Difficulty
    var diffContainer = document.getElementById('difficultyBtns');
    diffContainer.innerHTML = '';
    Object.keys(D().data).forEach(function (d) {
      var btn = document.createElement('button');
      btn.className = 'btn' + (d === currentDifficulty ? ' active' : '');
      btn.dataset.diff = d;
      btn.textContent = d;
      btn.onclick = function () { setDifficulty(d); };
      diffContainer.appendChild(btn);
    });

    // Type (BB only)
    var typeGroup = document.getElementById('typeGroup');
    if (CFG.hasTypes) {
      typeGroup.style.display = '';
      document.getElementById('typeBtns').innerHTML =
        '<button class="btn' + (currentType === 'monsters' ? ' active' : '') + '" data-type="monsters" onclick="window._viewer.setType(\'monsters\')">' + t('monsters') + '</button>' +
        '<button class="btn' + (currentType === 'boxes' ? ' active' : '') + '" data-type="boxes" onclick="window._viewer.setType(\'boxes\')">' + t('boxes') + '</button>';
    } else {
      typeGroup.style.display = 'none';
    }

    // Episode (BB, NGC)
    var epGroup = document.getElementById('episodeGroup');
    if (CFG.episodes) {
      epGroup.style.display = '';
      var epHtml = '<button class="btn' + (currentEpisode === 'all' ? ' active' : '') + '" data-ep="all" onclick="window._viewer.setEpisode(\'all\')">' + t('all') + '</button>';
      CFG.episodes.forEach(function (ep) {
        var label = 'Ep.' + ep.replace('Episode ', '');
        epHtml += '<button class="btn' + (currentEpisode === ep ? ' active' : '') + '" data-ep="' + ep + '" onclick="window._viewer.setEpisode(\'' + ep + '\')">' + label + '</button>';
      });
      document.getElementById('episodeBtns').innerHTML = epHtml;
    } else {
      epGroup.style.display = 'none';
    }

    // Rate toggle (BB only)
    var rateGroup = document.getElementById('rateGroup');
    if (CFG.hasRateToggle) {
      rateGroup.style.display = '';
      document.getElementById('rateBtns').innerHTML =
        '<button class="btn' + (rateFormat === 'percent' ? ' active' : '') + '" data-fmt="percent" onclick="window._viewer.setRateFormat(\'percent\')">' + t('percent') + '</button>' +
        '<button class="btn' + (rateFormat === 'fraction' ? ' active' : '') + '" data-fmt="fraction" onclick="window._viewer.setRateFormat(\'fraction\')">' + t('fraction') + '</button>';
    } else {
      rateGroup.style.display = 'none';
    }

    // Labels
    document.getElementById('lblLang').textContent = t('lang');
    document.getElementById('lblDifficulty').textContent = t('difficulty');
    if (CFG.hasTypes) document.getElementById('lblType').textContent = t('type');
    if (CFG.episodes) document.getElementById('lblEpisode').textContent = t('episode');
    if (CFG.hasRateToggle) document.getElementById('lblRate').textContent = t('rate');
    document.getElementById('lblSearch').textContent = t('search');
    document.getElementById('searchBox').placeholder = t('searchPlaceholder');

    // Header
    document.getElementById('pageTitle').textContent = t('title');
    document.getElementById('pageSubtitle').textContent = t('subtitle');
    document.title = t('title');
  }

  // --- setters ---

  function setLang(code) {
    lang = code;
    document.documentElement.lang = lang;
    buildControls();
    render();
  }

  function setDifficulty(d) {
    currentDifficulty = d;
    document.querySelectorAll('#difficultyBtns .btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.diff === d);
    });
    render();
  }

  function setType(tp) {
    currentType = tp;
    document.querySelectorAll('#typeBtns .btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.type === tp);
    });
    render();
  }

  function setEpisode(ep) {
    currentEpisode = ep;
    document.querySelectorAll('#episodeBtns .btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.ep === ep);
    });
    render();
  }

  function setRateFormat(fmt) {
    rateFormat = fmt;
    document.querySelectorAll('#rateBtns .btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.fmt === fmt);
    });
    render();
  }

  // Canonical Section ID order, shared by every dataset; names the header icons.
  var SECTION_ID_ICONS = ['Viridia', 'Greenill', 'Skyly', 'Bluefull', 'Purplenum',
    'Pinkal', 'Redria', 'Oran', 'Yellowboze', 'Whitill'];

  // Ephinea's drop charts fix the text color per Section ID column.
  var EPHINEA_SECTION_TEXT = {
    '#00A562': '#fff', '#76FE43': '#000', '#59F9F9': '#000', '#4488FF': '#fff', '#CC00FF': '#fff',
    '#FF87CB': '#000', '#F70F0F': '#fff', '#F7830F': '#000', '#F7F715': '#000', '#FFFFFF': '#000'
  };

  function sectionStyle(hex) {
    return 'background-color:' + hex + ';color:' + (EPHINEA_SECTION_TEXT[hex.toUpperCase()] || contrastText(hex));
  }

  /** Return '#000' or '#fff' for best contrast against a hex background. */
  function contrastText(hex) {
    var channels = hex.replace('#', '').match(/../g).map(function (value) {
      var channel = parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    var luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000' : '#fff';
  }

  function fuzzyMatch(text, term) {
    text = text.normalize('NFKC').toLowerCase();
    term = term.normalize('NFKC').toLowerCase();
    var ti = 0;
    for (var i = 0; i < term.length; i++) {
      ti = text.indexOf(term[i], ti);
      if (ti === -1) return false;
      ti++;
    }
    return true;
  }

  function onSearch() {
    searchTerm = document.getElementById('searchBox').value.toLowerCase().trim();
    render();
  }

  function centerAreaLabels() {
    document.querySelectorAll('.table-wrap').forEach(function (wrap) {
      wrap.style.setProperty('--area-label-center', Math.round(wrap.clientWidth / 2) + 'px');
    });
  }

  function saveContext() {
    var url = new URL(window.location.href);
    var values = {
      lang: lang === 'en' ? '' : lang,
      diff: currentDifficulty === 'Normal' ? '' : currentDifficulty,
      ep: currentEpisode === 'all' ? '' : currentEpisode,
      type: currentType === 'monsters' ? '' : currentType,
      rate: CFG.hasRateToggle && rateFormat !== 'percent' ? rateFormat : '',
      q: document.getElementById('searchBox').value
    };
    Object.keys(values).forEach(function (key) {
      if (values[key]) url.searchParams.set(key, values[key]);
      else url.searchParams.delete(key);
    });
    if (url.href !== window.location.href) window.history.replaceState(null, '', url.href);
  }

  // --- render ---

  function render() {
    document.querySelectorAll('.btn').forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    });
    document.getElementById('item-tooltip').style.display = 'none';
    document.getElementById('rate-tooltip').style.display = 'none';
    saveContext();
    var data = D();
    var enData = DATA_MAP.en;
    var diffData = data.data[currentDifficulty];
    if (!diffData) return;

    var typeKey = CFG.hasTypes ? currentType : 'monsters';
    var typeData = diffData[typeKey] || {};
    var enTypeData = (enData.data[currentDifficulty] || {})[typeKey] || {};
    var container = document.getElementById('content');
    var html = '';
    var totalEntries = 0;
    var shownEntries = 0;

    var episodes;
    if (CFG.episodes) {
      episodes = currentEpisode === 'all' ? Object.keys(typeData) : [currentEpisode];
    } else {
      episodes = Object.keys(typeData);
    }

    for (var ei = 0; ei < episodes.length; ei++) {
      var ep = episodes[ei];
      var entries = typeData[ep];
      var enEntries = enTypeData[ep] || [];
      if (!entries || entries.length === 0) continue;

      totalEntries += entries.length;

      var filteredWithIdx = [];
      entries.forEach(function (e, idx) {
        if (!searchTerm) { filteredWithIdx.push({ entry: e, idx: idx }); return; }
        var profile = monsterProfile(ep, enEntries[idx].name);
        var names = profile ? Object.values(profile.normal.names).concat(Object.values(profile.ultimate.names)) : [e.name];
        if (names.some(function (name) { return fuzzyMatch(name, searchTerm); })) { filteredWithIdx.push({ entry: e, idx: idx }); return; }
        if (e.drops.some(function (cell) {
          return cellDrops(cell).some(function (d) {
            return d && d.item && fuzzyMatch(d.item, searchTerm);
          });
        })) {
          filteredWithIdx.push({ entry: e, idx: idx });
        }
      });
      var filtered = filteredWithIdx.map(function (o) { return o.entry; });

      if (filtered.length === 0) continue;
      shownEntries += filtered.length;

      var label = (CFG.hasTypes && currentType === 'boxes') ? (ep + ' - ' + t('boxes')) : ep;
      html += '<div class="episode-section">';
      html += '<div class="episode-title">' + label + '</div>';
      html += '<div class="table-wrap" tabindex="0" role="region" aria-label="' + escapeHtml(ep) + '">';
      html += '<table class="drop-table">';

      var colLabel = (CFG.hasTypes && currentType === 'boxes') ? t('location') : t('monster');
      html += '<thead><tr><th class="monster-col">' + colLabel + '</th>';
      data.sectionIds.forEach(function (sid, i) {
        html += '<th class="section-header" style="' + sectionStyle(data.sectionColors[i]) + '">' +
          '<span class="section-label"><img class="section-icon" src="../shared/images/section-ids/' +
          SECTION_ID_ICONS[i] + '.png" alt="" width="22" height="22">' + sid + '</span></th>';
      });
      html += '</tr></thead>';

      html += '<tbody>';
      var lastArea = null;
      var colCount = data.sectionIds.length + 1;
      for (var fi = 0; fi < filteredWithIdx.length; fi++) {
        var entry = filteredWithIdx[fi].entry;
        var enEntry = enEntries[filteredWithIdx[fi].idx];
        var area = areaFor(ep, enEntry ? enEntry.name : entry.name);
        if (CFG.version === 'destiny' && !area) area = t('areaUnknown');
        if (area && area !== lastArea) {
          html += '<tr class="area-gap' + (lastArea === null ? ' first' : '') + '">' +
                  '<td colspan="' + colCount + '"><span class="area-label">' +
                  area + '</span></td></tr>';
          lastArea = area;
        }
        html += '<tr>';
        var drTag = entry.dropRate ? '<br><span class="drop-rate-tag">(' +
          (CFG.version === 'destiny' ? 'DAR ' : '') + fmtRate(entry.dropRate) + ')</span>' : '';
        var profile = monsterProfile(ep, enEntry.name);
        var variant = profile && monsterVariant(profile);
        var displayName = variant ? escapeHtml(variant.names[lang]) : escapeHtml(entry.name).replace(/\//g, '<br>');
        var portrait = variant && variant.image
          ? '<img class="monster-tooltip-img" src="images/monsters/' + variant.image + '" alt="" loading="lazy">' : '';
        var label = '<span class="mob-name">' + displayName + '</span>' + drTag + portrait;
        if (profile) {
          var diff = {Normal:'n', Hard:'h', 'Very Hard':'vh', Ultimate:'u'}[currentDifficulty];
          label = '<a class="monster-link monster-label" href="https://www.psohaven.com/data/enemies/' + profile.id + '.html?diff=' + diff + '&amp;lang=' + lang + '">' + label + '</a>';
        } else {
          label = '<div class="monster-label">' + label + '</div>';
        }
        html += '<td class="monster-name">' + label + '</td>';
        for (var di = 0; di < entry.drops.length; di++) {
          var drops = cellDrops(entry.drops[di]).filter(Boolean);
          var enDrops = enEntry && enEntry.drops[di] ? cellDrops(enEntry.drops[di]) : [];
          var hasItem = drops.some(function (drop) { return !!drop.item; });
          var isSsRare = drops.some(function (drop) { return !!drop.ss; });
          var sidStyle = sectionStyle(data.sectionColors[di]);
          if (hasItem) {
            html += '<td class="drop-cell' + (isSsRare ? ' ss-rare-cell' : '') + '" style="' + sidStyle + '">';
            drops.forEach(function (drop, dropIndex) {
              if (!drop.item) return;
              var enItem = enDrops[dropIndex] ? enDrops[dropIndex].item : null;
              var itemIsHL = searchTerm && fuzzyMatch(drop.item, searchTerm);
              var itemIsSsRare = !!drop.ss;
              html += '<span class="drop-option' + (itemIsHL ? ' highlight' : '') + '">';
              var itemId = CFG.version === 'bb' && window.BB_ITEMS[enItem];
              var needsHit = CFG.version === 'bb' && Number.isInteger(drop.bannerHit) && drop.bannerHit > 0;
              var bannerHint = needsHit ? t('bannerHitHint').replace('{hit}', drop.bannerHit)
                : CFG.version === 'bb' && itemIsSsRare ? t('bannerNoHitHint') : '';
              var bannerAttrs = bannerHint ? ' title="' + escapeHtml(bannerHint) + '" aria-label="' + escapeHtml(drop.item + '. ' + bannerHint) + '"' : '';
              var itemClass = 'item-name' + (itemIsSsRare ? ' ss-rare-item' : needsHit ? ' banner-hit-item' : '');
              html += itemId
                ? '<a class="' + itemClass + '" href="https://www.psohaven.com/data/items/' + itemId + '.html?lang=' + lang + '"' + bannerAttrs + '>' + escapeHtml(drop.item) + '</a>'
                : '<span class="' + itemClass + '"' + bannerAttrs + '>' + escapeHtml(drop.item) + '</span>';
              var imgFile = IMG_MAP && (CFG.version === 'destiny'
                ? (Object.prototype.hasOwnProperty.call(IMG_MAP, drop.item) ? IMG_MAP[drop.item] : null)
                : (IMG_MAP[drop.item] || (enItem && IMG_MAP[enItem])));
              if (imgFile) {
                if (CFG.version === 'destiny' && IMG_INFO && IMG_INFO[drop.item] && IMG_INFO[drop.item].indexOf('candidate') !== -1) {
                  html += '<a href="images.html" title="Model preview: candidate item identity" aria-label="Candidate image identity; inspect image gallery" style="color:#aab8ce;font-size:10px;margin-left:3px">≈</a>';
                }
                if (CFG.version === 'destiny' && IMG_INFO && /Shared category/.test(IMG_INFO[drop.item] || '')) {
                  html += '<a href="images.html" title="Shared category image; individual appearance unavailable" aria-label="Shared category image" style="color:#aab8ce;font-size:10px;margin-left:3px">◇</a>';
                }
                var imageBase = CFG.version === 'destiny' ? 'images/' : '../shared/images/';
                html += '<img class="item-tooltip-img" src="' + imageBase + encodeURIComponent(imgFile) + '" data-blend="' + (IMG_BLEND && IMG_BLEND[drop.item] === 'additive' ? 'additive' : 'normal') + '" data-caption="' + escapeHtml(CFG.version === 'destiny' && IMG_INFO ? IMG_INFO[drop.item] || '' : '') + '" alt="" loading="lazy">';
              }
              if (!imgFile && CFG.version === 'destiny' && IMG_VARIANTS && IMG_VARIANTS[drop.item] && IMG_VARIANTS[drop.item].some(function (variant) { return variant.image; })) {
                html += '<a href="images.html" aria-label="Distinct item variants" title="Drop name has multiple appearances" style="font-size:10px;margin-left:3px">↔</a>';
                IMG_VARIANTS[drop.item].forEach(function (variant) {
                  if (variant.image) html += '<img class="item-tooltip-img" src="images/' + encodeURIComponent(variant.image) + '" data-caption="Variant ' + escapeHtml(variant.code) + '" alt="" loading="lazy">';
                });
              }
              if (drop.rate) {
                var rdr = typeKey === 'monsters' ? rdrTooltip(drop.rate, entry.dropRate) : '';
                var rdrAttr = rdr ? ' data-rdr="' + rdr + '"' : '';
                html += '<span class="drop-rate' + (rdr ? ' has-rdr' : '') + '"' + rdrAttr + '>' + fmtRate(drop.rate) + '</span>';
              } else if (CFG.version === 'destiny') {
                html += '<span class="drop-rate">' + t('rateUnknown') + '</span>';
              }
              html += '</span>';
            });
            html += '</td>';
          } else {
            html += '<td class="drop-cell empty" style="' + sidStyle + '"><span class="empty-mark">\u2014</span></td>';
          }
        }
        html += '</tr>';
      }
      html += '</tbody></table></div></div>';
    }

    container.innerHTML = html || '<div style="text-align:center;padding:40px;color:#666">No results</div>';
    centerAreaLabels();

    var statsEl = document.getElementById('stats');
    if (searchTerm) {
      statsEl.textContent = t('showing').replace('{shown}', shownEntries).replace('{total}', totalEntries).replace('{term}', searchTerm);
    } else {
      statsEl.textContent = t('entries').replace('{diff}', currentDifficulty).replace('{total}', totalEntries);
    }
  }

  // --- init ---

  window.initViewer = function (config) {
    CFG = config;
    I18N_DATA = window.I18N[config.version];

    // Build DATA_MAP from global variables
    config.languages.forEach(function (code) {
      var varName = 'DROP_DATA_' + code.toUpperCase();
      DATA_MAP[code] = window[varName];
    });

    // Read URL params
    var params = new URLSearchParams(window.location.search);
    var diffParam = params.get('diff');
    if (diffParam && Object.keys(DATA_MAP[lang].data).includes(diffParam)) {
      currentDifficulty = diffParam;
    }
    var langParam = params.get('lang');
    if (langParam && config.languages.includes(langParam)) {
      lang = langParam;
    }
    if (CFG.hasTypes && params.get('type') === 'boxes') currentType = 'boxes';
    if (CFG.episodes && CFG.episodes.includes(params.get('ep'))) currentEpisode = params.get('ep');
    if (CFG.hasRateToggle && params.get('rate') === 'fraction') rateFormat = 'fraction';
    var query = params.get('q') || '';
    document.getElementById('searchBox').value = query;
    searchTerm = query.toLowerCase().trim();

    document.documentElement.lang = lang;

    // Destiny uses only its verified item artwork; other versions keep shared art.
    var xhr = new XMLHttpRequest();
    xhr.open('GET', CFG.version === 'destiny' ? 'images/mapping.json' : '../shared/images/mapping.json', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        if (CFG.version === 'destiny') {
          var infoRequest = new XMLHttpRequest();
          infoRequest.open('GET', 'images/coverage.json', true);
          infoRequest.onload = function () {
            if (infoRequest.status !== 200) return;
            try {
              var coverage = JSON.parse(infoRequest.responseText);
              IMG_INFO = {};
              IMG_BLEND = {};
              IMG_VARIANTS = {};
              coverage.items.forEach(function (item) { IMG_INFO[item.name] = item.explanation; IMG_BLEND[item.name] = item.imageBlend; IMG_VARIANTS[item.name] = item.variants || []; });
              IMG_MAP = JSON.parse(xhr.responseText);
            } catch (e) { return; }
            render();
          };
          infoRequest.send();
        } else {
          try { IMG_MAP = JSON.parse(xhr.responseText); } catch (e) {}
          render();
        }
      }
    };
    xhr.send();

    // Expose setters for inline onclick handlers
    window._viewer = {
      setType: setType,
      setEpisode: setEpisode,
      setRateFormat: setRateFormat
    };
    window.onSearch = onSearch;
    window.addEventListener('resize', centerAreaLabels);

    initTooltip();
    buildControls();
    render();
  };

})();
