/* Mag evolution chart renderer.
 *
 * Consumes window.MAG_EVOLUTION (assets/js/mag-evolution.js) and knows nothing
 * about where that data came from. Mount points are <div data-mag-chart="HU">.
 *
 * Styles live in assets/css/mag-chart.css.
 */
'use strict';

(function () {
    const SPRITE_DIR = '/assets/img/mag/wiki/';
    const STAT = /\b(POW|DEX|MIND|DEF)\b/g;

    function esc(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    /* Escape first, then inject the stat spans — the other order would escape
     * the markup we just added. Every string reaching the DOM passes through
     * esc() exactly once. */
    function colorize(s) {
        return esc(s).replace(STAT, (m) => `<span class="stat--${m.toLowerCase()}">${m}</span>`);
    }

    function sprite(name) {
        return `${SPRITE_DIR}${encodeURIComponent(name)}.png`;
    }

    function triggerRows(mag, meta) {
        const rows = meta.events
            .filter((e) => e in mag.triggers)
            .map((e) => {
                const t = mag.triggers[e];
                return `<div class="mag-trig__row">
          <span class="mag-trig__event">${esc(e)}</span>
          <span>${esc(meta.effects[t.effect] || t.effect)}</span>
          <span class="mag-trig__rate">${esc(t.rate)}</span>
        </div>`;
            });
        return rows.length ? `<div class="mag-trig">${rows.join('')}</div>` : '';
    }

    function pbLine(mag, meta) {
        if (!mag.pb) return '';
        const zh = meta.pbNames[mag.pb] || '';
        return `<div class="mag-card__pb"><span class="mag-card__label">PB</span><b>${esc(zh)}</b> ${esc(mag.pb)}</div>`;
    }

    function condLine(mag) {
        return mag.cond
            .map((c) => colorize(c))
            .join('<span class="mag-card__or">或</span>');
    }

    function card(mag, meta) {
        return `<div class="mag-card">
      <img class="mag-card__sprite" src="${sprite(mag.name)}" alt="${esc(mag.name)}" loading="lazy">
      <div>
        <div class="mag-card__name">${esc(mag.zh)}<span class="mag-card__en">${esc(mag.name)}</span></div>
        <div class="mag-card__cond">${condLine(mag)}</div>
        ${pbLine(mag, meta)}
        ${triggerRows(mag, meta)}
      </div>
    </div>`;
    }

    function stage(step, title, body, note) {
        return `<section class="mag-stage">
      <h3 class="mag-stage__title"><span class="mag-stage__step">${esc(step)}</span>${esc(title)}</h3>
      ${note ? `<p class="mag-stage__note">${note}</p>` : ''}
      ${body}
    </section>`;
    }

    function idSet(ids, meta) {
        return `<div class="mag-idset">${ids
            .map((id) => `<span class="mag-id" style="--id-color:${esc(meta.idColors[id])}">${esc(id)}</span>`)
            .join('')}</div>`;
    }

    function starterCard() {
        return `<div class="mag-card">
      <img class="mag-card__sprite" src="${sprite('Mag')}" alt="Mag" loading="lazy">
      <div>
        <div class="mag-card__name">玛古<span class="mag-card__en">Mag</span></div>
        <div class="mag-card__cond">初始形态</div>
      </div>
    </div>`;
    }

    function arrow(label) {
        return `<div class="mag-arrow">${esc(label)}</div>`;
    }

    function renderStage1(c, meta, key) {
        /* Lv.35 is a gate in front of a three-way branch, not another sideways
         * step, so it reads as a full-width divider rather than a trailing
         * arrow pointing off the end of the row. */
        const flow = `<div class="mag-flow">
      ${starterCard()}
      ${arrow(`${key} 职业`)}
      ${card(c.stage1, meta)}
    </div>
    <div class="mag-gate">
      <span class="mag-gate__label">达到 Lv.35 · 比较 ${colorize('POW / DEX / MIND')} 最大值</span>
    </div>
    <div class="mag-branch">${c.stage2.map((m) => card(m, meta)).join('')}</div>`;
        return stage('STEP 1', 'Lv.1 → Lv.35 基础进化', flow);
    }

    function renderFunnel() {
        return `<div class="mag-funnel">
      <strong>Lv.50 起的进化结果只取决于 Section ID 与属性排序，与 Lv.35 变成了什么无关。</strong>
      三个阶段之间没有连线并非疏漏 —— 这样的映射并不存在。
    </div>`;
    }

    function renderColumn(c, meta, grp, prefix) {
        const label = grp === 'A' ? 'A 组' : 'B 组';
        return `<div class="mag-col">
      <div class="mag-col__head">
        <div class="mag-col__title">${esc(prefix + label)}</div>
        ${idSet(meta.idGroups[grp], meta)}
      </div>
      ${c.stage3[grp].map((m) => card(m, meta)).join('')}
    </div>`;
    }

    function renderStage3(c, meta) {
        const special = c.stage3.special
            ? `<div class="mag-special">
           <div class="mag-special__title">${colorize('DEF ≥ 45')} — 不分 Section ID，优先于下方分支</div>
           <div class="mag-special__cards">${c.stage3.special.map((m) => card(m, meta)).join('')}</div>
         </div>`
            : '';
        const prefix = c.stage3.special ? 'DEF < 45 · ' : '';
        const cols = `<div class="mag-cols">
      ${renderColumn(c, meta, 'A', prefix)}
      ${renderColumn(c, meta, 'B', prefix)}
    </div>`;
        return stage('STEP 2', 'Lv.50 按 Section ID + 属性排序分支', special + cols,
            '两列各自独立成表：同一条属性排序在 A 组与 B 组会给出不同的 mag。');
    }

    function renderStage4(c, meta) {
        const rows = c.stage4.map((r) => `<div class="mag-lv100__row">
      ${card(r.male, meta)}
      <div class="mag-lv100__formula">
        <div class="mag-lv100__expr">${colorize(r.formula)}</div>
        ${idSet(meta.idGroups[r.group], meta)}
      </div>
      ${card(r.female, meta)}
    </div>`).join('');

        const body = `<div class="mag-lv100">
      <div class="mag-lv100__head"><span>男性角色</span><span>数值公式 + Section ID</span><span>女性角色</span></div>
      ${rows}
    </div>`;
        return stage('STEP 3', 'Lv.100 按公式 + Section ID + 性别分支', body,
            'Lv.100 起每逢 10 的倍数判定一次：公式、Section ID 与角色性别必须同时满足。四阶不会新增 PB。');
    }

    function renderMagChart(mount, key) {
        const data = window.MAG_EVOLUTION;
        if (!data) throw new Error('mag-chart: window.MAG_EVOLUTION not loaded');
        const c = data.classes[key];
        if (!c) throw new Error(`mag-chart: unknown class ${key}`);
        const meta = data.meta;

        mount.classList.add('mag-chart');
        mount.innerHTML =
            renderStage1(c, meta, key) +
            renderFunnel() +
            renderStage3(c, meta) +
            renderStage4(c, meta);
    }

    /* ---------- tabs ----------
     * Three full charts on one page is a punishing scroll, so only one class is
     * visible at a time. The location hash drives selection, which keeps the
     * existing #hu / #ra / #fo deep links (and the page's own nav bar) working.
     */

    function initTabs(root) {
        const tabs = [...root.querySelectorAll('[data-mag-tab]')];
        const panel = (key) => document.getElementById(`panel-${key.toLowerCase()}`);

        function select(key, focus) {
            tabs.forEach((t) => {
                const on = t.dataset.magTab === key;
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                panel(t.dataset.magTab).hidden = !on;
                if (on && focus) t.focus();
            });
        }

        tabs.forEach((t) => t.addEventListener('click', () => {
            // Let the hash change drive selection, so a click and a deep link
            // travel the same path.
            location.hash = t.dataset.magTab.toLowerCase();
        }));

        root.addEventListener('keydown', (e) => {
            const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
            const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            const t = tabs[(next + tabs.length) % tabs.length];
            location.hash = t.dataset.magTab.toLowerCase();
            select(t.dataset.magTab, true);
        });

        function fromHash() {
            const key = location.hash.slice(1).toUpperCase();
            select(tabs.some((t) => t.dataset.magTab === key) ? key : tabs[0].dataset.magTab);
        }

        window.addEventListener('hashchange', fromHash);
        fromHash();
    }

    window.renderMagChart = renderMagChart;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-mag-chart]').forEach((el) => {
            renderMagChart(el, el.dataset.magChart);
        });
        document.querySelectorAll('[data-mag-tabs]').forEach(initTabs);
    });
})();
