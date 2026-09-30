# PSO 本地模型与素材渲染流程

这套方法直接读取本地游戏资源，解析模型、贴图和角色配置，在 Blender 中组装后渲染。
它复用之前 Mag 图谱的工作方式。Phantasmal World、QEdit 和 newserv 的源码可用于核对格式或资源对应关系；不需要打开编辑器界面，也不需要从网络图片或视频截图取代已有本地资源。

**资源预览与游戏实机画面是两种产物。** 以下 NPC 图使用原始模型和贴图，但采用基础姿态与摄影棚灯光，不复刻任务场景、动画、雾、光子特效或客户端着色。不得标成“任务内截图”。

## 已验证的入口

| 资源 | 已验证流程 | 范围与限制 |
|---|---|---|
| Mag | `artifacts/hd-gallery/mag-default/README.md` 和同目录脚本 | 本地 AFS/PRS 模型、贴图，XJ/NJ，79 个模型；部分使用内嵌动画。脚本在本机保留，未入 Git |
| NPC | `content/npc-models.json` → 下列三个脚本 | 已验证 Flowen、Rico、Ult、Zoke、Kroe、Anna、Tyrell、Coren 示例；不代表任意 NPC 或所有 NJ chunk 均受支持 |
| 怪物 | `scripts/render_monster_models.py` / `.mjs` | 现有另一条渲染入口，依赖其浏览器渲染环境；需要时先核对环境和资产版本，不把它误称为 Blender 渲染 |

人物与资源必须先建立证据对应。存在一个职业模型不等于已找到某个人物；任务出现名字也不等于出现实体。Osto、Blant 的核查范围和例外见 [NPC 头像审计](NPC_ASSET_AUDIT.md)。

## 先识别输入，再选解析器

1. 记录客户端版本、资源路径、大小、SHA-256；在工作目录提取，不覆盖客户端原件。
2. 原始模型常在 `pl*bdy/hed/hai/cap*.nj`；城镇人物可能在 `data.gsl → BML → PRS → NJ + XVM`。装备常在 `ItemModelEp4.afs` / `ItemTextureEp4.afs`，另有 Ephinea 覆盖文件。
3. AFS 的成员可能是 **独立 XVRT**，不是 XVM。现有纹理校验器读取 XVM 时，可在工作副本上加正确的 XVMH 包装。BML 带回的贴图则可能已有 XVMH。先检查 magic、长度、成员数量和边界。
4. 任务 QST 通常描述 NPC 的产生、模板、外观覆盖和动作，模型本身由客户端提供。依次解 QST、BIN/DAT；NPC 身份需结合生成指令、模板与对话，不能靠附近的字符串猜。
5. 优先使用现有解析器。当前 NPC 脚本依赖本机 `bb-psov4/tools/psomodel` 的 NJ strip 解码和 `pso-assets` 的 XVR/DXT 解码；遇到未支持 chunk 必须失败并检查格式，不能跳过后交付残缺模型。

本次复现位置：

- 客户端：`/Applications/EphineaPSO.app/Contents/SharedSupport/prefix/drive_c/EphineaPSO/data`
- 任务库：`/Users/wangzhen/Library/Mobile Documents/com~apple~CloudDocs/pso/Quests`
- 模型解析：`/Users/wangzhen/study/bb-psov4/tools/psomodel`
- 纹理解析：`/Users/wangzhen/study/pso-assets/tools/xvm_inspect.py` 与其 `ref/pso-blender/pso_blender/dxt.py`
- 格式参考：本地 newserv；角色组装参考：本地 QEdit `NPCBuild.pas`

这些是工作站路径，不是 PSO 格式规定。移到其他机器时先找到同一解析器和对应资源，再调整脚本中的路径。

## NPC 组装：不能直接套刚性 Mag 模型

