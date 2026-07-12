// assets/js/mag-sim-ui.js
// Bootstrap (Task 11) + Setup panel (Task 12). renderCard/renderFeed/renderLog
// are filled in by Tasks 13-15.
import * as E from '/assets/js/mag-sim-engine.js';

const DATA = window.MAG_SIM;

let state = E.createState(DATA, { start: { mode: 'fresh' } });
const history = []; // undo snapshot stack (Tasks 12-15)

const SECTION_IDS = ['Viridia', 'Skyly', 'Purplenum', 'Redria', 'Yellowboze',
    'Greenill', 'Bluefull', 'Pinkal', 'Oran', 'Whitill'];
const STAGE_LABEL = { 0: '初始 (Lv.0)', 1: '一段 (Lv.10)', 2: '二段 (Lv.35)', 3: '三段 (Lv.50)', 4: '四段 (Lv.100)' };
const CLASS_LABEL = { HU: 'HU（战士）', RA: 'RA（枪手）', FO: 'FO（法师）' };

// Rebuilds `state` from scratch (start mode / custom stats changed) and
// discards any feed history, since the mag itself is a different object now.
function applyStart(start) {
    state = E.createState(DATA, { start });
    history.length = 0;
    render();
}

// The feeder only decides which evolution branch a future feed takes; it
// never invalidates past progress, so this mutates state.feeder in place.
function setFeeder(patch) {
    Object.assign(state.feeder, patch);
    render();
}

function speciesOptionsHtml() {
    const byStage = {};
    Object.entries(DATA.mags).forEach(([id, m]) => {
        (byStage[m.stage] || (byStage[m.stage] = [])).push(id);
    });
    return Object.keys(byStage)
        .sort((a, b) => Number(a) - Number(b))
        .map((stage) => {
            const opts = byStage[stage].sort()
                .map((id) => `<option value="${id}">${id}</option>`).join('');
            return `<optgroup label="${STAGE_LABEL[stage] || `阶段 ${stage}`}">${opts}</optgroup>`;
        }).join('');
}

