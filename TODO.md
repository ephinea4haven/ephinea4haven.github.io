# TODO

> Long-term architecture issues are tracked in [`ARCHITECTURE.md`](./ARCHITECTURE.md). This file tracks near-term, actionable work and decisions.

## Active

- [ ] **Angular 前端现代化与 jQuery / Bootstrap 退休评估** (Long-term)
  - 先以 `tools/status.html` 和 `tools/chartable.html` 做 Angular POC，验证静态托管、路由回退、构建产物、缓存失效、SEO、无障碍和发布体积，不直接迁移全站 105 个 HTML 页面。
  - 盘点并逐步移除本站自有代码中的 jQuery；评估以站点自有组件样式替代 Bootstrap CSS，禁止同时长期维护旧实现与 Angular 兼容层。
  - Combo Calculator 必须先决定是否继续同步 PSOStats 上游。继续同步时不得在生成文件中手改 Angular 实现；若改为本站完整维护，需明确 fork 边界、许可证、数据同步和回归基线。
  - 决策门槛：POC 相比当前原生静态实现能够实质降低维护成本或支撑明确的新产品能力，并且完整迁移计划、体积预算与回滚方案通过 review 后再实施。

- [ ] **清点并选择性恢复 PSO FRAME slot3（Red-Wolf）资料** (Medium)
  - 已确认旧站名称为 **PSO FRAME slot3**，管理者为 Red-Wolf；早期地址为 `http://www.red-wolf.ac/pso/`，之后迁移到 `http://www.red-wolf.sakura.ne.jp/pso/`。
  - 两个旧域名目前均已无法解析；2016 年的 PSO 玩家讨论也已明确提到该攻略站消失。
  - Internet Archive 仍保存了大量 2005–2010 年页面和图片，包括全物品表、武器分类、Section ID 掉落、任务、控制塔、挑战模式、角色与素材配置等；[2010-08-05 主页面存档](https://web.archive.org/web/20100805063421/http://www.red-wolf.sakura.ne.jp/pso/pso.html)已确认可下载。
  - 已验证的道具资料入口：[全道具表](https://web.archive.org/web/20100122043150/http://www.red-wolf.sakura.ne.jp/pso/all_item.html)、[Saber 分类（包含 Lavis Cannon）](https://web.archive.org/web/20091213005723/http://www.red-wolf.sakura.ne.jp/pso/itemlist/saber.html)。
  - 下一步：导出 Wayback CDX 清单，下载并建立本地只读镜像；标注 GC / Episode I&II 的适用版本、原始来源和存档时间，再与本站现有资料去重，选择仍有独特价值的内容迁移。
  - 调查依据：[2004 年链接记录](https://ropso.exblog.jp/544347/)、[旧站迁移记录](https://blankrune.sakura.ne.jp/changelog.html)、[2016 年关闭讨论](https://jbbs.shitaraba.net/bbs/read.cgi/netgame/14889/1473776762/)。

- [ ] **Automated cache-busting** (Low)
  - Replace manual `?v=N` query strings on `<script>` / `<link>` tags with content-hash strings (e.g. md5 of file).
  - Could be a small Python script run pre-deploy, or a git pre-commit hook.
  - Cross-ref: ARCHITECTURE.md issue #1.

## Shipped

- [x] **Bootstrap 5 与 jQuery 4 迁移** — 共享依赖升级到 Bootstrap 5.3.8 CSS 和 jQuery 4.0.0 slim；Combo 同步器会将上游 Bootstrap 4 input-group/select 标记转换为 Bootstrap 5，并通过桌面、移动端、计算交互、人物表、无障碍与发布体积回归验证。

- [x] **首页活动专题自动高亮** — 除“活动总览”外，五个节日入口按访客本地日期在对应活动窗口自动显示流动彩虹高亮；周年活动为 8 月 1 日至 9 月 15 日。动画遵循 `prefers-reduced-motion`。

- [x] **Mag 模拟器与反向规划器** — 已拆分至独立项目 [`warmonipa/magfeeder`](https://github.com/warmonipa/magfeeder)，生产地址为 [`magfeeder.psohaven.com`](https://magfeeder.psohaven.com/)；主站保留入口链接、旧 `/tools/mag-sim.html` 兼容跳转，以及作为唯一生成源的共享 Mag 数据。

## Optional follow-ups

- [ ] **Extend `<page-chrome>` to support an inline langSwitch widget**
  - Two multilingual pages (`tools/status.html`, `data/protocol/index.html`) were skipped during the chrome-injection migration because their `<header>` carries an inline `#langSwitch` button row. To migrate them, extend `<page-chrome>` to either accept a `lang-switch="zh,en,ja"` attribute or render slot content inside the header.
  - Low priority — only 2 pages affected, current inline chrome works.

## Vite tooling

**Decision (2026-04-26): Vite stays dev-only.** Deployment remains `push to master` → GitHub Pages serving the repo as-is. No `vite build`, no `dist/`, no MPA entries. Vite's role is HMR + dev-time cache busting only.

Rationale:
- The current 105 HTML pages would each need MPA entry registration.
- Shared jQuery and Bootstrap CSS are generated from pinned npm packages, while Vue, vue-multiselect and marked remain dropped-in assets; migrating all page dependencies to imports is still significant churn.
- Site is otherwise stable static HTML; cost of full migration >> benefit.

Revisit when: cache-busting `?v=N` becomes painful enough to justify automated hashing (i.e. once "Automated cache-busting" above stops being deferrable).

## Long-term (probably won't, but documented)

- [ ] **Astro migration** — would give automated hashing, zero-JS by default, and cleaner shared layouts. But requires production build pipeline, MPA registration of the current 105 HTML pages, vendor lib migration to npm, and excluding the third-party combo calc sync. Currently overruled by the Vite dev-only decision; revisit only if multiple concrete pain points emerge.
- [ ] **TypeScript for `chardata.js`** — type safety on calculation data. No bug-driven motivation today; defer until a class/stat data bug bites or the chardata decoupling above is done (good time to add types alongside JSON extraction).

## Design follow-ups (passive)

- [ ] **Vignette / scanline fatigue check** after extended use. Current values: vignette 0.75 black, scanlines 0.08 alpha. If reading is tiring, drop to 0.55 / 0.05.
- [ ] **Periodic visual consistency review** between home (lobby image + vignette + scanlines) and subpages (vignette + scanlines, no image). If home gains design elements, sync subpage treatment accordingly.

## Scope exclusions

These are intentionally outside the refactor/cleanup scope (don't propose changes):

- `data/droptable/` — retained for local tooling; production links and deployment use `dropcharts.psohaven.com`.
- `assets/js/combo_calc*.js`, `tools/cc.html`, `tools/ccopm.html` — generated third-party Combo Calculator snapshots. Put Haven-specific changes in `scripts/sync_combo_calculator.mjs`; direct edits get clobbered on sync.
- `assets/js/jquery.min.js`, `assets/css/bootstrap.min.css` — shared pinned frontend dependencies. Update package versions and run `npm run sync:frontend`; do not add per-page copies.
