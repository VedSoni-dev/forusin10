param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$cliDir = Join-Path $InstallDir "resources\cli\win"
$current = [Environment]::GetEnvironmentVariable("Path", "User")

if ([string]::IsNullOrWhiteSpace($current)) {
  [Environment]::SetEnvironmentVariable("Path", $cliDir, "User")
  exit 0
}

$parts = $current.Split(";") | Where-Object { $_.Trim() -ne "" }
if ($parts -contains $cliDir) {
  exit 0
}

$updated = ($parts + $cliDir) -join ";"
[Environment]::SetEnvironmentVariable("Path", $updated, "User")
