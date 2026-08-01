param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [Parameter(Mandatory = $true)]
  [string]$DataPath
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$resolvedBackup = (Resolve-Path -LiteralPath $BackupPath).Path
$runtime = Initialize-MatrixCompassRuntime
Write-MatrixCompassRuntimeSummary -Runtime $runtime
Set-MatrixCompassDataPath -DataPath $DataPath -ProjectPath $resolvedProject | Out-Null
Push-Location $resolvedProject
try {
  Invoke-MatrixCompassNpm -Runtime $runtime -Arguments @("run", "restore:dry-run", "--", "--backup", $resolvedBackup)
  if ($LASTEXITCODE -ne 0) { throw "Restore dry-run failed; the current database was not replaced." }
} finally {
  Pop-Location
}
