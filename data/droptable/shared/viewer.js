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

  // --- tooltip ---

  function initTooltip() {
    var tip = document.createElement('img');
    tip.id = 'item-tooltip';
    document.body.appendChild(tip);

    document.addEventListener('mouseover', function (e) {
      var cell = e.target.closest('.drop-cell');
      if (!cell) { tip.style.display = 'none'; return; }
      var img = cell.querySelector('.item-tooltip-img');
      if (!img) { tip.style.display = 'none'; return; }
      tip.src = img.src;
      tip.style.display = 'block';
    });

    document.addEventListener('mousemove', function (e) {
      if (tip.style.display === 'block') {
        tip.style.left = (e.clientX + 12) + 'px';
        tip.style.top = (e.clientY - 90) + 'px';
      }
    });

    document.addEventListener('mouseout', function (e) {
      var cell = e.target.closest('.drop-cell');
      if (cell && !cell.contains(e.relatedTarget)) {
        tip.style.display = 'none';
      }
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

  function onSearch() {
    searchTerm = document.getElementById('searchBox').value.toLowerCase().trim();
    render();
  }

  // --- render ---

  function render() {
    var data = D();
    var diffData = data.data[currentDifficulty];
    if (!diffData) return;

    var typeKey = CFG.hasTypes ? currentType : 'monsters';
    var typeData = diffData[typeKey] || {};
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
      if (!entries || entries.length === 0) continue;

      totalEntries += entries.length;

      var filtered = entries.filter(function (e) {
        if (!searchTerm) return true;
        if (e.name.toLowerCase().indexOf(searchTerm) !== -1) return true;
        return e.drops.some(function (d) {
          return d.item && d.item.toLowerCase().indexOf(searchTerm) !== -1;
        });
      });

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
        html += '<th class="section-header" style="background-color:' + data.sectionColors[i] + '">' + sid + '</th>';
      });
      html += '<th class="monster-col">' + colLabel + '</th>';
      html += '</tr></thead>';

      html += '<tbody>';
      for (var fi = 0; fi < filtered.length; fi++) {
        var entry = filtered[fi];
        html += '<tr>';
        var drTag = entry.dropRate ? '<br><span class="drop-rate-tag">(' + fmtRate(entry.dropRate) + ')</span>' : '';
        var displayName = entry.name.replace(/\//g, '<br>');
        html += '<td class="monster-name" title="' + entry.name + '"><span class="mob-name">' + displayName + '</span>' + drTag + '</td>';
        for (var di = 0; di < entry.drops.length; di++) {
          var drop = entry.drops[di];
          var isHL = searchTerm && drop.item && drop.item.toLowerCase().indexOf(searchTerm) !== -1;
          var cellColor = 'background-color:' + data.sectionColors[di];
          if (drop.item) {
            html += '<td class="drop-cell' + (isHL ? ' highlight' : '') + '" style="' + cellColor + '">';
            html += '<span class="item-name">' + drop.item + '</span>';
            var imgFile = IMG_MAP && IMG_MAP[drop.item];
            if (imgFile) html += '<img class="item-tooltip-img" src="../shared/images/' + encodeURIComponent(imgFile) + '" alt="" loading="lazy">';
            if (drop.rate) html += '<span class="drop-rate">' + fmtRate(drop.rate) + '</span>';
            html += '</td>';
          } else {
            html += '<td class="drop-cell empty" style="' + cellColor + '">\u2014</td>';
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
    xhr.open('GET', '../shared/images/_mapping.json', true);
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
