$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Starting React frontend at http://127.0.0.1:5173"
Set-Location (Join-Path $Root "frontend")
npm install
npm run dev

