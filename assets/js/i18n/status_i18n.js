/* 角色属性模拟器 i18n (zh/en/ja) — default zh */
(function () {
    var I18N = {
        zh: {
            title: '角色属性模拟器',
            back: '← 返回首页',
            outArmor: '铠甲', outShield: '盾牌', outUnits: '插件',
            outMag: '玛古', outMats: '素材', outLv: '等级',
            outPower: '力量', outDef: '防御', outMind: '精神',
            outEvade: '回避', outLuck: '幸运',
            outMatsLeft: function (n) { return '剩余 ' + n; },
            outMatsExceed: function (max, over) { return '上限 ' + max + ' 超出 ' + over; },
            outAllExcept: '除以下属性外全部达到上限：',
            outAllMaxed: '全部属性已达上限'
        },
        en: {
            title: 'Status Simulator',
            back: '← Back to Home',
            outArmor: 'Armor', outShield: 'Shield', outUnits: 'Units',
            outMag: 'Mag', outMats: 'Mats', outLv: 'LV',
            outPower: 'Power', outDef: 'Def', outMind: 'Mind',
            outEvade: 'Evade', outLuck: 'Luck',
            outMatsLeft: function (n) { return n + ' left'; },
            outMatsExceed: function (max, over) { return 'exceed: ' + max + ' by: ' + over; },
            outAllExcept: 'All stats maxed out except:',
            outAllMaxed: 'All stats maxed'
        },
        ja: {
            title: 'ステータスシミュレーター',
            back: '← ホームへ戻る',
            outArmor: 'アーマー', outShield: 'シールド', outUnits: 'ユニット',
            outMag: 'マグ', outMats: '素材', outLv: 'Lv',
            outPower: 'パワー', outDef: 'ディフェンス', outMind: 'マインド',
            outEvade: 'エヴェイド', outLuck: 'ラック',
            outMatsLeft: function (n) { return '残り ' + n; },
            outMatsExceed: function (max, over) { return '上限 ' + max + ' 超過 ' + over; },
            outAllExcept: '以下を除きすべて最大値：',
            outAllMaxed: '全ステータス最大'
        }
    };

    var saved = null;
    try { saved = localStorage.getItem('simLang'); } catch (e) {}
    var currentLang = I18N[saved] ? saved : 'zh';

    window.simT = function (key) {
        var dict = I18N[currentLang] || I18N.zh;
        return dict[key];
    };
    window.getSimLang = function () { return currentLang; };

    function applyLang() {
        document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : (currentLang === 'ja' ? 'ja' : 'en');

        document.querySelectorAll('[data-en][data-zh]').forEach(function (el) {
            var val = el.getAttribute('data-' + currentLang) || el.getAttribute('data-en');
            if (val == null) return;
            if (el.tagName === 'INPUT') {
                el.value = val;
            } else {
                var btn = el.querySelector('input[type="button"]');
                if (btn) {
                    el.firstChild.textContent = val + ' ';
                    var btnVal = btn.getAttribute('data-' + currentLang) || btn.getAttribute('data-en');
                    if (btnVal != null) btn.value = btnVal;
                } else {
                    el.textContent = val;
                }
            }
        });

        var title = document.getElementById('project_title');
        if (title) title.textContent = I18N[currentLang].title;
        var backLink = document.querySelector('.back-link');
        if (backLink) backLink.textContent = I18N[currentLang].back;

        document.querySelectorAll('#langSwitch .lang-btn').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-lang') === currentLang);
        });

        if (typeof calc === 'function') calc();
    }

    window.setSimLang = function (lang) {
        if (!I18N[lang]) return;
        currentLang = lang;
        try { localStorage.setItem('simLang', lang); } catch (e) {}
        applyLang();
    };

    function init() {
        document.querySelectorAll('#langSwitch .lang-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                window.setSimLang(b.getAttribute('data-lang'));
            });
        });
        // Wait for chardata to load — simulator.js gates dropdown creation on
        // the same Promise, so applying language before then would miss the
        // <option> elements that need translating.
        if (window.charDataReady && typeof window.charDataReady.then === 'function') {
            window.charDataReady.then(applyLang);
        } else {
            applyLang();
        }
    }

    if (window.jQuery) {
        window.jQuery(document).ready(init);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
