# Matrix Compass Skill Node 运行时一致性设计

日期：2026-08-01  
状态：待用户确认  
范围：仅修复 `skill/matrix-compass/scripts` 的 Node/npm 运行时选择，不修改业务数据、数据库结构或网页功能。

## 1. 问题与目标

当前 PowerShell 会话可能同时存在多个 Node.js。实测中，Skill 外层版本检查通过了 Node 24，但 `npm run db:migrate` 的子进程从 PATH 命中 Node 18，导致 Wrangler 拒绝启动。

目标是让版本检查、npm CLI 和 npm 子脚本始终使用同一个 Node.js 22.13+。Skill 不修改系统 PATH、不安装 Node、不依赖用户手工注入临时 PowerShell 函数。

## 2. 已选方案

在 `common.ps1` 增加共享运行时解析与 npm 调用函数，所有安装、启动、诊断、备份和恢复脚本统一调用。

解析顺序：

1. 用户显式设置的 `MATRIX_COMPASS_NODE`；
2. PATH 中的全部 `node` 候选，而不是只取第一个；
3. Windows 常见 Node 安装位置；
4. Codex 本地运行时目录中的兼容 Node，作为 Codex Skill 的最后兜底。

每个候选都真实执行 `--version`，只接受 22.13+。选择后仅修改当前脚本进程的 PATH，把所选 Node 所在目录放在最前面；不修改用户或系统环境变量。

npm 不再直接执行 `npm.cmd`。解析器定位 npm 的 `npm-cli.js`，再通过所选 Node 调用它。这样 npm 本身和 `package.json` 子脚本都运行在同一 Node 上。

## 3. 错误处理与安全边界

- 找不到兼容 Node 时，在克隆、迁移、启动或备份前停止，并列出已检查的版本与安全修复建议。
- `MATRIX_COMPASS_NODE` 不存在、不是文件或版本过低时明确拒绝，不静默回退，以避免配置错误被掩盖。
- 找不到 npm CLI 时停止，不自动下载依赖或修改系统配置。
- 不输出环境变量中的密钥，不读取或删除业务数据。
- 继续保持源码目录与数据目录隔离规则。

## 4. 测试设计

先添加会在当前实现上失败的 PowerShell 黑盒测试：

1. PATH 第一个 Node 为 18、后续候选为 24 时，解析器选择 24；
2. 显式 `MATRIX_COMPASS_NODE` 为兼容版本时优先使用；
3. 显式 Node 版本过低时拒绝且不回退；
4. npm CLI 与 npm 子脚本观察到的 Node 版本一致；
5. 没有兼容 Node 或 npm CLI 时，在任何数据操作前失败。

修复后运行：PowerShell 黑盒测试、现有单元/覆盖率/Gherkin/E2E、安全扫描，以及一次隔离的安装→迁移→诊断→启动→`/api/health` 全链路测试。

## 5. 验收标准

- 在当前机器 PATH 首位仍是 Node 18 的情况下，无需修改系统 PATH即可完成隔离安装和启动；
- `/api/health` 返回 `status: ok`、`dataSource: local-d1`；
- 所有 Skill 操作报告实际选中的 Node 路径和版本，但不泄露敏感环境变量；
- 旧的安全边界、数据目录校验和备份/恢复行为全部保持不变；
- 修复同步到仓库 Skill 和本机已安装 Skill，GitHub `main` 保持最新。
