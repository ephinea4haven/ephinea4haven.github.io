/* Black Paper's Deal view layer — consumes:
 *   window.BDP_DATA    ([{ label_id, columns:[[id,...]x4] }])
 *   window.ITEMS_I18N  (id → {zh, en, ja})
 *   window.pageLang / window.onLangChange
 */
(function () {
    var LABELS = {
        zh: {
            title: '黑页危险交易掉落表',
            subtitle: "Black Paper's Deal Drop Charts",
            back: '← 返回首页',
            monsterHeader: '怪物',
            difficulty: { normal: '普通', hard: '苦难', veryHard: '极难', ultimate: '极限' }
        },
        en: {
            title: "Black Paper's Deal Drop Charts",
            subtitle: '',
            back: '← Back to Home',
            monsterHeader: 'Enemy',
            difficulty: { normal: 'Normal', hard: 'Hard', veryHard: 'Very Hard', ultimate: 'Ultimate' }
        },
        ja: {
            title: 'ブラックペーパーズディール ドロップ表',
            subtitle: "Black Paper's Deal Drop Charts",
            back: '← ホームへ戻る',
            monsterHeader: 'モンスター',
            difficulty: { normal: 'ノーマル', hard: 'ハード', veryHard: 'ベリーハード', ultimate: 'アルティメット' }
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

        var container = document.getElementById('bdpContainer');
        if (!container) return;
        container.innerHTML = '';

        var table = el('table', { class: 'bdp-table' });
        var tbody = el('tbody');
        table.appendChild(tbody);

        tbody.appendChild(el('tr', { class: 'bdp-head' }, [
            el('td', null, [el('strong', null, [labels.monsterHeader])]),
            el('td', null, [el('strong', null, [labels.difficulty.normal])]),
            el('td', null, [el('strong', null, [labels.difficulty.hard])]),
            el('td', null, [el('strong', null, [labels.difficulty.veryHard])]),
            el('td', null, [el('strong', null, [labels.difficulty.ultimate])])
        ]));

        (window.BDP_DATA || []).forEach(function (section, idx) {
            var labelCell = el('td', { class: 'monster-label' }, [
                el('strong', null, [itemText(section.label_id, lang)])
            ]);
            var row = el('tr', { class: 'bdp-row bdp-row-' + idx }, [labelCell]);
            section.columns.forEach(function (col) {
                var cell = el('td', { valign: 'top' });
                col.forEach(function (id, i) {
                    if (i > 0) cell.appendChild(el('br'));
                    cell.appendChild(document.createTextNode(itemText(id, lang)));
                });
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });

        container.appendChild(table);
    }

    function init() {
        if (typeof window.onLangChange === 'function') window.onLangChange(render);
        else render(window.pageLang || 'zh');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
