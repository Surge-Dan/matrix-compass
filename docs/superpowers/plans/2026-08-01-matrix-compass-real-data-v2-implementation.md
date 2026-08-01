# Matrix Compass 真实数据经营工作台 V2 实施计划

> 日期：2026-08-01  
> 依据：`docs/superpowers/specs/2026-08-01-matrix-compass-real-data-v2-design.md`  
> 状态：待用户确认后执行  
> 优先级：本计划在冲突处覆盖 `2026-07-30-matrix-compass-creator-operations-implementation.md`。

## 1. 实施结论

不在旧演示看板上继续堆页面。实施采用“领域与真实数据底座 -> 可用工作流 -> 数据接入 -> 财务与分析 -> 移动与发布”的顺序。

每项生产代码严格执行：

1. 先写一个最小失败测试；
2. 运行并确认因缺少目标行为而失败；
3. 写最小实现；
4. 运行目标测试与相关回归；
5. 仅在全绿后重构；
6. 提交一个可独立回滚的 commit。

禁止先写生产代码再补测试。原型探索只能存在于临时文件中，验证完成后删除，再从失败测试开始正式实现。

## 2. 当前基线

已完成且不重复建设：

- 本地/演示运行模式；
- 本地 D1 数据目录和 v1 schema；
- 数据库迁移基础；
- 备份与恢复预演基础；
- Windows 安装与运行 Skill；
- 基础健康检查；
- 现有 Vitest、Cucumber、Playwright、Stryker 和安全检查管线。

当前缺口：

- 首页和 `/api/dashboard` 仍读取演示 fixture；
- 账号、内容虽有 v1 表，但没有真实 CRUD 与工作台；
- 没有文件导入、飞书 OAuth 或同步；
- 没有财务、指标、复盘和决策数据表；
- 导航仍是旧监控模块；
- 没有真实数据闭环和稳定公网全栈演示。

## 3. 横向技术约束

### 3.1 分层

```text
app/api/*                  HTTP 输入、鉴权、错误映射
lib/application/*         用例编排和事务边界
lib/domain/*              领域类型、状态机、公式和校验
lib/repositories/*        D1 仓储接口与实现
lib/import/*              暂存、映射、解析、去重和撤销
lib/integrations/feishu/* OAuth、API 客户端、同步游标
lib/security/*            凭据保护、脱敏和输入限制
components/*              页面壳、表格、表单、日历和分析
db/schema.ts              Drizzle schema
db/migrations/*           只增不改的迁移文件
```

页面组件不得直接执行 SQL。飞书客户端不得直接写业务表；必须通过统一暂存、校验和提交用例。

### 3.2 API 约定

所有 API 返回：

- 成功：`data`、`meta.requestId`、必要的分页或版本信息；
- 失败：`error.code`、用户可读 `error.message`、`error.requestId` 和可选字段错误；
- 写操作：要求记录版本，冲突返回 HTTP 409；
- 所有真实数据响应：`cache-control: no-store`；
- 不把堆栈、SQL、文件路径或远端令牌返回浏览器。

### 3.3 数据库约定

- 金额统一存最小货币单位整数；
- 时间统一存带时区的 ISO 8601；
- 所有业务表带 `version`、`created_at`、`updated_at` 和软删除字段；
- 外部来源标识使用组合唯一约束保证幂等；
- 每次迁移更新 `matrix_compass_meta.schema_version`；
- 迁移文件只增不改；
- 生产迁移前自动备份，测试同时覆盖全新安装和 v1 升级。

### 3.4 质量配置

随功能增长同步更新：

- `vitest.config.ts`：纳入全部新核心代码并维持核心模块 100% 四维覆盖；
- `stryker.config.json`：纳入导入、同步、财务、迁移和备份，核心阈值 95%；
- `features/*.feature`：每个用户闭环至少一个正常、一个异常和一个恢复场景；
- `playwright.config.ts`：最终设备矩阵为 1440×900、1366×768、390×844、360×800；
- `scripts/security-scan.mjs`：增加飞书凭据、私钥、OAuth token 和导入临时文件扫描。

## 4. 里程碑 1：真实领域底座与无假数据首页

### 目标

