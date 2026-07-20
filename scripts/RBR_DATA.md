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
RagolBoostRoad 模板 ────> Wiki 公布的本周三个任务
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

如果 Wiki 模板还停留在上周，输出会保留原值并产生 `current-rotation` warning，
而不是把旧数据当作最新数据。

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
