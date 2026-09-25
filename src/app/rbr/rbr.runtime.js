export function initializeRbr(root, language) {
    "use strict";

    const TEXT = {
        zh: {
            areas: {
                forest: "森林", caves: "洞窟", mines: "坑道", ruins: "遗迹",
                crossArea: "跨区域", temple: "VR 神殿", spaceship: "VR 宇宙船",
                cca: "中央管理区", seabed: "海底设施", tower: "控制塔",
                crater: "陨石坑", desert: "地下沙漠",
            },
            status: { current: "本周当前", possible: "下周可能", unavailable: "本轮已用" },
            questLabel: (abbreviation, name, status) => `${abbreviation} ${name}，${status}`,
            episodeSummary: (current, possible, total) =>
                `当前 ${current} · 可能 ${possible} · 共 ${total}`,
            conflict: "数据冲突：Tracker 的当前任务与当前轮换模板不一致。请以游戏内 /rbr 为准。",
            stale: (current, week, expected) =>
                `Tracker 与当前任务模板一致（${current}），但模板周日期仍为 ${week}，本周应为 ${expected}。` +
                "Wiki 正在等待人工更新；请暂时以游戏内 /rbr 为准。",
            fresh: (current, week) => `Tracker、当前任务与周日期一致：${current}（${week}）。`,
            generated: (date) => `；本站数据生成于 ${date}`,
            locale: "zh-CN",
            badge: "本周 RBR",
            markerTitle: (abbreviation) => `本周 RBR：${abbreviation}`,
            currentWeek: (quests, week) => `${quests}（${week}）`,
            markerError: (message) => `本周 RBR 标记暂时无法显示（${message}）`,
            loadError: (message) =>
                `RBR Tracker 暂时无法读取（${message}）。请直接查看 Pioneer 2 Wiki 或在游戏内使用 /rbr。`,
        },
        en: {
            areas: {
                forest: "Forest", caves: "Caves", mines: "Mines", ruins: "Ruins",
                crossArea: "Multi-area", temple: "VR Temple", spaceship: "VR Spaceship",
                cca: "Central Control Area", seabed: "Seabed", tower: "Control Tower",
                crater: "Crater", desert: "Subterranean Desert",
            },
            status: { current: "This week", possible: "Possible next week", unavailable: "Used this cycle" },
            questLabel: (abbreviation, name, status) => `${abbreviation} ${name}, ${status}`,
            episodeSummary: (current, possible, total) =>
                `Current ${current} · Possible ${possible} · Total ${total}`,
            conflict: "Data conflict: the Tracker's current quests do not match the current rotation template. Trust /rbr in game.",
            stale: (current, week, expected) =>
                `The Tracker matches the current quest template (${current}), but the template week is still ${week}; this week should be ${expected}. ` +
                "The Wiki is waiting for a manual update; trust /rbr in game for now.",
            fresh: (current, week) => `The Tracker, current quests and week date agree: ${current} (${week}).`,
            generated: (date) => `; site data generated ${date}`,
            locale: "en-GB",
            badge: "This week's RBR",
            markerTitle: (abbreviation) => `This week's RBR: ${abbreviation}`,
            currentWeek: (quests, week) => `${quests} (${week})`,
            markerError: (message) => `This week's RBR markers cannot be shown right now (${message})`,
            loadError: (message) =>
                `The RBR Tracker cannot be read right now (${message}). Check the Pioneer 2 Wiki or use /rbr in game.`,
        },
        ja: {
            areas: {
                forest: "森林", caves: "洞窟", mines: "坑道", ruins: "遺跡",
                crossArea: "複数エリア", temple: "VR 神殿", spaceship: "VR 宇宙船",
                cca: "セントラルコントロールエリア", seabed: "海底プラント", tower: "コントロールタワー",
                crater: "クレーター", desert: "地下砂漠",
            },
            status: { current: "今週", possible: "来週の候補", unavailable: "今回の周で出題済み" },
            questLabel: (abbreviation, name, status) => `${abbreviation} ${name}、${status}`,
            episodeSummary: (current, possible, total) =>
                `今週 ${current} · 候補 ${possible} · 全 ${total}`,
            conflict: "データの矛盾：Tracker の今週のクエストが現在のローテーションテンプレートと一致しません。ゲーム内の /rbr を優先してください。",
            stale: (current, week, expected) =>
                `Tracker は現在のクエストテンプレート（${current}）と一致していますが、テンプレートの週は ${week} のままで、今週は ${expected} のはずです。` +
                "Wiki は手動更新待ちです。当面はゲーム内の /rbr を優先してください。",
            fresh: (current, week) => `Tracker・今週のクエスト・週の日付が一致しています：${current}（${week}）。`,
            generated: (date) => `／本サイトのデータ生成：${date}`,
            locale: "ja-JP",
            badge: "今週の RBR",
            markerTitle: (abbreviation) => `今週の RBR：${abbreviation}`,
            currentWeek: (quests, week) => `${quests}（${week}）`,
            markerError: (message) => `今週の RBR マーカーを表示できません（${message}）`,
            loadError: (message) =>
                `RBR Tracker を読み込めません（${message}）。Pioneer 2 Wiki を見るか、ゲーム内で /rbr を使ってください。`,
        },
    }[language];

    const EPISODE_LAYOUT = [
        {
            episode: 1,
            areas: [
                { name: TEXT.areas.forest, quests: ["MU1", "SU1", "EN1", "SR1", "LHS"] },
                { name: TEXT.areas.caves, quests: ["MU2", "SU2", "EN2", "SR2", "LIS"] },
                { name: TEXT.areas.mines, quests: ["MU3", "SU3", "EN3", "SR3"] },
                { name: TEXT.areas.ruins, quests: ["MU4", "SU4", "EN4", "SR4", "LHP"] },
                { name: TEXT.areas.crossArea, quests: ["AO1", "AO2", "SA1", "SA2"] },
            ],
        },
        {
            episode: 2,
            areas: [
                { name: TEXT.areas.temple, quests: ["SU5", "PS1", "LSR"] },
                { name: TEXT.areas.spaceship, quests: ["SU6", "PS2", "LBA"] },
                { name: TEXT.areas.cca, quests: ["PW1", "SU7", "PS3", "PS4"] },
                { name: TEXT.areas.seabed, quests: ["PW3", "SU8", "PS5", "LDR"] },
                { name: TEXT.areas.tower, quests: ["PS6", "LCV", "TET", "TWT"] },
                { name: TEXT.areas.crossArea, quests: ["AO3", "AO4", "AO5"] },
            ],
        },
        {
            episode: 4,
            areas: [
                {
                    name: TEXT.areas.crater,
                    quests: ["WoL1", "WoL2", "NMU1", "NMU2", "SU10", "SU11"],
                },
                {
                    name: TEXT.areas.desert,
                    quests: [
                        "WoL3",
                        "WoL4",
                        "WoL5",
                        "NMU4",
                        "NMU5",
                        "SU12",
                        "SU13",
                        "SU14",
                    ],
                },
            ],
        },
    ];
    const STATUS_TEXT = TEXT.status;

    const byId = (id) => root.querySelector(`#${id}`);

    function statusByAbbreviation(data) {
        const result = new Map();
        for (const episode of EPISODE_LAYOUT) {
            const statuses = data.tracker.byEpisode[String(episode.episode)];
            for (const status of ["current", "possible", "unavailable"]) {
                for (const abbreviation of statuses[status]) {
                    result.set(abbreviation, status);
                }
            }
        }
        return result;
    }

    function questCell(quest, status) {
        const link = document.createElement("a");
        const abbreviation = document.createElement("strong");

        link.className = `rbr-quest-cell is-${status}`;
        link.href = quest.wikiUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = `${quest.name} · ${STATUS_TEXT[status]}`;
        link.setAttribute(
            "aria-label",
            TEXT.questLabel(quest.abbreviation, quest.name, STATUS_TEXT[status])
        );
        abbreviation.textContent = quest.abbreviation;
        link.append(abbreviation);
        return link;
    }

    function renderTracker(data, questsByAbbreviation) {
        const container = byId("rbr-tracker-episodes");
        const statuses = statusByAbbreviation(data);
        const rendered = new Set();
        container.replaceChildren();

        for (const layout of EPISODE_LAYOUT) {
            const tracker = data.tracker.byEpisode[String(layout.episode)];
            const card = document.createElement("section");
            const header = document.createElement("header");
            const heading = document.createElement("h3");
            const summary = document.createElement("span");

            card.className = "rbr-episode-card";
            header.className = "rbr-episode-header";
            heading.textContent = `Episode ${layout.episode}`;
            summary.className = "rbr-episode-summary";
            summary.textContent = TEXT.episodeSummary(
                tracker.current[0],
                tracker.possible.length,
                data.eligibleCounts[String(layout.episode)]
            );
            header.append(heading, summary);
            card.append(header);

            for (const area of layout.areas) {
                const row = document.createElement("div");
                const areaName = document.createElement("div");
                const quests = document.createElement("div");
                row.className = "rbr-area-row";
                areaName.className = "rbr-area-name";
                areaName.textContent = area.name;
                quests.className = "rbr-area-quests";

                for (const abbreviation of area.quests) {
                    const quest = questsByAbbreviation.get(abbreviation);
                    const status = statuses.get(abbreviation);
                    if (!quest || !status || rendered.has(abbreviation)) {
                        throw new Error(
                            `Tracker layout contains invalid quest ${abbreviation}`
                        );
                    }
                    rendered.add(abbreviation);
                    quests.append(questCell(quest, status));
                }
                row.append(areaName, quests);
                card.append(row);
            }
            container.append(card);
        }

        if (rendered.size !== data.quests.length) {
            throw new Error(
                `Tracker layout covers ${rendered.size}/${data.quests.length} quests`
            );
        }
    }

    function renderSourceStatus(data) {
        const status = byId("rbr-tracker-status");
        const consistent = data.tracker.isConsistentWithCurrentTemplate;
        const now = new Date();
        const utcMidnight = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        );
        const expectedSunday = new Date(
            utcMidnight - now.getUTCDay() * 24 * 60 * 60 * 1000
        );
        const expectedWeek = new Intl.DateTimeFormat("en-GB", {
            timeZone: "UTC",
            day: "2-digit",
            month: "long",
            year: "numeric",
        }).format(expectedSunday);
        const dateFresh = data.current.week === expectedWeek;
        const current = data.current.quests
            .map((quest) => quest.abbreviation)
            .join(" / ");
        const trackerSource = data.sources.tracker;
        const sourceLink = document.createElement("a");
        sourceLink.href = trackerSource.url;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = `Tracker revision ${trackerSource.revision}`;

        status.className = "rbr-tracker-status";
        if (!consistent) {
            status.classList.add("is-error");
            status.textContent = TEXT.conflict;
        } else if (!dateFresh) {
            status.classList.add("is-warning");
            status.textContent = TEXT.stale(current, data.current.week, expectedWeek);
        } else {
            status.classList.add("is-ok");
            status.textContent = TEXT.fresh(current, data.current.week);
        }

        status.append(document.createElement("br"), sourceLink);
        status.append(
            document.createTextNode(
                TEXT.generated(new Date(data.generatedAt).toLocaleString(TEXT.locale))
            )
        );
    }

    async function renderTierHighlights(data) {
        const chart = byId("rbr-tier-chart");
        const overlay = byId("rbr-tier-current-overlay");
        const summary = byId("rbr-tier-current-summary");
        if (!chart || !overlay || !summary) {
            return;
        }

        const response = await fetch(chart.getAttribute("src"), {
            cache: "force-cache",
        });
        if (!response.ok) {
            throw new Error(`Tier chart HTTP ${response.status}`);
        }

        const documentRoot = new DOMParser().parseFromString(
            await response.text(),
            "image/svg+xml"
        );
        const svg = documentRoot.documentElement;
        const viewBox = svg
            .getAttribute("viewBox")
            .split(/\s+/)
            .map(Number);
        const [, , viewBoxWidth, viewBoxHeight] = viewBox;
        const current = data.current.quests.map((quest) => quest.abbreviation);

        if (
            viewBox.length !== 4 ||
            !viewBox.every(Number.isFinite) ||
            viewBoxWidth <= 0 ||
            viewBoxHeight <= 0
        ) {
            throw new Error("Tier chart has an invalid viewBox");
        }

        overlay.replaceChildren();
        current.forEach((abbreviation, index) => {
            const label = Array.from(documentRoot.querySelectorAll("text")).find(
                (element) => element.textContent.trim() === abbreviation
            );
            const cell = label?.previousElementSibling;
            if (!cell || cell.tagName.toLowerCase() !== "rect") {
                throw new Error(`Tier chart does not contain ${abbreviation}`);
            }

            const marker = document.createElement("div");
            const corners = document.createElement("span");
            const scan = document.createElement("i");
            const name = document.createElement("strong");
            const x = Number(cell.getAttribute("x"));
            const y = Number(cell.getAttribute("y"));
            const width = Number(cell.getAttribute("width"));
            const height = Number(cell.getAttribute("height"));
            if (![x, y, width, height].every(Number.isFinite)) {
                throw new Error(`Tier chart cell ${abbreviation} is invalid`);
            }

            marker.className = "tier-current-marker";
            corners.className = "tier-current-corners";
            scan.className = "tier-current-scan";
            name.className = "tier-current-name";
            name.textContent = abbreviation;
            marker.title = TEXT.markerTitle(abbreviation);
            marker.style.setProperty("--marker-delay", `${index * 120}ms`);
            marker.style.left = `${(x / viewBoxWidth) * 100}%`;
            marker.style.top = `${(y / viewBoxHeight) * 100}%`;
            marker.style.width = `${(width / viewBoxWidth) * 100}%`;
            marker.style.height = `${(height / viewBoxHeight) * 100}%`;
            marker.append(corners, scan, name);
            overlay.append(marker);
        });

        const badge = document.createElement("span");
        const quests = document.createElement("strong");
        badge.textContent = TEXT.badge;
        quests.textContent = TEXT.currentWeek(current.join(" · "), data.current.week);
        summary.replaceChildren(badge, quests);
    }

    async function loadTracker() {
        const response = await fetch("/data/rbr/source.json", {
            cache: "no-cache",
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (
            data.schemaVersion < 2 ||
            !data.tracker ||
            !Array.isArray(data.quests)
        ) {
            throw new Error("RBR source schema does not include tracker data");
        }

        const questsByAbbreviation = new Map(
            data.quests.map((quest) => [quest.abbreviation, quest])
        );
        renderSourceStatus(data);
        renderTracker(data, questsByAbbreviation);
        renderTierHighlights(data).catch((error) => {
            const summary = byId("rbr-tier-current-summary");
            if (summary) {
                summary.textContent = TEXT.markerError(error.message);
            }
        });
    }

    loadTracker().catch((error) => {
        const status = byId("rbr-tracker-status");
        status.className = "rbr-tracker-status is-error";
        status.textContent = TEXT.loadError(error.message);
    });
}
