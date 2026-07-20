(() => {
    "use strict";

    const EPISODE_LAYOUT = [
        {
            episode: 1,
            areas: [
                { name: "森林", quests: ["MU1", "SU1", "EN1", "SR1", "LHS"] },
                { name: "洞窟", quests: ["MU2", "SU2", "EN2", "SR2", "LIS"] },
                { name: "坑道", quests: ["MU3", "SU3", "EN3", "SR3"] },
                { name: "遗迹", quests: ["MU4", "SU4", "EN4", "SR4", "LHP"] },
                { name: "跨区域", quests: ["AO1", "AO2", "SA1", "SA2"] },
            ],
        },
        {
            episode: 2,
            areas: [
                { name: "VR 神殿", quests: ["SU5", "PS1", "LSR"] },
                { name: "VR 宇宙船", quests: ["SU6", "PS2", "LBA"] },
                { name: "中央管理区", quests: ["PW1", "SU7", "PS3", "PS4"] },
                { name: "海底设施", quests: ["PW3", "SU8", "PS5", "LDR"] },
                { name: "控制塔", quests: ["PS6", "LCV", "TET", "TWT"] },
                { name: "跨区域", quests: ["AO3", "AO4", "AO5"] },
            ],
        },
        {
            episode: 4,
            areas: [
                {
                    name: "陨石坑",
                    quests: ["WoL1", "WoL2", "NMU1", "NMU2", "SU10", "SU11"],
                },
                {
                    name: "地下沙漠",
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
    const STATUS_TEXT = {
        current: "本周当前",
        possible: "下周可能",
        unavailable: "本轮已用",
    };

    const byId = (id) => document.getElementById(id);

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
        const state = document.createElement("small");

        link.className = `rbr-quest-cell is-${status}`;
        link.href = quest.wikiUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = quest.name;
        link.setAttribute(
            "aria-label",
            `${quest.abbreviation} ${quest.name}，${STATUS_TEXT[status]}`
        );
        abbreviation.textContent = quest.abbreviation;
        state.textContent = STATUS_TEXT[status];
        link.append(abbreviation, state);
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
            summary.textContent =
                `当前 ${tracker.current[0]} · ` +
                `可能 ${tracker.possible.length} · ` +
                `共 ${data.eligibleCounts[String(layout.episode)]}`;
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
        const dateFresh = data.current.isFresh;
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
            status.textContent =
                "数据冲突：Tracker 的当前任务与当前轮换模板不一致。请以游戏内 /rbr 为准。";
        } else if (!dateFresh) {
            status.classList.add("is-warning");
            status.textContent =
                `Tracker 与当前任务模板一致（${current}），但模板周日期仍为 ` +
                `${data.current.week}，按更新时间应为 ${data.current.expectedWeek}。` +
                "这通常表示任务已更新、日期字段漏改；请以游戏内 /rbr 为准。";
        } else {
            status.classList.add("is-ok");
            status.textContent =
                `Tracker、当前任务与周日期一致：${current}（${data.current.week}）。`;
        }

        status.append(document.createElement("br"), sourceLink);
        status.append(
            document.createTextNode(
                `；本站数据生成于 ${new Date(data.generatedAt).toLocaleString("zh-CN")}`
            )
        );
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
    }

    loadTracker().catch((error) => {
        const status = byId("rbr-tracker-status");
        status.className = "rbr-tracker-status is-error";
        status.textContent =
            `RBR Tracker 暂时无法读取（${error.message}）。` +
            "请直接查看 Pioneer 2 Wiki 或在游戏内使用 /rbr。";
    });
})();
