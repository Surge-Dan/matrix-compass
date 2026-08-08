---
name: matrix-compass
description: 在 Windows 本地安装、启动、导入、分析、备份和恢复 Matrix Compass 创作者经营实验室；数据默认只保存在本机。
compatibility: Windows PowerShell, Git, Node.js 22.13+, npm
---

# Matrix Compass 本地 Skill

这个 Skill 用于把 Matrix Compass 作为可安装、可迁移、可备份的本地工具运行。所有账号、内容、日程、收入、导入批次、复盘和实验数据保存在用户明确选择的数据目录中。

## 安装

```powershell
.\scripts\install.ps1 -TargetPath "C:\Tools\matrix-compass" -DataPath "C:\Users\Public\MatrixCompassData"
```

安装脚本会检查 Node/npm/Git，拒绝非空目标目录，安装锁定依赖，并执行初始迁移。不要把数据目录放到仓库内，也不要提交数据目录、密钥或平台 Cookie。不要把 API Key 发到聊天，不要清空或重建用户数据。

## 启动

```powershell
.\scripts\start.ps1 -ProjectPath "C:\Tools\matrix-compass" -DataPath "C:\Users\Public\MatrixCompassData"
```

手机访问必须由用户显式启用：

```powershell
.\scripts\start.ps1 -ProjectPath "C:\Tools\matrix-compass" -DataPath "C:\Users\Public\MatrixCompassData" -Lan
```

默认只监听 `127.0.0.1`。局域网模式只适合可信 Wi-Fi，不做公网映射，不自动修改防火墙。

## 数据工作流

1. 账号资产中建立平台和账号。
2. 内容库或日历中建立计划内容。
3. 收入管理中记录收入、支出、结算状态和复盘字段。
4. 数据导入与同步中选择 CSV/XLSX；旧版 XLS 先另存为 XLSX 或 CSV，先预览错误，再提交批次。
5. 复盘实验中记录证据、假设、下一行动和实验指标。

收入金额在界面按元填写，数据库按整数分保存；导入批次可通过 `/api/imports/rollback` 回滚已提交的数据。

## 备份、诊断、恢复演练

```powershell
.\scripts\doctor.ps1 -ProjectPath "C:\Tools\matrix-compass" -DataPath "C:\Users\Public\MatrixCompassData"
.\scripts\backup.ps1 -ProjectPath "C:\Tools\matrix-compass" -DataPath "C:\Users\Public\MatrixCompassData"
.\scripts\restore.ps1 -ProjectPath "C:\Tools\matrix-compass" -DataPath "C:\Users\Public\MatrixCompassData" -BackupPath "C:\...\backup"
```

恢复脚本默认只做隔离 dry-run。升级前会先创建校验备份；迁移、manifest、行数和外键都必须通过才会报告成功。

## 连接器边界

公众号、小红书、抖音、快手的后台接口权限、审核和账号安全风险不作为默认依赖。本地导入和手动记录是稳定主路径；未来连接器必须复用同一数据契约，不能绕过本地审计、批次和备份机制。公网演示不读取本地数据。

## 输出要求

报告项目路径、数据路径、运行模式、健康检查、迁移/备份/恢复演练结果和未完成风险。不要输出密钥，不要把“启动进程存在”当作健康，必须检查 `/api/health`。
