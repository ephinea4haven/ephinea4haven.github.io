'use strict';

function buff() {
    const epoch = new Date(2019, 8, 22);
    epoch.setHours(8, 0, 0, 0);

    const now = new Date();
    const offset = Math.floor(((now.getTime() - epoch.getTime()) / (24 * 60 * 60 * 1000)) / 7 % 4);

    document.querySelectorAll('#week-buf li').forEach(function (el) {
        const id = parseInt(el.id);

        if (offset === id) {
            el.insertAdjacentHTML('beforeend', " - <span style='color: red; font-weight: bolder'>本周</span>");
            el.style.color = 'red';
            el.style.fontWeight = 'bolder';
        } else {
            el.style.color = 'grey';
            el.style.fontWeight = 'bolder';
        }

        if ((offset + 1) % 4 === id) {
            el.insertAdjacentHTML('beforeend', " - <span style='color: grey; font-weight: bolder'>下周</span>");
            el.style.color = 'grey';
            el.style.fontWeight = 'bolder';
        }
    });
}

function GetBeatTime() {
    const date = new Date();
    let hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();

    hours = (hours === 23) ? 0 : hours + 1;

    const timeInSeconds = ((hours * 60 + minutes) * 60) + seconds;
    return Math.abs(timeInSeconds / 86.4).toFixed(2);
}

function GetInternetTime() {
    let beats = GetBeatTime();
    const isEven = Math.floor(beats / 100) % 2 === 0;

    const swatchTime = document.getElementById('swatchTime');
    const hpLabel = document.getElementById('hp-label');

    if (isEven) {
        const padded = beats.toString().padStart(3, '0');
        swatchTime.innerHTML = `<span style="color: #47a447; font-weight: bolder; font-size: larger">@${padded}</span>`;
        if (hpLabel) {
            hpLabel.style.color = 'green';
            hpLabel.style.fontWeight = 'bold';
        }
    } else {
        swatchTime.innerHTML = `<span style="color: #a49047; font-weight: bolder">@${beats}</span>`;
        if (hpLabel) {
            hpLabel.style.color = '';
        }
    }
}

function pad0(unit, base = 10) {
    const str = String(unit);
    if (base === 10) return str.padStart(2, '0');
    if (base === 100) return str.padStart(3, '0');
    return str;
}

function getBeatPeriod(start, end) {
    const beats = GetBeatTime();

    const d1 = new Date();
    d1.setHours(0, 0, 0, 0);
    d1.setTime(d1.getTime() + start * 86400 + 7 * 3600000);

    const d2 = new Date();
    d2.setHours(0, 0, 0, 0);
    d2.setTime(d2.getTime() + (end + 1) * 86400 + 7 * 3600000 - 1000);

    const timeRange = `${pad0(d1.getHours())}:${pad0(d1.getMinutes())}:${pad0(d1.getSeconds())}` +
        ` ~ ${pad0(d2.getHours())}:${pad0(d2.getMinutes())}:${pad0(d2.getSeconds())}`;

    const raw = `${pad0(start, 100)} ~ ${pad0(end, 100)} : ${timeRange}`;

    if (beats >= start && beats <= end) {
        const color = Math.floor(beats / 100) % 2 === 0 ? '#47a447' : '#a49047';
        return `<span style="color: ${color}; font-weight: bold">${raw}</span>`;
    }

    return raw;
}

document.addEventListener('DOMContentLoaded', function () {
    GetInternetTime();
    setInterval(GetInternetTime, 1000);

    buff();

    const beatPeriods = [];
    for (let i = 0; i < 1000; i += 100) {
        beatPeriods.push(`<li>${getBeatPeriod(i, i + 99)}`);
    }
    document.getElementById('beat_even_period').innerHTML = beatPeriods.join('');

    const galatineRanges = [
        [0, 124, '0.33x (110-140)'],
        [125, 249, '0.5x (165-210)'],
        [250, 374, '1x (330-420)'],
        [375, 499, '2x (660-840)'],
        [500, 624, '3x (990-1260)'],
        [625, 749, '2x (660-840)'],
        [750, 874, '1x (330-420)'],
        [875, 999, '0.5x (165-210)'],
    ];
    const galatinePeriod = '<ul>' +
        galatineRanges.map(([s, e, label]) => `<li>${getBeatPeriod(s, e)} - ${label}`).join('') +
        '</ul>';
    document.getElementById('galatine_even_period').innerHTML = galatinePeriod;
});
