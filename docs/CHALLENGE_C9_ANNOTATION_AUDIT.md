# EP1 C9 标注核对记录

核对日期：2026-09-16。范围：Area 41–45，中、英、日三版。
这次验收同时检查操作信息和地图轮廓；路线覆盖率不能代替标注完整性。

## 来源及可用性

| 来源 | 本次实际使用的材料 | 用途与限制 |
| --- | --- | --- |
| [PSO World C9](https://www.pso-world.com/sections.php?artid=296&op=viewarticle) | 仓库 `assets/img/challenge/ep1/original/area_41.png` 至 `area_45.png`；搜索索引保留的 Stage 9 Level Maps 正文 | 底图、路线、编号说明。原站本次无法正常读取；不是实时抓取成功的网页。搜索索引标注抓取于约五个月前。 |
| [Sakura](https://www.ne.jp/asahi/mihara/sakura/pso/capture/challenge_mode/index.html) | 仓库 `assets/img/challenge/ep1/area_41.gif` 至 `area_45.gif`，逐图放大阅读 | 日文局部说明、机关顺序、职业分工、补给与危险标记。 |
| [PSO Palace C9](https://psopalace.sylverant.net/cmode_stage9.html) | 本次可读的逐区域文字攻略 | 交叉检查操作顺序与陷阱种类。它面向旧 DC/PC，不能把特定版本的伤害、跨平台崩溃说明直接套到 BB。 |
| [Ephinea Wiki C9，修订 43050](https://wiki.pioneer2.net/index.php?title=Episode_1:_Stage_9/Guide&oldid=43050) | BB 固定箱子列表 | 确认 Area 43 的两件四孔铠甲。各区 Walkthrough 仍是 Placeholder，不能视为路线验证。 |
| [Miranda Challenge Mode Guide](https://gamefaqs.gamespot.com/dreamcast/472540-phantasy-star-online-ver-2/faqs/15063) | 2001 年 DC V2 攻略 | 查阅作背景参考；明确引用 Sakura，不计作另一份独立地图佐证。 |

PSO World 的可访问性另有[社区停站讨论](https://www.reddit.com/r/PSO/comments/1tmdj7d/something_wrong_with_psoworld/)：自称前版主的用户称，恶意跳转出现后 Ryna 将网站下线。未找到永久关闭公告。此讨论仅解释来源可用性，不作为游戏机制依据。

## 逐处对应

下表 ID 对应 `content/challenge-maps/ep1.json` 的 `callouts[].id`，也对应生成 SVG 的 `data-callout`。所有 31 条均有三种语言的可见文字和指向线；关键数量、顺序另画在机关图标中。

| Area | 信息 | 来源 | 新图对应 |
| --- | --- | --- | --- |
| 41 | 双机关先触发、清炮台，再留人踩住 | Sakura 炮台图标；Palace 流程 | `shooting-traps` |
| 41 | FO 放玛古开灯，清场后回收 | Sakura；PSO World；Palace | `mag-light` |
| 41 | 末端侧室箱子没有陷阱 | Sakura | `safe-boxes` |
| 42 | 限时机关之前先破坏两处钟形陷阱 | Sakura「釣鐘トラップ」；Palace 的 two Jar Traps | `timed-switch-traps`；两个 `jar-trap` |
| 42 | 围栏内箱子可跳过；取时先在外面射开箱子，入内会触发炮台 | PSO World；Sakura 图标；Palace | `cage-box-traps` |
| 42 | 两组传送后都只踩面对方向左侧机关 | Sakura；PSO World；Palace | `left-switch-only` |
| 43 | 中央机关触发四个火球炮台，先清除再留人踩住 | PSO World 数量；Sakura、Palace 操作 | `shooting-traps` |
| 43 | 开关 1→4；第三个完成后留守者先到门边，再踩第四个 | Sakura 数字；PSO World、Palace 撤离时机 | `fourth-switch-retreat`；四个圆形机关内的 `step` |
| 43 | 岩石藏着照明机关 | Sakura；Palace | `rock-hidden-light` |
| 43 | 左侧玛古机关开灯但会触发炮台，放下即移开 | Sakura；Palace | `mag-pad-trap`；脚注保留回收玛古 |
| 43 | 首房照明机关藏在岩后 | Sakura；Palace | `first-room-light` |
| 43 | 枪击墙上照明机关 | Sakura；Palace | `shoot-light-switch` |
| 43 | 固定补给：两件四孔铠甲 | Sakura；Ephinea Wiki 的 Solid Frame 4S ×2 | `fixed-armor-boxes` |
| 43 | 出口侧箱子有陷阱／炮台 | Sakura | `exit-box-traps`；箱子及炮台图标 |
| 44 | 中央留一人，另外三人分路 | Sakura；PSO World；Palace | `hold-central-pad` |
| 44 | 西路由 Ranger 清炮台，再破岩推进 | Sakura；PSO World 的持枪角色建议 | `west-shooting-traps` |
| 44 | 东路清敌由两名 Hunter 处理 | Sakura；Palace | `east-two-hunters` |
| 44 | 面对门只踩右侧机关，忽略错误音；另一侧关灯 | Sakura；PSO World | `right-switch-only` |
| 44 | 中央台箱子可跳过，取箱需清北侧区域 | Sakura；PSO World | `skip-platform-boxes`；脚注 3 |
| 44 | 岩后箱子附近有天花陷阱 | PSO World；Sakura 褐色陷阱图标 | `ceiling-traps`；区别于西路炮台的钟形图标 |
| 45 | 双机关使上一暗房出现落雷陷阱 | Palace | `two-switch-traps` |
| 45 | 每个装备机关 4 件；合计武器 8、盾牌 8，余量不足走常规路 | Sakura 的四个数量图标；PSO World 总量 | `equipment-shortcut`；四个机关的 `count: 4`；脚注保留火球陷阱 |
| 45 | 两处墙上机关不射击 | Sakura 的两个叉号 | `do-not-shoot-wall`；两个禁止射击标记 |
| 45 | 门上方机关不射击 | Sakura | `do-not-shoot-overhead`；禁止射击标记 |
| 45 | 机关房只踩入口一侧 | Sakura | `near-switch-only` |
| 45 | 最后房间北侧箱子安全 | Sakura | `safe-north-boxes` |
| 45 | 最后房间南侧箱子安全 | Sakura | `safe-south-boxes` |
| 45 | 有余裕时 FO 使用治疗点 | Sakura；Palace | `optional-force-heal` |
| 45 | 上方照明位置 | Sakura | `upper-light` |
| 45 | 分一人往左开灯 | Sakura 照明位置；Palace 分工 | `lower-light` |
| 45 | 破岩继续走 | Sakura | `break-rocks` |

其他保留的信息：41 中央四个射击机关、传送与回收支线、长廊危险；42 三人／一人分工和会合路线；43 双人门与传送链；44 西路完成后支援东路；45 走廊钟形陷阱、上方房间危险标记、双人机关及 Boss 方向。它们分别由图标、路线和编号脚注表达。

## 纠正与证据边界

- Area 42 的「釣鐘トラップ」此前被误归为射击陷阱。现以独立 `jar-trap` 图标和中英日图例表达；44、45 的同类褐色图标也一并区别于炮台。「钟形陷阱」是外观描述；机制身份为 Jar Trap，不是声称已查到客户端专名。
- 43 的顺序数字在圆形机关内；橙色方块仍是脚注编号，粉色三角仍是传送编号。三者不能混用。
- 地图沿用 PSO World 轮廓和颜色；Sakura 的标记按房间连接关系定位。它们是攻略示意位置，不是从 BB 任务数据提取的实体坐标。炮台图标代表该处危险，除正文明确给数量外，不代表实体数量。
- PSO World 用 Foie/Zonde 描述部分陷阱，Palace 有 Gibarta/Gizonde 的更细说法。当前采用双方一致的操作建议和火球／落雷描述，不将旧版的法术等级差异认定为 BB 实测结论。
- 不引入旧 DC/PC 跨平台 FSOD、Boss 固定伤害／HP 阈值或具体 TA 冒险阈值。本次也没有做 BB 游戏内逐机关实测。
- 承认来源之间可能复用地图。四个主要来源承担不同核对职责，不等于每条信息都有四份独立证据。

### 收尾核验

- 42 的两处错误地板机关、44 的消灯机关、45 的远端机关补上方框叉号，并以“不要踩”单独列入图例；圆框叉号仍专指“不要射击”。坐标依据 Sakura 房间拓扑对应到 PSO World 底图，仍属示意位置。
- 42 可选箱区的说明明确为传送进入。删除原先穿入箱区的步行虚线：现有原图没有足以确定该未编号传送两端位置的信息，因此不编造第五组传送点。箱子、陷阱、限时开关和取箱操作提示全部保留。
- 补齐三语细节一致性：43 中央四个火球炮台、44 中央台箱子需清北侧区域。

本次完成的是资料驱动的五张地图重绘及标注校对；BB 游戏内逐机关实测和 Area 46 Boss 行为验证不在这次完成声明中。

## 验证方式

- 固定 31 条局部提示清单，检查来源、三语文本、有效锚点和生成 SVG 中的可见文字，避免仅把说明留在不可见的描述标签中。
- 单独检查 43 的 1→4 位置、45 四个每组 4 件的机关、三处禁止射击标记和钟形陷阱分类。
- 检查三语标注框互不覆盖、文字不溢出、标注框不盖住底图；人工复核图标、引线和脚注。
- 已接受底图文件 SHA-256 保持 `0d7d4345b91f4d0f6371f967f7feaf012137ca7b1c8fe58ab3631440cbff0dca`。路线与底图测试继续独立运行。

收尾验证结果：13 项地图单元测试通过；地图资产清单验证通过；15 张 C9 SVG 的 Chromium 标注遮挡／溢出检查通过；站点构建通过，构建产物中的 15 张 SVG 与源输出逐字节一致。挑战地图语言记忆、手机布局以及新增的 C9 五区域三语加载浏览器检查均通过。C9 测试首次误用了“中文／日本語”按钮名，按页面实际“中／日”修正后重跑通过。维护者随后接受 C9 作为其他关卡的对齐标准，并于 2026-09-16 在整体复审 PASS 后授权提交推送挑战模式相关内容；详见[最终验收记录](CHALLENGE_MAP_REDRAW.md#acceptance-and-review-2026-09-16)。发布状态以对应提交的 Pages 工作流为准。
