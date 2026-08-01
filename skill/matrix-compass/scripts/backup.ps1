param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [Parameter(Mandatory = $true)]
  [string]$DataPath
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$runtime = Initialize-MatrixCompassRuntime
Write-MatrixCompassRuntimeSummary -Runtime $runtime
Set-MatrixCompassDataPath -DataPath $DataPath -ProjectPath $resolvedProject | Out-Null
Push-Location $resolvedProject
try {
  Invoke-MatrixCompassNpm -Runtime $runtime -Arguments @("run", "backup")
  if ($LASTEXITCODE -ne 0) { throw "Backup creation or verification failed." }
} finally {
  Pop-Location
}
