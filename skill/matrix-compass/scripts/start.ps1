param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [Parameter(Mandatory = $true)]
  [string]$DataPath,
  [switch]$Lan
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $resolvedProject "package.json"))) {
  throw "The target is not a Matrix Compass project: $resolvedProject"
}
Set-MatrixCompassDataPath -DataPath $DataPath -ProjectPath $resolvedProject | Out-Null
Push-Location $resolvedProject
try {
  if ($Lan) { & npm run dev:lan } else { & npm run dev }
  if ($LASTEXITCODE -ne 0) { throw "Matrix Compass failed to start." }
} finally {
  Pop-Location
}
