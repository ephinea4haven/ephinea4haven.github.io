(function () {
    'use strict';

    const ITEM_NAME_OVERRIDES = [
        { en: 'Ultimate Present', zh: '究极礼物' },
        { en: 'Common Present', zh: '普通礼物' },
        { en: 'Music Disk', zh: '音乐光盘' },
        { en: 'Random Music Disc', zh: '随机音乐光盘' },
        { en: 'Item Ticket', zh: '道具兑换券' },
        { en: 'Red Ring Paint', zh: '红色手镯涂装' },
        { en: 'Photon Crystal', zh: '光子水晶' },
        { en: 'Mag Kits', zh: '玛古套件' },
        { en: 'Mag Kit', zh: '玛古套件' },
        { en: 'Sonic Doll', zh: '索尼克人偶' },
        { en: 'Game Magazine', zh: '游戏杂志' },
        { en: 'Heart of YN-0117', zh: 'YN-0117之心' },
        { en: 'Magic Rock Heart Key', zh: '魔石「心之钥」' },
        { en: 'Stealth Kit', zh: '隐形套件' },
        { en: 'Revival', zh: '速生' },
        { en: 'Material', zh: '材料' },
        { en: 'Parts', zh: '部件' },
        { en: 'Coal', zh: '煤炭' }
    ];

    const AMBIGUOUS_ITEM_NAMES = new Set([
        'disk',
        'heart',
        'hit',
        'mind',
        'pioneer',
        'rappy'
    ]);

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getItemTranslations(sourceText) {
        const translations = [
            ...ITEM_NAME_OVERRIDES,
            ...Object.values(window.ITEMS_I18N || {})
                .filter(item =>
                    item.en &&
                    item.zh &&
                    item.en !== item.zh &&
                    !AMBIGUOUS_ITEM_NAMES.has(item.en.toLowerCase())
                )
                .map(item => ({ en: item.en, zh: item.zh }))
        ];
        const seen = new Set();
        return translations
            .filter(item => {
                const key = item.en.toLowerCase();
                if (seen.has(key) || !sourceText.toLowerCase().includes(key)) return false;
                seen.add(key);
                return true;
            })
            .sort((a, b) => b.en.length - a.en.length);
    }

    window.localizeItemNames = function (container) {
        const translations = getItemTranslations(container.textContent);
        if (!translations.length) return;

        const byEnglishName = new Map(
            translations.map(item => [item.en.toLowerCase(), item])
        );
        const choices = translations.map(item => escapeRegExp(item.en)).join('|');
        const itemPattern = new RegExp(
            `(^|[^A-Za-z0-9])(${choices})(?=$|[^A-Za-z0-9])`,
            'gi'
        );
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    if (node.parentElement.closest('.event-ui-label, .item-bilingual, script, style')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const text = node.nodeValue;
            itemPattern.lastIndex = 0;
            if (!itemPattern.test(text)) return;
            itemPattern.lastIndex = 0;

            const fragment = document.createDocumentFragment();
            let cursor = 0;
            text.replace(itemPattern, (match, prefix, englishName, offset) => {
                const nameStart = offset + prefix.length;
                const leadingText = text.slice(cursor, nameStart).replace(
                    /([\u3400-\u9fff])\s+$/,
                    '$1'
                );
                fragment.append(leadingText);

                const item = byEnglishName.get(englishName.toLowerCase());
                const span = document.createElement('span');
                span.className = 'item-bilingual';
                span.innerHTML = `<span class="item-zh">${item.zh}</span><span class="item-en">(${englishName})</span>`;
                fragment.append(span);
                cursor = nameStart + englishName.length;
                return match;
            });
            fragment.append(text.slice(cursor));
            node.replaceWith(fragment);
        });
    };
})();
