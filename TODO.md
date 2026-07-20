# TODO

> Long-term architecture issues are tracked in [`ARCHITECTURE.md`](./ARCHITECTURE.md). This file tracks near-term, actionable work and decisions.

## Active

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

- [x] **Mag 模拟器与反向规划器** — `tools/mag-sim.html` 使用单窗口三栏工作台展示设置、当前 Mag、喂食和历史记录；能力槽显示各属性升到下一级的百分比。规划器输入目标种类 + 精确四维，输出由正向引擎完整回放验证的分组方案：四阶公式只在 Lv100/110… 的实际进化节点检查，进化锁定后可继续成长；Cell Mag 会先规划前置 Mag，再把 Cell 作为显式进化步骤，之后继续培养到最终四维。精确解不可达时回退到最近可达四维，并支持一键导入正向模拟器。

## Optional follow-ups

- [ ] **Extend `<page-chrome>` to support an inline langSwitch widget**
  - Two multilingual pages (`tools/status.html`, `data/protocol/index.html`) were skipped during the chrome-injection migration because their `<header>` carries an inline `#langSwitch` button row. To migrate them, extend `<page-chrome>` to either accept a `lang-switch="zh,en,ja"` attribute or render slot content inside the header.
  - Low priority — only 2 pages affected, current inline chrome works.

## Vite tooling

**Decision (2026-04-26): Vite stays dev-only.** Deployment remains `push to master` → GitHub Pages serving the repo as-is. No `vite build`, no `dist/`, no MPA entries. Vite's role is HMR + dev-time cache busting only.

Rationale:
- ~60 HTML pages would each need MPA entry registration.
- Vendor libs (jquery / bootstrap / vue / vue-multiselect / popper / marked) live as dropped-in `assets/js/*.min.js`; migrating to npm imports is significant churn.
- Site is otherwise stable static HTML; cost of full migration >> benefit.

Revisit when: cache-busting `?v=N` becomes painful enough to justify automated hashing (i.e. once "Automated cache-busting" above stops being deferrable).

## Long-term (probably won't, but documented)

- [ ] **Astro migration** — would give automated hashing, zero-JS by default, and cleaner shared layouts. But requires production build pipeline, MPA registration of ~60 pages, vendor lib migration to npm, and excluding the third-party combo calc sync. Currently overruled by the Vite dev-only decision; revisit only if multiple concrete pain points emerge.
- [ ] **TypeScript for `chardata.js`** — type safety on calculation data. No bug-driven motivation today; defer until a class/stat data bug bites or the chardata decoupling above is done (good time to add types alongside JSON extraction).

## Design follow-ups (passive)

- [ ] **Vignette / scanline fatigue check** after extended use. Current values: vignette 0.75 black, scanlines 0.08 alpha. If reading is tiring, drop to 0.55 / 0.05.
- [ ] **Periodic visual consistency review** between home (lobby image + vignette + scanlines) and subpages (vignette + scanlines, no image). If home gains design elements, sync subpage treatment accordingly.

## Scope exclusions

These are intentionally outside the refactor/cleanup scope (don't propose changes):

- `data/droptable/` — opt-out by user (dedup of `en.js` / `zh.js` 27k-line data files was previously proposed but rejected).
- `assets/js/combo_calc.js`, `tools/cc.html`, `tools/ccopm.html` — third-party combo calculator sync'd from upstream; local edits get clobbered on each sync.
