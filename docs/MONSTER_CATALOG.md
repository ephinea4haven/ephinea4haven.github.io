# Monster Catalog

The episode selector contains EP1, EP2 and EP4 with no All option and defaults
to EP1. The area selector has no All option either: browsing shows one region,
the episode's first by default (Forest for EP1). Regions gather the Wiki's
finer areas (`REGION_OF` in `monster.ts`): numbered sub-areas and the boss room
join their region, for example Forest with Under the Dome, Cave with Cave 1–3
and Underground Channel, Seabed with the Test Subject Disposal Area, and
Subterranean Desert with the Meteor Impact Site. Each region fits on one
24-entry page (at most 24 monsters), and rows and details keep the specific
area. A search covers every area of the
selected episode, like the item catalog's search across subcategories, and the
area selector is disabled while a query is present. Clearing auxiliary filters
keeps the episode and returns to its first area. All types remains available. A directly opened detail
page returns to its monster's episode when no originating episode is specified.

The catalog lives at `/data/enemies.html`, with detail pages at
`/data/enemies/{id}.html`. The original `/data/monsters.html` remains the farming
guide, and the two pages link to each other.

## Coverage and use

The [monster name reference by episode and area](MONSTER_NAMES_BY_AREA.md)
lists Chinese, English and Japanese names, with Ultimate names alongside the
Normal–Very Hard names. It covers all 160 catalog records in 12 regional groups;
eight cross-region records appear twice, for 168 table rows. Boss phases and
parts are labeled separately from ordinary enemies. Central Control Area and
Crater retain the catalog's broad area grouping rather than implying a verified
sub-area spawn inventory.

