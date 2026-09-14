# TODO

## Active

- [ ] 游戏机制：补充各 Photon Blast 的伤害计算逻辑，核对基础公式、
  PB 类型、玛古与角色属性、连锁／捐献、目标抗性及适用条件；区分攻击型
  PB 与治疗／辅助型 PB。来源：[Ephinea Photon Blasts](https://wiki.pioneer2.net/w/Photon_Blasts)。
- [ ] 武器之心：整理完整列表、对应武器外观、获取途径、使用与还原条件，
  关联道具图鉴并沿用权威名称。来源：[Ephinea Weapon hearts](https://wiki.pioneer2.net/w/Weapon_hearts)。
- [ ] Inventory the archived PSO FRAME slot3 (Red-Wolf) material, record version
  and provenance, and selectively restore only information that remains unique.
- [ ] Move manually versioned runtime data URLs behind the build manifest where
  this materially improves cache behavior.

## Maintenance

- Keep Angular and build tooling on stable, non-prerelease releases.
- Run the complete release gate for dependency or upstream-data changes.
- Preserve historical public URLs and the static GitHub Pages deployment model.
- Keep generated third-party snapshots separate from Haven-owned Angular UI.

## Shipped

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