把正式本地模式从演示 fixture 切换为 D1。没有数据时展示接入引导；演示模式继续使用隔离 fixture。

### RED：先写失败测试

新增：

- `tests/vitest/domain-account.test.ts`
- `tests/vitest/domain-content.test.ts`
- `tests/vitest/repositories-account.test.ts`
- `tests/vitest/repositories-content.test.ts`
- `tests/vitest/bootstrap-query.test.ts`
- `tests/vitest/schema-v2-migration.test.ts`
- `tests/e2e/onboarding.spec.ts`

必须先失败的行为：

1. 空数据库返回 `needsOnboarding: true` 且所有业务指标为空；
2. 正式模式不返回任何 demo fixture；
3. 账号平台与名称组合唯一；
4. 内容标题不能为空，账号必须存在；
5. `plannedAt` 与 `publishedAt` 至少一个存在；
6. 已发布内容必须有 `publishedAt`；
7. 重复 v2 迁移不破坏数据；
8. v1 迁移到 v2 后已有账号和内容数量不变。

### GREEN：最小实现

新增或修改：

- `db/migrations/0002_real_data_core.sql`
- `db/schema.ts`
- `lib/domain/account.ts`
- `lib/domain/content.ts`
- `lib/domain/errors.ts`
- `lib/repositories/database.ts`
- `lib/repositories/accounts.ts`
- `lib/repositories/contents.ts`
- `lib/application/get-bootstrap.ts`
- `app/api/bootstrap/route.ts`
- `app/page.tsx`
- `components/app/app-shell.tsx`
- `components/onboarding/empty-state.tsx`
- `components/onboarding/demo-mode-banner.tsx`

处理原则：

- 正式模式通过 `cloudflare:workers` 的 `DB` binding 查询 D1；
- demo adapter 只在 `MATRIX_COMPASS_MODE=demo` 时注入；
- 删除正式页面对 `lib/dashboard-fixtures.ts` 的直接依赖；
- 旧 `/api/dashboard` 保留一个兼容周期，但正式模式改由真实聚合用例提供数据；
- 所有仓储方法允许注入 D1 兼容接口，避免测试依赖 mock 调用次数。

### 验收

- 本地空数据库首次打开只显示三个真实接入入口；
- demo 模式显示常驻演示标记；
- `/api/health` schema version 为 2；
- v1 数据升级前后逐表对账；
- 核心覆盖率与变异门禁通过。

### 提交

`feat: establish real data domain foundation`

## 5. 里程碑 2：账号、内容表格、表单与日历

### 目标

用户可以不依赖导入，直接在桌面或手机创建账号、内容和日程；内容表格与日历读取同一份数据。

### RED：先写失败测试

新增：

- `tests/vitest/account-use-cases.test.ts`
- `tests/vitest/content-use-cases.test.ts`
- `tests/vitest/content-calendar.test.ts`
- `tests/vitest/optimistic-concurrency.test.ts`
- `features/content-workflow.feature`
- `tests/cucumber/content-workflow.steps.mjs`
- `tests/e2e/accounts.spec.ts`
- `tests/e2e/contents.spec.ts`
- `tests/e2e/calendar.spec.ts`

必须先失败的行为：

1. 账号创建、编辑、停用和软删除；
2. 30 秒内完成最简内容创建；
3. 同一内容同时编辑时旧版本返回 409；
4. 月、周、列表视图由相同内容查询生成；
5. 未发布内容可改期，已发布内容不可拖动改变实际发布时间；
6. 移动端 360px 可完成账号选择、主题和日期录入；
7. 表格筛选、排序、分页不会丢失筛选条件。

### GREEN：最小实现

新增或修改：

- `lib/application/accounts/create-account.ts`
- `lib/application/accounts/update-account.ts`
- `lib/application/contents/create-content.ts`
- `lib/application/contents/update-content.ts`
- `lib/application/contents/list-contents.ts`
- `lib/application/contents/get-calendar.ts`
- `app/api/accounts/route.ts`
- `app/api/accounts/[id]/route.ts`
- `app/api/contents/route.ts`
- `app/api/contents/[id]/route.ts`
- `app/api/calendar/route.ts`
- `components/accounts/account-list.tsx`
- `components/accounts/account-form.tsx`
- `components/contents/content-table.tsx`
- `components/contents/content-card-list.tsx`
- `components/contents/content-form.tsx`
- `components/contents/content-detail-drawer.tsx`
- `components/calendar/content-calendar.tsx`
- `components/calendar/calendar-toolbar.tsx`
- `components/navigation/desktop-sidebar.tsx`
- `components/navigation/mobile-nav.tsx`

