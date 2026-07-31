param(
  [Parameter(Mandatory = $true)]
  [string]$TargetPath,
  [Parameter(Mandatory = $true)]
  [string]$DataPath
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$repository = "https://github.com/Surge-Dan/matrix-compass.git"
$resolvedTarget = [System.IO.Path]::GetFullPath($TargetPath)
$resolvedData = Set-MatrixCompassDataPath -DataPath $DataPath -ProjectPath $resolvedTarget

if (-not [System.IO.Path]::IsPathRooted($TargetPath)) {
  throw "The installation directory must be an absolute path."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git was not found."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22.13 or newer was not found."
}
$nodeVersion = [version]((& node --version).TrimStart("v"))
if ($nodeVersion -lt [version]"22.13.0") {
  throw "Node.js $nodeVersion is too old; version 22.13 or newer is required."
}
if (Test-Path -LiteralPath $resolvedTarget) {
  if ((Get-ChildItem -LiteralPath $resolvedTarget -Force | Measure-Object).Count -gt 0) {
    throw "The installation directory is not empty: $resolvedTarget"
  }
} else {
  $parent = Split-Path -Parent $resolvedTarget
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
}

& git clone $repository $resolvedTarget
if ($LASTEXITCODE -ne 0) { throw "Git clone failed." }
Push-Location $resolvedTarget
try {
  & npm ci
  if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
  & npm run db:migrate
  if ($LASTEXITCODE -ne 0) { throw "Initial local database migration failed." }
} finally {
  Pop-Location
}
Write-Output "Matrix Compass installed: $resolvedTarget"
Write-Output "Matrix Compass data directory: $resolvedData"
