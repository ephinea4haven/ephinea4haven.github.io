# RBR 数据来源与自动化边界

## 结论

RBR 的客观数据可以大部分自动化，Tier 评级不能原样自动生成。

- 候选任务池、机制、Wiki 当前轮换、任务 EXP 和刷怪数已经可以自动抓取。
- 掉落率可以与仓库现有 Ephinea 掉落表连接。
- 物价可以与现有 Price Guide 抓取结果连接。
- Tier 仍需要人工确认，因为它包含路线、完成时间、队伍要求、操作难度、市场流动性和作者偏好。

## 数据链

```text
Ragol Boost Road Wiki ──> 候选池（EP1 23 / EP2 21 / EP4 14）与加成规则
游戏内 `/rbr` ─────────> 本周三个任务（唯一权威来源）
RagolBoostRoad 模板 ────> Ephinea Wiki 镜像与候选 diff 基线
58 个任务 Wiki 页面 ───> Episode、类别、Ultimate EXP、敌人数量
Ephinea 掉落表 ─────────> 敌人 × Section ID × 物品 × 基础掉率
Price Guide ────────────> 物品价格区间
玩家实测 ───────────────> 路线、人数、周回时间、失败率
                           │
                           └──> 每轮掉落期望 / 每小时价值 / 建议 ID
                                      │
note Tier + 人工判断 ────────────────> 最终 Tier
```

## 已实现的生成器

运行：

```bash
python3 scripts/build_rbr_data.py
python3 -m unittest scripts/test_build_rbr_data.py
```

输出：`data/rbr/source.json`

## 每周更新入口

RBR 不再通过 GitHub Actions 定时轮询 Ephinea Wiki。旧的 `sync-rbr.yml` 已退休，
因为 Wiki 只是可能滞后的镜像，不能替代游戏服务器的实际轮换。

每周由维护者提供游戏内 `/rbr` 的原始内容，并从中确认 Episode 1、2、4 的三个
任务缩写。当前计划器只接受这三个拆分后的缩写，尚不能直接解析整段 `/rbr` 原文。
它验证输入、Tracker 状态、本站投影和 Ephinea Wiki 候选 diff。本站数据更新不由
定时任务执行；Ephinea Wiki 的两个模板可以由本地认证发布器显式更新。

## 自动化闭环状态

只读调研和方案验证已经闭环：

- 游戏 `/rbr` 被确定为本周轮换的唯一权威来源；
- 三个任务的缩写、Episode 归属、周次和 Tracker 状态均会校验；
- 两个 Ephinea Wiki 模板的候选 Wikitext、revision 和 diff 均会生成；
- 本站 current/Tracker 投影会生成，并经过与候选 Wiki 模板相同的结构校验；
- 候选 Wikitext 仅通过 `action=parse` 预览，不产生外部写入。

“输入一次 `/rbr` 后自动更新本站和 Ephinea Wiki”的跨目标发布闭环尚未实现：

- 没有整段 `/rbr` 原文解析器；
- 不写入或提交本站 `data/rbr/source.json`；
- 本地发布器只负责 Ephinea Wiki 的两个模板，不提交本站；
- 本站和 Wiki 两个目标之间仍没有顺序发布、部分失败恢复或幂等重试。

因此只读计划器中的 `localProjection` 和 Wiki diff 仍是候选结果，不是发布成功记录。
只有 `publish_rbr_update.py` 返回的逐模板 revision 和写后校验结果才是 Wiki 发布记录。

## 两个目标的已知更新路径

本站不是 MediaWiki，而是由 Git 仓库发布的静态 GitHub Pages 站点。本站的目标路径
已经明确：用游戏 `/rbr` 的三个任务更新 `data/rbr/source.json`，运行 RBR 测试和生产
构建，提交到 `master`，再通过 Pages Workflow 发布。当前缺少的是从 `/rbr` 输入直接
构造完整 snapshot 并执行上述发布链路的实现；现有 `localProjection` 不能替代它。

Ephinea Wiki 使用标准 MediaWiki Action API。本地发布器建立内存 cookie session，
通过 `clientlogin` 登录，获取 CSRF token，读取两个模板的最新 revision 与时间戳，
提交带 `baserevid`、`basetimestamp` 和 `starttimestamp` 的 `action=edit`，并在每次写入后
重新读取验证。两个模板中的任意一个先成功后中断时，重跑会识别中间状态并只补剩余
模板；未知的不一致状态会停止。

本站与 Wiki 不存在共同事务，不能声称“同时原子更新”。Wiki 内部的两个模板同样不是
单一事务，但发布器会记录每个模板的 revision，并允许基于相同输入安全重试。

## Wiki 更新方案验证

游戏内 `/rbr` 是服务器实际轮换的唯一权威来源，服务器没有公开的 RBR 接口。
第一阶段只验证更新方案，不修改 Ephinea Wiki，也不覆盖本站的
`data/rbr/source.json`：