表格先实现必要列、筛选、排序、分页和列显隐。保存视图与复杂分组在本里程碑验收后再加，不阻塞真实数据闭环。

### 验收

- 创建一条内容后同时出现在表格和正确日期；
- 编辑、发布、复盘状态机符合领域规则；
- 桌面和移动端核心路径无横向溢出；
- 键盘可完成表单和详情抽屉操作；
- Gherkin 与四个目标视口 E2E 通过。

### 提交

`feat: add account content and calendar workflows`

## 6. 里程碑 3：XLSX/CSV 导入、预览与撤销

### 依赖门槛

在加依赖前做一次有上限的兼容验证：

1. 候选 XLSX 与 CSV 解析器必须能在当前 workerd/vinext 运行时解析脱敏样本；
2. 不执行公式、宏或外部链接；
3. 生产依赖审计无 high/critical；
4. 解析 10,000 行目标样本不超过 30 秒；
5. 验证失败立即停止该候选，不做无边界试错。

通过后锁定精确版本并提交 lockfile。若浏览器/API route 解析不满足安全或兼容要求，则把解析放入现有本地 Node 启动器的受限 worker 线程，不降低安全标准。

### RED：先写失败测试

新增：

- `tests/fixtures/import/` 下的脱敏账号、内容、收入、错误和恶意样本；
- `tests/vitest/import-file-limits.test.ts`
- `tests/vitest/import-detection.test.ts`
- `tests/vitest/import-mapping.test.ts`
- `tests/vitest/import-validation.test.ts`
- `tests/vitest/import-deduplication.test.ts`
- `tests/vitest/import-transaction.test.ts`
- `tests/vitest/import-rollback.test.ts`
- `features/file-import.feature`
- `tests/cucumber/file-import.steps.mjs`
- `tests/e2e/import-wizard.spec.ts`

必须先失败的行为：

1. 自动识别用户现有中文表头；
2. 低置信度映射必须人工确认；
3. 远端 ID 或发布序号精确重复自动跳过；
4. 标题+账号+日期相似只能进入疑似重复；
5. 错误报告包含工作表、行、列、原值和错误码；
6. 中途写入失败整批回滚；
7. 重复提交同一批次保持幂等；
8. 撤销只撤销该批次产生的变更；
9. 宏、外链、公式注入和超限文件被拒绝或安全当值读取。

### GREEN：最小实现

新增或修改：

- `db/migrations/0003_import_audit.sql`
- `db/schema.ts`
- `lib/import/types.ts`
- `lib/import/file-limits.ts`
- `lib/import/detect-dataset.ts`
- `lib/import/field-aliases.ts`
- `lib/import/map-fields.ts`
- `lib/import/normalize-row.ts`
- `lib/import/fingerprint.ts`
- `lib/import/validate-row.ts`
- `lib/import/stage-batch.ts`
- `lib/import/commit-batch.ts`
- `lib/import/rollback-batch.ts`
- `lib/import/parsers/xlsx.ts`
- `lib/import/parsers/csv.ts`
- `app/api/import/preview/route.ts`
- `app/api/import/commit/route.ts`
- `app/api/import/[batchId]/route.ts`
- `app/api/import/[batchId]/rollback/route.ts`
- `components/import/import-wizard.tsx`
- `components/import/field-mapping.tsx`
- `components/import/import-preview.tsx`
- `components/import/import-report.tsx`

### 验收

- 用户现有飞书导出文件能识别账号、发布和收入数据；
- 149 条级别样本与 10,000 行压力样本均通过；
- 导入前备份、事务提交和批次撤销可验证；
- 失败行可下载为安全 CSV；
- 任何错误不污染正式表。

### 提交

`feat: add safe spreadsheet import pipeline`

## 7. 里程碑 4：飞书 OAuth 与只读增量同步

### 目标

