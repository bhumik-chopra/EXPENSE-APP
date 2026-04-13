$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appPath = Join-Path $scriptDir "app.py"
$candidatePythons = @(
    (Join-Path $scriptDir ".venv311\Scripts\python.exe"),
    (Join-Path $scriptDir ".venv\Scripts\python.exe")
)

if ($env:VIRTUAL_ENV) {
    $candidatePythons = @((Join-Path $env:VIRTUAL_ENV "Scripts\python.exe")) + $candidatePythons
}

$python = $candidatePythons | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $python) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        $python = $pythonCommand.Source
    }
}

if (-not $python) {
    Write-Error "Backend Python was not found. Expected a virtualenv in backend\\.venv311 or backend\\.venv, or a system python on PATH."
}

Set-Location $scriptDir
& $python $appPath
