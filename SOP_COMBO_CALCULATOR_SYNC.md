# PSOStats Combo Calculator 上游同步 SOP

## 目标

从 [`phelix-/psostats-client`](https://github.com/phelix-/psostats-client)
同步计算规则和数据，同时保持本站 Angular 页面、静态部署和许可证来源可审计。

上游页面使用什么 UI 框架不构成本项目的运行时依赖。同步流程只提取规则和数据，
不得重新引入 jQuery、Bootstrap、Vue、上游 HTML 或兼容层。

## 文件归属

`npm run sync:combo` 生成并更新：

- `assets/js/combo_calc.js`：带许可证指引的上游计算规则快照；
- `assets/js/combo_calc_multi_data.js`：多人模式数据快照；
- `assets/js/combo_calc_opm_data.js`：单人模式数据快照；
- `third_party/psostats-combo/LICENSE`：MIT 许可证；
- `third_party/psostats-combo/upstream.json`：来源、commit 和 SHA-256。

这些文件是不可发布的构建输入，不是浏览器入口。不要直接修改。Angular 构建生成器
将数据和计算边界转换为 `src/app/generated/combo/` 下的临时 TypeScript 模块；
`src/app/combo/` 独立拥有模板、样式、状态和可访问性。

## 标准流程

1. 确认工作树中的其他改动，禁止用 reset/restore 清除未确认内容。
2. 安装锁定依赖并同步：

   ```bash
   npm ci
   npm run sync:combo
   ```

3. 审查 `third_party/psostats-combo/upstream.json`、三个快照和许可证差异。
4. 验证同步仍可重复：

   ```bash
   npm run sync:combo -- --check
   ```

5. 执行完整验收：

   ```bash
   npm run release:prepare
   npm audit --audit-level=low
   ```

6. 仅提交已审查的快照、来源记录、许可证及必要的生成器/测试改动。

## 必须保持的不变量

- 部署脚本与记录的 GitHub commit 内容一致；
- 两种模式的数据各自包含 weapons、frames、classStats、enemyNameSort 和 enemies；
- 上游许可证完整发布到 `/third_party/psostats-combo/LICENSE`；
- 两个历史 URL 都由同一个 Haven Angular 组件提供；
- 生产产物不存在 jQuery、Bootstrap 或 Vue 运行时；
- 四类敌人、职业切换、Shifta、排序、移除、清空和移动端布局正常；
- 页面无控制台错误、本地资源错误和 WCAG A/AA 自动审计错误；
- 构建预算和确定性检查通过。

`scripts/sync_combo_calculator.mjs` 可以识别上游声明的 UI 依赖，目的是记录来源变化，
不是安装或复制这些依赖。若上游模板结构变化导致数据边界无法识别，同步必须失败，
然后显式更新提取器和回归测试。

## 常见失败

| 现象 | 处理 |
|---|---|
| 网络或 DNS 失败 | 网络恢复后重新执行，不混用不同时间的快照。 |
| 上游 commit 与部署脚本不一致 | 等待上游部署稳定后重试。 |
| 数据边界或关键字段变化 | 对照上游更新提取器，并增加相应测试。 |
| `--check` 报 stale | 重新同步并审查全部新差异。 |
| provenance hash 失败 | 移除手工修改，从同一来源重新生成。 |
| Angular 页面不再产生结果 | 修复适配边界和回归测试，不恢复旧框架。 |

发现线上回归时，对边界清晰的同步提交使用 `git revert`，重新执行发布门禁后部署；
不要手工拼接不同版本的脚本和数据。
