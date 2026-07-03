param(
    [string] $SourceDir = "deploy\elasticbeanstalk",
    [string] $OutputPath = "deploy-artifacts\ai-study-assistant-eb.zip"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ResolvedSourceDir = Join-Path $Root $SourceDir
$ResolvedOutputPath = Join-Path $Root $OutputPath
$OutputDir = Split-Path -Parent $ResolvedOutputPath

if (-not (Test-Path (Join-Path $ResolvedSourceDir "Dockerrun.aws.json"))) {
    throw "Dockerrun.aws.json was not found in $ResolvedSourceDir"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path $ResolvedOutputPath) {
    Remove-Item -Force $ResolvedOutputPath
}

Compress-Archive -Path (Join-Path $ResolvedSourceDir "Dockerrun.aws.json") -DestinationPath $ResolvedOutputPath
Write-Host "Created Elastic Beanstalk bundle: $ResolvedOutputPath"