function renderSetup() {
    const root = document.querySelector('[data-sim-setup]');
    if (!root) return;

    const fresh = DATA.freshMag;
    root.innerHTML = `
        <h2>起始设置</h2>
        <fieldset class="mag-sim-setup__block">
            <legend>起始 Mag</legend>
            <div class="mag-tabs" role="tablist" data-start-tabs>
                <button type="button" class="mag-tab" role="tab" data-mode="fresh" aria-selected="true">全新 Mag</button>
                <button type="button" class="mag-tab" role="tab" data-mode="custom" aria-selected="false">自定义</button>
            </div>
            <div class="mag-sim-setup__custom" data-custom-fields hidden>
                <label class="mag-sim-setup__field">
                    <span>种类</span>
                    <select data-custom="magId">${speciesOptionsHtml()}</select>
                </label>
                <div class="mag-sim-setup__stats">
                    <label>DEF<input type="number" data-custom="def" value="${fresh.def}" min="0" max="200" step="1"></label>
                    <label>POW<input type="number" data-custom="pow" value="${fresh.pow}" min="0" max="200" step="1"></label>
                    <label>DEX<input type="number" data-custom="dex" value="${fresh.dex}" min="0" max="200" step="1"></label>
                    <label>MIND<input type="number" data-custom="mind" value="${fresh.mind}" min="0" max="200" step="1"></label>
                    <label>同步率<input type="number" data-custom="synchro" value="${fresh.synchro}" min="0" max="120" step="1"></label>
                    <label>IQ<input type="number" data-custom="iq" value="${fresh.iq}" min="0" max="200" step="1"></label>
                </div>
                <button type="button" class="mag-sim-setup__apply" data-apply-custom>应用自定义设置</button>
            </div>
        </fieldset>

        <fieldset class="mag-sim-setup__block">
            <legend>喂食者</legend>
            <div class="mag-sim-setup__row">
                <label class="mag-sim-setup__field">
                    <span>职业</span>
                    <select data-feeder="class">
                        ${Object.entries(CLASS_LABEL).map(([v, label]) =>
                            `<option value="${v}"${v === state.feeder.class ? ' selected' : ''}>${label}</option>`).join('')}
                    </select>
                </label>
                <div class="mag-tabs" role="tablist" data-feeder-gender>
                    <button type="button" class="mag-tab" role="tab" data-gender="M" aria-selected="${state.feeder.gender === 'M'}">男</button>
                    <button type="button" class="mag-tab" role="tab" data-gender="F" aria-selected="${state.feeder.gender === 'F'}">女</button>
                </div>
            </div>
            <div class="mag-sim-setup__label">Section ID</div>
            <div class="mag-idset mag-idset--picker" data-feeder-section role="tablist">
                ${SECTION_IDS.map((id) => `
                    <button type="button" class="mag-id-chip" role="tab" data-id="${id}" aria-selected="${id === state.feeder.sectionId}">
                        <img src="/assets/img/section/sm/${id}.png" alt="" width="16" height="16" loading="lazy">${id}
                    </button>`).join('')}
            </div>
        </fieldset>
    `;

    // ---- start mode ----
    const startTabs = root.querySelector('[data-start-tabs]');
    const customFields = root.querySelector('[data-custom-fields]');
    const magSelect = root.querySelector('[data-custom="magId"]');

    function currentCustomStart() {
        const val = (name) => Number(root.querySelector(`[data-custom="${name}"]`).value) || 0;
        return {
            mode: 'custom',
            magId: magSelect.value,
            def: val('def'), pow: val('pow'), dex: val('dex'), mind: val('mind'),
            synchro: val('synchro'), iq: val('iq'),
        };
    }

    startTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mode]');
        if (!btn) return;
        startTabs.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
        customFields.hidden = btn.dataset.mode !== 'custom';
        applyStart(btn.dataset.mode === 'custom' ? currentCustomStart() : { mode: 'fresh' });
    });

    customFields.addEventListener('change', () => {
        if (customFields.hidden) return;
        applyStart(currentCustomStart());
    });

    root.querySelector('[data-apply-custom]').addEventListener('click', () => {
        applyStart(currentCustomStart());
    });

    // ---- feeder ----
    root.querySelector('[data-feeder="class"]').addEventListener('change', (e) => {
        setFeeder({ class: e.target.value });
    });

    const genderTabs = root.querySelector('[data-feeder-gender]');
    genderTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-gender]');
        if (!btn) return;
        genderTabs.querySelectorAll('[data-gender]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
        setFeeder({ gender: btn.dataset.gender });
    });

    const idPicker = root.querySelector('[data-feeder-section]');
    idPicker.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-id]');
        if (!btn) return;
        idPicker.querySelectorAll('[data-id]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
        setFeeder({ sectionId: btn.dataset.id });
    });
}

// ---------- Task 13: live Mag card ----------

const SPRITE_DIR = '/assets/img/mag/wiki/';
function sprite(name) { return `${SPRITE_DIR}${encodeURIComponent(name)}.png`; }

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

const STAT_DEFS = [
    { key: 'def', label: 'DEF', cls: 'def' },
    { key: 'pow', label: 'POW', cls: 'pow' },
    { key: 'dex', label: 'DEX', cls: 'dex' },
    { key: 'mind', label: 'MIND', cls: 'mind' },
];

const NEXT_EVO_HINT = {
    0: 'Lv 10 → 一阶',
    1: 'Lv 35 → 二阶',
    2: (s) => `Lv ${s.window.stage3} → 三阶`,
    3: (s) => `Lv ${s.window.stage4} → 四阶（或用 Mag Cell）`,
    4: '已达四阶（可用 Mag Cell 转稀有）',
};

// Flat name -> {name, zh, pb, triggers} lookup over window.MAG_EVOLUTION's
// evolution tree, built once on first use (not at module load, since
// mag-evolution.js — a separate deferred script — may not have run yet).
// Absent from the lookup = a node the standard tree doesn't know about (cell
// mags like Gael Giel): renderCard degrades to the bare English name.
let magInfoCache = null;
function getMagInfo() {
    if (magInfoCache) return magInfoCache;
    magInfoCache = Object.create(null);
    const data = window.MAG_EVOLUTION;
    if (!data || !data.classes) return magInfoCache;
    const add = (node) => { if (node && node.name) magInfoCache[node.name] = node; };
    Object.values(data.classes).forEach((c) => {
        add(c.stage1);
        (c.stage2 || []).forEach(add);
        const s3 = c.stage3 || {};
        (s3.special || []).forEach(add);
        (s3.A || []).forEach(add);
        (s3.B || []).forEach(add);
        (c.stage4 || []).forEach((r) => { add(r.male); add(r.female); });
    });
    return magInfoCache;
}

