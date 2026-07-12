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

    /* ---------- sprite recolour ----------
     * The wiki sprites are a single cyan hue — faithful, since a mag's colour
     * is random / costume-based, not a property of its species, and stays
     * constant across every evolution. So the tint is global: pick one colour
     * and every sprite on the page takes it.
     *
     * Multiply tint: scale the chosen colour by each pixel's luma, so shadows
     * and highlights survive. Validated against the 12 real in-game screenshots
     * — recoloured hue matched every one.
     */
    const REC = { hex: null, cache: new Map(), sources: new Map() };

    function tintDataUrl(imgData, hex) {
        const T = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        const d = imgData.data;
        // luma range over opaque pixels, to normalise contrast per sprite
        let lo = 1, hi = 0;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 8) continue;
            const y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            if (y < lo) lo = y;
            if (y > hi) hi = y;
        }
        const span = hi - lo || 1;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            const k = 0.25 + 1.35 * ((y - lo) / span);
            d[i] = Math.min(255, T[0] * k);
            d[i + 1] = Math.min(255, T[1] * k);
            d[i + 2] = Math.min(255, T[2] * k);
        }
        return d;
    }

    function recolorImg(img, hex) {
        if (!hex) { img.src = sprite(img.dataset.mag); return; }
        const key = `${img.dataset.mag}|${hex}`;
        const cached = REC.cache.get(key);
        if (cached) { img.src = cached; return; }
        const src = REC.sources.get(img.dataset.mag);
        if (!src || !src.complete || !src.naturalWidth) return;
        const cv = document.createElement('canvas');
        cv.width = src.naturalWidth;
        cv.height = src.naturalHeight;
        const cx = cv.getContext('2d');
        cx.drawImage(src, 0, 0);
        let data;
        try { data = cx.getImageData(0, 0, cv.width, cv.height); }
        catch { return; }  // canvas tainted — leave sprite as-is
        tintDataUrl(data, hex);
        cx.putImageData(data, 0, 0);
        const url = cv.toDataURL('image/png');
        REC.cache.set(key, url);
        img.src = url;
    }

    function applyRecolor(hex) {
        REC.hex = hex;
        document.querySelectorAll('.mag-card__sprite[data-mag]').forEach((img) => {
            const raw = REC.sources.get(img.dataset.mag);
            if (raw && raw.complete && raw.naturalWidth) recolorImg(img, hex);
            else if (raw) raw.addEventListener('load', () => recolorImg(img, hex), { once: true });
        });
    }

    /* Keep one clean off-DOM copy of each sprite to tint from, so repeated
     * picks never compound. */
    function trackSprite(img) {
        const name = img.dataset.mag;
        if (REC.sources.has(name)) return;
        const raw = new Image();
        raw.src = sprite(name);
        REC.sources.set(name, raw);
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
        // Slug the file name — "Mylla & Youlla" as a raw <img src> (spaces + &)
        // fails to load in-page even though the encoded URL resolves directly.
        const icon = `/assets/img/mag/pb/${mag.pb.replace(/[^A-Za-z0-9]+/g, '_')}.png`;
        return `<div class="mag-card__pb"><span class="mag-card__label">PB</span>`
            + `<img class="mag-card__pb-icon" src="${icon}" alt="" loading="lazy" width="20" height="17">`
            + `<b>${esc(zh)}</b><span class="mag-card__pb-en">${esc(mag.pb)}</span></div>`;
    }

    function condLine(mag) {
        return mag.cond
            .map((c) => colorize(c))
            .join('<span class="mag-card__or">或</span>');
    }

    /* `place` positions a card in the Lv.50 grid. The rule text stays in the
     * card markup but is hidden on wide screens, where the shared middle column
     * carries it; below the breakpoint that column is dropped and the card's
     * own copy comes back. */
    function card(mag, meta, place = '') {
        return `<div class="mag-card"${place}>
      <img class="mag-card__sprite" src="${sprite(mag.name)}" alt="${esc(mag.name)}" loading="lazy" data-mag="${esc(mag.name)}">
      <div class="mag-card__body">
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

    function idSet(ids) {
        return `<div class="mag-idset">${ids
            .map((id) => `<span class="mag-id"><img src="/assets/img/section/sm/${encodeURIComponent(id)}.png" alt="" width="18" height="18" loading="lazy">${esc(id)}</span>`)
            .join('')}</div>`;
    }

    function starterCard() {
        return `<div class="mag-card">
      <img class="mag-card__sprite" src="${sprite('Mag')}" alt="Mag" loading="lazy" data-mag="Mag">
      <div>
        <div class="mag-card__name">玛古<span class="mag-card__en">Mag</span></div>
        <div class="mag-card__cond">初始形态</div>
      </div>
    </div>`;
    }

    function arrow(label) {
        return `<div class="mag-arrow"><span>${esc(label)}</span></div>`;
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

    function idHead(label, ids) {
        return `<div class="mag-col__head">
      <div class="mag-col__title">${esc(label)}</div>
      ${idSet(ids)}
    </div>`;
    }

    /* Both ID columns cover the same rule set, so the rules live once in a
     * shared middle column and each card spans its rules via grid-row. The card
     * markup still carries its own rule line (hidden on wide screens) for the
     * single-column fallback. Rows are 1-based and offset by 1 for the header. */
    function renderStage3(c, meta) {
        const special = c.stage3.special
            ? `<div class="mag-special">
           <div class="mag-special__title">${colorize('DEF ≥ 45')} — 不分 Section ID，优先于下方分支</div>
           <div class="mag-special__cards">${c.stage3.special.map((m) => card(m, meta)).join('')}</div>
         </div>`
            : '';
        const prefix = c.stage3.special ? 'DEF < 45 · ' : '';
        const at = (m, col) => ` style="grid-column:${col};grid-row:${m.span[0] + 2}/span ${m.span[1]}"`;

        const rules = c.stage3.rules.map((r, i) =>
            `<div class="mag-rule" style="grid-row:${i + 2}">${colorize(r)}</div>`).join('');

        // DOM order = mobile stacking order: A head, A cards, spine, B head, B
        // cards. On wide screens explicit grid placement overrides this; the
        // three headers auto-place into row 1 regardless. The spine is hidden
        // on mobile, where each card shows its own rule line instead.
        const grid = `<div class="mag-grid">
      ${idHead(prefix + 'A 组', meta.idGroups.A)}
      ${c.stage3.A.map((m) => card(m, meta, at(m, 1))).join('')}
      <div class="mag-grid__rulehead">进化条件</div>
      ${rules}
      ${idHead(prefix + 'B 组', meta.idGroups.B)}
      ${c.stage3.B.map((m) => card(m, meta, at(m, 3))).join('')}
    </div>`;

        return stage('LV.50', '三阶 · 看 Section ID + 进化条件', special + grid,
            '中间列是进化条件（属性比较），左右是 A 组 / B 组满足该条件时得到的 mag —— 同一条件在两组给出不同结果。'
            + '<b>Lv.50 之后每 5 级还可再次进化</b>（55、60、65…），前提是满足另一组进化条件，'
            + '例如把 Mag 转给另一个角色去喂。');
    }

    function renderStage4(c, meta) {
        const rows = c.stage4.map((r) => `<div class="mag-lv100__row">
      ${card(r.male, meta)}
      <div class="mag-lv100__formula">
        <div class="mag-lv100__expr">${colorize(r.formula)}</div>
        ${idSet(meta.idGroups[r.group])}
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
        mount.insertAdjacentHTML('afterbegin',
            '<svg class="mag-wire" aria-hidden="true"><path class="mag-wire__path" d=""></path></svg>');
    }

    /* ---------- SVG connector layer ----------
     * The evolution flow drawn as lines, recomputed from live geometry so it
     * survives reflow, font loading and tab switches. One <path> per chart holds
     * every segment as an independent M…L subpath.
     *
     * A segment is a plain polyline in the chart's own pixel space (the <svg>
     * has no viewBox, so user units are CSS px). Anchors come from
     * getBoundingClientRect minus the svg's own rect.
     */

    function drawWires(chart) {
        const svg = chart.querySelector(':scope > svg.mag-wire');
        if (!svg) return;
        // Hidden tab panel / narrow layout: the svg has no box, so bail rather
        // than draw everything anchored at (0,0).
        if (!svg.getClientRects().length) { svg.innerHTML = '<path class="mag-wire__path" d=""></path>'; return; }

        const base = svg.getBoundingClientRect();
        const rel = (el) => {
            const r = el.getBoundingClientRect();
            return {
                l: r.left - base.left, r: r.right - base.left,
                t: r.top - base.top, b: r.bottom - base.top,
                cx: (r.left + r.right) / 2 - base.left,
                cy: (r.top + r.bottom) / 2 - base.top,
                w: r.width,
            };
        };
        const seg = [];
        const labels = [];
        const vline = (x, y1, y2) => seg.push(`M ${x} ${y1} L ${x} ${y2}`);
        const hline = (x1, x2, y) => seg.push(`M ${x1} ${y} L ${x2} ${y}`);
        // Small chevron arrowheads, tip at (x, y), by pointing direction.
        const headR = (x, y) => seg.push(`M ${x - 6} ${y - 4} L ${x} ${y} L ${x - 6} ${y + 4}`);
        const headL = (x, y) => seg.push(`M ${x + 6} ${y - 4} L ${x} ${y} L ${x + 6} ${y + 4}`);
        const headD = (x, y) => seg.push(`M ${x - 4} ${y - 6} L ${x} ${y} L ${x + 4} ${y - 6}`);

        // Connect a rule to a card that may span several rules (so the rule's
        // own y can fall outside the card's box): land the arrow clamped inside
        // the card, with an elbow when the straight line would miss it. dir −1
        // points left into an A card, +1 right into a B card.
        const elbowInto = (fromX, box, cy, dir) => {
            const edgeX = dir < 0 ? box.r : box.l;
            const y = Math.max(box.t + 12, Math.min(box.b - 12, cy));
            if (Math.abs(y - cy) < 1.5) {
                hline(fromX, edgeX, cy);
            } else {
                const midX = fromX + (edgeX - fromX) * 0.45;
                seg.push(`M ${fromX} ${cy} L ${midX} ${cy} L ${midX} ${y} L ${edgeX} ${y}`);
            }
            if (dir < 0) headL(edgeX, y); else headR(edgeX, y);
        };

        // Lv.10: the starter card → the first-evolution card, a horizontal
        // connector across the gap, arrow into the result. The "<class> 职业"
        // label chip rides the line's middle.
        const flow = chart.querySelector('.mag-flow');
        if (flow) {
            const cards = [...flow.querySelectorAll(':scope > .mag-card')];
            if (cards.length >= 2) {
                const a = rel(cards[0]);
                const b = rel(cards[cards.length - 1]);
                const y = (a.cy + b.cy) / 2;
                hline(a.r, b.l, y);
                headR(b.l, y);
            }
        }

        // Lv.35: gate → the three stat-max cards. Each drop is tagged with the
        // stat (POW/DEX/MIND) that routes to it, coloured to match its card, so
        // which line leads where reads off the diagram — not only off the cards.
        const gate = chart.querySelector('.mag-gate');
        const branch = [...chart.querySelectorAll('.mag-branch > .mag-card')];
        if (gate && branch.length) {
            const s = rel(gate);
            const kids = branch.map(rel);
            // Short stem off the gate, then a bus, then a long drop into each
            // card with an arrowhead. The stat tag rides the upper third of the
            // drop, leaving clear line above and below it.
            const busY = s.b + 16;
            vline(s.cx, s.b, busY);
            hline(Math.min(...kids.map((x) => x.cx)), Math.max(...kids.map((x) => x.cx)), busY);
            kids.forEach((k, i) => {
                vline(k.cx, busY, k.t);
                headD(k.cx, k.t);
                const statEl = branch[i].querySelector('[class*="stat--"]');
                if (!statEl) return;
                const cls = [...statEl.classList].find((c) => c.startsWith('stat--')) || '';
                const y = busY + 16;
                labels.push(`<rect class="mag-wire__chip" x="${k.cx - 22}" y="${y - 9}" width="44" height="18" rx="9"></rect>`
                    + `<text class="mag-wire__tag ${cls}" x="${k.cx}" y="${y + 0.5}" text-anchor="middle" dominant-baseline="central">${esc(statEl.textContent.trim())}</text>`);
            });
        }

        // Lv.50 special (FO's DEF ≥ 45): the full-width banner feeds straight
        // down into each card — a simple drop per card, no centre stem (which
        // would point at the empty middle of the left-aligned banner).
        const special = chart.querySelector('.mag-special');
        if (special) {
            const title = special.querySelector('.mag-special__title');
            const cards = [...special.querySelectorAll('.mag-card')];
            if (title && cards.length) {
                const t = rel(title);
                cards.forEach((cardEl) => {
                    const k = rel(cardEl);
                    vline(k.cx, t.b + 5, k.t);
                    headD(k.cx, k.t);
                });
            }
        }

        // Lv.50 rules → the A card left and B card right for that rule. Matched
        // by the renderer's own grid-row spans (not by pixels), so a card that
        // covers several rules links to each — and the arrow lands clamped
        // inside that card even when it is shorter than the rows it spans.
        // Skip rules with no box (hidden below 900px).
        const grid = chart.querySelector('.mag-grid');
        if (grid) {
            const rowOf = (el) => {
                const m = /grid-row:\s*(\d+)(?:\s*\/\s*span\s*(\d+))?/.exec(el.getAttribute('style') || '');
                if (!m) return null;
                const start = +m[1];
                return { start, end: start + (m[2] ? +m[2] : 1) - 1 };
            };
            const gcards = [...grid.querySelectorAll('.mag-card')]
                .map((el) => ({ col: /grid-column:\s*1/.test(el.getAttribute('style') || '') ? 1 : 3, row: rowOf(el), box: rel(el) }))
                .filter((c) => c.row);
            grid.querySelectorAll('.mag-rule').forEach((ruleEl) => {
                const R = rel(ruleEl);
                if (R.w < 1) return;
                const rr = rowOf(ruleEl);
                if (!rr) return;
                const covers = (c) => c.row.start <= rr.start && c.row.end >= rr.start;
                const a = gcards.find((c) => c.col === 1 && covers(c));
                const b = gcards.find((c) => c.col === 3 && covers(c));
                if (a) elbowInto(R.l, a.box, R.cy, -1);
                if (b) elbowInto(R.r, b.box, R.cy, +1);
            });
        }

        // Lv.100: each formula → the male card left, the female card right.
        chart.querySelectorAll('.mag-lv100__row').forEach((row) => {
            const f = row.querySelector('.mag-lv100__formula');
            const cards = [...row.querySelectorAll('.mag-card')];
            if (!f || cards.length < 2) return;
            const F = rel(f);
            elbowInto(F.l, rel(cards[0]), F.cy, -1);
            elbowInto(F.r, rel(cards[1]), F.cy, +1);
        });

        svg.innerHTML = `<path class="mag-wire__path" d="${seg.join(' ')}"></path>${labels.join('')}`;
    }

    let wireRaf = 0;
    function redrawWires() {
        if (wireRaf) return;
        wireRaf = requestAnimationFrame(() => {
            wireRaf = 0;
            document.querySelectorAll('.mag-chart').forEach(drawWires);
        });
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
            // A chart panel just became visible; its wires measured 0 while
            // hidden, so redraw now that it has a box.
            redrawWires();
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

    /* ---------- colour picker ---------- */

    function initColorPicker(mount) {
        const colors = window.MAG_EVOLUTION?.meta?.colors || [];
        if (!colors.length) return;

        const swatch = (c) =>
            `<button class="mag-swatch" type="button" title="${esc(c.name)}${c.exclusive ? '（E 服独占）' : ''}"
        data-hex="${esc(c.hex)}" style="--sw:${esc(c.hex)}"><span class="sr-only">${esc(c.name)}</span></button>`;

        mount.innerHTML = `<span class="mag-picker__label">Mag 颜色</span>
      <button class="mag-swatch mag-swatch--reset is-on" type="button" title="原始（无色）" data-hex="">原色</button>
      ${colors.map(swatch).join('')}`;

        mount.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-hex]');
            if (!btn) return;
            mount.querySelectorAll('[data-hex]').forEach((b) => b.classList.remove('is-on'));
            btn.classList.add('is-on');
            applyRecolor(btn.dataset.hex || null);
        });
    }

    /* ---- Feeding tables ---------------------------------------------------
     * Rendered from window.MAG_SIM (assets/js/mag-sim-data.js), the same
     * generated data the simulator eats, so the chart page and the simulator
     * cannot drift. Mount points are <table data-feed-table="0".."7"> with a
     * hand-written <thead> and an empty <tbody> we fill here.
     *
     * Negatives render with U+2212 MINUS SIGN, matching the typography the
     * page used when these tables were hand-written HTML. */
    function fmtFeed(n) {
        return n < 0 ? `−${-n}` : String(n);
    }

    function renderFeedTable(table, key) {
        const SIM = window.MAG_SIM;
        if (!SIM || !SIM.feedTables) return;
        const rows = SIM.feedTables[key];
        const order = SIM.itemOrder;
        if (!rows || !order) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        tbody.innerHTML = order.map((item) => {
            const v = rows[item];
            if (!v) return '';
            const cells = v.map((n) => `<td>${fmtFeed(n)}</td>`).join('');
            return `<tr><td>${esc(item)}</td>${cells}</tr>`;
        }).join('');
    }

    window.renderMagChart = renderMagChart;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-mag-chart]').forEach((el) => {
            renderMagChart(el, el.dataset.magChart);
        });
        document.querySelectorAll('[data-feed-table]').forEach((el) => {
            renderFeedTable(el, el.dataset.feedTable);
        });
        document.querySelectorAll('[data-mag-tabs]').forEach(initTabs);
        document.querySelectorAll('[data-section-nav]').forEach(initSectionNav);
        document.querySelectorAll('[data-copy]').forEach(initCopy);
        document.querySelectorAll('[data-mag-colorpicker]').forEach(initColorPicker);
        document.querySelectorAll('.mag-card__sprite[data-mag]').forEach(trackSprite);
        // Re-tint sprites that mount later (hidden tab panels render eagerly, but
        // their images may still be decoding).
        if (REC.hex) applyRecolor(REC.hex);

        // Connector layer: draw once, then keep it in sync with anything that
        // shifts card geometry — container resize, late web fonts, image decode.
        const charts = [...document.querySelectorAll('.mag-chart')];
        if (charts.length) {
            redrawWires();
            if (typeof ResizeObserver === 'function') {
                const ro = new ResizeObserver(() => redrawWires());
                charts.forEach((c) => ro.observe(c));
            }
            window.addEventListener('resize', redrawWires);
            window.addEventListener('load', redrawWires);
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawWires);
        }
    });
})();
