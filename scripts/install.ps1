# Run from a trusted checkout. Never downloads or executes remote scripts.
$ErrorActionPreference = 'Stop'
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { throw 'Python 3 is required. Install Python before using zSSH.' }
& python "$PSScriptRoot/zssh.py" init
if ($LASTEXITCODE -ne 0) { throw 'zSSH bootstrap failed' }
