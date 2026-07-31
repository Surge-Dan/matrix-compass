$ErrorActionPreference = "Stop"

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
