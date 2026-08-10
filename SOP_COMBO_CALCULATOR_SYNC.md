# PSOStats Combo Calculator 上游同步 SOP

## 目的

在保持 Haven 本地适配（下称 **overlay**）的前提下，将本站 Combo
Calculator 对齐到 PSOStats 当前部署版本，并留下可审计、可重复、可回滚的
更新记录。

上游项目：[`phelix-/psostats-client`](https://github.com/phelix-/psostats-client)

## 文件归属

### 上游生成文件

以下文件由 `npm run sync:combo` 生成，不得直接修改：

- `tools/cc.html`
- `tools/ccopm.html`
- `assets/js/combo_calc.js`
- `assets/js/combo_calc_multi_data.js`
- `assets/js/combo_calc_opm_data.js`
- `third_party/psostats-combo/LICENSE`
- `third_party/psostats-combo/upstream.json`

`combo_calc.js` 保留上游部署脚本逻辑，只在文件头添加许可证指引。两个
`*_data.js` 文件来自上游
Go 服务端渲染后的 Multiplayer/OPM 页面，包含对应模式的职业、武器、护甲和
敌人数据；它们同样带有许可证指引。完整 MIT 文本会发布到
`/third_party/psostats-combo/LICENSE`。

### 全站共享前端依赖

CC 不保留专用 jQuery/Bootstrap 副本，而是与现有工具页共享：

- `assets/js/jquery.min.js`：jQuery 4.0.0 slim；
- `assets/css/bootstrap.min.css`：Bootstrap 5.3.8 CSS。

版本在 `package.json` 中精确锁定，文件由 `npm run sync:frontend` 从 lockfile
安装出的 npm 包复制。`npm test` 会逐字节校验共享文件与锁定包一致。当前页面没有
使用 Bootstrap JavaScript 插件，因此不发布 `bootstrap.min.js` 或 `popper.min.js`；
同步器会在上游开始使用 Bootstrap JS 时拒绝生成，避免静默删除必要依赖。

同步器还会读取上游页面声明的 jQuery/Bootstrap 版本；本地版本低于上游时同步失败。

### Haven overlay

Overlay 的唯一实现入口是：

- `scripts/sync_combo_calculator.mjs`

当前 overlay 负责：

- 将 CDN 依赖替换为本站统一的 jQuery 和 Bootstrap CSS，并移除未使用的
  Bootstrap JavaScript bundle；
- 将上游 Bootstrap 4 的 input-group 与 select 标记迁移为 Bootstrap 5 结构；
- 为上游缺少 label 的 Combo 表单控件补充稳定的可访问名称；
- 将敌人多选标签的删除图标转换为可由键盘和读屏器识别的按钮；
- 移除 PSOStats 导航栏；
- 将 Multiplayer/OPM 互链改为本站路径；
- 添加本站需要的 charset 和 description；
- 将上游服务端注入数据拆为独立脚本，避免突破内联脚本预算；
- 为页面、计算脚本和数据脚本添加上游版权及许可证指引；
- 规范化换行和行尾空白，保证生成差异可直接通过 `git diff --check`；
- 验证部署脚本与 GitHub commit 一致，并拒绝同步过程中发生变化的线上快照；
- 校验上游关键结构，结构变化时立即失败。

#### Bootstrap 5 / jQuery 4 本地迁移契约

PSOStats 上游当前仍声明 jQuery 3.x、Bootstrap 4.x，并输出 Bootstrap 4 的
`input-group-prepend` / `input-group-append` 与 select `form-control` 标记；本站统一
发布 jQuery 4.0.0 slim 和 Bootstrap 5.3.8 CSS。两者之间的差异必须由
`scripts/sync_combo_calculator.mjs` 的 `migrateBootstrap5Markup()` 处理，禁止直接修改
生成文件 `tools/cc.html` 或 `tools/ccopm.html`。

同步适配器必须保持以下不变量：

- input-group 标签是 `.input-group` 的直接子元素，不得残留
  `input-group-prepend` / `input-group-append`；
- `<select>` 使用 Bootstrap 5 的 `form-select`，不得继续使用 `form-control`；
- 角色 ATP / ATA / Shifta / Zalure 栏在 390px 视口使用全宽布局，避免双 ATP
  输入值被裁切；
- 不引入 Bootstrap JavaScript 或 Popper；
- jQuery 使用 slim 构建，因此不得依赖 Ajax、Effects、Deferred 或 Queue 模块。
- 所有 input/select 必须具有 label、`aria-label` 或等效的可访问名称。
- 敌人标签的删除操作不得同时设置 `aria-hidden` 与可聚焦 tabindex。

`scripts/verify_combo_sync.mjs` 会校验版本、共享资源字节、生成哈希和 Bootstrap 5
标记；Playwright 会验证两种计算器的敌人选择、职业/数值交互、移动端横向溢出及
jQuery 运行时版本，并使用 axe 执行 WCAG A/AA 自动审计。上游同步后必须同时运行 `npm test`、`npm run build` 和
`npm run test:e2e`，任何旧标记回流或移动端退化都应视为同步失败。

配套约束位于：

- `scripts/build_site.mjs`：复制生成的第三方脚本和许可证，不改写其全局绑定，并把
  上游脚本计入发布 JavaScript gzip 预算；
- `scripts/verify_combo_sync.mjs`：验证来源、hash、许可证、格式、本地依赖和页面互链；
- `tests/e2e/site-smoke.spec.mjs`：验证两个模式能加载并实际生成伤害结果行。

## 标准更新流程

### 1. 更新前检查

```bash
git status --short
git pull --ff-only
```

建议从干净工作树开始。如果存在其他改动，应先确认它们与本次同步互不重叠，
不得用 reset、restore 或 checkout 清除未确认的修改。

### 2. 获取并应用上游快照

```bash
npm ci
npm run sync:frontend -- --check
npm run sync:combo
```

该命令需要访问 `psostats.com` 和 GitHub。它会验证线上计算脚本与记录的 GitHub
commit 完全一致，并对线上脚本及两个页面执行二次抓取稳定性检查；随后完成结构
校验和 overlay 转换，再写入生成文件。网络失败、部署正在变化或上游结构不符合
预期时应停止，不要手工拼接不完整快照。

如果要升级共享依赖，先修改 `package.json` 的精确版本并更新 lockfile，再执行：

```bash
npm run sync:frontend
```

不得直接覆盖 `assets/js/jquery.min.js` 或 `assets/css/bootstrap.min.css`。

### 3. 审查来源和差异

```bash
git diff --stat
git diff -- third_party/psostats-combo/upstream.json
git diff -- tools/cc.html tools/ccopm.html
git diff -- assets/js/combo_calc.js
```

检查项：

- `verifiedScriptCommit` 是否为预期的上游计算脚本提交；
- 来源 URL 和 SHA-256 是否完整；
- `sourceSha256.script` 与 `sourceSha256.commitScript` 是否一致；
- 页面仍只引用本站本地脚本和样式；
- `dependencies.local` 不低于 `dependencies.upstream`；
- CC、属性模拟器和人物能力表引用的是同一个共享 jQuery 文件；
- Multiplayer 和 OPM 数据没有串用；
- 没有重新出现 PSOStats 导航或 `/combo-calculator` 上游路由；
- 上游新增或删除的武器、特殊攻击、字段和 UI 控件符合预期；
- 许可证变化已被包含。

### 4. 验证同步可重复

```bash
npm run sync:combo -- --check
```

此命令重新读取当前上游并与工作树比较。通过表示同步结果当前且可重复；失败表示
上游在审查期间发生变化，或生成文件被手工修改，应重新同步并重新审查。

### 5. 完整验证

```bash
npm run release:prepare
```

该命令依次覆盖业务校验、生产构建和浏览器测试。Combo Calculator 的最低验收
标准为：

- `npm test` 中 Combo snapshot/hash 校验通过；
- `npm run build` 将原样复制的上游脚本也计入发布 JavaScript gzip 预算，且不突破
  JavaScript 和内联脚本预算；
- `_site/third_party/psostats-combo/LICENSE` 存在并与源码许可证一致；
- Multiplayer 与 OPM 页面无运行时或资源加载错误；
- 浏览器中实际加载 jQuery 4.0.0 slim；属性模拟器的职业/等级、Mag/素材输入及
  重置操作正常；
- 人物能力表的 12 个职业各生成 200 行，按钮/回车跳转、高亮和重置正常；
- CC 两个模式的四类敌人、职业切换、Shifta 输入、伤害排序和清空操作正常；
- 390px 移动视口下 CC 核心控件和结果表可用，页面不产生整体横向溢出；
- CC 两种模式、属性模拟器和人物能力表在实际交互状态下通过 axe WCAG A/AA
  审计；敌人标签的 Remove 按钮可被识别、聚焦并实际删除对应敌人。

### 6. 提交

```bash
git status --short
git diff --check
git add \
  tools/cc.html tools/ccopm.html \
  assets/js/combo_calc.js \
  assets/js/combo_calc_multi_data.js \
  assets/js/combo_calc_opm_data.js \
  third_party/psostats-combo/LICENSE \
  third_party/psostats-combo/upstream.json
git commit -m "chore: sync PSOStats combo calculator"
git push
```

如果本次同时修改了 overlay、校验或文档，也应明确审查后加入同一个提交，或拆成
一个 overlay 机制提交和一个生成快照提交。

如果本次升级了共享前端依赖，还必须一并提交并审查：

- `package.json`、`package-lock.json`；
- `scripts/sync_frontend_dependencies.mjs`；
- `assets/js/jquery.min.js`、`assets/css/bootstrap.min.css`；
- 因不再使用而删除的旧 Bootstrap JavaScript/Popper 文件及其页面引用；
- 对应静态校验、E2E 和文档变更。

## 修改 overlay 的流程

1. 只修改 `scripts/sync_combo_calculator.mjs`，不要在生成页面或生成脚本中打补丁。
2. 为新转换增加“必须命中”的结构校验，避免上游改版后静默漏应用。
3. 执行 `npm run sync:combo` 重新生成全部快照。
4. 在 `scripts/verify_combo_sync.mjs` 增加静态约束。
5. 涉及用户行为时，在 `tests/e2e/site-smoke.spec.mjs` 增加浏览器断言。
6. 重新执行本 SOP 的差异审查、幂等检查和完整验证。

紧急修复也应进入同步器后再生成文件。只修改生成文件会导致下一次同步覆盖修复，
并触发 provenance hash 校验失败。

## 常见失败处理

| 现象 | 原因 | 处理 |
|---|---|---|
| `fetch failed` / DNS 错误 | 当前环境禁止联网或上游暂时不可用 | 获取联网权限后重试；不要使用旧页面配新脚本 |
| `Upstream page no longer contains...` | 上游标签、依赖或模板结构变化 | 对照上游模板更新同步器匹配规则，再完整验证 |
| `began using Bootstrap JavaScript` | 上游新增 Bootstrap JS 插件行为 | 评估并恢复锁定版本的 Bootstrap JS；增加对应 E2E 后才能继续同步 |
| `does not match ... locked package` | 共享依赖被手改或升级后未生成 | 执行 `npm run sync:frontend`，审查并提交生成差异 |
| `data block boundaries changed` | 上游改变服务端数据注入方式 | 重新确定数据边界并更新提取逻辑与静态校验 |
| `does not match upstream commit` | GitHub main 与 PSOStats 部署不同步 | 等待部署稳定后重试，不要把 commit 与错误的部署快照关联 |
| `changed during synchronization` | 同步期间 PSOStats 正在部署 | 等待部署稳定后重新执行完整同步 |
| `--check` 报 stale | 上游再次更新或生成文件被修改 | 重新运行同步并审查新差异 |
| provenance hash 校验失败 | 生成文件被手工编辑或元数据不匹配 | 将需要的修改移入 overlay，然后重新生成 |
| Inline script budget exceeded | 新数据仍留在页面内联脚本中 | 更新提取逻辑，不应直接提高预算 |
| 页面加载但无结果行 | 数据脚本顺序、全局绑定或上游计算接口变化 | 检查浏览器错误并更新 overlay/E2E，禁止只放宽测试 |

## 回滚

同步应作为边界清晰的提交发布。发现回归时，优先对该同步提交执行普通 `git revert`
并重新部署；不要手工混搭不同日期的 HTML、数据脚本和计算脚本。修复同步器后，再
从同一套上游来源重新生成和验证。

## 完成定义

只有同时满足以下条件，才可视为一次同步完成：

- 线上计算脚本已与记录的 GitHub commit 校验一致；页面数据作为部署快照记录
  SHA-256，不宣称由 Git commit 唯一确定；
- 许可证已记录并进入发布产物；
- overlay 已自动应用；
- `sync:combo -- --check` 通过；
- `release:prepare` 通过；
- 差异已经人工审查；
- 生成文件、来源记录及相关 overlay 修改已一起提交。
