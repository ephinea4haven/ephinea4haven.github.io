# Destiny PSOBB 掉落表与物品数据

初始采集：2026-09-28；删除后恢复与部分来源重新采集：2026-09-29。独立本地预览沿用 **dropcharts** 的样式与控件。

## 打开预览

当前预览：<http://127.0.0.1:18770/destiny/>

若服务已关闭，从 `ephinea4haven.github.io` 根目录运行：

```sh
rtk node scripts/serve_site.mjs artifacts/destiny/dropcharts 18770
```

支持四个难度、Episode 1/2/4、十个 Section ID、物品/怪物搜索与分数/百分比切换。
物品名称保留官网英文。这是仓库内的 Destiny 研究预览，未接入站点的 `_site/` 输出或公开导航；提交与推送本目录不等于部署网站。
仓库跟踪源代码、规范化数据、来源哈希和可直接通过上述命令查看的预览包。网页原始采集文件、客户端二进制、
解包资源及实验渲染缓存仅保留在本地并受 Git 忽略；全量重新渲染需要这些本地原始资源，
已有预览无需它们即可通过本地 HTTP 服务查看。
已审批的固定帧粒子 JSON、渲染 sidecar 和哈希清单属于版本化来源证据；不属于丢弃的实验缓存。
来源记录保留采集机器的绝对路径。全量重渲染及 `verify-effect-sources.mjs` 依赖清单/脚本所记录的本地路径与工具环境，
尚不是可跨机器直接运行的资源构建流程；可移植范围是已提交的预览及其 15 项测试。

## 数据文件

| 文件 | 内容 |
| --- | --- |
| [drops.json](drops.json) | 官网全部 12 张掉落表，494 行、4,940 格 |
| [database.json](database.json) | 官网物品数据库 1,022 条：武器 490、护甲 111、盾牌 207、插件 132、Mag 82 |
| [catalog.json](catalog.json) | 掉落物品与官网条目、客户端名称及 PMT 的候选关联；保留关联状态 |
| [coverage.json](coverage.json) | 身份歧义、缺失名称、参数差异与来源覆盖统计 |
| [validation.json](validation.json) | 掉落源文件哈希、12 表结构检查与缺失概率统计 |
| [pmt/records.json](pmt/records.json) | 抓包 PMT 的 1,756 条原始参数记录 |
| [resources/inventory.json](resources/inventory.json) | 本地 ItemKT、模型、纹理、Unitxt 等来源清单与哈希 |
| [resources/README.md](resources/README.md) | 客户端名称对齐证据与素材映射限制 |

## 来源与解释范围

- 掉落来源：<https://playpso.net/drop-tables>，页面的四个难度均已保存于本地忽略的 `source/`。
- 物品来源：<https://playpso.net/database> 的 Weapons、Armor、Shields、Units、Mags 五类。
  数据库使用虚拟滚动；按重叠窗口采集实际 DOM 行，逐窗口验证重叠内容一致，直到表尾。
  同名不同描述的物品保留为不同记录。`source/database-*-rows.html` 是当时本地归档入口保存的
  JSON 文本，实际格式由内容确定；规范化输出为 `database.json`。
- PMT 来自 `psobb-sniffers/data/captures/param_dumps_destiny/ItemPMT.prs`，文件修改时间为
  2026-08-05。通过 BB V4 小端结构检查、现有双解析器的 13 项检查，以及 newserv 解压哈希比对。
  文件修改时间不等同于已证明的服务器版本日期。
- 客户端资源来自 `C:\Program Files\PSOBB Destiny\data`，未修改客户端。
  ItemKT、模型和纹理档案均已找到，但尚未证明每件 Destiny 自定义物品与素材条目的映射，
  因此预览只使用有资源关联证据的 Destiny 图片，不使用其他服务器的同名物品图片。
- 本地 Unitxt 与抓包 PMT 的名称编号并非全局一致；不能把 `PMT id` 无条件当成当前名称索引。
  关联证据和未确认记录单独保留，官网掉落表不依赖这些候选关联。
- 1,756 条 PMT 记录中，940 条名称在 Unitxt 与本地 Solylib 同代码注释之间精确一致，
  816 条未确认；这不是运行时身份验证。517 个不同掉落名称中，298 个唯一候选的可比参数一致、
  21 个仅名称匹配、1 个参数冲突、197 个未解决。同名本身不证明身份一致。
- 官网的 408 个 `No Item` 格保留为空；40 格有物品但没有概率，10 格概率为 `1/???`。
  页面显示未知，不补数。DAR 与指定物品的掉率分别保存，不用 DAR 替代缺失概率。
- 范围是官网上述掉落表和数据库；不宣称囊括官网未列出的任务、活动、箱子或服务端专属规则。

## 重建与验证

```sh
rtk node artifacts/destiny/parse-drops.mjs
rtk node artifacts/destiny/build-catalog.mjs
rtk node artifacts/destiny/build-viewer-data.mjs
rtk node artifacts/destiny/build-item-images.mjs
rtk node artifacts/destiny/merge-supplemental-images.mjs
rtk node artifacts/destiny/build-complete-images.mjs
rtk node artifacts/destiny/build-image-gallery.mjs
rtk npm run test:destiny
rtk npm run test:destiny:upstream
```

