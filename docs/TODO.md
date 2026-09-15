# TODO

## Active

- [ ] 武器之心：整理完整列表、对应武器外观、获取途径、使用与还原条件，
  关联道具图鉴并沿用权威名称。来源：[Ephinea Weapon hearts](https://wiki.pioneer2.net/w/Weapon_hearts)。
- [ ] Inventory the archived PSO FRAME slot3 (Red-Wolf) material, record version
  and provenance, and selectively restore only information that remains unique.
- [ ] Move manually versioned runtime data URLs behind the build manifest where
  this materially improves cache behavior.

## Maintenance

- PB 机制正文仅维护在 [游戏机制 G 节](../tools/mechanics.html#photon-blast)：
  六种技能各自的作用方式、属性影响、使用场景与限制、连锁定位，以及参数、
  伤害／恢复／辅助公式、连锁与捐赠、图标和算例集中展示。
  玛古页面、缩写表及项目文档只提供相关入口，不另存一套公式或攻略。
- Keep Angular and build tooling on stable, non-prerelease releases.
- Run the complete release gate for dependency or upstream-data changes.
- Preserve historical public URLs and the static GitHub Pages deployment model.
- Keep generated third-party snapshots separate from Haven-owned Angular UI.

## Shipped

- [x] [游戏机制 G 节](../tools/mechanics.html#photon-blast)：六种 PB 均有游戏图标、
  作用方式示意图、属性影响、使用场景与限制、连锁定位及公式；补齐首发角色／玛古
  参数取值、逐步截断、光抗性、伤害算例与同条件对比。分别说明 Leilla 恢复量、
  Mylla & Youlla 辅助等级，以及捐赠与有效连锁数、相邻重复覆盖的规则。依据
  [Ephinea Photon Blasts](https://wiki.pioneer2.net/w/Photon_Blasts) 整理，未宣称客户端实测；
  构建、中文与架构检查、10 项定向浏览器测试及桌面／手机显示验证通过。
  2026-09-15 用户验收并明确授权提交、推送；复审与授权记录见
  [机制页验证记录](MECHANICS_VISUAL_EVIDENCE.md#用户验收与提交授权)。
- [x] [怪物图鉴](MONSTER_CATALOG.md)：160 个条目、三语界面与名称、
  难度／模式属性、行为与条件机制表；十色掉落直接由 droptable 生成。
- [x] 首页展示 `data/rbr/source.json` 的 RBR 任务并链接详情页，
  UTC 周日跨周后未更新的记录明确显示待更新；卡片显示共用评级数据中的 Tier、
  推荐 Section ID 和对应颜色，并标明评级日期与非官方性质。
  `548e78e` 已部署并完成[线上核验](MONSTER_CATALOG.md#2026-09-14-发布核验)。

- [x] Full [item catalog](ITEM_CATALOG.md): 1,044 items across six categories,
  524 illustrated entries, search/filter URLs and per-item detail pages. All
  57 ordinary shop weapon models have verified local images. Follow-up review
  fixes and 1,193-test local validation are recorded in the
  [September 14 release record](DEPLOYMENT.md#september-14-2026-item-catalog);
  production status follows the latest successful Pages run for `master`.
- [x] Item catalog visual refresh and zh/en/ja interface/name switching, with
  URL and local preference persistence, source-language mechanics labels and
  817 verified Japanese item names. The remaining 227 show an explicit English
  name notice; Chinese names still use the drop-table authority.
- [x] Unified 2016–2026 anniversary archive with 2026 milestones, stable overlay
  year navigation, responsive chapter navigation and shared year-themed presentation.
- [x] Full-site Angular modernization completed and release-validated; jQuery,
  Bootstrap and Vue retired from the application and production artifact.
- [x] Banner reference page based on the Ephinea Wiki banner documentation.
- [x] Canonical item-translation pipeline generated from the sole
  `droptable/i18n_names.json` authority, preserving Unitxt mixed-width names
  without a halfwidth/fullwidth selector.
- [x] Ephinea equipment-based Technique boost reference covering weapons,
  frames and barriers through the canonical translation catalog.
- [x] Landing-page seasonal highlighting with reduced-motion support; LIVE
  markers and activity panels share registered yearly dates, so expired or
  unannounced events cannot be highlighted by month alone.
- [x] September 10 homepage fix and dependency updates released: Angular
  patch group and deploy-pages merged, duplicate Hono PR closed, and the CI
  item-name authority path shared across business and browser tests. See the
  [verified release record](DEPLOYMENT.md#september-10-2026-release).
- [x] Standalone Mag feeder/planner deployment with legacy URL redirect.
- [x] Original-source high-resolution map atlas for the Episode I and II challenge guides.
- [x] Standalone Chinese Seabed route, combat and equipment guide.
