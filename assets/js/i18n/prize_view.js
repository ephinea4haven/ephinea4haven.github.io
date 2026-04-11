/* prizelist view layer — consumes:
 *   window.PRIZE_DATA  (id-based table)
 *   window.ITEMS_I18N  (id → {zh, en, ja})
 *   window.pageLang / window.onLangChange
 */
(function () {
    var LABELS = {
        zh: {
            title: '科伦赌博奖品列表',
            subtitle: "Coren's Prize List",
            back: '← 返回首页',
            note1: '请记住，<strong>科伦遵守 UTC 时间（中国 UTC+8）</strong>，并且高额赌博更容易同时获得低额奖品。',
            note2: '<strong>1,000</strong> — 第一列 4%<br><strong>10,000</strong> — 第一列 8%、第二列 4%<br><strong>100,000</strong> — 第一列 12%、第二列 8%、第三列 4%',
            weekdays: {
                monday: '星期一', tuesday: '星期二', wednesday: '星期三',
                thursday: '星期四', friday: '星期五', saturday: '星期六', sunday: '星期日'
            }
        },
        en: {
            title: "Coren's Prize List",
            subtitle: '',
            back: '← Back to Home',
            note1: "Remember, <strong>Coren follows UTC time</strong>, and higher-tier gambling is more likely to drop lower-tier prizes alongside its own.",
            note2: '<strong>1,000</strong> — 4% for column 1<br><strong>10,000</strong> — 8% for column 1, 4% for column 2<br><strong>100,000</strong> — 12% for column 1, 8% for column 2, 4% for column 3',
            weekdays: {
                monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
                thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
            }
        },
        ja: {
            title: 'コーレン賞品リスト',
            subtitle: "Coren's Prize List",
            back: '← ホームへ戻る',
            note1: '<strong>コーレンは UTC 時刻に従います</strong>。高額ギャンブルほど同時に低ランクの賞品が出やすくなります。',
            note2: '<strong>1,000</strong> — 1列目 4%<br><strong>10,000</strong> — 1列目 8%、2列目 4%<br><strong>100,000</strong> — 1列目 12%、2列目 8%、3列目 4%',
            weekdays: {
                monday: '月曜日', tuesday: '火曜日', wednesday: '水曜日',
                thursday: '木曜日', friday: '金曜日', saturday: '土曜日', sunday: '日曜日'
            }
        }
    };

    function t(lang) { return LABELS[lang] || LABELS.zh; }

    function itemText(id, lang) {
        var dict = window.ITEMS_I18N || {};
        var entry = dict[id];
        if (!entry) return id;
        return entry[lang] || entry.en || entry.zh || id;
    }

    function el(tag, attrs, children) {
        var e = document.createElement(tag);
        if (attrs) {
            for (var k in attrs) {
                if (k === 'class') e.className = attrs[k];
                else if (k === 'html') e.innerHTML = attrs[k];
                else e.setAttribute(k, attrs[k]);
            }
        }
        if (children) {
            children.forEach(function (c) {
                if (c == null) return;
                e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
            });
        }
        return e;
    }

    function renderDayTable(day, labels, lang) {
        var head = el('tr', { class: 'day-head' }, [
            el('td', { colspan: '3' }, [labels.weekdays[day.key] || day.key])
        ]);
        var odds = el('tr', { class: 'odds-head' }, day.odds.map(function (o) {
            return el('td', null, [el('strong', null, [o])]);
        }));
        var items = el('tr', { class: 'items-row' }, day.columns.map(function (col) {
            var cell = el('td', { valign: 'top' });
            col.forEach(function (id, i) {
                if (i > 0) cell.appendChild(el('br'));
                cell.appendChild(document.createTextNode(itemText(id, lang)));
            });
            return cell;
        }));
        return el('section', { id: 'day-' + day.key, class: 'day-section' }, [
            el('a', { name: day.key }),
            el('table', { class: 'prize-table' }, [el('tbody', null, [head, odds, items])])
        ]);
    }

    function render(lang) {
        var labels = t(lang);
        document.title = labels.title + ' — PSOBB Wiki';

        var titleEl = document.getElementById('pageTitle');
        if (titleEl) titleEl.textContent = labels.title;

        var subEl = document.getElementById('pageSubtitle');
        if (subEl) {
            subEl.textContent = labels.subtitle;
            subEl.style.display = labels.subtitle ? '' : 'none';
        }

        var backEl = document.querySelector('.back-link');
        if (backEl) backEl.textContent = labels.back;

        var n1 = document.getElementById('note1');
        if (n1) n1.innerHTML = labels.note1;
        var n2 = document.getElementById('note2');
        if (n2) n2.innerHTML = labels.note2;

        var nav = document.getElementById('dayNav');
        if (nav) {
            nav.innerHTML = '';
            (window.PRIZE_DATA || []).forEach(function (day) {
                var a = el('a', { href: '#day-' + day.key, class: 'btn' },
                    [labels.weekdays[day.key] || day.key]);
                nav.appendChild(a);
            });
        }

        var container = document.getElementById('tablesContainer');
        if (container) {
            container.innerHTML = '';
            (window.PRIZE_DATA || []).forEach(function (day) {
                container.appendChild(renderDayTable(day, labels, lang));
            });
        }
    }

    function init() {
        if (typeof window.onLangChange === 'function') window.onLangChange(render);
        else render(window.pageLang || 'zh');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
