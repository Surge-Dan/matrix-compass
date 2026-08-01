---
name: matrix-compass
description: 在 Windows 本地安全地安装、启动、备份、恢复预演和诊断 Matrix Compass 创作者经营实验室。用户提到安装 Matrix Compass、启动本地网页、开启手机局域网访问、备份或恢复创作者数据、升级前检查、启动失败或数据库异常时，都应使用此 Skill。
compatibility: Windows PowerShell、Git、Node.js 22.13+、npm
---

# Matrix Compass 本地运维

把真实创作者数据留在用户明确选择的数据目录中，并把源码、程序版本和数据生命周期分开处理。先确认目标，再调用 `scripts/` 中的确定性脚本。

## 安全边界

- 不要把 API Key 发到聊天；产品从本机环境变量读取可选配置。
- 不要清空或重建用户数据作为排错手段。
- 不要对用户未确认的目录执行递归删除、覆盖或移动。
- 公网演示不读取本地数据，也不接受真实个人数据导入。
- 默认只监听 `127.0.0.1`；只有用户明确要求手机访问时才启用 LAN。
- 局域网模式仅用于可信 Wi-Fi，不建议做路由器公网映射。
- 更新前先创建并验证备份，再检查 Git 工作区；存在未提交修改时停止并说明。

## Node.js 运行时

脚本会统一解析 Node.js 和 npm 运行时，保证版本检查、npm CLI 与 npm 子脚本使用同一个 Node.js 22.13+。解析器只调整当前脚本进程，不修改用户或系统 PATH。

- 通常直接运行脚本，由解析器从 PATH、Windows 常见安装位置和 Codex 本地运行时中选择兼容版本。
- 需要固定版本时，把 `MATRIX_COMPASS_NODE` 设置为 Node 可执行文件的绝对路径；配置无效或版本过低时脚本会停止，不会静默回退。
- 找不到兼容 Node 或 npm CLI 时，先报告已检查的版本和路径，不要继续克隆、迁移、启动、备份或恢复。

## 安装

1. 确认用户指定的是空目录；不要自行选择或覆盖已有项目。
2. 运行：

   ```powershell
   .\scripts\install.ps1 -TargetPath "C:\明确的安装目录" -DataPath "E:\CreatorData"
   ```

3. 安装输出必须显示实际选择的 Node 路径和版本；安装完成后运行 `doctor.ps1`。
4. 首次启动使用 `start.ps1`，确认 `/api/health` 返回 `status: ok` 和 `dataSource: local-d1`。

## 启动

电脑本机使用：

```powershell
.\scripts\start.ps1 -ProjectPath "C:\安装目录" -DataPath "E:\CreatorData"
```

用户明确要在同一 Wi-Fi 的手机访问时：

```powershell
.\scripts\start.ps1 -ProjectPath "C:\安装目录" -DataPath "E:\CreatorData" -Lan
```

不要在未确认的情况下修改防火墙规则。若端口冲突，先报告占用进程和影响。

## 备份与恢复

创建备份：

```powershell
.\scripts\backup.ps1 -ProjectPath "C:\安装目录" -DataPath "E:\CreatorData"
```

恢复预演只验证校验值、模式版本、行数和外键，不替换当前数据库：

```powershell
.\scripts\restore.ps1 -ProjectPath "C:\安装目录" -DataPath "E:\CreatorData" -BackupPath "C:\备份目录"
```

里程碑 0 不开放直接覆盖恢复。需要实际替换时，说明当前限制并保留现有数据。

## 诊断

运行：

```powershell
.\scripts\doctor.ps1 -ProjectPath "C:\安装目录" -DataPath "E:\CreatorData"
```

按以下顺序定位：Node/Git 版本 → 项目文件 → 数据目录 → 迁移 → 端口 → 健康接口。报告证据和修复建议，不输出密钥值，不把删除数据作为修复路径。

## 输出要求

向用户说明：

- 使用的项目目录和数据目录；
- 当前运行模式是本机还是 LAN；
- 健康检查、迁移、备份或恢复预演的结果；
- 任何未完成风险和下一步；
- 不声称“已成功”，除非相应命令退出码和健康检查均已验证。
