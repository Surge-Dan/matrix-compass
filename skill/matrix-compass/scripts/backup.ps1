param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [Parameter(Mandatory = $true)]
  [string]$DataPath
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
Set-MatrixCompassDataPath -DataPath $DataPath -ProjectPath $resolvedProject | Out-Null
Push-Location $resolvedProject
try {
  & npm run backup
  if ($LASTEXITCODE -ne 0) { throw "Backup creation or verification failed." }
} finally {
  Pop-Location
}
