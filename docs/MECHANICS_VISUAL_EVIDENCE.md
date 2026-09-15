# C / E 图解证据记录

日期：2026-09-15。记录 `tools/mechanics.html` 的图文变更、机制证据、验证结果与已关闭的复审问题。部署流程见[发布手册](DEPLOYMENT.md#september-15-2026-mechanics-illustrations)。

## 核对对象

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