使用用户自建应用读取选定 Base，首次全量迁移，随后安全增量同步，不反向写入。

### 凭据保护设计

本地启动器生成随机主密钥，并使用 Windows DPAPI 当前用户范围加密保存。运行时解密后只以内存绑定提供给应用；飞书 App Secret、access token 和 refresh token 使用 AES-256-GCM 加密后持久化。

禁止把秘密放在命令行参数、URL、普通环境文件、日志或 Git。DPAPI 调用通过受限 PowerShell 子进程的标准输入传输数据，并设置 `-NoProfile -NonInteractive`。

### RED：先写失败测试

新增：

- `tests/vitest/dpapi-secret-store.test.ts`
- `tests/vitest/feishu-oauth-state.test.ts`
- `tests/vitest/feishu-token-refresh.test.ts`
- `tests/vitest/feishu-client-pagination.test.ts`
- `tests/vitest/feishu-field-drift.test.ts`
- `tests/vitest/feishu-sync-idempotency.test.ts`
- `tests/vitest/feishu-sync-conflict.test.ts`
- `features/feishu-sync.feature`
- `tests/cucumber/feishu-sync.steps.mjs`
- `tests/e2e/feishu-connection.spec.ts`

必须先失败的行为：

1. OAuth `state` 缺失、过期或不匹配时拒绝回调；
2. 日志与错误响应永远不包含令牌；
3. refresh token 轮换是原子操作；
4. API 分页重复、缺页、429、5xx 和断网不会形成错误完成状态；
5. 首次全量同步复用文件导入的映射、校验和提交管线；
6. 同一 `record_id` 重复同步幂等；
7. 本地修改与远端修改产生字段级冲突；
8. 远端删除只标记来源删除；
9. 字段改名或类型漂移暂停该表；
10. 代码库中不存在飞书写入 API 路径。

### GREEN：最小实现

新增或修改：

- `db/migrations/0004_feishu_sources.sql`
- `lib/security/redact.ts`
- `lib/security/aes-gcm.ts`
- `lib/security/windows-dpapi.ts`
- `lib/security/secret-store.ts`
- `lib/integrations/feishu/oauth.ts`
- `lib/integrations/feishu/client.ts`
- `lib/integrations/feishu/types.ts`
- `lib/integrations/feishu/discover.ts`
- `lib/integrations/feishu/sync.ts`
- `lib/integrations/feishu/cursor.ts`
- `lib/application/sync/run-source-sync.ts`
- `app/api/integrations/feishu/config/route.ts`
- `app/api/integrations/feishu/authorize/route.ts`
- `app/api/integrations/feishu/callback/route.ts`
- `app/api/integrations/feishu/sync/route.ts`
- `app/api/integrations/feishu/status/route.ts`
- `components/integrations/feishu-connect.tsx`
- `components/integrations/sync-status.tsx`
- `components/integrations/conflict-queue.tsx`
- `scripts/local-runtime.ts`

使用原生 `fetch` 调用飞书官方 OpenAPI，不引入不必要的 SDK。客户端只实现元数据、数据表、字段和记录读取、OAuth 与刷新；不实现 create/update/delete。

### 验收

- 真实授权只申请已确认的只读范围；
- 能选择账号、发布和收入数据表；
- 首次同步数据量与飞书对账一致；
- 新增远端记录后增量同步只处理变化；
- 冲突、字段漂移、授权过期和断网均有可恢复状态；
- 秘密扫描、日志扫描和生产依赖审计通过。

### 提交

`feat: add read only feishu synchronization`

## 8. 里程碑 5：财务流水、结算、成本与归因

### RED：先写失败测试

新增：

- `tests/vitest/finance-money.test.ts`
- `tests/vitest/finance-state-machine.test.ts`
- `tests/vitest/finance-attribution.test.ts`
- `tests/vitest/finance-aggregates.test.ts`
- `features/income-management.feature`
- `tests/cucumber/income-management.steps.mjs`
- `tests/e2e/income.spec.ts`

必须先失败的行为：

1. 所有金额按整数累计且无浮点误差；
2. 部分结算、已结算、取消和逾期状态转换合法；
3. 已结算金额不得超过流水金额；
4. 归因总额不得超过可分配金额；
5. 未关联和未归因收入始终可见；
6. 总收入、净收入、已结算、待结算和逾期可从原始流水重算；
7. 时间筛选使用统一口径；
8. 收入编辑冲突返回 409。

