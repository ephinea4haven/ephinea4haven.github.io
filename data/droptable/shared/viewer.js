/**
 * Shared drop chart viewer.
 *
 * Call initViewer(config) from each version's index.html.
 *
 * config = {
 *   version:    'bb' | 'dc' | 'ngc',
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
  var IMG_MAP = null;  // item name -> image filename

  // Area (layer) groupings within each episode, in canonical order.
  // Keyed by the monster's English pre-'/' name. BB uses Normal-tier names;
  // DC/NGC use difficulty-specific (Ultimate-tier) names, so each area also
  // lists those English variants. A divider row is drawn whenever the area
  // changes down a table. (NGC's non-Ultimate en data is Japanese, a
  // pre-existing data gap, so it simply shows no dividers there.)
  var AREAS = {
    "Episode 1": [
      { name: "Forest", keys: ["Booma", "Gobooma", "Gigobooma", "Rag Rappy", "Al Rappy", "Mothmant", "Monest", "Savage Wolf", "Barbarous Wolf", "Hildebear", "Hildeblue", "Dragon",
        "Bartle", "Barble", "Tollaw", "El Rappy", "Pal Rappy", "Mothvert", "Gulgus", "Gulgus-Gue", "Gulgus-gue", "Hildelt", "Hildetorr", "Hidelt", "Hildetor", "Sil Dragon"] },
      { name: "Cave", keys: ["Evil Shark", "Pal Shark", "Guil Shark", "Poison Lily", "Nar Lily", "Grass Assassin", "Nano Dragon", "Pofuilly Slime", "Pouilly Slime", "Pan Arms", "Migium", "Hidoom", "De Rol Le",
        "Vulmer", "Govulmer", "GoVulmer", "Melqueek", "Ob Lily", "Mil Lily", "Crimson Assassin", "Pouifully Slime", "Dal Ral Lie"] },
      { name: "Mine", keys: ["Gilchic", "Dubchic", "Canadine", "Canane", "Sinow Beat", "Sinow Gold", "Garanz", "Vol Opt",
        "Gilchich", "Dubchich", "Gillchich", "Canabin", "Canune", "Sinow Blue", "Sinow Red", "Baranz", "Vol Opt ver.2"] },
      { name: "Ruins", keys: ["Dimenian", "La Dimenian", "So Dimenian", "Delsaber", "Claw", "Bulk", "Bulclaw", "Dark Belra", "Dark Gunner", "Death Gunner", "Chaos Sorcerer", "Chaos Bringer", "Dark Falz",
        "Arlan", "Merlan", "Del-D", "Indi Belra", "Dark Bringer", "Gran Sorcerer"] }
    ],
    "Episode 2": [
      { name: "VR Temple", keys: ["Dimenian", "La Dimenian", "So Dimenian", "Rag Rappy", "Love Rappy", "Egg Rappy", "Halo Rappy", "St. Rappy", "Hildebear", "Hildeblue", "Mothmant", "Monest", "Grass Assassin", "Poison Lily", "Nar Lily", "Dark Belra", "Barba Ray",
        "Arlan", "Merlan", "Del-D", "Mothvert", "El Rappy", "Hidelt", "Hildetor", "Crimson Assassin", "Ob Lily", "Mil Lily", "Indi Belra"] },
      { name: "VR Spaceship", keys: ["Dubchic", "Gilchic", "Recon", "Savage Wolf", "Barbarous Wolf", "Pan Arms", "Migium", "Hidoom", "Garanz", "Delsaber", "Chaos Sorcerer", "Gol Dragon",
        "Dubchich", "Gilchich", "Gillchich", "Gulgus", "Gulgus-gue", "Baranz", "Gran Sorcerer"] },
      { name: "Central Control Area", keys: ["Ul Gibbon", "Zol Gibbon", "Merillia", "Meriltas", "Gee", "Sinow Berill", "Sinow Spigell", "Mericarol", "Merikle", "Mericus", "Gibbles", "Gi Gue", "Gal Gryphon"] },
      { name: "Seabed", keys: ["Dolmolm", "Dolmdarl", "Morfos", "Sinow Zoa", "Sinow Zele", "Deldepth", "Delbiter", "Olga Flow"] },
      { name: "Tower", keys: ["Ill Gill", "Del Lily", "Epsilon"] }
    ],
    "Episode 4": [
      { name: "Crater", keys: ["Boota", "Ze Boota", "Ba Boota", "Sand Rappy", "Del Rappy", "Satellite Lizard", "Yowie", "Zu", "Pazuzu", "Astark", "Dorphon", "Dorphon Eclair"] },
      { name: "Subterranean Desert", keys: ["Goran", "Pyro Goran", "Goran Detonator", "Merissa A", "Merissa AA", "Girtablulu", "Saint Million", "Shambertin", "Kondrieu"] }
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
    return map[englishName.split('/')[0].trim().toLowerCase()] || null;
  }

  // --- tooltip ---

  function initTooltip() {
    var tip = document.createElement('img');
    tip.id = 'item-tooltip';
    document.body.appendChild(tip);
    var lastCell = null;

    document.addEventListener('mousemove', function (e) {
      var cell = e.target.closest('.drop-cell');
      if (cell) {
        var img = cell.querySelector('.item-tooltip-img');
        if (img) {
          if (cell !== lastCell) {
            tip.src = img.src;
            lastCell = cell;
          }
          tip.style.display = 'block';
          var x = e.clientX + 12;
          var y = e.clientY - 90;
          if (y < 4) y = e.clientY + 16;
          if (x + 90 > window.innerWidth) x = e.clientX - 92;
          tip.style.left = x + 'px';
          tip.style.top = y + 'px';
          return;
        }
      }
      tip.style.display = 'none';
      lastCell = null;
    });
  }

  // --- helpers ---

  function t(key) {
    return (I18N_DATA[lang] || I18N_DATA.en)[key] || key;
  }

  function fmtRate(raw) {
    if (!raw) return '';
    if (!CFG.hasRateToggle) return raw;           // DC/NGC: show as-is (percentages)
    if (rateFormat === 'fraction') return raw;     // BB fraction mode
    // Convert fraction to percent
    var parts = raw.split('/');
    if (parts.length !== 2) return raw;
    var pct = (parseFloat(parts[0]) / parseFloat(parts[1])) * 100;
    if (pct >= 100) return '100%';
    if (pct >= 10)  return pct.toFixed(1) + '%';
    if (pct >= 1)   return pct.toFixed(2) + '%';
    if (pct >= 0.1) return pct.toFixed(3) + '%';
    return pct.toFixed(4) + '%';
  }

  function D() { return DATA_MAP[lang] || DATA_MAP.en; }

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

  /** Return '#000' or '#fff' for best contrast against a hex background. */
  function contrastText(hex) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    // W3C relative luminance
    var L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return L > 0.5 ? '#000' : '#fff';
  }

  function contrastSub(hex) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    var L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return L > 0.5 ? '#555' : '#eee';
  }

  function fuzzyMatch(text, term) {
    text = text.toLowerCase();
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

  // --- render ---

  function render() {
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
        if (fuzzyMatch(e.name, searchTerm)) { filteredWithIdx.push({ entry: e, idx: idx }); return; }
        if (e.drops.some(function (d) { return d.item && fuzzyMatch(d.item, searchTerm); })) {
          filteredWithIdx.push({ entry: e, idx: idx });
        }
      });
      var filtered = filteredWithIdx.map(function (o) { return o.entry; });

      if (filtered.length === 0) continue;
      shownEntries += filtered.length;

      var label = (CFG.hasTypes && currentType === 'boxes') ? (ep + ' - ' + t('boxes')) : ep;
      html += '<div class="episode-section">';
      html += '<div class="episode-title">' + label + '</div>';
      html += '<div class="table-wrap">';
      html += '<table class="drop-table">';

      var colLabel = (CFG.hasTypes && currentType === 'boxes') ? t('location') : t('monster');
      html += '<thead><tr><th class="monster-col">' + colLabel + '</th>';
      data.sectionIds.forEach(function (sid, i) {
        html += '<th class="section-header" style="background-color:' + data.sectionColors[i] + ';color:' + contrastText(data.sectionColors[i]) + '">' + sid + '</th>';
      });
      html += '<th class="monster-col">' + colLabel + '</th>';
      html += '</tr></thead>';

      html += '<tbody>';
      var lastArea = null;
      var colCount = data.sectionIds.length + 2;
      for (var fi = 0; fi < filteredWithIdx.length; fi++) {
        var entry = filteredWithIdx[fi].entry;
        var enEntry = enEntries[filteredWithIdx[fi].idx];
        var area = areaFor(ep, enEntry ? enEntry.name : entry.name);
        if (area && area !== lastArea) {
          html += '<tr class="area-gap' + (lastArea === null ? ' first' : '') + '">' +
                  '<td colspan="' + colCount + '">' + area + '</td></tr>';
          lastArea = area;
        }
        html += '<tr>';
        var drTag = entry.dropRate ? '<br><span class="drop-rate-tag">(' + fmtRate(entry.dropRate) + ')</span>' : '';
        var displayName = entry.name.replace(/\//g, '<br>');
        html += '<td class="monster-name" title="' + entry.name + '"><span class="mob-name">' + displayName + '</span>' + drTag + '</td>';
        for (var di = 0; di < entry.drops.length; di++) {
          var drop = entry.drops[di];
          var enItem = enEntry && enEntry.drops[di] ? enEntry.drops[di].item : null;
          var isHL = searchTerm && drop.item && fuzzyMatch(drop.item, searchTerm);
          var isSsRare = !!drop.ss;
          var bg = data.sectionColors[di];
          var txtColor = contrastText(bg);
          var subColor = contrastSub(bg);
          var cellStyle = 'background-color:' + bg + ';color:' + txtColor;
          if (drop.item) {
            html += '<td class="drop-cell' + (isHL ? ' highlight' : '') + (isSsRare ? ' ss-rare-cell' : '') + '" style="' + cellStyle + '">';
            html += '<span class="item-name' + (isSsRare ? ' ss-rare-item' : '') + '">' + drop.item + '</span>';
            var imgFile = IMG_MAP && (IMG_MAP[drop.item] || (enItem && IMG_MAP[enItem]));
            if (imgFile) html += '<img class="item-tooltip-img" src="../shared/images/' + encodeURIComponent(imgFile) + '" alt="" loading="lazy">';
            if (drop.rate) html += '<span class="drop-rate" style="color:' + subColor + '">' + fmtRate(drop.rate) + '</span>';
            html += '</td>';
          } else {
            html += '<td class="drop-cell empty" style="' + cellStyle + '">\u2014</td>';
          }
        }
        html += '<td class="monster-name" title="' + entry.name + '"><span class="mob-name">' + displayName + '</span>' + drTag + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div></div>';
    }

    container.innerHTML = html || '<div style="text-align:center;padding:40px;color:#666">No results</div>';

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
    if (diffParam && DATA_MAP[lang] && DATA_MAP[lang].data[diffParam]) {
      currentDifficulty = diffParam;
    }
    var langParam = params.get('lang');
    if (langParam && I18N_DATA[langParam]) {
      lang = langParam;
    }

    // Load image mapping
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '../shared/images/mapping.json', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { IMG_MAP = JSON.parse(xhr.responseText); } catch (e) {}
        render();
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

    initTooltip();
    buildControls();
    render();
  };

})();