On 2026-09-20 all 223 distinct normal/Ultimate source identifiers matched the
[Ephinea Wiki full monster table](https://wiki.pioneer2.net/w/Monsters/Full_Monster_Table).
The reference also includes Bulk and Death Gunner from the drop list. Checks
found no omitted catalog record, normal/Ultimate name or recorded area, and all
nine monster tests passed, including coverage of every drop row in all four
difficulties. This verifies name coverage, not every quest-specific spawn location.

The 2026-09-14 snapshot contains 160 entries across EP1, EP2 and EP4. A monster is
recorded separately for each episode, area and boss phase, and its Normal through
Very Hard and Ultimate appearances switch within one entry. 158 entries have
stats, for 1,262 difficulty and mode records in total. Bulk and Death Gunner were
added from the drop list without borrowing their parent's stats. Dark Falz's third
phase has no Normal stats and shows as uncatalogued rather than zero.

The catalog supports Chinese, English and Japanese name search, episode, area and
type filters, HP sorting, 24-entry pages, and switching between four difficulties
and multiplayer or single-player mode. Difficulty buttons use the client names:
普通 / 困难 / 极难 / 极限 from the maintained Chinese localization (BB
`unitxt_cs` agrees), ノーマル / ハード / ベリーハード / アルティメット from the
Japanese BB client, and Normal / Hard / Very Hard / Ultimate in English. The
English labels remain the keys for matching Wiki source tables. The query is kept in the URL, and returning
to the list restores the conditions. The interface and names are available in
Chinese, English and Japanese, each prerendered at its own URL. Behaviour notes
are written in all three languages; English fact tables are labeled as source
English. Unverified translations keep the English identifier.

Detail pages include stats, behavior and mechanics, conditional damage tables,
ten-Section-ID rare drops and sources. 141 entries have mechanics notes and
109 have mechanics tables, drawn from notes on 81 source pages and 458 fact tables
on 98 pages. Entries without notes say so explicitly; this is never taken to mean
the monster has no special attacks. Blank or `???` table cells are never converted
to zero.

157 normal and 149 Ultimate appearances have images. 196 Wiki image metadata
records store the original URL, source page, dimensions and SHA-1, and identical
bytes may share a local PNG. EP1 and EP2 appearances of the same monster may reuse
an image, and uncatalogued appearances show a placeholder. None of these are KT
images.

## Data sources and limits

- Stats come primarily from the Ephinea Wiki `Template:FullEnemyTable` and the
  templates it references. `wiki.json` stores 127 source revisions and numeric
  facts, not full articles. Tianhuan
  [EP1](http://pso.ffsky.cn/ep1m1.htm), [EP2](http://pso.ffsky.cn/ep2m1.htm) and
  [EP4](http://pso.ffsky.cn/ep4m1.htm) serve as cross-references; values from
  different versions never overwrite Ephinea's.
- `mechanics.json` stores mechanics fact tables, section anchors, difficulty and
  mode tab context, and source revisions. `notes.json` stores summaries
  verified against the source context, each written in Chinese, English and
  Japanese (`{ zh, en, ja }`); the generator rejects a note missing a language. The extractor expands merged rows and
  columns, keeps short cell notes, and excludes history, strategy lists and
  unrelated embedded master tables.
- Fixed damage must be read with its conditions, for example Chaos Bringer's TP
  drain boost, Gibbles' jump physical hit and follow-up fixed damage, Vol Opt's
  cage, Olga Flow's distance and body-part stacking, Epsilon's element shield and
  Ill Gill's instant death. Technique base damage, resistance reduction, physical
  multipliers and fixed HP loss are never merged into one "fixed damage" number.
- The Wiki's `Normal` can mean either the difficulty or multiplayer mode. The
  generator tells them apart from the surrounding tab group, and the front end
  shows an explicit mode name. Filtering follows the tabs provided by the source
  and verified body-text conditions. Difficulty, area and note conditions listed
  separately in a table are kept, and a table without tabs is never treated as
  specific to the current mode.
- Tables keep the source page name and the full heading hierarchy, including boss
  forms and phases. Difficulty restrictions stated only in body text are recorded
  in `mechanic-conditions.json`, bound to the original revision and section
  anchor. After a source revision changes, they must be re-verified or the build
  fails. The six Megid tables used only on Ultimate currently do not appear on
  lower difficulties; Del Lily's all-difficulty Megid is not given that
  restriction.
- **Rare drops are read directly from upstream `droptable/bb/data/en.js`.** The
  path is resolved from the directory containing `DROPTABLE_I18N_AUTHORITY`,
  defaulting to `../droptable/`. The build parses the upstream JSON data section
  without executing the script, and pages keep no copy of rates or the
  ten-Section-ID mapping. CI pins `warmonipa/dropcharts` at commit
  `8fbbde4fe3a65819067f6037da7a8d6562e8956a`; update that pin whenever upstream
  changes.
- Monsters are linked by episode and verified English aliases, covering every
  upstream monster drop row across all four difficulties. Section ID names, colors
  and order, multiple items in one cell, and rates all come from upstream. Rates
  are the base per-kill DR including DAR, never multiplied again, and exclude event
  or party boosts. A missing DAR is shown as not provided by the source.
- Boss phases and body parts that share the boss drop show a defeat-reward notice.
  21 entries have no linked drop row of their own, which does not prove that no
  related reward exists in the game.
- Chinese and Japanese names of dropped items come from `i18n_names.json`, and the
  links reuse the item catalog's English identity. Monster names are also
  generated into `names.json` from the same authority's `monsters` section by
  `npm run sync:i18n`. Missing Japanese names may be filled from the same Wiki
  monster template names; duplicated and conflicting template names are not used.

## Maintenance

The build does not call the Wiki. It uses the committed snapshots and the drop
table pinned in CI. Routine drop data updates need no changes to the monster
pages:

```sh
npm run sync:i18n
npm test
npm run build
npm run test:e2e
```

To update Wiki stats, export the MediaWiki `action=query` template page array,
including each revision's ID, timestamp and `slots.main.content`, then run:

```sh
node scripts/import_monster_catalog.mjs /path/to/templates.json
node scripts/download_monster_images.mjs /path/to/imageinfo.json
```

The template list is determined by what `Template:FullEnemyTable` references. The
image input is an array of MediaWiki `imageinfo` pages. The downloader verifies
the PNG signature and SHA-1, re-downloads corrupt cache entries, and atomically
replaces the originals and the manifest only after the temporary files pass
verification. For mechanics updates, `scripts/extract_monster_mechanics.mjs` pulls
fact tables from each monster's `action=parse` DOM and writes them back to
`mechanics.json` with the page revision record. Chinese notes and body-text
conditions must be re-read and verified against the source. Network exports stay
in a temporary directory.

`generate_monster_catalog.mjs` generates a lightweight index, server-side details
and `/assets/data/monsters/{id}.json`. These outputs are not committed. Detail
prerendering uses a server loader and TransferState, and browser navigation
requests a single entry on demand instead of bundling every detail into the client.

## Home page RBR

At build time the home page generates quest cards for three episodes from
`current.quests` in `data/rbr/source.json`, and each card opens `/guide/rbr.html`.
Quest names and the rotation week have no copy in the page, so updating the RBR
data and rebuilding also updates the home page. The browser decides whether the
record belongs to the current week by the UTC Sunday. If a new week starts
without an update, the card changes to "pending update" and keeps the recorded
date. Static HTML uses the neutral heading "RBR 任务" (RBR quests).

Cards read the tier and recommended Section ID from `data/rbr/tiers.json`,
sharing that data with the detail page's tier chart. The top border and color dot
use the site's BB drop table Section ID palette. Each card notes the rating date
and that the rating is unofficial. Changes still have to be committed, pushed and
deployed through Pages before they appear in production.

## Verification scope

Data checks cover drop rows and ten-Section-ID cells for every difficulty and
episode, aliases, multiple items per cell, upstream changes, missing stats, empty
source values, mechanics conditions and image references. Browser checks cover
language and filter round trips, rate and item links, mode and difficulty
differences, missing images, phone and desktop overflow, and WCAG A/AA. Home page
checks cover quest data consistency, the detail link and the UTC Sunday
staleness state.

2026-09-14 local verification: `npm test`, the production build, 11 new page
checks and the full **1,376 / 1,376** browser regression passed. The output
contains 1,265 Angular routes and 45 event fragments, with 874,366 / 1,000,000
bytes of gzip JavaScript and no budget increase. Final phone and desktop
screenshots were reviewed. The first page checks found an ambiguous accessible
name on the mode selector and a long image overflowing its box; both were fixed
and boundary assertions were added. A mechanics review also fixed a
difficulty-versus-mode ambiguity on single-axis Normal tabs.

## 2026-09-14 review-fix-loop log

Baseline `d173fec`, with a clean working tree at the start. The scope was the
shipped item and monster catalogs, trilingual support, data and image sources,
ten-Section-ID drops, the home page RBR cards, and two TODO entries. The actual
content of the PB formulas and weapon hearts was still pending and out of scope.
The root `AGENTS.md` was the only applicable repository instruction.

| ID | Severity / status | Root cause and extended scope | Regression and closure evidence |
| --- | --- | --- | --- |
| RF1 | Blocking / Fixed | Monster sections used bare fragments, which the root `base` resolved to the home page. The detail effect always scrolled to the top, conditional navigation lost the fragment, and paging kept the old page's bottom position. RouterLink now keeps the query and section, positioning follows the fragment, and paging scrolls to the first row. The check was extended to every section, direct open and refresh, all three languages, difficulty and mode switches, and list paging. | The old build reproduced a jump to `/#drops`, a directly opened section 1465 px from the viewport top, and a first-entry visibility ratio of 0 after paging. After the fix, 44 catalog and RBR browser checks passed, including section navigation, share and refresh, and paging regressions. |
| RF2 | Blocking / Fixed | Mechanics extraction kept only the tab and the last heading. It missed Ultimate restrictions stated in body text and parent phase headings, and the heading allowlist also dropped Olga Flow's attack trigger threshold table. Six body-text conditions, source pages and full heading hierarchies were added, and the threshold table was restored. The check was extended to all eight Megid tables and every shared boss source. | The old build showed Ultimate Megid on Normal and lacked phases and thresholds. New condition records were checked against the same day's original Wiki revisions, and the values and revisions of the original 457 tables were fully preserved. `npm run test:monsters` (8 tests) and 44 catalog and RBR checks passed, covering the six restrictions plus Del Lily, boss forms and the extractor Usage table, which must not be restricted. |
| RF3 | Should-fix / Fixed | Image downloads wrote straight to the final cache file, so a network interruption left a partial file. Retries only checked that the file existed and exited on every checksum failure, so downloads could never recover. The downloader now validates the cache, re-downloads corrupt files, and atomically replaces files only after the temporary copy passes verification. The change covers every image cache entry and the manifest publication. | `node --test scripts/test_monster_images.mjs` reproduced "Invalid image" on the old script. After the fix, `npm run test:monsters` (8 tests) passed, covering corrupt cache recovery, offline reuse of a valid cache, and error responses that must not replace the original file or manifest. |

After the fixes, data import, generation, routing, shared language state, list and
detail consumers, tests and docs were re-reviewed with no new actionable issues.
Earlier tests only covered tabs and missed applicability conditions from body text
and parent headings; the new regressions cover both source types. All 158 stat
entries and 127 template revisions match the original export one by one, all 196
monster image SHA-1 values match, and the existing mechanics table data is
unchanged.

| User requirement | Implementation and verification evidence |
| --- | --- |
| Complete item list, stats, shop images and image sources | Completeness of the 1,044-entry catalog, images for all 57 shop weapons, original image checksums and 27 item page checks passed. |
| How to obtain rare items | Item detail pages show acquisition notes, Wiki drop conditions and revisions. Data tests check specific rates such as V101. |
| Full trilingual interface | Interface and name switching for items and monsters, query preservation, source-language labels, and phone and desktop overflow and accessibility regressions passed. |
| Monster stats, behavior and conditional mechanics | A 160-entry catalog with 1,262 stat records. RF2 added body-text difficulty restrictions and boss phases, and uncatalogued content keeps an explicit empty state. |
| Ten-Section-ID drops from droptable | Drop rows for every difficulty and episode, color order, per-cell rates, multiple items and item detail links match upstream, and CI uses the same pinned version. |
| Home page RBR and detail link | Home page quests come from `data/rbr/source.json` and open the detail page. The UTC Sunday week-rollover notice regression passed. |
| PB calculation and weapon heart TODOs | `docs/TODO.md` records each scope and the designated Wiki sources without claiming they are implemented. |

This pass re-verified against the Wiki revisions saved that day, without changing
source versions or bulk-refreshing external data. The web browsing tool failed to
connect during this pass, and that failure was not treated as evidence against any
stat or mechanic; the saved full source text and revisions were sufficient to
verify these fixes.

Final local verification: `npm test` passed, including 10 item data checks and 8
monster and image checks. `npm run build` passed with 1,265 routes, 45 event
fragments and 874,665 / 1,000,000 bytes of gzip JavaScript. The focused catalog
and RBR regression passed **44 / 44**, the full `npx playwright test` passed
**1,382 / 1,382**, and `git diff --check` passed. RF1 through RF3 are all Fixed,
and the full re-review found no remaining Blocking or Should-fix issues. Release
status follows the Pages pipeline for the matching commit.

## Same-day full change re-review

The scope was the nine commits in `31a0985..5fd44ce`, plus uncommitted RBR changes
in seven files present when the review started. Data import, generation, routing,
trilingual support, list and detail pages, images, the build and related tests
were re-checked. Three new browser regressions all failed against the pre-fix
build and passed after the fix.

| ID | Severity / status | Root cause and fix scope | Regression evidence |
| --- | --- | --- | --- |
| D1 | Blocking / Fixed | The list and detail pages shared an update method that always cleared the page number, so switching difficulty or mode on a detail page lost the return position. The page number now resets only when list filters change, and detail pages keep the originating page. | Opening a detail from page two of EP1, switching difficulty, mode and Japanese, refreshing and returning lands on the original page, with the section and first entry unchanged; changing list conditions still resets the page. |
| D2 | Blocking / Fixed | The static Chinese route titles of both catalog lists overwrote the component's trilingual title when query navigation finished. Because the language had not changed, the title effect did not run again. Both static titles were removed and the components own the title. | After an English search, and after further condition changes in Japanese, both lists keep the browser title in the selected language, while static prerendering remains Chinese. |

Earlier regressions checked trilingual support and list return separately, but did
not cover the browser title when the language stays the same, or combine later-page
details with difficulty and mode switches. The new regressions cover these
combinations without weakening existing assertions.

Local `npm test`, `python3 scripts/sync_item_i18n.py --check` and the production
build passed. The catalog and RBR suite passed **47 / 47**, and the full
`npm run test:e2e -- --workers=4` passed **1,385 / 1,385**. The build contains 1,265
routes and 45 fragments, with 874,973 / 1,000,000 bytes of gzip JavaScript. The
1,262 stat records of 158 monster entries match the saved snapshot one by one, all
196 monster image checksum records pass, and all 1,044 item detail pages with set
and appearance links are complete. The final re-review found no remaining Blocking
or Should-fix issues.

A byte-for-byte comparison of manifests from repeated builds passed, and
`git diff --check` passed. One build exited abnormally in the destructor of
`ExtendedEnv` in the LMDB 3.5.6 native cache; a macOS report from September 13
already showed the same call stack. Rerunning without product code changes
succeeded and produced a manifest identical to the tested artifact. This existing
toolchain issue may still occur intermittently.

These conclusions rest on the source snapshots saved in the repository and on local
build output. They do not replace new in-game verification or production release
checks. The initial RBR working-tree changes were included in the review and tests,
and this pass's catalog fix commit contains only D1, D2, their regressions and the
review record.

## Second re-review: area search and generated directories

Baseline `5a772d4`, continuing the review of the same day's changes and the seven
uncommitted RBR files. The D1 and D2 regressions still passed, and this pass
confirmed and fixed two issues with distinct root causes.

| ID | Severity / status | Root cause and fix scope | Regression evidence |
| --- | --- | --- | --- |
| D3 | Should-fix / Fixed | Area search indexed only the area names of the current interface language, so switching languages kept the query but lost the results. English, Chinese and Japanese area names are now all indexed, reusing the existing translations and keeping area numbers. | Before the fix, searching 森林 returned 11 entries and switching to English returned 0. The new regression covers 森林, 地下砂漠 and 遺跡 2, keeping result identity and count across all three languages and refreshes. |
| D4 | Should-fix / Fixed | The monster generator overwrote only current entries and never removed JSON for deleted entries, so build output depended on past generation state. After input validation and data preparation, the generator now rebuilds its own monster asset directory. | An isolated fixture generated the full catalog, removed Booma and regenerated. Before the fix `booma.json` remained; after the fix it is deleted and the file list matches the current index exactly. |

Earlier search regressions used monster names and did not cover area translations
combined with language switching, and repeated builds used the same list, which did
not cover deleted entries. Both new regressions reproduced the failure first and
then verified the fix. Re-extracting the snapshot from the 127 saved original Wiki
exports matched the committed monster stats and source records exactly.

Local `npm test` passed, including 10 item checks, 9 monster and image checks and
55 RBR checks, and `python3 scripts/sync_item_i18n.py --check` passed. The focused
catalog and RBR regression passed **48 / 48**, and the full
`npx playwright test --workers=4` passed **1,386 / 1,386**. The production build
contains 1,265 routes and 45 event fragments, with 874,959 / 1,000,000 bytes of
gzip JavaScript. Manifests from repeated builds match byte for byte, and
`git diff --check` passed. The final re-review found no remaining Blocking or
Should-fix issues.

Repeated builds hit the known LMDB native crash again. After inspecting the cache
implementation, `npx ng cache clean` was run and the build then passed. No
dependencies were changed and no product-level workaround was added; the
intermittent toolchain crash remains a known limitation. That pass's commit
`230766c` contains only D3, D4, their regressions and the review record. The seven
RBR files were not yet committed or verified in production at that point; the
later release result follows.

## 2026-09-14 release verification

The seven RBR files were committed and pushed in `548e78e`, covering home page
tiers, recommended Section IDs, colors, shared data and regression tests.
[Pages run 34821846682](https://github.com/ephinea4haven/ephinea4haven.github.io/actions/runs/34821846682)
built and deployed successfully: business tests, two production builds, the
manifest comparison and **1,386 / 1,386** browser tests passed.

After deployment, `https://www.psohaven.com/` was refreshed and the live page and
screenshots were checked. The recorded week is `13 September 2026`. SR1, LDR and
WoL5 all show Tier D, with recommended IDs Pinkal, Bluefull and Pinkal, and the top
border and color dot colors match. The rating note shows `2025-11，非官方`
(2025-11, unofficial). This check confirms page publication and display only; it
did not re-evaluate tiers or change the in-game rotation.

## 高清怪物素材

2026-09-20 首次接入维护者提供的 `ENEMY` 素材，共 **168 张**，覆盖 **131 / 160 个图鉴条目**的普通与 Ultimate 外观。同日接入 `BOSS 补完` 后，当前保留 **171 张**图片，覆盖 **134 / 160 个图鉴条目**。图片按原区域分别保留，EP1 / EP2 中内容相同的图片也使用各自的资源路径，不做跨章节去重。神殿目录附带的 Al Rappy / Pal Rappy 两张图仍完整保留，但 EP2 没有对应条目，不误绑到 Love Rappy 或节日拉比。列表继续使用原 Wiki 缩略图；详情页有高清图时默认显示高清，并提供 Wiki 图片切换、当前图片来源与原图链接。没有高清素材的形态继续显示 Wiki 图片。

- 清单：`content/monster-catalog/hd-gallery.json`，记录原文件名、规范文件名、英文身份、原 PNG 尺寸 / 大小 / SHA-256、WebP 大小 / SHA-256，以及每个条目的普通 / Ultimate 绑定。
- 资源：`assets/img/monsters/hd/<area>/`；首批 `ENEMY` 的 WebP 使用 `cwebp -q 85 -m 6 -resize 1024 0`，保留透明度，不重绘图片。原 PNG 宽度均不小于 1024；Boss 补完的转换工具见下方记录。
- 文件名以 `content/monster-catalog/names.json` 中维护的怪物名称为准，不能用上游素材名称反向改写图鉴名称。修正歇／蝎字误写、旧译名、海底临时文件名，以及 `FROEST` 目录拼写。
- 按画面确认首领形态：Vol Opt 两种难度素材仅绑定 Form 2；Dark Falz 的 Form 1、2、3 与 Olga Flow 的 Form 1、2 分别绑定各自图片。不把本体图自动用于柱子、屏幕、护盾或其他部位。EP4 三只首领的完整本体图用于各自两阶段，不用于 Spinner。
- 高清字段仅写入详情 JSON，不进入列表索引。切换语言或普通难度之间的条件保留图片选择，切换怪物或普通 / Ultimate 外观组时恢复默认高清；加载失败后仍可手动切换 Wiki 图片；失败状态仅属于当前图片，网络恢复后切走再切回可重新加载。

更新流程：先按英文身份、章节和形态核对素材，再同步源文件名与清单，生成 WebP 并更新绑定；执行 `npm run test:monsters`、构建和怪物图鉴浏览器测试。新增图片不得凭中文相似名称自动绑定首领阶段或部位。

### 首批 ENEMY 导入与验收记录（2026-09-20）

- 下载目录修正 21 个文件名，并将 `FROEST` 改为 `FOREST`；168 张 PNG 的内容、大小和尺寸均与导入前清单一致，SHA-256 全量核验通过。源 PNG 不随站点提交。
- 站内保留 168 个独立 WebP 文件，共 17,768,210 字节；131 个条目对应 262 个普通 / Ultimate 图片绑定。29 个未提供高清素材的阶段、部位与召唤物继续沿用已有 Wiki 图片或缺图状态。
- 最终审查修复图片失败状态跨图片切换残留的问题：网络恢复后切走再切回可重试。新增回归覆盖高清 / Wiki 双向切换，以及详情页 / 列表页的难度切换。
- `npm run test:monsters`：10 / 10 通过；`npx playwright test tests/e2e/monster-catalog.spec.mjs --workers=4`：26 / 26 通过，含手机 / 桌面布局与无障碍检查。
- `npm run build`：1,268 条预渲染路由构建成功，发布 JavaScript gzip 为 949,217 / 1,000,000 字节。`node scripts/verify_angular_architecture.mjs` 与 `git diff --check` 通过。
- 独立完整性审计确认 168 个 WebP 均可解码、哈希符合清单；构建产物中的图片及全部 160 份详情 JSON 与本地生成结果一致。

以上为本地验收结果；线上发布时间与部署结果以对应提交的 Pages 工作流为准。

### Boss 图片补完（2026-09-20）

- 从维护者提供的 `BOSS 补完` 导入四张 PNG：新增 Dark Falz (Form 2)、Dark Falz (Form 3)、Olga Flow (Form 1)，并替换 De Rol Le 原高清图。De Rol Le 的 Ultimate 外观继续使用独立的 Dal Ral Lie 图片；三个新增形态分别绑定其普通 / Ultimate 外观，不改变形态的难度和属性数据。
- 源文件保持原样；清单 `original` 记录原文件名，`source` 记录按现有怪物名称生成的规范名称。此次转换使用 Pillow / libwebp 1.6.0，Lanczos 等比缩放至宽 1024、WebP quality 85 / method 6，保留透明度，不重绘。四张 WebP 共 619,332 字节。
- 移除被替换的 De Rol Le 旧 WebP 和清单记录。当前 171 个 WebP 共 18,294,718 字节，134 个条目对应 268 个普通 / Ultimate 绑定；其余 26 个条目沿用 Wiki 图片或缺图状态。
- 本地验收：怪物测试 **10 / 10**、怪物图鉴浏览器测试 **26 / 26** 通过；四个更新页面在 1440 / 390 px 下分别验证高清 / Wiki 切换、难度切换、图片链接及无横向溢出，并检查截图。171 个 WebP 全部可解码且与清单一致，四张原 PNG 的 SHA-256 核验通过。
- 使用本机已有 Node 24.21.0 完成生产构建：1,268 条路由、45 个活动片段，JavaScript gzip 956,216 / 1,000,000 字节。默认 Node 22.18.0 低于当前 Angular CLI 要求，未改动项目依赖或系统 Node。
- 维护者已验收并批准提交、推送至 `master`。本地验收与线上发布分开记录，部署结果以本次提交对应的 Pages 工作流为准。

### 图片修正（2026-09-22）

- 使用维护者提供的两张 1280 × 1280 PNG，替换 Barbarous Wolf 的森林、宇宙船普通外观，以及 Gobooma 的 Ultimate 外观 Barble；新版去除了原图腿后多余的细尾巴。两章节仍使用独立资源路径，旧 WebP 已移除。
- 使用 `cwebp -q 85 -m 6 -resize 1024 0` 转为 1024 × 1024 WebP；清单同步原附件名、规范来源路径、尺寸、字节数、SHA-256 和详情绑定。来源路径位于 `User-provided corrections/2026-09-22/`，按 FOREST / SPACE SHIP 及现有中文名称组织；原 PNG 不随站点提交。
- 当前仍为 171 张 WebP、134 个条目、268 个外观绑定，共 18,252,380 字节。
- 本地怪物测试 10 / 10 通过，三张替换后的成品（含 Silence Claw）已逐张目视核对；生产构建通过，共 1,268 条路由、45 个活动片段。
- 物品 / 怪物高清图相关浏览器测试 7 / 7 通过。
- 维护者已验收并批准提交、推送至 master；线上部署结果以对应 Pages 工作流为准。