最近记录的 viewer/gallery 测试共 29 项；恢复后的检查见 [RECOVERY.md](RECOVERY.md)。
`test:destiny` 检查可移植的图库与 Destiny viewer；`test:destiny:upstream` 检查 BB/DC/NGC 回归，
直接读取相邻 `../droptable` 仓库的测试 fixtures，因此需要该仓库在场。不保存指向个人机器绝对路径的软链接。
完整的护甲特效来源哈希校验可运行 `rtk node artifacts/destiny/verify-effect-sources.mjs`，需要本地原始客户端资源。

## 图片

[图片浏览页](http://127.0.0.1:18770/destiny/images.html)可搜索已关联物品；掉落表内指向物品可显示图片预览。
`resources/itemkt-images/` 保存两个 Destiny ItemKT 档案导出的 952 张图片和逐条哈希。
其中 `ItemKTep4.afs` 的 entry 45 未被现有解码器支持，已记录而未补造。
`dropcharts/destiny/images/manifest.json` 记录实际用于网页的每张图的来源与关联证据。
缺少现成图标的物品使用 `resources/model-previews/` 中核验过的模型与纹理生成预览；
没有可用独立外观的物品使用明确标注的共用类别图。模型预览属于离线静态渲染，不包含运行时动画与特效。
517 个掉落名称中，271 项有道具专属或变体预览（其中 9 项为无角色的护甲特效预览），246 项仍只有明确标注的共用类别图。当前图片覆盖及分类数量以
`dropcharts/destiny/images/coverage.json` 为准。图库与掉落表均明确区分独立外观、候选模型、
共用类别拾取图。所有图片只允许客户端 ItemKT、模型或粒子素材生成的预览，不允许官网截图。共用类别图不是单件物品外观，也不承诺该物品的实际掉落箱颜色。
NEI'S CLAW 的两个版本分别展示；掉落表未指定版本时，不擅自选其中一个。

`completeness/item-families.json` 保存全量类别证据；`resources/category-previews/` 保存来自
Destiny `item.bml` 的真实共用拾取模型与纹理，原版 BB 的类别选取规则也有记录，但未声称
直接验证 Destiny exe 的运行时选择。未知类别另行标注。
`completeness/approved-images.json` 只收录带原始模型与纹理哈希的客户端模型候选图；构建器拒绝官网截图。

恢复解码的 M&A85 Fury、Last Emperor、Twin Cyclone、Judgement Blade 的适配范围与来源审计见
`resources/completeness/render-fixes/README.md`；四枚戒指现已按客户端原始材质生成静态预览，保留不透明表面，未伪造透明度；不承诺等同游戏运行时效果。
来源、截图和对旧检查结论的修正见 `resources/completeness/red-ring-experiment/README.md`。

新增模型关联证据在 `supplemental-jobs.json`；实际渲染任务、来源哈希、逐图视觉审批位于
`resources/supplemental-render/`。候选关联在图库明确标注，掉落表用 ≈ 链接提示。
部分自定义物品由唯一 Unitxt 名称及六项武器/九项防具参数一致关联，少量仅参数唯一匹配，
均不视为运行时身份验证。七项纹理仅规范化容器对齐与零尾部，像素 payload 哈希保持不变。

昨日缺图审计的起点是 317 项；当前数量以 images/coverage.json 为准。
未取得独立外观的材料、插件、护甲等使用明确标注的共用类别图，不计为独立物品外观。
未通过检查的模型未冒充合格预览。没有根据文件时间推断客户端过期。

若需重新渲染新增批次：

```sh
rtk python3 artifacts/destiny/prepare-supplemental-render.py
rtk python3 artifacts/destiny/render-supplemental-jobs.py
rtk python3 artifacts/destiny/finalize-supplemental-render.py
```

重新渲染后的图片需要重新目视检查并绑定 `visual-qa.json` 中的 PNG 哈希，不能直接沿用旧审批。
原始模型批次的渲染与 UV、色彩、透明度检查见 `resources/model-previews/README.md`。
加色材质在透明 PNG 中使用适合深色网页背景的静态近似，不宣称等同游戏运行时效果。

恢复范围、重新采集时间与备份说明见 [RECOVERY.md](RECOVERY.md)。

当前缺口逐项列在 `completeness/remaining-appearance-audit.md` 和对应 JSON；用 `node artifacts/destiny/completeness/build-remaining-appearance-audit.mjs` 重建。图库的 Missing item-specific previews 包含共用拾取图，盒子图不计入道具专属预览数。图片优先使用有效 ItemKT，缺少 KT 时才采用本地模型与纹理的静态渲染，禁止下载现成道具图片。


九项护甲特效通过 `resources/completeness/armor-effects/render_all_previews.py` 重建，清单为同目录 `render-manifest.json`。使用本地 Destiny 粒子与纹理、已核实的标准客户端计算规则，固定种子和单次发射器起播后第 40 帧；不是 Destiny 游戏内截图，也不包含角色模型。图库和悬浮图保留这一标注。独立校验脚本验证本地来源哈希；图片构建防止覆盖已有 KT/模型图片。
