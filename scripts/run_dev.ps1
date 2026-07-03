$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root ".venv\Scripts\python.exe"

function Resolve-BasePython {
    $SystemPython = Get-Command python -ErrorAction SilentlyContinue
    if ($SystemPython) {
        return @($SystemPython.Source)
    }

    $PythonLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($PythonLauncher) {
        return @($PythonLauncher.Source, "-3")
    }

    $CodexPython = "C:\Users\willi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    if (Test-Path $CodexPython) {
        return @($CodexPython)
    }

    throw "Python was not found. Install Python 3.11+ or create .venv manually."
}

function Invoke-BasePython {
    param(
        [string[]] $PythonSpec,
        [string[]] $ArgsList
    )

    $AllArgs = @()
    if ($PythonSpec.Count -gt 1) {
        $AllArgs += $PythonSpec[1..($PythonSpec.Count - 1)]
    }
    $AllArgs += $ArgsList
    & $PythonSpec[0] @AllArgs
}

if (-not (Test-Path $Python)) {
    Write-Host "Virtual environment not found. Creating .venv..."
    Invoke-BasePython (Resolve-BasePython) @("-m", "venv", (Join-Path $Root ".venv"))
}

Write-Host "Installing dependencies..."
& $Python -m pip install -r (Join-Path $Root "requirements.txt")

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "Building React frontend..."
    Push-Location (Join-Path $Root "frontend")
    npm install
    npm run build
    Pop-Location
}

Write-Host "Starting AI Study Assistant at http://127.0.0.1:8000"
Set-Location $Root
& $Python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