- `npcplayerchar.dat` 是 64 条、每条 `0x70` 字节的模板。视觉字段包括 `0x30` Section ID、`0x31` 职业、`0x38` 起的服装/皮肤/脸/头/发型、`0x42` 起的头发 RGB，以及 `0x48/0x4C` 体型。
- 模板采用零起始字段；编辑器 UI 可能是一开始。任务还可能通过 `prepare_npc_visual` / `enable_npc_visual` 覆盖模板，不能仅按固定人物表取外观。
- `npc_crp_id` 与 `npc_crptalk_id` 的参数排列不同。前者本次例子的模板在 r66，后者在 r65；请按对应版本的 opcode 定义解释。
- 模型的纹理槽号不等于 AFS 成员顺序。按已核对的映射绑定每一部分，含 Section ID、脸、耳朵、头发、帽子和手部。头发还需模板颜色。
- 普通玩家职业模型把头接到身体骨骼；本次模板使用骨骼 59。独立角色另有组装方式：Flowen 头与发在 Y=17，Rico 头在 Y=14.5。不能把这个位移当成所有角色的通用常量。
- NJ 人物模型会复用顶点索引，并包含“缓存多边形列表”和“绘制缓存列表”命令。必须在每次绘制时使用当时的顶点缓存。把全模型最后一个缓存应用到所有多边形，会让手臂等部位错位。
- 当前人物路径支持 `0x25`、`0x29`、`0x2C` 顶点块。权重片段先经各自节点变换后累加，法线用逆转置变换。不要将这段有限实现宣称为完整的 Ninja 导入器。
- RAcaseal **头型 2 的脸槽 0/1 互换**。Ult 的头部 AFS 顺序是 `[265,264,266]`；按顺序绑定 `[264,265,266]` 会把盔甲纹理贴到脸上。
- 体型是在 3D 模型上应用的角色配置。本次使用 QEdit 的预览公式，并在来源中披露；不要用图片纵向缩放代替角色体型。

渲染器把 PSO Y-up 转为 Blender Z-up：`(x,y,z) → (x,-z,y)`，UV 的 V 轴也按现有导出约定转换。光照使用 Mag 流程的主光 2.8、补光 0.7、环境光 0.8，Standard 色彩视图、64 次 Cycles 采样、透明背景。这里的数值是图谱风格，不是客户端光照常量。

## 可重复执行

在站点仓库根目录运行：

```sh
rtk proxy python3 scripts/extract_npc_models.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/test_npc_model_geometry.py
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/render_npc_models.py
```

只重渲染指定人物时，在最后增加 `-- rico zoke kroe`。产物在忽略目录 `artifacts/npc-models/`：原件工作副本、纹理 PNG、解析后的配置、全身图、方形头像和 `.blend` 场景。

**Blender 默认可能在 Python 异常后返回退出码 0。** 使用 `--python-exit-code 1`，并检查本次日志和产物，不能把退出码 0 或上次遗留的 PNG 当成成功。

逐张检查全身图和头像，确认人物、头发、脸部、手臂、服装、贴图透明度、朝向和取景后，执行：

```sh
rtk proxy python3 scripts/publish_npc_models.py
rtk npm run test:npc
rtk npm run build
rtk proxy npx playwright test tests/e2e/npc-guide.spec.mjs tests/e2e/site-smoke.spec.mjs --grep 'NPC guide'
```

`publish_npc_models.py` 仅写本地网站素材与来源清单，不会推送或部署网站。它将已检查的 900×900 RGBA 图片编码为 WebP（quality=95、method=6），保留透明度。发布前还要保持三语 HTML 和 SVG 关系图引用一致。

新人物先加入 `content/npc-models.json`，注明每部分来源、纹理槽、附着骨骼或位移、模板字段。完成身份核对后再补进页面；不要让未验证任务自动覆盖已验收头像。

## 验收与可追溯性

- 资源哈希、任务哈希、模板配置、最终图片哈希保存在 `assets/img/npc/model-renders.json`。
- `scripts/test_npc_model_geometry.py` 用合成数据验证缓存不提前绘制、不同绘制时的顶点状态互不污染、缺失缓存明确报错。
- 网站回归检查人物卡片与 SVG 同源、自然尺寸与声明尺寸一致、全部头像显示比例不变，以及检索、语言切换、移动端和可访问性。
- 用浏览器看最终卡片和关系图。高分辨率正方形渲染不会增加原始低分辨率纹理的细节；不要用 AI 重画来伪造更细的游戏素材。
- 没有确定人物模型时，报告已查的版本、任务和资源范围，保留明确标注的资料条目。不要把“未找到”扩大为“所有版本都不存在”。
