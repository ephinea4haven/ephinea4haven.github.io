# 机制页图文与复审证据记录

日期：2026-09-15。记录 `tools/mechanics.html` 的图文变更、机制证据、验证结果与已关闭的复审问题。部署流程见[发布手册](DEPLOYMENT.md#september-15-2026-mechanics-illustrations)。

## C / E 初次图解的核对对象

- `../bb-psov4/clients/ephinea/psobb.exe`
- SHA-256：`f4d4bd463c07fec2542452735deb5237641634100d9223d2d0f0ae4000315cc0`
- 反编译参考：`../bb-psov4/ref/original-psobb-client-source/src/Psobb.exe-05112026.c`
- 本次使用 pefile 读取 PE 映射与常量，使用 Capstone 解码该 EXE 的实际 x86 指令；未修改参考仓库。

## E：严格大于 25%，比较先于整数截断

函数 `try_knockdown_player`，VA `0x0077529c`：

```asm
0077529f movsx edx, word ptr [ecx + 0x2bc]
007752a6 mov dword ptr [esp], edx
007752a9 fild dword ptr [esp]
007752ac fmul dword ptr [0x97822c]
007752b2 fcomp dword ptr [esp + 0xc]
007752b6 fnstsw ax
007752b8 sahf
007752b9 jae 0x7752d2
007752bb mov edx, dword ptr [ecx + 0x30]
007752be or edx, 0x400
007752c4 mov dword ptr [ecx + 0x30], edx
```

`0x0097822c` 的 float32 实值为 `0.25`。`jae` 在阈值大于或等于传入伤害时跳过置位，所以只有 `damage > max_hp * 0.25` 才设置 `0x400`。

物理伤害路径在 `0x007738d6` 调用该函数，随后才执行 FPU 控制字 `OR 0xc00` 与 `fistp` 进行向零截断。反编译对应 747691 行先调用 `try_knockdown_player(local_14)`，再截断并调用 `deal_damage`。因此图解明确使用“截断前的内部伤害”，例子为最大 HP 1,000、内部伤害 240 / 250 / 260。250.5 会越过阈值而整数扣血仍为 250。

状态消费者 `HandlePostEvadeDamageCheck_0069f408` 检查 `took_damage` 和 `0x400`，分别转入 light / heavy 受击状态。该证据只描述通用伤害阈值，不代表每个攻击都必然经过它，也不证明当前在线客户端没有运行时补丁。

### 与 Wiki 的差异

2026-09-15 读取的 [Ephinea Wiki / Game mechanics / Knockdown](https://wiki.pioneer2.net/w/Game_mechanics#Knockdown) 写为“25% or more”。本地逆向仓库的 `_wiki_combat_formulas.md` 重复此说法；`_wiki_TODO.md` B.3 仍未勾选；`COVERAGE.md` 的轻重受击笔记则写为 `≤25%` / `>25%`。不能把 Wiki 摘录当作独立 RE 结论，本次按精确 EXE 指令说明严格边界，并在页面展开说明中注明差异和版本限制。

## C：动作图与实测公式的证据边界

- 保留原页 [SLW 实测视频](https://www.youtube.com/watch?v=J2FgRRGCQEM) 对回避、Guard 动作差异及命中率近似关系的归因。
- 本次没有重新观看并逐帧验证该视频，也没有完整追踪玩家的所有命中/零伤害消费者；图解不新增“客户端反编译证明敌人命中率公式”的断言。
- 图中人形、弹开轨迹、位移箭头与 HP 条为解释性示意，不是实机截图，不表达精确位移距离或硬直时长。
- 只说明普通、可回避的物理攻击；保留正文固定伤害等例外提示。

## 变更范围

- C：判定分支、三种结果、前后位置对照、跳转 E 的链接。
- E：内部伤害标尺、严格边界、截断说明、来源展开说明。
- A / B / D / F / G / H 的公式与物品身份保持不变。
- 320 px 浏览器检查发现 D 节职业增幅表会撑宽整页；加入可键盘聚焦的局部横向滚动容器，表内数据未改动。
- 图解使用语义 HTML、装饰性内联 SVG 和页面专用 CSS；跳转与来源展开使用原生链接及 details，无新增依赖或 JavaScript 运行时。

## 本地验证结果

- `npm run sync:i18n` 已执行，生成文件内容无额外差异；`npm run test:i18n` 通过 8 项。
- `npm run build` 通过：1,265 个 Angular 预渲染路由、45 个活动片段；最终 JavaScript gzip 882,022 / 1,000,000 bytes。
- `npm run test:e2e -- --grep 'mechanics authored item references|mechanics diagrams remain readable|authored item names stay aligned across guides and tools' --workers=1` 通过 3 项，包含原有跨页面物品校验。
- `node scripts/verify_zh_localization.mjs`、`node scripts/verify_angular_architecture.mjs` 与 `git diff --check` 通过。
- parse5 检查无解析错误、无重复 ID，页内链接与 aria-labelledby 指向存在的 ID；15 种物品身份（共 17 处引用）保持一致。F–H 除物品引用键大小写外，正文未改动。
- Chrome 桌面截图检查：流程连线、三幅动作对照与阈值标尺均已查看；C 到 E 的链接及来源 details 展开已操作确认。
- 320 / 390 / 760 / 761 / 1,024 / 1,440 px 自动检查通过；桌面及 390 / 320 px 截图已人工查看。图解与整页无横向溢出，职业增幅表在自身容器内横向滚动。
- 图解、来源说明及表格滚动区域的 WCAG A/AA 自动扫描通过；键盘跳转与展开操作通过。
- 浏览器采集到的 error / warn 日志为空。
- 本地预览运行时入口：`http://127.0.0.1:4173/tools/mechanics.html#incoming-physical`，E 节锚点为 `#knockdown`。

## Review-fix-loop 记录

复审发现：原先的“引用保持一致”检查只能证明图文修改未改变原引用，不能证明这些引用符合权威键。`f1dff12` 引入的 6 个属性使用了 5 种非权威大小写，浏览器的宽松查找仍能显示中文，导致该问题未被先前的展示检查发现。现将本页属性统一为 `OROTIAGITO`（2 处）、`FOIE MERGE`、`DOUBLE CANNON`、`LAVIS BLADE`、`GAL WIND`；语义身份、中文译名、公式和数值保持不变。

新增 `tests/e2e/mechanics.spec.mjs`：在页面渲染与大小写归一化之前使用 parse5 检查源文件中的每个物品键。修复前明确失败并列出全部 6 项，修复后通过；另验证 6 个视口宽度、键盘跳转与来源展开、图解范围的 WCAG A/AA。原有跨页面物品 E2E 保留，未放宽断言。

| ID | 级别 / 状态 | 根因与检查范围 | 修复与关闭证据 |
| --- | --- | --- | --- |
| M-01 | Should-fix / Fixed | 显示层的大小写归一化掩盖源文件的非权威键。按原有跨页面测试解析全部受测页面的物品属性，6 处缺失精确键均位于 mechanics.html。 | 修正全部 6 处，新增源文件精确键测试；修复前列出 6 项失败，修复后通过。原有跨页面测试由失败转为通过，未放宽断言；同步、8 项单元测试、3 项定向 E2E、构建及完整性检查通过。 |

最终完整差异复审未发现其他可操作问题，无剩余 Blocking 或 Should-fix。结论：**PASS**。

## 验证边界

- 本次本地验证未运行全站完整测试集；完整发布门禁由对应提交的 Pages 工作流执行，发布状态以该次 build / deploy 结果为准。
- C 节引用的实测未重新复现；E 节只核对上述固定客户端快照，未验证当前在线运行时。页面正文与来源展开说明保留这些边界。

## 2026-09-15 PB 整合复审台账

范围：`8b235b2..141d070` 的机制页图解、PB 集中整理、玛古／缩写表入口、样式、测试与文档；同时落实用户新指示：本地完成后等待验收，未经明确同意不推送或部署。
本节记录复审证据，PB 公式正文仍只维护在 `tools/mechanics.html#photon-blast`。
当前状态：2026-09-15 用户已验收并授权提交、推送，见[用户验收与提交授权](#用户验收与提交授权)。以下各轮的待验收描述保留为当时的过程记录。

### 第 1 轮：审查与复现

- 完整差异、Angular 内容生成和相关入口已检查。依据 Ephinea Wiki 的 Game mechanics、Photon Blasts、Mags 页面核对新增公式、输入参数和适用范围；单独重算图中数值，未发现公式或算例错误。
- parse5 检查机制页、玛古页和缩写表：无解析错误、重复 ID、悬空页内链接或 aria-labelledby。
- 原有机制页测试通过 2 项；临时探针在加载后移除所有 PB 图标，原有测试仍通过 2 项，确认存在漏检。

| ID | 级别 / 状态 | 根因与影响范围 | 回归覆盖与关闭证据 |
| --- | --- | --- | --- |
| PB-R01 | Should-fix / Fixed | 图标和章节检查遍历当前 DOM；节点消失时循环不执行，图标错配时也只检查图片能加载。影响六种 PB 图标、四连图标顺序及八个章节入口。已有跨页入口只做过一次人工验证。 | 固定必需图标／章节集合，验证名称与图标配对、连锁顺序以及玛古／缩写页的三个入口与返回。机制页测试通过 3 项；临时缺图、错图、缺章节三个探针分别被新断言拦截。 |
| PB-R02 | Should-fix / Fixed | 介绍区为排版使用顶层 header，与 page-chrome 的 header 一起暴露两个无名称区分的 banner 地标。原 WCAG 标签与局部选择器没有检查全页地标唯一性。影响页头与介绍区的辅助阅读器导航。 | 全页 Axe landmark-unique 探针已复现；介绍容器改为 div，新增 banner 数量和全页地标唯一性检查。最终 9 项定向 E2E 全部通过，包含该回归。 |
| PB-R03 | Blocking / Fixed | 将用户要求的逐技能分析误缩为公式与参数整理；六张 PB 卡片只有简短效果和公式，缺少各自的使用场景、限制、属性差异与连锁定位。原验收只覆盖公式／图标，遗漏内容完整性。 | 六种 PB 各有作用方式、参数影响、使用分析、连锁定位、原有图标及新增 SVG 示意图；技能分析前置，新增六个直达入口与同条件伤害比较。新回归在旧页面因缺少六个分析入口失败；实施后验证六种技能的效果、属性差异、关键限制、图文关联及键盘跳转，通过。 |

用户工作流调整单独处理：AGENTS.md 改为本地验证后等待验收。本轮不提交、不推送、不部署。

### 第 2 轮：修复后复审

PB-R01 的回归测试最初误写了无空格的链接可访问名称；根据浏览器 accessibility snapshot 修正测试定位器后，3 项正式测试通过。这是测试工具问题，未修改产品来迎合错误断言。
随后三个故障探针分别确认缺失图标、错误图标和缺失章节均失败；新增全页地标检查发现 PB-R02，继续修复，不将此中间状态作为完成结论。

### 第 3 轮：按逐技能分析要求补齐并收敛

- 用户指出“每个 PB 技能的分析”仍缺失；将此遗漏记为 PB-R03，并明确承认先前把范围误缩为公式汇总。新增 `each PB explains its role, stat scaling and limits beside its illustration`，在旧构建上复现失败：应有 6 个技能分析入口，实际 0 个。
- 依据 [Ephinea Photon Blasts](https://wiki.pioneer2.net/w/Photon_Blasts) 的效果描述与公式逐个整理六种技能。正文明确区分来源事实与推导建议；示意图不声称具体距离、精确范围或目标选择规则。
- 独立重算四种攻击的同条件算例，基础威力及最终伤害均与正文一致。六种 PB 仍各只有一张主卡片，攻击／恢复／辅助公式随各自分析维护；玛古页和缩写表继续指向机制页，不复制攻略。
- 检查完整本地差异及关联入口。视觉复审将双子图原先分别写在不同玩家下的 ATP／DFP 标签统一为每人“攻防 ↑”，避免误解为不同玩家只获得其中一种加成；更新构建后重新截图、检查并通过同一组 9 项测试。

最终验证：

```sh
rtk npm run build
rtk npm run test:e2e -- --grep 'mechanics authored|mechanics diagrams|each PB explains|Mag and acronym PB|/(tools/(mechanics|mag)|guide/acronym)\.html prerendered|authored item names stay aligned|Angular protocol, Vol Opt, and Mag controls'
rtk node scripts/verify_zh_localization.mjs
rtk node scripts/verify_angular_architecture.mjs
rtk git diff --check
```

- 构建成功：1,265 个预渲染路由、45 个活动片段；JavaScript gzip 为 894,263 / 1,000,000 字节。
- 定向 E2E：9 项通过；包含 320、390、760、761、1,024、1,440 px 页面／图卡无横向溢出、必需图标配对与加载、全部章节和技能键盘跳转、三个跨页入口与返回、局部 WCAG 检查、全页地标唯一性及相关 Angular 交互。
- 中文一致性与 105 个 HTML 源文件的 Angular 归属检查通过。parse5 检查三个关联页面，无解析错误、重复 ID 或悬空链接／aria-labelledby。
- 人工查看本地截图：`/tmp/pb-skills-desktop.png`、`/tmp/pb-support-desktop.png`、`/tmp/pb-estlla-mobile.png`、`/tmp/pb-twins-mobile.png`、`/tmp/pb-comparison-desktop.png`。技能图标、示意图、说明与公式均可读；手机端按单列排列。

本轮无剩余 Blocking 或 Should-fix，结论：**PASS**。本轮为本地内容与展示验证，未执行全站 release:prepare，未声称对线上客户端实测。更改未提交、未推送、未部署；用户验收仍为后续发布前提。

### 第 4 轮：Wiki 规则与算例校准（用户追加要求）

本轮按用户“校准对齐”要求重新核对 PB 全节及玛古／缩写表入口。来源为 Ephinea Wiki `Photon Blasts`（页面引用修订 41842）、`Game mechanics#Special attacks`；玛古自动触发与 PB 施放的等级概念另核对 `Mags#Trigger types`。

| ID | 级别 / 状态 | 根因与影响范围 | 回归覆盖与关闭证据 |
| --- | --- | --- | --- |
| PB-R04 | Should-fix / Fixed | 规则被压缩且只给宽泛来源：没有说明相邻重复时被覆盖者失去连锁收益；双子等级算例未就近标明推导性质，缺少捐赠参与者数量与有效 PB 数的对照；PB 积累末句将特殊攻击限制引向未写此限制的 Photon Blasts 页面。影响双子卡片、参数表、连锁／捐赠段和 PB 积累来源。 | 已补齐覆盖后果、同房间／时机条件及精确原文链接，明确 Shifta／Deband 等级含义，增加捐赠与连锁的条件化算例回归。旧页面缺失覆盖后果时失败；最终 10 项定向 E2E 通过。公式逐项复算，未发现数值错误。 |

本轮回归最初因新增的可访问名称尚不存在而失败；改为定位既有连锁列表后，旧页面明确在“被覆盖的玩家不会获得该次连锁收益”断言失败，确认覆盖的是内容缺失。首次修正后 10 项通过。人工截图复审发现手机端等级列默认需横向滚动，继续将本表改为窄屏四列完整展示，并将回归改为检查 320／390 px 所有列与文字均可见。

| ID | 级别 / 状态 | 根因与影响范围 | 回归覆盖与关闭证据 |
| --- | --- | --- | --- |
| PB-R05 | Should-fix / Fixed | 新增手机表格规则的选择器优先级低于全站 `.content-container table th/td`，实际仍保留左右各 15 px 内边距，导致固定列宽下的 Q 与等级文字超出单元格。影响该表在窄屏的表头与数据单元格。 | 320 px 单元格内容尺寸断言复现；浏览器计算样式确认为 `12px 15px`，Q 列宽 36 px、所需 41 px。将规则限定到机制页、提高选择器优先级后，320／390 px 所有表头与单元格尺寸断言及截图验证通过，无需横向滚动即可同时读取四列。 |

最终重建与复审：

```sh
rtk npm run build
rtk npm run test:e2e -- --grep 'mechanics authored|mechanics diagrams|each PB explains|PB donation rules|Mag and acronym PB|/(tools/(mechanics|mag)|guide/acronym)\.html prerendered|authored item names stay aligned|Angular protocol, Vol Opt, and Mag controls'
rtk node scripts/verify_zh_localization.mjs
rtk node scripts/verify_angular_architecture.mjs
rtk git diff --check
```

- 构建成功：1,265 路由、45 活动片段，JavaScript gzip 为 895,760 / 1,000,000 字节。最终 10 项定向 E2E 通过；中文检查、105 个 HTML 源文件归属检查及差异检查通过。
- 三个关联页面的 parse5 解析、ID 唯一性、页内链接和 aria-labelledby 完整性通过。通过独立代数化简复算新增等级表，六个场景与页面数值一致。
- 查看 `test-results/mechanics-PB-donation-rule-81698--facts-from-worked-examples/` 下的 `pb-levels-desktop.png`、`pb-levels-mobile-320.png`、`pb-levels-mobile-390.png`：桌面和两种手机宽度均可同时读取方式、Q、N、等级，文字无重叠或裁切。
- 最终复审覆盖六种 PB 原有卡片、参数口径、伤害／恢复／辅助公式、捐赠／连锁规则、新增等级表及关联入口，未发现剩余 Blocking 或 Should-fix；本轮结论 **PASS**。
- 本轮仅在机制页维护 PB 正文；文档记录来源与验收状态。按 Wiki 整理并推算的性质已在正文注明，未做游戏客户端实测或全站 release:prepare。全部改动继续保留在本地，未提交、未推送、未部署，等待用户验收。

### 第 5 轮：用户再次调用 review-fix-loop

- 重新审查全部 7 个本地改动文件；暂存区无改动。检查关联的玛古／缩写表入口、HTML 到 Angular 的正文及 URL／样式生成、页面页头、路由配置与测试选择器，未发现新的可操作问题。
- 重新读取 Ephinea Wiki Photon Blasts，逐项核对六种效果、首发参数、截断公式、Q／N、捐赠／覆盖规则及双子复活限制。独立复算攻击对比、Pilla 单发／捐赠／四连和六个双子等级场景，页面数值一致。规则、推导建议和未实测边界仍分别明确标注。
- PB-R01 至 PB-R05 均维持 Fixed：必需图标与名称匹配、唯一 banner、六种独立分析、规则出处和捐赠等级对照、手机单元格内容尺寸均通过现有回归。本轮没有新增缺陷，因此只追加复审记录。
- 重新执行第 4 轮列出的完整验证命令：构建成功（1,265 路由、45 片段、JavaScript gzip 895,760 / 1,000,000 字节），10 项定向 E2E 全部通过，中文／105 个 HTML 归属／差异检查通过。再次以 parse5 检查三个关联页面，无解析错误、重复 ID 或悬空页内／aria-labelledby 引用。
- 人工查看本轮重新生成的 `pb-levels-desktop.png`、`pb-levels-mobile-320.png`、`pb-levels-mobile-390.png`，四列及文字完整可读。外部引用检查基于 Wiki 正文与页面链接地址；未把外站可用性或游戏客户端实测纳入本地 E2E。
- 最终完整复审无剩余 Blocking 或 Should-fix，结论 **PASS**。本次验证仍为机制页及关联模块范围，未运行全站 release:prepare；所有改动未提交、未推送、未部署，发布前仍须用户验收。

### 用户验收与提交授权

- 2026-09-15，用户在图文资源确认及第 5 轮复审后明确要求“对齐文档，提交推送”，本次机制页改动已获验收与提交、推送授权。
- 本次交付包含六种 PB 的图标、技能示意与独立分析，伤害／恢复／辅助等级参数，Wiki 规则校准、捐赠等级对照和手机显示修复，以及对应回归测试。PB 正文只在机制页维护。
- 文档已将该项从待验收移至完成，并保持后续工作须先验收再推送的仓库规则。本次验收后仅更新文档状态，产品验证沿用第 5 轮通过的构建、10 项定向 E2E、中文与架构检查；未扩展为全站 release:prepare 或客户端实测结论。
- 按此版本直接提交至 `master` 并推送 `origin/master`；Git 提交记录对应本次交付，实际部署状态以该提交的 Pages 工作流结果为准。
