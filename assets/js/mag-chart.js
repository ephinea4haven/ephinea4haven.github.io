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

    /* The main line is Lv.10 -> 35 -> 50 -> 100, and each gate reads a
     * different thing. Lv.10 reads only the class; Lv.35 reads the Lv.10 form
     * and the highest stat, and ignores the class entirely. */

    function renderLv10(c, meta, key) {
        const flow = `<div class="mag-flow">
      ${starterCard()}
      ${arrow(`${key} 职业`)}
      ${card(c.stage1, meta)}
    </div>`;
        return stage('LV.10', '一阶 · 只看职业', flow,
            `进化结果<b>仅</b>取决于把 Mag 喂到 Lv.10 的角色职业，与属性完全无关。`);
    }

    function renderLv35(c, meta) {
        const tie = c.stage2.find((m) => m.cond[0].startsWith(c.tieBreak));
        const body = `<div class="mag-gate">
      <span class="mag-gate__label">达到 Lv.35 · 比较 ${colorize('POW / DEX / MIND')} 最大值</span>
    </div>
    <div class="mag-branch">${c.stage2.map((m) => card(m, meta)).join('')}</div>`;
        return stage('LV.35', '二阶 · 看一阶形态 + 最高属性', body,
            `此处<b>与职业无关</b>：由 ${esc(c.stage1.zh)} ${esc(c.stage1.name)} 出发，只比最高属性。`
            + `若最高属性并列，则按一阶形态的优先属性裁决 —— ${esc(c.stage1.zh)} 认 `
            + `${colorize(c.tieBreak)}，进化为 ${esc(tie ? tie.zh : '')}。`);
    }

    function renderFunnel() {
        return `<div class="mag-funnel">
      <strong>Lv.50 起，进化结果只取决于 Section ID 与属性排序，与二阶形态无关。</strong>
      注意这个不对称：Lv.35 是要看一阶形态的（所以上面那根箭头有意义），Lv.50 不看二阶形态。
      因此下方与上方之间没有连线 —— 这样的映射并不存在，并非疏漏。
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
        return stage('LV.50', '三阶 · 看 Section ID + 属性排序', special + cols,
            '两列各自独立成表：同一条属性排序在 A 组与 B 组会给出不同的 mag。'
            + '<b>Lv.50 之后每 5 级还可再次进化</b>（55、60、65…），前提是满足另一组进化条件，'
            + '例如把 Mag 转给另一个角色去喂。');
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
        return stage('LV.100', '四阶 · 看数值公式 + Section ID + 性别', body,
            'Lv.100 起每逢 10 的倍数判定一次（110、120…）：公式、Section ID 与角色性别必须同时满足，'
            + '且<b>只能由三阶 Mag 进化</b>。四阶不保证达成 —— 若过了 100 级仍未进化，可转给条件吻合的角色再喂一次。'
            + '<b>一旦进化为四阶，便不再进化，也不再学习新的 PB。</b>');
    }

    function renderMagChart(mount, key) {
        const data = window.MAG_EVOLUTION;
        if (!data) throw new Error('mag-chart: window.MAG_EVOLUTION not loaded');
        const c = data.classes[key];
        if (!c) throw new Error(`mag-chart: unknown class ${key}`);
        const meta = data.meta;

        mount.classList.add('mag-chart');
        mount.innerHTML =
            renderLv10(c, meta, key) +
            renderLv35(c, meta) +
            renderFunnel() +
            renderStage3(c, meta) +
            renderStage4(c, meta);
    }

    /* ---------- tabs ----------
     * Three full charts (or eight feeding tables) stacked on one page is a
     * punishing scroll, so only one panel shows at a time.
     *
     * A tab's own element id is its hash, and it points at its panel through
     * aria-controls. So #hu and #recipe1 keep working as deep links, and a
     * click and a deep link travel the same code path.
     *
     * Several tablists coexist on the page, so each one only reacts to hashes
     * it owns — otherwise navigating to #sync would silently reset the chart
     * back to HU.
     */

    function initTabs(root) {
        const tabs = [...root.querySelectorAll('[role="tab"]')];
        if (!tabs.length) return;
        const panelOf = (t) => document.getElementById(t.getAttribute('aria-controls'));
        const owns = (hash) => tabs.some((t) => t.id === hash);

        function select(id, focus) {
            tabs.forEach((t) => {
                const on = t.id === id;
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                const p = panelOf(t);
                if (p) p.hidden = !on;
                if (on && focus) t.focus();
            });
        }

        tabs.forEach((t) => t.addEventListener('click', () => { location.hash = t.id; }));

        root.addEventListener('keydown', (e) => {
            const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
            const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            const t = tabs[(next + tabs.length) % tabs.length];
            location.hash = t.id;
            select(t.id, true);
        });

        function fromHash(initial) {
            const hash = decodeURIComponent(location.hash.slice(1));
            if (owns(hash)) select(hash, false);
            else if (initial) select(tabs[0].id, false);
        }

        window.addEventListener('hashchange', () => fromHash(false));
        fromHash(true);
    }

    /* ---------- sticky section nav ----------
     * Highlights whichever section is currently on screen. The page is long
     * even with tabs, so a nav you cannot orient yourself in is dead weight.
     */

    function initSectionNav(nav) {
        const links = [...nav.querySelectorAll('a[href^="#"]')];
        const targets = links
            .map((a) => ({ a, el: document.getElementById(a.hash.slice(1)) }))
            .filter((t) => t.el);
        if (!targets.length) return;

        const seen = new Map();
        const mark = () => {
            const visible = targets.filter((t) => seen.get(t.el));
            const current = visible[0] || null;
            links.forEach((a) => a.removeAttribute('aria-current'));
            if (current) current.a.setAttribute('aria-current', 'true');
        };

        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => seen.set(e.target, e.isIntersecting));
            mark();
        }, { rootMargin: '-72px 0px -55% 0px' });

        targets.forEach((t) => io.observe(t.el));
    }

    /* ---------- click-to-copy ----------
     * navigator.clipboard needs a secure context AND the clipboard-write
     * permission; it rejects on plain http and in some embedded views. Fall
     * back to a throwaway selection, and report whether anything was copied so
     * the button never claims success it did not achieve.
     */

    function legacyCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
        return ok;
    }

    async function copyText(text) {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch { /* permission denied or insecure context — fall through */ }
        }
        return legacyCopy(text);
    }

    function initCopy(btn) {
        let timer;
        btn.addEventListener('click', async () => {
            if (!(await copyText(btn.dataset.copy))) return;
            btn.dataset.copied = '1';
            clearTimeout(timer);
            timer = setTimeout(() => { delete btn.dataset.copied; }, 1200);
        });
    }

    window.renderMagChart = renderMagChart;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-mag-chart]').forEach((el) => {
            renderMagChart(el, el.dataset.magChart);
        });
        document.querySelectorAll('[data-mag-tabs]').forEach(initTabs);
        document.querySelectorAll('[data-section-nav]').forEach(initSectionNav);
        document.querySelectorAll('[data-copy]').forEach(initCopy);
    });
})();
