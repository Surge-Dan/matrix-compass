# Matrix Compass 创作者经营实验室实施计划

- 日期：2026-07-30
- 依据：[产品设计规格](../specs/2026-07-30-matrix-compass-creator-operations-design.md)
- 状态：待实施
原则：测试先行、数据不丢失、每个里程碑可独立验收、任一强制门槛失败即停止发布

## 1. 实施结论

本次改造不在现有演示看板上继续堆页面，而是先建立可靠的本地数据底座，再逐步交付内容、日程、导入、收入、分析、移动端和 AI。

首个可用版本分八个里程碑。每个里程碑遵循同一循环：

1. 先写失败的单元、契约或 Gherkin 测试；
2. 只实现让测试通过的最小代码；
3. 补齐异常流、属性测试和安全检查；
4. 运行目标模块测试与全量质量门槛；
5. 在真实浏览器完成桌面端与移动端验收；
6. 形成独立提交，失败可回滚到上一个里程碑。

不允许以截图替代数据库、导入、恢复、并发和错误处理验证。

## 2. 技术架构决定

### 2.1 一套业务逻辑，两种数据适配器

- 本地正式版：沿用现有 Vinext、Cloudflare Worker 与 Drizzle 技术栈，使用 Cloudflare D1 的本地 SQLite 持久化；
- 公网演示版：使用隔离的演示数据适配器或独立演示 D1，不读取本机数据目录；
- 页面和业务服务只依赖仓储接口，禁止在 React 组件中直接访问 D1；
- `/api/health` 必须返回版本、运行模式、数据源类型、迁移版本和只读状态，但不暴露本地绝对路径。

