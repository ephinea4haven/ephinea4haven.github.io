'use strict';

const IMG_DIR = '/assets/img/section/';
const SECTION_IDS = ['Viridia', 'Greenill', 'Skyly', 'Bluefull',
    'Purplenum', 'Pinkal', 'Redria', 'Oran',
    'Yellowboze', 'Whitill'];
const TEXT_FIELDS = Array.from({ length: 13 }, (_, i) => `#tf${i}`);
const IMG_IDS = Array.from({ length: 13 }, (_, i) => `img${i}`);
const MAGIC_NUMBERS = [0, 1, 2, 9, 3, 11, 4, 5, 10, 6, 7, 8];

function processName() {
    const input = document.getElementById('name').value;
    let flag = 0;
    let value = 0;

    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        value += code;

        if (code >= 0x100 && code < 0xFF61) {
            if (flag !== 2) {
                flag = 2;
                value += 83;
            }
        } else if (code <= 0xFF91) {
            if (flag !== 1) {
                flag = 1;
                value += 45;
            }
        }
    }
    return value;
}

function isStrAscii(str) {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code > 126 || code < 32) return false;
    }
    return true;
}

function openCalcMode(modeName) {
    const tabs = document.getElementsByClassName('calc');
    for (const tab of tabs) {
        tab.style.display = 'none';
    }
    document.getElementById(modeName).style.display = 'block';
}

function setIdResult(index, sectionName) {
    document.querySelector(TEXT_FIELDS[index]).textContent = sectionName;
    document.getElementById(IMG_IDS[index]).src = `${IMG_DIR}${sectionName}.png`;
}

function setIdNA(index) {
    document.querySelector(TEXT_FIELDS[index]).textContent = 'N/A';
    document.getElementById(IMG_IDS[index]).src = `${IMG_DIR}Impossible.png`;
}

document.querySelector('#name').addEventListener('input', function () {
    const input = document.getElementById('name');
    const val = input.value;

    if (val.length > 0 && val.length <= 12 && isStrAscii(val)) {
        setIdResult(0, SECTION_IDS[(processName() + 5) % 10]);
    } else {
        setIdNA(0);
    }

    if (val.length > 0 && val.length <= 10) {
        for (let i = 1; i <= 12; i++) {
            setIdResult(i, SECTION_IDS[(processName() + MAGIC_NUMBERS[i - 1]) % 10]);
        }
    } else {
        for (let i = 1; i <= 12; i++) {
            setIdNA(i);
        }
    }
});

document.getElementById('defaultOpen').click();
