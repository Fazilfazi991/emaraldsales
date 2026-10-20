param([Parameter(ValueFromRemainingArguments=$true)][string[]]$TaskArguments)
$ErrorActionPreference = 'Stop'
$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($pnpmCommand) {
    $pnpmExecutable = $pnpmCommand.Source
} else {
    $pnpmExecutable = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    if (-not (Test-Path -LiteralPath $pnpmExecutable)) { throw 'Install Node.js 22+ and pnpm 11.25.0, then retry.' }
}
Push-Location (Split-Path -Parent $PSScriptRoot)
try { & $pnpmExecutable @TaskArguments; exit $LASTEXITCODE } finally { Pop-Location }
