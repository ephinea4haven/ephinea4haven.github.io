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

function renderCard() {}
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