function statBarHtml(stat) {
    const value = state[stat.key];
    const progress = state.progress[stat.key];
    const pct = Math.min(100, Math.max(0, (value / 200) * 100));
    return `<div class="mag-sim-card__stat">
        <span class="mag-sim-card__stat-label stat--${stat.cls}">${stat.label}</span>
        <div class="mag-sim-card__stat-track">
            <div class="mag-sim-card__stat-fill mag-sim-card__stat-fill--${stat.cls}" style="width:${pct}%"></div>
        </div>
        <span class="mag-sim-card__stat-value">${value}·${progress}%</span>
    </div>`;
}

function pbHtml(info, meta) {
    if (!info || !info.pb || !meta) return '';
    const zh = meta.pbNames[info.pb] || '';
    // Slug the file name — "Mylla & Youlla" as a raw src (spaces + &) fails to
    // load in-page even though the encoded URL resolves directly.
    const icon = `/assets/img/mag/pb/${info.pb.replace(/[^A-Za-z0-9]+/g, '_')}.png`;
    return `<div class="mag-card__pb"><span class="mag-card__label">PB</span>`
        + `<img class="mag-card__pb-icon" src="${icon}" alt="" loading="lazy" width="20" height="17">`
        + `<b>${esc(zh)}</b><span class="mag-card__pb-en">${esc(info.pb)}</span></div>`;
}

function triggersHtml(info, meta) {
    if (!info || !info.triggers || !meta) return '';
    const rows = (meta.events || [])
        .filter((e) => e in info.triggers)
        .map((e) => {
            const t = info.triggers[e];
            return `<div class="mag-trig__row">
                <span class="mag-trig__event">${esc(e)}</span>
                <span>${esc(meta.effects[t.effect] || t.effect)}</span>
                <span class="mag-trig__rate">${esc(t.rate)}</span>
            </div>`;
        });
    return rows.length ? `<div class="mag-trig">${rows.join('')}</div>` : '';
}

function nextEvoHint() {
    const stage = DATA.mags[state.magId]?.stage ?? 0;
    const hint = NEXT_EVO_HINT[stage];
    if (!hint) return '';
    return typeof hint === 'function' ? hint(state) : hint;
}

function renderCard() {
    const root = document.querySelector('[data-sim-card]');
    if (!root) return;

    const info = getMagInfo()[state.magId];
    const meta = window.MAG_EVOLUTION?.meta;
    const nameHtml = info?.zh
        ? `${esc(info.zh)}<span class="mag-card__en">${esc(state.magId)}</span>`
        : esc(state.magId);
    const level = E.magLevel(state);

    root.innerHTML = `
        <h2>当前 Mag</h2>
        <div class="mag-sim-card__head">
            <img class="mag-sim-card__sprite" src="${sprite(state.magId)}" alt="${esc(state.magId)}"
                loading="lazy" onerror="this.remove()">
            <div>
                <div class="mag-card__name">${nameHtml}</div>
                <div class="mag-sim-card__level">Lv ${level} / 200 · 同步率 ${state.synchro} / 120 · IQ ${state.iq} / 200</div>
            </div>
        </div>
        <div class="mag-sim-card__stats">
            ${STAT_DEFS.map(statBarHtml).join('')}
        </div>
        ${pbHtml(info, meta)}
        ${triggersHtml(info, meta)}
        <div class="mag-sim-card__next">下次进化：<b>${esc(nextEvoHint())}</b></div>
    `;
}

function renderFeed() {}
function renderLog() {}

function render() {
    renderCard();
    renderFeed();
    renderLog();
}

document.addEventListener('DOMContentLoaded', () => {
    renderSetup();
    render();
});