选择依据：Cloudflare Vite 插件原生支持本地持久化状态和自定义持久化目录；D1 的本地开发与导出能力可以让现有 Worker 架构继续共用，而不引入第二套 Node 服务。参考：[Local development settings](https://developers.cloudflare.com/workers/local-development/local-data/)、[D1 local development](https://developers.cloudflare.com/d1/best-practices/local-development/)、[Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/)。

### 2.2 数据目录

默认目录：`%LOCALAPPDATA%\MatrixCompass\data\`。

允许使用 `MATRIX_COMPASS_DATA_DIR` 指定绝对路径。启动时必须拒绝：

- 磁盘根目录；
- 用户主目录；
- Git 仓库根目录及其父目录；
- 相对路径、空路径、不可写目录和符号链接逃逸路径。

建议目录结构：

```text
data/
  d1-state/
  backups/
  imports/
  logs/
  runtime.json
```

### 2.3 备份边界

- 不直接复制正在写入的 Miniflare 内部 SQLite 文件；
- 使用官方 D1 本地导出命令生成一致性 SQL 快照；
- 每份备份附带 `manifest.json`，记录应用版本、迁移版本、表行数、生成时间和 SHA-256；
- 恢复先导入临时状态目录，完成迁移、外键、行数和校验值检查，再替换当前状态；
- 替换失败时保留原状态和失败报告，不自动清空数据。

### 2.4 数据建模约束

- 主键使用 UUID；
- 金额统一存储为最小货币单位整数，界面负责格式化；
- 日期时间以 UTC 存储，同时保留用户时区；
- JSON 数组和平台特有字段在写入前做结构校验；
- 所有可编辑主记录包含 `created_at`、`updated_at`、`version`；
- 软删除仅用于需要恢复或审计的核心业务记录；
- 派生指标不覆盖原始导入值。

## 3. 代码结构目标

```text
app/
  api/
    accounts/
    contents/
    calendar/
    imports/
    metrics/
    finance/
    analysis/
    backups/
    pairing/
    ai/
  accounts/
  contents/
  calendar/
  imports/
  finance/
  analysis/
  settings/
components/
  shell/
  table/
  calendar/
  forms/
  charts/
  import-wizard/
  finance/
db/
  schema.ts
  client.ts
  migrations/
  repositories/
domain/
  accounts/
  contents/
  metrics/
  finance/
  analysis/
lib/
  runtime/
  import/
  backup/
  auth/
  ai/
tests/
  unit/
  integration/
  contract/
  cucumber/
  e2e/
  fixtures/
skill/matrix-compass/
```

现有 `components/dashboard/*` 在新页面稳定后删除；改造期间不同时维护两套业务逻辑。

## 4. 里程碑 0：本地运行、SQLite、迁移与恢复证明

### 目标

先证明“数据写入后重启仍存在、升级可迁移、备份可恢复、数据目录安全”，再开发业务页面。

### 先写测试

- `tests/unit/data-dir.test.ts`：默认路径、环境变量覆盖、根目录与仓库目录拒绝、Unicode 路径；
- `tests/integration/d1-persistence.test.ts`：写入、重启、读取、外键、事务回滚；
- `tests/integration/migrations.test.ts`：空库升级、重复执行、旧版本升级、失败回滚；
- `tests/integration/backup-restore.test.ts`：导出、校验、临时恢复、损坏备份拒绝、恢复后逐表一致；
- `tests/contract/health.test.ts`：本地、演示、迁移失败和只读模式响应。

### 实现文件

- 修改 `vite.config.ts`：默认仅监听 localhost；通过显式启动参数开启 LAN；配置 D1 本地状态目录；
- 修改 `.openai/hosting.json`：声明 D1 绑定和演示环境边界；
- 实现 `lib/runtime/data-dir.ts`、`lib/runtime/mode.ts`；
- 实现 `db/client.ts`、`db/schema.ts`、`db/migrations/*`；
- 实现 `lib/backup/export.ts`、`verify.ts`、`restore.ts`；
- 增加 `scripts/start-local.mjs`、`scripts/backup-local.mjs`、`scripts/restore-local.mjs`；
- 建立最小可用的 `skill/matrix-compass/SKILL.md` 与安装、启动、诊断脚本，后续里程碑持续加固；
- 更新 `app/api/health/route.ts` 和 `worker/index.ts` 的类型绑定；
- 在 `package.json` 增加 `db:migrate`、`db:check`、`backup`、`restore:dry-run`、`dev:lan`。

### 验收

- 连续三次重启后测试记录仍存在；
- 人为中断迁移后原库可继续使用；
- 备份恢复前后表行数、外键检查和校验值一致；
- 默认启动无法从局域网访问；
- 本地真实数据目录不进入 Git。

## 5. 里程碑 1：领域模型、账户、内容、表格与日程

### 先写测试

- 账户平台枚举、账号唯一性和停用规则；
- 内容五项最小必填、状态机合法迁移和实际发布日期保护；
- 日历派生事件幂等生成、计划日期拖动、实际日期不可拖动；
- 分页、筛选、排序和保存视图的契约测试；
- Gherkin：30 秒创建内容、从表格进入详情、日历调整计划、归档内容；
- E2E：320、390、768、1024、1440 像素关键流程。

### 实现文件

- `domain/accounts/*`、`domain/contents/*`；
- `db/repositories/accounts.ts`、`contents.ts`、`schedule-events.ts`、`saved-views.ts`；
- `app/api/accounts/*`、`app/api/contents/*`、`app/api/calendar/*`；
- `components/shell/*`：桌面侧栏、移动底栏、全局命令入口；
- `components/table/*`：服务端分页、筛选、排序、列配置；
- `components/forms/content-quick-create.tsx`：五项必填的渐进录入；
- `components/calendar/*`：月、周、列表视图；
- `app/accounts/page.tsx`、`app/contents/page.tsx`、`app/contents/[id]/page.tsx`、`app/calendar/page.tsx`。

### 验收

- 表格、详情和日历修改同一记录后立即一致；
- 10,000 条内容下常用查询 P95 不高于 200ms；
- 手机端可以创建、查看、补录和移动计划事件；
- 关键页面无非预期横向滚动，axe serious/critical 为 0。

## 6. 里程碑 2：XLSX/CSV 与飞书迁移

### 依赖门槛

在引入 XLSX 解析库前完成许可证、维护状态、压缩炸弹防护和已知漏洞审查；未通过则换库，不在业务层绑定单一第三方 API。

### 先写测试

- CSV 编码、引号、换行、空值、超长单元格和公式注入；
- XLSX 多工作表、隐藏列、合并单元格、公式、外链、宏标记和异常压缩比；
- 当前飞书“发布记录、收入明细、账号概览”字段映射夹具；
- 精确重复、模糊重复、外部 ID 冲突和中低置信关联；
- 单事务写入、故障回滚、批次撤销和原始字段保留；
- Gherkin：上传—映射—预览—修复—备份—导入—撤销。

### 实现文件

- `lib/import/file-policy.ts`、`readers/csv.ts`、`readers/xlsx.ts`；
- `lib/import/header-detection.ts`、`mapping.ts`、`normalization.ts`、`dedupe.ts`、`validation.ts`；
- `lib/import/templates/feishu.ts`、`templates/matrix-compass.ts`；
- `db/repositories/import-batches.ts`、`import-rows.ts`；
- `app/api/imports/preview/route.ts`、`commit/route.ts`、`rollback/route.ts`、`report/route.ts`；
- `components/import-wizard/*` 与 `app/imports/page.tsx`；
- `tests/fixtures/imports/*`，只放脱敏样本。

### 验收

- 导入前不会写入业务表；
- 10,000 行文件在目标开发机 30 秒内完成预览、校验、写入和报告；
- 任一错误行都能定位工作表、行、列、原始值和建议；
- 未映射字段、未归因收入和模糊重复均可追踪；
- 撤销后业务表与导入前备份一致。

## 7. 里程碑 3：指标快照、收入、成本、归因与 ROI

### 先写测试

- 不同平台指标字典和只显示适用字段；
- T+1、T+3、T+7 快照追加不覆盖；
- 金额整数运算、税费、平台费、取消收入和多币种拒绝规则；
- 分配金额不超过净收入、部分分配保留未归因余额；
- 零成本、零工时和缺失分母返回空值；
- Gherkin：记录收入—拆分归因—补录成本—查看现金与经济 ROI—撤销关联。

### 实现文件

- `domain/metrics/*`、`domain/finance/*`；
- `db/repositories/metric-snapshots.ts`、`income.ts`、`costs.ts`、`attributions.ts`；
- `app/api/metrics/*`、`app/api/finance/*`；
- `components/forms/metric-snapshot-form.tsx`；
- `components/finance/*`、`app/finance/page.tsx`；
- 内容详情页增加指标、收入、成本和归因区域。

### 验收

- 任一总额均可下钻到原始流水和归因记录；
- 零错误自动归因：只有高置信规则可建议，最终写入需要用户确认；
- 未归因金额始终显式显示；
- 取消或修改收入后所有派生指标可重算且不留脏缓存。

## 8. 里程碑 4：可视化、复盘、实验与策略资产

### 先写测试

- 同平台、同账号、同窗口 90 天中位数基线；
- 缺项权重重归一、少于两项不输出综合指数；
- 样本少于三篇不输出“最佳”结论；
- 策略证据升级、降级、反例和适用边界；
- 图表空数据、单点、极值、长标签、色盲与键盘操作；
- Gherkin：从异常内容生成复盘—提出单变量实验—累积证据—形成策略。

### 实现文件

- `domain/analysis/baselines.ts`、`performance-index.ts`、`evidence-level.ts`、`recommendations.ts`；
- `db/repositories/reviews.ts`、`strategy-rules.ts`、`strategy-evidence.ts`；
- `app/api/analysis/*`；
- `components/charts/*`：优先使用受控 SVG 组件，避免为基础图表引入重型运行时；
- `components/analysis/*`、`app/analysis/page.tsx`；
- 首页改造为行动驱动的 `app/page.tsx`。

### 验收

- 每张图显示口径、时间窗口、样本数和缺失情况；
- 描述、解释假设和行动建议在视觉与数据结构上分层；
- 不出现未经证据支持的因果措辞；
- 表格、日历、收入与分析使用同一主数据。

## 9. 里程碑 5：安装 Skill 加固、备份运营与升级流程

### 先写测试

- 安装前环境检查和空目录检查；
- 自定义数据目录保护；
- 更新前备份与本地源码改动检测；
- 迁移失败回滚；
- 备份保留策略和“至少一个已验证备份”不变量；
- 修复流程不得包含清空用户数据。

### 实现文件

- 加固里程碑 0 建立的 `skill/matrix-compass/SKILL.md`；
- `skill/matrix-compass/scripts/install.ps1`、`start.ps1`、`update.ps1`、`backup.ps1`、`restore.ps1`、`doctor.ps1`；
- `docs/installation.md`、`docs/backup-and-restore.md`、`docs/upgrading.md`；
- 设置页增加数据目录、备份、恢复预演和诊断入口。

### 验收

- 在全新 Windows 用户目录完成一次安装、启动、备份、升级、恢复演练；
- 用户无需把 API Key 发到聊天；
- 更新前后业务记录逐表一致；
- Skill 包内不包含真实数据、密钥和机器绝对路径。

## 10. 里程碑 6：局域网手机访问、配对与冲突处理

### 先写测试

- 默认 localhost、显式开启 LAN、停止后端口关闭；
- 短时单次配对码、过期、重放、撤销设备；
- HttpOnly、SameSite、CSRF、Origin/Host 校验；
- 乐观锁版本冲突、字段级差异和草稿保留；
- 20 次断网与重连，失败写入不得显示成功；
- 移动端触控目标、软键盘、横竖屏和低宽度布局。

### 实现文件

- `lib/auth/pairing.ts`、`session.ts`、`csrf.ts`、`origin-policy.ts`；
- `db/repositories/paired-devices.ts`；
- `app/api/pairing/*`、`app/api/devices/*`；
- `components/settings/lan-access.tsx`、`device-list.tsx`、`conflict-dialog.tsx`；
- 设置页增加 LAN 风险提示、二维码和撤销入口。

### 验收

- 未配对设备无法读取业务数据；
- 撤销后现有会话立即失效；
- 电脑和手机写入同一数据库；
- 并发修改不静默覆盖；
- 界面明确提示 v1 局域网 HTTP 的传输边界。

## 11. 里程碑 7：可选 AI 与可降级提示词

### 先写测试

- 无 Key、错误 Key、超时、限流、非 JSON、空文本和超长响应；
- 默认隐私字段排除与用户逐项授权；
- AI 试图修改原始指标、收入或归因时拒绝；
- AI 草稿必须经用户确认才能保存；
- 提示词模式在任何 AI 故障下可用。

### 实现文件

- `lib/ai/context-policy.ts`、`prompt-builder.ts`、`response-schema.ts`、`provider.ts`；
- `app/api/ai/review/route.ts`；
- `components/ai/privacy-preview.tsx`、`review-draft.tsx`；
- 设置页增加本地环境变量状态检查，不回显 Key。

### 验收

- AI 完全关闭时全部核心功能可用；
- 发送前可见字段级数据范围；
- AI 输出与人工事实明确区分；
- 所有失败均退回可复制提示词，不阻塞保存与复盘。

## 12. 里程碑 8：公网演示、完整 QA 与发布

### 公网演示

- 使用脱敏种子数据和可重置沙箱；
- 全局显示“演示环境”；
- 文件导入只在浏览器临时预览，不保存真实上传；
- 健康接口明确返回 `demo` 数据源；
- 不配置真实平台密钥或用户 AI Key。

### 全量质量门槛

现有命令继续保留并扩展：

```text
npm run build
npm run lint
npm run typecheck
npm run test:unit
npm run test:coverage
npm run test:gherkin
npm run test:e2e
npm run test:mutation
```

新增质量约束：

- 导入、计算、迁移、备份和归因模块语句及分支覆盖率 100%；
- 整体分支覆盖率不低于 90%；
- 关键模块变异得分不低于 85%；
- axe serious/critical 为 0；
- 关键 E2E 控制台错误为 0；
- 320px 至 1440px 无非预期横向溢出；
- 依赖审计无未豁免的高危或严重漏洞；
- 公网构建中不存在本地绝对路径、真实数据、令牌和密钥；
- 备份恢复数据差异为 0。

### 发布演练

1. 从稳定标签安装本地版；
2. 导入脱敏飞书样本；
3. 创建内容、补指标、登记收入并完成复盘；
4. 电脑与手机同时修改并验证冲突；
5. 创建备份并升级到候选版本；
6. 执行恢复并比较数据；
7. 发布公网演示；
8. 从公网完成桌面与移动端关键流程；
9. 验证回滚到上一稳定标签。

## 13. 测试工程调整

现有测试文件先保留作为旧界面回归保护，再按模块迁移：

- `tests/dashboard-contract.test.mjs` → `tests/contract/*`；
- `tests/dashboard-ui.test.mjs` → 页面级组件测试；
- `tests/cucumber/dashboard.steps.mjs` → 按业务域拆分 steps 与 features；
- `tests/e2e/dashboard.spec.ts` → smoke、content、import、finance、mobile、backup 六组；
- `tests/vitest/dashboard-core.test.ts` → 领域层测试。

必须新增：

- 测试数据工厂，禁止依赖执行顺序；
- 每个集成测试独立临时 D1 状态目录；
- 固定时钟、固定时区和确定性 UUID 注入；
- 性能基准数据生成器；
- 故障注入：数据库锁定、磁盘写入失败、进程中断、网络断开；
- 发布候选质量报告，记录覆盖率、变异、性能、可访问性和恢复结果。

## 14. 提交与验收节奏

每个里程碑至少拆为以下提交：

1. `test: define <domain> contracts`；
2. `feat: implement <domain> foundation`；
3. `feat: add <domain> user flows`；
4. `test: harden <domain> adversarial cases`；
5. `docs: record <domain> acceptance evidence`。

每个里程碑结束时提供：

- 可运行的本地预览地址；
- 当期桌面与移动端验收截图；
- 自动化测试摘要；
- 未解决风险和下一阶段决策点；
- GitHub 最新提交与回滚点。

## 15. 开工顺序与停止条件

确认本计划后，从里程碑 0 开始，不并行铺开所有功能。出现以下任一情况立即停止扩展功能，优先修复根因：

- 持久化重启后数据丢失；
- 迁移或恢复无法可靠回滚；
- 导入产生半批数据或静默丢字段；
- 金额、归因或 ROI 不变量失败；
- 移动端写入可能静默覆盖电脑端；
- 公网构建接触本地真实数据；
- 为通过门槛而降低阈值、删断言或排除关键文件。

第一个实施交付物是“里程碑 0 可运行骨架”：本地数据库、迁移、健康检查、备份恢复和安装入口。它通过后，才开始账户、内容、表格和日历界面。
