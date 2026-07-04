param(
  [string]$BaseUrl = "",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)
  throw $Message
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Step "Checking git-tracked sensitive files"
$sensitiveTracked = git ls-files | Select-String -Pattern '(^|/)(\.env|OpenAI Key|AWS Access Key|.*key.*\.txt|.*secret.*)$'
if ($sensitiveTracked) {
  $sensitiveTracked | ForEach-Object { Write-Host $_.Line -ForegroundColor Red }
  Fail "Sensitive-looking files are tracked by git. Remove them before launch."
}
Write-Host "No tracked env/key files found." -ForegroundColor Green

Write-Step "Scanning tracked files for common secret patterns"
$secretScan = git grep -n -E '(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA|OPENSSH|PRIVATE) KEY|aws_secret_access_key|OPENAI_API_KEY=|DATABASE_URL=postgresql://|AUTH_TOKEN_SECRET=)' -- . ':!*.md' ':!*.example' 2>$null
if ($LASTEXITCODE -eq 0 -and $secretScan) {
  $secretScan | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  Fail "Potential secret values found in tracked source files."
}
Write-Host "No obvious secret values found in tracked source files." -ForegroundColor Green

Write-Step "Checking production env example"
$requiredNames = @(
  "APP_ENV",
  "MOCK_AI",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "DATABASE_URL",
  "REQUIRE_USER_ACCOUNTS",
  "AUTH_TOKEN_SECRET",
  "AUTH_TOKEN_TTL_DAYS",
  "MAX_SOURCE_CHARS",
  "MAX_UPLOAD_MB",
  "PER_USER_DAILY_AI_LIMIT",
  "GLOBAL_DAILY_AI_LIMIT"
)
$exampleText = Get-Content -Path ".env.production.example" -Raw
foreach ($name in $requiredNames) {
  if ($exampleText -notmatch "(?m)^$name=") {
    Fail ".env.production.example is missing $name."
  }
}
Write-Host ".env.production.example contains required launch variables." -ForegroundColor Green

if (-not $SkipBuild) {
  Write-Step "Compiling backend"
  & ".\.venv\Scripts\python.exe" -m compileall backend

  Write-Step "Building frontend"
  Push-Location frontend
  npm run build
  Pop-Location
}

if ($BaseUrl) {
  Write-Step "Checking deployed health endpoint"
  $healthUrl = $BaseUrl.TrimEnd("/") + "/api/health"
  $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing
  Write-Host $response.Content -ForegroundColor Green
}

Write-Step "Production readiness check complete"
Write-Host "This script does not rotate secrets or configure cloud services. Complete docs/launch-checklist.md before public launch." -ForegroundColor Yellow
