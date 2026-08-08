# Matrix Compass

本地优先的创作者经营实验室：账号、内容库、发布日程、收入明细、数据导入、复盘与实验分析都在一个可追溯的数据模型里完成。默认数据只保存在本机，不调用公众号、小红书、抖音或快手的后台账号，也不要求上传密钥。

## 能做什么

- 账号资产：平台、账号定位、发布节奏、粉丝快照。
- 内容与日程：内容题目、账号、计划时间、发布状态，支持日历视图。
- 收入管理：收入/支出、分类、金额（分）、结算状态、预计结算日和复盘字段。
- 文件导入：CSV、XLSX；旧版 XLS 会提示先另存为 XLSX 或 CSV；先预览字段错误，再提交；每次提交有批次，可回滚。
- 复盘实验：亮点、问题、假设、下一步行动，以及可量化的实验登记。
- 本地安全：自动迁移前备份、备份完整性校验、恢复默认 dry-run、桌面与局域网手机访问。

## 安装为本地 Skill

Node.js 22.13+、Git、Windows PowerShell：

```powershell
git clone https://github.com/Surge-Dan/matrix-compass.git C:\Tools\matrix-compass
cd C:\Tools\matrix-compass
.\skill\matrix-compass\scripts\install.ps1 -TargetPath C:\Tools\matrix-compass -DataPath C:\Users\Public\MatrixCompassData
```

如果目标目录已经是本仓库，直接安装依赖并初始化：

```powershell
npm ci
$env:MATRIX_COMPASS_DATA_DIR = "C:\Users\Public\MatrixCompassData"
npm run db:migrate
```

## 使用

桌面端：

```powershell
.\skill\matrix-compass\scripts\start.ps1 -ProjectPath C:\Tools\matrix-compass -DataPath C:\Users\Public\MatrixCompassData
```

手机与电脑在同一 Wi-Fi 时：

```powershell
.\skill\matrix-compass\scripts\start.ps1 -ProjectPath C:\Tools\matrix-compass -DataPath C:\Users\Public\MatrixCompassData -Lan
```

浏览器打开 `http://127.0.0.1:3000`；局域网模式打开终端显示的局域网地址。进入“数据导入与同步”即可粘贴 CSV 或上传 XLSX（旧版 XLS 请先另存为 XLSX/CSV），预览通过后再提交。

## 数据格式

内容导入至少需要：`platform,account,title,date`。

收入导入至少需要：`platform,account,direction,category,amount,occurred_at`；金额按元填写，系统以整数分保存。可选字段：`settlement_status,settled_amount,expected_settlement_at,currency,note`。

## 备份与恢复

```powershell
npm run backup
npm run restore:dry-run -- --backup "C:\Users\Public\MatrixCompassData\backups\<timestamp>"
npm run db:check
```

备份是本地 SQL 快照和 manifest；恢复命令默认只做隔离演练，不覆盖当前数据。

## QA

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:coverage
npm run test:gherkin
npm run test:e2e
npm run test:mutation
npm run test:security
```

真实平台 API 连接不是默认路径：平台权限、审核、账号安全和政策变化会带来高风险。本版本把可落地的本地记录、导入、分析和收入管理做成完整闭环；未来可在不改变本地数据模型的前提下增加受控连接器。
