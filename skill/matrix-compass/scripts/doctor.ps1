param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [Parameter(Mandatory = $true)]
  [string]$DataPath
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$checks = [ordered]@{
  Git = [bool](Get-Command git -ErrorAction SilentlyContinue)
  Node = [bool](Get-Command node -ErrorAction SilentlyContinue)
  Npm = [bool](Get-Command npm -ErrorAction SilentlyContinue)
  Package = Test-Path -LiteralPath (Join-Path $resolvedProject "package.json")
  Lockfile = Test-Path -LiteralPath (Join-Path $resolvedProject "package-lock.json")
  WranglerConfig = Test-Path -LiteralPath (Join-Path $resolvedProject "wrangler.local.jsonc")
  Migration = Test-Path -LiteralPath (Join-Path $resolvedProject "db\migrations\0001_initial.sql")
}
if ($checks.Node) {
  $nodeVersion = [version]((& node --version).TrimStart("v"))
  $checks.NodeVersion = $nodeVersion
  $checks.NodeCompatible = $nodeVersion -ge [version]"22.13.0"
} else {
  $checks.NodeCompatible = $false
}
$checks.DataPath = Set-MatrixCompassDataPath -DataPath $DataPath -ProjectPath $resolvedProject

$coreHealthy = -not ($checks.Values -contains $false)
$databaseHealthy = $false
if ($coreHealthy) {
  Push-Location $resolvedProject
  try {
    & npm run db:check
    $databaseHealthy = $LASTEXITCODE -eq 0
  } finally {
    Pop-Location
  }
}
$checks.Database = $databaseHealthy

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$checks.Port3000 = if ($listener) { "listening" } else { "not-listening" }
$checks.Health = "not-running"
if ($listener) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 3
    $checks.Health = if ($health.status -eq "ok" -and $health.dataSource -eq "local-d1") { "ok" } else { "unexpected" }
  } catch {
    $checks.Health = "unreachable"
  }
}

$checks.GetEnumerator() | ForEach-Object {
  Write-Output ("{0}: {1}" -f $_.Key, $_.Value)
}
if (-not $coreHealthy -or -not $databaseHealthy) {
  throw "Diagnostics failed; no user data was modified or cleared."
}
