/* Shared 3-way language switcher (zh / en / ja) — default zh.
 *
 * Mounts into any element with id="langSwitch". Persists selection in
 * localStorage under key `siteLang` so switching language is sticky across
 * pages. Exposes:
 *   window.pageLang                 — current language string
 *   window.setPageLang(lang)        — change language
 *   window.onLangChange(callback)   — subscribe; fires on init + every change
 *
 * The module calls subscribers with the new lang string, so view files just
 * implement `render(lang)` and pass it to onLangChange.
 */
(function () {
    var STORAGE_KEY = 'siteLang';
    var SUPPORTED = ['zh', 'en', 'ja'];
    var LABELS = { zh: '中', en: 'EN', ja: '日' };

    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    var currentLang = SUPPORTED.indexOf(saved) >= 0 ? saved : 'zh';

    var listeners = [];

    function notify() {
        for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](currentLang); } catch (e) { console.error(e); }
        }
    }

    function updateActiveButton() {
        var host = document.getElementById('langSwitch');
        if (!host) return;
        var btns = host.querySelectorAll('.lang-btn');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var match = b.getAttribute('data-lang') === currentLang;
            b.classList.toggle('active', match);
        }
    }

    function mount() {
        var host = document.getElementById('langSwitch');
        if (!host) return;
        // Render buttons if not already present
        if (!host.querySelector('.lang-btn')) {
            host.innerHTML = '';
            SUPPORTED.forEach(function (lang) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'lang-btn';
                b.setAttribute('data-lang', lang);
                b.textContent = LABELS[lang];
                host.appendChild(b);
            });
        }
        host.addEventListener('click', function (e) {
            var t = e.target.closest('.lang-btn');
            if (!t) return;
            var lang = t.getAttribute('data-lang');
            window.setPageLang(lang);
        });
        updateActiveButton();
        document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : currentLang;
    }

    window.pageLang = currentLang;
    window.setPageLang = function (lang) {
        if (SUPPORTED.indexOf(lang) < 0) return;
        currentLang = lang;
        window.pageLang = lang;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
        updateActiveButton();
        notify();
    };
    window.onLangChange = function (cb) {
        if (typeof cb !== 'function') return;
        listeners.push(cb);
        // Fire immediately so subscribers can render current state
        try { cb(currentLang); } catch (e) { console.error(e); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
