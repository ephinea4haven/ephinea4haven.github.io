'use strict';

const GALATINE_RANGES = [
    [0,   124, '0.33×', '110–140'],
    [125, 249, '0.5×',  '165–210'],
    [250, 374, '1×',    '330–420'],
    [375, 499, '2×',    '660–840'],
    [500, 624, '3×',    '990–1260'],
    [625, 749, '2×',    '660–840'],
    [750, 874, '1×',    '330–420'],
    [875, 999, '0.5×',  '165–210'],
];

const BUF_LABELS = [
    '稀有怪率 (RER)  +50%',  // offset 0
    '掉宝率 (RDR)  +25%',    // offset 1
    '经验值 (EXP)  +50%',    // offset 2
    '掉物率 (DAR)  +25%',    // offset 3
];

function getBeatTime() {
    const d = new Date();
    let h = d.getUTCHours();
    h = h === 23 ? 0 : h + 1;
    const secs = ((h * 60 + d.getUTCMinutes()) * 60) + d.getUTCSeconds();
    return Math.abs(secs / 86.4);
}

function formatBeat(beats) {
    const [i, f] = beats.toFixed(2).split('.');
    return '@' + i.padStart(3, '0') + '.' + f;
}

function tick() {
    const beats    = getBeatTime();
    const isEven   = Math.floor(beats / 100) % 2 === 0;

    const swatch = document.getElementById('swatchTime');
    const note   = document.getElementById('beat-period-label');
    if (swatch) {
        swatch.textContent      = formatBeat(beats);
        swatch.style.color      = isEven ? '#47a447' : '#c8a23a';
        swatch.style.textShadow = isEven
            ? '0 0 20px rgba(71,164,71,0.6)'
            : '0 0 20px rgba(200,162,58,0.5)';
    }
    if (note) {
        note.textContent = '天罚时间';
        note.style.color = isEven ? '#4ade80' : '#94a3b8';
    }

    const floor = Math.floor(beats);
    const range = GALATINE_RANGES.find(([s, e]) => floor >= s && floor <= e);
    const atpEl = document.getElementById('galatine-atp');
    const perEl = document.getElementById('galatine-period');
    if (range) {
        if (atpEl) atpEl.textContent = range[2] + ' · ATP ' + range[3];
        if (perEl) perEl.textContent = 'beat ' + range[0] + '–' + range[1];
    }
}

function initBuf() {
    const epoch    = new Date(2019, 8, 22, 8, 0, 0, 0);
    const daysSince = Math.floor((Date.now() - epoch.getTime()) / 86400000);
    const offset   = Math.floor(daysSince / 7) % 4;

    const cur = document.getElementById('buf-current');
    const nxt = document.getElementById('buf-next');
    if (cur) cur.textContent = BUF_LABELS[offset];
    if (nxt) nxt.textContent = '下周：' + BUF_LABELS[(offset + 1) % 4];
}

document.addEventListener('DOMContentLoaded', () => {
    tick();
    setInterval(tick, 1000);
    initBuf();
});