### GREEN：最小实现

新增或修改：

- `db/migrations/0005_finance.sql`
- `lib/domain/money.ts`
- `lib/domain/finance.ts`
- `lib/repositories/finance.ts`
- `lib/application/finance/create-entry.ts`
- `lib/application/finance/update-settlement.ts`
- `lib/application/finance/attribute-entry.ts`
- `lib/application/finance/get-summary.ts`
- `app/api/finance/entries/route.ts`
- `app/api/finance/entries/[id]/route.ts`
- `app/api/finance/summary/route.ts`
- `components/finance/finance-overview.tsx`
- `components/finance/finance-table.tsx`
- `components/finance/finance-form.tsx`
- `components/finance/settlement-queue.tsx`
- `components/finance/attribution-editor.tsx`

### 验收

- 飞书收入明细与本地总额、已结算和待结算逐项对账；
- 可记录成本并计算净收入；
- 未关联记录不会消失；
- 桌面端和移动端都能新增收入并跟进结算。

### 提交

`feat: add finance settlement and attribution`

## 9. 里程碑 6：指标快照、经营分析、复盘实验与决策日志

### RED：先写失败测试

新增：

- `tests/vitest/metric-snapshots.test.ts`
- `tests/vitest/analytics-definitions.test.ts`
- `tests/vitest/content-portfolio.test.ts`
- `tests/vitest/evidence-guardrails.test.ts`
- `tests/vitest/experiment-state.test.ts`
- `features/weekly-review.feature`
- `tests/cucumber/weekly-review.steps.mjs`
- `tests/e2e/analytics-and-review.spec.ts`

必须先失败的行为：

1. 新快照不覆盖历史；
2. 零或缺失分母返回空值与原因；
3. 不同平台比较显示账号规模、窗口和样本量；
4. 样本不足不输出“最佳”或确定性分类；
5. 每条建议带数据范围、样本量、依据和不确定性；
6. 实验结论只能是有效、无效或证据不足；
7. AI 失败不影响原始数据和手动复盘；
8. 决策日志可关联依据并在复查日更新结果。

### GREEN：最小实现

新增或修改：

- `db/migrations/0006_analysis_reviews.sql`
- `lib/domain/metrics.ts`
- `lib/domain/experiments.ts`
- `lib/repositories/metrics.ts`
- `lib/repositories/reviews.ts`
- `lib/analytics/definitions.ts`
- `lib/analytics/portfolio.ts`
- `lib/analytics/diagnostics.ts`
- `lib/analytics/evidence.ts`
- `lib/application/reviews/create-review.ts`
- `lib/application/experiments/manage-experiment.ts`
- `lib/application/decisions/log-decision.ts`
- `app/api/metrics/route.ts`
- `app/api/analytics/route.ts`
- `app/api/reviews/route.ts`
- `app/api/experiments/route.ts`
- `app/api/decisions/route.ts`
- `components/analytics/operations-overview.tsx`
- `components/analytics/content-portfolio.tsx`
- `components/reviews/review-editor.tsx`
- `components/reviews/experiment-board.tsx`
- `components/reviews/decision-log.tsx`

### 验收

- 所有指标可追溯到流水或快照；
- 内容四象限对样本不足安全降级；
- 一条经营信号可以转化为实验并回写验证结果；
- AI 关闭时完整闭环仍可用。

### 提交

`feat: add evidence based analytics and experiments`

## 10. 里程碑 7：移动端、局域网配对与备份运营

### RED：先写失败测试

新增：

- `tests/vitest/pairing-session.test.ts`
- `tests/vitest/mobile-write-conflict.test.ts`
- `tests/vitest/backup-retention.test.ts`
- `features/mobile-lan.feature`
- `tests/cucumber/mobile-lan.steps.mjs`
- `tests/e2e/mobile-core.spec.ts`
- `tests/e2e/backup-restore.spec.ts`

必须先失败的行为：

