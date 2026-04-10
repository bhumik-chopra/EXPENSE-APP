$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $scriptDir ".venv311\Scripts\python.exe"
$appPath = Join-Path $scriptDir "app.py"
$healthUrl = "http://127.0.0.1:5000/api/health"

if (-not (Test-Path $venvPython)) {
    Write-Error "Backend venv Python not found at $venvPython"
}

if (-not (Test-Path $appPath)) {
    Write-Error "Backend app not found at $appPath"
}

try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
    Write-Host "Backend is already running at $healthUrl" -ForegroundColor Yellow
    Write-Host ("Health: " + ($health | ConvertTo-Json -Compress))
    exit 0
} catch {
    # Backend is not up yet, continue with startup.
}

Write-Host "Starting backend with $venvPython" -ForegroundColor Cyan
Write-Host "Health endpoint: $healthUrl" -ForegroundColor Cyan

Set-Location $scriptDir
& $venvPython $appPath
