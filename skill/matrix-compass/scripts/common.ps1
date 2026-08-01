$ErrorActionPreference = "Stop"

$script:MatrixCompassMinimumNodeVersion = [version]"22.13.0"

function Get-MatrixCompassNodeVersion {
  param(
    [Parameter(Mandatory = $true)][string]$NodePath
  )
  try {
    $output = @(& $NodePath --version 2>$null)
    if ($LASTEXITCODE -ne 0 -or $output.Count -eq 0) { return $null }
    return [version]($output[-1].Trim().TrimStart("v"))
  } catch {
    return $null
  }
}

function Resolve-MatrixCompassNpmCli {
  param(
    [Parameter(Mandatory = $true)][string]$NodePath
  )
  $candidates = [System.Collections.Generic.List[string]]::new()
  $nodeDirectory = Split-Path -Parent $NodePath
  $candidates.Add((Join-Path $nodeDirectory "node_modules\npm\bin\npm-cli.js"))

  @(Get-Command npm -All -ErrorAction SilentlyContinue) | ForEach-Object {
    $commandPath = if ($_.Source) { $_.Source } elseif ($_.Path) { $_.Path } else { $null }
    if ($commandPath) {
      $candidates.Add((Join-Path (Split-Path -Parent $commandPath) "node_modules\npm\bin\npm-cli.js"))
    }
  }

  foreach ($candidate in @($candidates | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }
  throw "npm CLI was not found. Install npm alongside Node.js or make npm available on PATH."
}

function Initialize-MatrixCompassRuntime {
  $minimum = $script:MatrixCompassMinimumNodeVersion
  $candidates = [System.Collections.Generic.List[string]]::new()
  $explicitNode = $env:MATRIX_COMPASS_NODE

  if ($explicitNode) {
    if (-not [System.IO.Path]::IsPathRooted($explicitNode) -or -not (Test-Path -LiteralPath $explicitNode -PathType Leaf)) {
      throw "MATRIX_COMPASS_NODE must point to an existing absolute Node.js executable: $explicitNode"
    }
    $explicitVersion = Get-MatrixCompassNodeVersion -NodePath $explicitNode
    if (-not $explicitVersion) {
      throw "MATRIX_COMPASS_NODE could not be executed: $explicitNode"
    }
    if ($explicitVersion -lt $minimum) {
      throw "MATRIX_COMPASS_NODE is Node.js $explicitVersion; version $minimum or newer is required."
    }
    $candidates.Add([System.IO.Path]::GetFullPath($explicitNode))
  } else {
    @(Get-Command node -All -ErrorAction SilentlyContinue) | ForEach-Object {
      $commandPath = if ($_.Source) { $_.Source } elseif ($_.Path) { $_.Path } else { $null }
      if ($commandPath -and [System.IO.Path]::IsPathRooted($commandPath)) {
        $candidates.Add([System.IO.Path]::GetFullPath($commandPath))
      }
    }

    @(
      (Join-Path $env:ProgramFiles "nodejs\node.exe"),
      (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe")
    ) | ForEach-Object { if ($_ -and (Test-Path -LiteralPath $_ -PathType Leaf)) { $candidates.Add($_) } }

    $userProfile = [Environment]::GetFolderPath("UserProfile")
    if ($userProfile) {
      $codexPattern = Join-Path $userProfile ".cache\codex-runtimes\*\dependencies\node\bin\node.exe"
      @(Get-Item -Path $codexPattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending) |
        ForEach-Object { $candidates.Add($_.FullName) }
    }
  }

  $selectedNode = $null
  $selectedVersion = $null
  $checked = [System.Collections.Generic.List[string]]::new()
  foreach ($candidate in @($candidates | Select-Object -Unique)) {
    $version = Get-MatrixCompassNodeVersion -NodePath $candidate
    $checked.Add("$candidate=$(if ($version) { $version } else { 'unavailable' })")
    if ($version -and $version -ge $minimum) {
      $selectedNode = $candidate
      $selectedVersion = $version
      break
    }
  }
  if (-not $selectedNode) {
    $checkedSummary = if ($checked.Count -gt 0) { $checked -join "; " } else { "no Node.js candidates found" }
    throw "Node.js $minimum or newer was not found. Checked: $checkedSummary"
  }

  $nodeDirectory = Split-Path -Parent $selectedNode
  $remainingPath = @($env:PATH -split ";" | Where-Object {
    $_ -and -not [string]::Equals($_.TrimEnd("\"), $nodeDirectory.TrimEnd("\"), [System.StringComparison]::OrdinalIgnoreCase)
  })
  $env:PATH = (@($nodeDirectory) + $remainingPath) -join ";"
  $npmCli = Resolve-MatrixCompassNpmCli -NodePath $selectedNode

  return [pscustomobject]@{
    NodePath = $selectedNode
    NodeVersion = [string]$selectedVersion
    NpmCliPath = $npmCli
  }
}

function Invoke-MatrixCompassNpm {
  param(
    [Parameter(Mandatory = $true)]$Runtime,
    [string[]]$Arguments = @()
  )
  & $Runtime.NodePath $Runtime.NpmCliPath @Arguments
}

function Write-MatrixCompassRuntimeSummary {
  param(
    [Parameter(Mandatory = $true)]$Runtime
  )
  Write-Output "Matrix Compass Node.js: $($Runtime.NodeVersion) ($($Runtime.NodePath))"
}

function Test-MatrixCompassSameOrChild {
  param(
    [Parameter(Mandatory = $true)][string]$ParentPath,
    [Parameter(Mandatory = $true)][string]$ChildPath
  )
  $parent = [System.IO.Path]::GetFullPath($ParentPath).TrimEnd('\', '/')
  $child = [System.IO.Path]::GetFullPath($ChildPath).TrimEnd('\', '/')
  return [string]::Equals($parent, $child, [System.StringComparison]::OrdinalIgnoreCase) -or
    $child.StartsWith($parent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
}

function Set-MatrixCompassDataPath {
  param(
    [Parameter(Mandatory = $true)][string]$DataPath,
    [Parameter(Mandatory = $true)][string]$ProjectPath
  )
  if (-not [System.IO.Path]::IsPathRooted($DataPath)) {
    throw "The data directory must be an absolute path."
  }
  $resolvedData = [System.IO.Path]::GetFullPath($DataPath)
  $resolvedProject = [System.IO.Path]::GetFullPath($ProjectPath)
  $driveRoot = [System.IO.Path]::GetPathRoot($resolvedData)
  $userHome = [Environment]::GetFolderPath("UserProfile")
  if ([string]::Equals($resolvedData.TrimEnd('\', '/'), $driveRoot.TrimEnd('\', '/'), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The data directory cannot be a drive root."
  }
  if ($userHome -and (Test-MatrixCompassSameOrChild -ParentPath $resolvedData -ChildPath $userHome) -and (Test-MatrixCompassSameOrChild -ParentPath $userHome -ChildPath $resolvedData)) {
    throw "The data directory cannot be the user profile directory."
  }
  if ((Test-MatrixCompassSameOrChild -ParentPath $resolvedData -ChildPath $resolvedProject) -or (Test-MatrixCompassSameOrChild -ParentPath $resolvedProject -ChildPath $resolvedData)) {
    throw "The data directory must be separate from the project directory."
  }
  $env:MATRIX_COMPASS_DATA_DIR = $resolvedData
  return $resolvedData
}