```bash
python3 scripts/plan_rbr_update.py \
  --episode-1 EN3 \
  --episode-2 PS2 \
  --episode-4 NMU5
```

计划器读取候选池、当前模板和 Tracker，确认 Wiki 只落后一周或已经是本周，
验证三个缩写所属 Episode 与当前轮次状态，生成两个候选 Wikitext，并通过
MediaWiki `action=parse` 做只读渲染预览。输出 JSON 包含源 revision、模板 diff、
预览 HTML 大小，以及本站将使用的 current/Tracker 投影。

`.github/workflows/validate-rbr-update.yml` 提供相同的手动输入入口。该 Workflow
只有 `contents: read` 权限，不读取 Wiki 凭据、不调用 `action=edit`、不提交文件。
它只验证方案，不是本站或 Ephinea Wiki 的发布流程。

## 本地发布两个 Wiki 模板

凭据保存在 Git 忽略的 `.secrets/ephinea-wiki.json`：

```json
{
  "username": "account name",
  "password": "account password"
}
```

文件必须设置为仅当前用户可读写：

```bash
chmod 600 .secrets/ephinea-wiki.json
```

发布命令：

```bash
python3 scripts/publish_rbr_update.py \
  --episode-1 EN3 \
  --episode-2 PS2 \
  --episode-4 NMU5
```

发布器仍会先运行完整规划和 MediaWiki 渲染预览。若两个模板已经是目标状态，它会完成
登录与读取验证并返回 `already-current`，不会取得 CSRF token 或制造空编辑。凭据不会
写入输出、Git、命令行参数或 cookie 文件。

人工整理后的两张 Tier 表保存在 `data/rbr/tiers.json`。完整性测试会确认 RBR 的
58 个候选任务恰好各出现一次，不允许漏项或重复：

```bash
python3 -m unittest scripts/test_rbr_tiers.py
```

生成器会：

1. 通过 MediaWiki API 读取 `Ragol Boost Road` 页面。
2. 审计候选数必须仍为 EP1 23、EP2 21、EP4 14，共 58 个。
3. 读取 `Template:RagolBoostRoad`，取得 Wiki 公布的当前周与三个任务。
4. 并发读取 58 个任务页。
5. 提取 Wiki revision、任务类别、Ultimate EXP、敌人数与条件数量注释。
6. 原子写入 JSON；网络或关键结构错误时不会破坏旧文件。

当前 Wiki 的五个 `Anomalous Ordeal` 页面没有固定刷怪表，因为任务以随机刷怪为特点。
生成器会将它们标为 `enemyCountStatus: "unavailable"`，不会伪造数量。

## “当前 RBR”并非完全可靠的公开 API

游戏内 `/rbr` 和大厅柜台是服务器实际状态的权威来源。Wiki 的
`Template:RagolBoostRoad` 是公开、可抓取的镜像，但由 Wiki 维护，可能晚于每周日
00:00 UTC 的服务器轮换。

生成器会计算最近一个周日并写入：

- `current.expectedWeek`
- `current.isFresh`

手工运行生成器时，`--require-current` 可用于拒绝尚未与当前 UTC 周次一致的 Wiki
镜像；这只是本地诊断门禁，不再由定时 Action 调用。不带该参数时仍可生成带 warning
的诊断快照。

## 自动计算掉落收益

有了敌人数 `n` 和单只敌人的最终掉落概率 `p`，至少一次掉落的概率为：

```text
P(每轮至少一件) = 1 - (1 - p)^n
```

下一阶段可以将 `source.json` 与 `data/droptable/bb/data/en.js` 连接，为每个任务和
Section ID 生成：

- 每轮各稀有物品的掉落概率；
- 推荐 Section ID；
- RBR 1–4 人加成后的概率；
- 以 Price Guide 中位价估算的每轮 PD 价值；
- 加入实测周回时间后的每小时价值。

这里需要先确认 Ephinea 对 DAR 与 RDR 加成的精确组合公式，不能直接对最终掉率
重复乘加成。

## 为什么 Tier 不能完全自动

两篇 note 的 Tier 不是单纯按敌人数排序，还明显使用了以下信息：

- 只刷 Area 1、打到中段即退等非完整路线；
- 2:2 或四人分路带来的时间收益；
- Hell、Divine Punishment、Anguish 1 等装备和难度条件；
- Boss、箱子、Lucky Coin、任务票与 Meseta 等额外收益；
- 当时的市场价格与物品流动性；
- 地图移动距离、迷路、机关、失败风险和队伍熟练度。

因此最稳妥的方案是“自动生成客观底表 + 人工维护路线时间与 Tier”。当 note 原文、
Wiki revision 或掉落表变化时，自动检查负责提示重新评估，而不是擅自改 Tier。
