param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ArgsFromCli
)

$command = if ($ArgsFromCli.Count -gt 0) { $ArgsFromCli[0] } else { "help" }
$rest = if ($ArgsFromCli.Count -gt 1) { $ArgsFromCli[1..($ArgsFromCli.Count - 1)] } else { @() }
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$exe = Join-Path $root "for us in 10.exe"
$baseUrl = "http://127.0.0.1:43110"

function Print-Help {
  @"
fui - local AI runtime

Usage:
  fui serve
  fui trust-web
  fui status
  fui models
"@ | Write-Output
}

switch ($command) {
  "serve" {
    Start-Process -FilePath $exe -ArgumentList @("--cli", "serve") -WindowStyle Hidden | Out-Null
    "Runtime started. Open https://www.10humansvsai.com and click Check again." | Write-Output
    exit 0
  }
  "trust-web" {
    & $exe --cli trust-web | Out-Null
    "Trusted https://www.10humansvsai.com for browser chat." | Write-Output
    exit 0
  }
  "status" {
    $health = Invoke-RestMethod -Uri "$baseUrl/v1/health" -UseBasicParsing
    "runtime: $($health.runtime) $($health.version)" | Write-Output
    "running: $($health.running)" | Write-Output
    "model: $($health.defaultModel)" | Write-Output
    "port: $($health.port)" | Write-Output
    exit 0
  }
  "models" {
    $models = Invoke-RestMethod -Uri "$baseUrl/v1/models" -UseBasicParsing
    $models.data | ForEach-Object { $_.id } | Write-Output
    exit 0
  }
  "help" { Print-Help; exit 0 }
  "--help" { Print-Help; exit 0 }
  "-h" { Print-Help; exit 0 }
  default {
    & $exe --cli @ArgsFromCli
    exit $LASTEXITCODE
  }
}
