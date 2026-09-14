# 怪物图鉴

入口 `/data/enemies.html`，详情 `/data/enemies/{id}.html`。原 `/data/monsters.html` 保留为周回指南，两者互相链接。

## 收录与使用

2026-09-14 快照包含 160 个条目，覆盖 EP1、EP2、EP4；同种怪物在不同章节、区域和首领阶段分别记录，Normal 至 Very Hard 与 Ultimate 外观在同一条目切换。158 个条目有属性，共 1,262 组难度／模式记录；Bulk、Death Gunner 另从掉落清单补入，没有借用母体属性。Dark Falz 第三阶段没有 Normal 属性，显示未收录而不是 0。

支持中／英／日名称搜索、章节／区域／类型筛选、HP 排序、24 条分页、四难度和多人／单人模式切换。查询保存在 URL，返回列表保留条件。界面与名称支持中英日，沿用道具图鉴的语言偏好；详细机制中文整理和英文事实表分别标明原文语言。未核实译名保留英文标识。

详情包括属性、行为与机制、条件伤害表、十色稀有掉落和来源。141 个条目有中文机制说明，109 个条目有机制表；共整理 81 个来源页面的说明、98 个页面中的 457 张事实表。没有说明的条目明确提示未收录，不据此推断其没有特殊攻击。表格空白或 `???` 不转换为 0。

157 个普通外观、149 个 Ultimate 外观已有图片。196 条 Wiki 图片元数据记录原始 URL、来源页、尺寸和 SHA-1；相同字节可共用本地 PNG。同种 EP1／EP2 外观可以复用图片，未收录外观显示占位；不是 KT 图片。

## 数据来源与边界

- 属性主源为 Ephinea Wiki `Template:FullEnemyTable` 及其引用模板。`wiki.json` 保存 127 份来源修订和数值事实，不保存完整文章。天幻 [EP1](http://pso.ffsky.cn/ep1m1.htm)、[EP2](http://pso.ffsky.cn/ep2m1.htm)、[EP4](http://pso.ffsky.cn/ep4m1.htm) 用作交叉参考；不同版本数值不能混合覆盖 Ephinea。
- `mechanics.json` 保存机制事实表、章节锚点、难度／模式 tab 上下文和来源修订；`notes.json` 保存经来源上下文核对的中文整理。提取器展开行列合并、保留单元格短注，排除历史、策略清单和嵌入的无关总表。
- 固伤必须连同条件阅读，例如 Chaos Bringer 的 TP 吸取强化、Gibbles 起跳物理判定与后续固伤、Vol Opt 囚笼、Olga Flow 距离与部位叠加、Epsilon 属性护罩及 Ill Gill 即死。魔法基础伤害、抗性折减、物理倍率和固定 HP 扣除不合并成一个“固伤”数值。
- Wiki 的 `Normal` 既可能指难度，也可能指多人模式；生成器根据同组 tab 区分，前端显示明确的模式名。只按来源提供的 tab 筛选；表中另列的难度、区域与说明条件继续保留，不能把无 tab 的整表解释成当前模式专属。
- **稀有掉落直接读取上游 `droptable/bb/data/en.js`**。路径由 `DROPTABLE_I18N_AUTHORITY` 所在目录确定，默认 `../droptable/`。构建时解析上游 JSON 数据段，不执行脚本，不在页面维护概率或十色映射副本。CI 已固定 `warmonipa/dropcharts` 提交 `8fbbde4fe3a65819067f6037da7a8d6562e8956a`；更新上游后应同步更新该固定版本。
- 怪物按章节和已核实英文别名关联，覆盖上游全部四难度怪物掉落行。Section ID 名称、颜色、顺序、单格多个物品和概率均来自上游。概率为包含 DAR 的基础每次击杀 DR，不重复相乘，不包含活动／队伍加成。DAR 缺失明确显示来源未填写。
- 首领阶段／部位共用首领掉落时显示击破奖励提示；21 个条目未关联独立掉落行，不能因此断言游戏中没有任何关联奖励。
- 掉落道具中文、日文来自 `i18n_names.json`，链接复用道具图鉴英文身份。怪物名称也通过 `npm run sync:i18n` 从同一权威的 `monsters` 生成 `names.json`。日文缺项可用相同 Wiki 怪物模板名称补充；模板重复且冲突的名称不采用。

## 维护流程

构建不请求 Wiki，使用已提交快照和 CI 固定版本的掉落表。正常更新掉落数据无需修改怪物页面：

```sh
npm run sync:i18n
npm test
npm run build
npm run test:e2e
```

更新 Wiki 属性时，导出 MediaWiki `action=query` 的模板页面数组，包含 `revisions` 的 ID、时间与 `slots.main.content`，然后运行：

```sh
node scripts/import_monster_catalog.mjs /path/to/templates.json
node scripts/download_monster_images.mjs /path/to/imageinfo.json
```

模板清单由 `Template:FullEnemyTable` 引用决定。图片输入为 MediaWiki `imageinfo` 页数组，下载器校验 PNG 签名和 SHA-1。机制更新使用 `scripts/extract_monster_mechanics.mjs` 对每个怪物 `action=parse` 的 DOM 取事实表，与页面修订记录一并写回 `mechanics.json`；中文说明须重新阅读来源核对。网络导出文件留在临时目录。

`generate_monster_catalog.mjs` 生成轻量索引、服务器详情及 `/assets/data/monsters/{id}.json`。这些输出不提交。详情预渲染使用服务器加载器和 TransferState，浏览器导航按需请求单条，不把全部详情打入客户端包。

## 首页 RBR

主页构建时从 `data/rbr/source.json` 的 `current.quests` 生成三个章节的任务卡，点击进入 `/guide/rbr.html`。任务名和轮替周没有页面副本；更新既有 RBR 数据并重建即可同步首页。浏览器按 UTC 周日判断记录是否属于本周，跨周未更新时改为“待更新”并保留记录日期；静态 HTML 使用中性的“RBR 任务”标题。

## 验证范围

数据检查覆盖全部难度／章节的掉落行与十色单元格、别名、单格多物品、上游变更、缺失属性、来源空值、机制条件和图片引用。浏览器检查覆盖三语与筛选往返、概率与道具跳转、模式／难度区别、缺图、手机及桌面溢出和 WCAG A/AA；首页检查任务数据一致性、详情入口和 UTC 周日过期状态。

2026-09-14 本地验证：`npm test`、生产构建、新增 11 项页面检查及完整 **1,376 / 1,376** 浏览器回归通过。产物包含 1,265 个 Angular 路由、45 个活动片段，JavaScript gzip 为 874,366 / 1,000,000 字节，未提高预算。最终手机／桌面截图已检查。首次页面检查发现模式选择的无障碍名称歧义及长图越界，修复后增加边界断言；机制复查另修正单轴 Normal tab 的难度／模式歧义。