1. LAN 默认关闭；
2. 未配对设备不能读取或写入；
3. 配对码短时、单次使用且可撤销；
4. 手机断网不显示保存成功并保留草稿；
5. 并发编辑返回字段级冲突；
6. 备份按 7 日/4 周策略保留；
7. 恢复先 dry-run，损坏备份不能覆盖当前库；
8. 20 次断网/重连演练草稿保留率 100%。

### GREEN：最小实现

新增或修改：

- `db/migrations/0007_pairing.sql`
- `lib/security/pairing.ts`
- `lib/application/mobile/pair-device.ts`
- `lib/application/mobile/revoke-device.ts`
- `app/api/pairing/route.ts`
- `app/api/pairing/confirm/route.ts`
- `app/api/devices/route.ts`
- `components/mobile/quick-capture.tsx`
- `components/settings/device-management.tsx`
- `components/settings/backup-management.tsx`
- `lib/backup/retention.ts`
- `scripts/backup-local.ts`
- `scripts/restore-local.ts`
- `skill/scripts/Start-MatrixCompass.ps1`

### 验收

- 电脑主动开启后手机扫码访问同一份 D1；
- 手机完成内容新增、日程查看、收入新增和复盘补充；
- 撤销设备立即失效；
- 备份、修改、恢复后逐表和外键对账差异为 0。

### 提交

`feat: complete mobile pairing and recovery operations`

## 11. 里程碑 8：对抗式发布、预览与 GitHub 交付

### 公网演示

正式本地版和公网演示版共享 UI 与业务接口，持久化适配器隔离。公网演示使用独立演示数据库，持续显示演示标识，不包含飞书凭据、真实收入或本地路径。

交付需要同时验证：

- 本机真实全栈地址；
- 手机局域网地址；
- 持久公网演示地址；
- 后端 `/api/health`、版本和数据源状态。

### 全量质量门禁

依次运行并保存结果：

```powershell
npm run build
npm run lint
npm run typecheck
npm run test:unit
npm run test:skill
npm run test:coverage
npm run test:gherkin
npm run test:e2e
npm run test:mutation
npm run test:security
npm audit --omit=dev --audit-level=high
```

额外 QA：

- 新数据库安装；
- v1 数据库升级；
- 飞书全量、增量、冲突和重新授权；
- XLSX/CSV 导入、失败、撤销和重复提交；
- 收入逐项对账；
- 备份恢复；
- 1440×900、1366×768、390×844、360×800；
- 键盘与 axe；
- 控制台、网络失败和结构化日志检查；
- 秘密扫描和公网演示隔离验证。

### 发布阻断条件

任一项出现即停止发布：

- 测试失败或门禁阈值降低；
- high/critical 生产漏洞；
- 真实数据与源数据无法对账；
- 导入、同步、冲突、撤销、备份或恢复主流程失败；
- 凭据出现在日志、数据库明文、构建产物或 Git；
- 正式模式出现未标注 demo 数据；
- 任一目标设备核心流程不可完成；
- 公网地址只包含静态前端或后端不可健康检查。

### 提交

`release: deliver matrix compass real data v2`

## 12. 每个里程碑的审查节奏

每个里程碑执行以下固定流程：

1. 记录基线测试结果；
2. 建立该里程碑的行为清单；
3. 逐行为执行 RED -> GREEN -> REFACTOR；
4. 运行目标测试、相关回归和静态检查；
5. 执行一次第一性原理自审：数据是否真实、状态是否可恢复、失败是否可见；
6. 执行一次对抗式审查：恶意输入、并发、断网、重复和中断；
7. 检查 diff，确保无无关改动、无秘密、无阈值绕过；
8. 提交并推送当前阶段；
9. 给用户提供可操作预览和验收结果；
10. 只有用户确认或阶段门禁全部通过后进入下一里程碑。

## 13. 开工顺序与首次可见交付

用户确认本计划后，只启动里程碑 1，不并行展开后续复杂模块。

首次可见交付必须做到：

- 新导航壳可见；
- 正式模式无假数据；
- 空状态能进入连接飞书、导入文件或手动创建；
- D1 schema v2 与真实 bootstrap API 可用；
- 桌面和移动端空状态通过 E2E；
- 原有本地运行、备份和 Skill 不回归。

里程碑 1 验收通过后，再进入账号、内容表格和日历。
