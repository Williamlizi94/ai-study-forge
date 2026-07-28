param(
    [string] $SourceDir = "deploy\elasticbeanstalk",
    [string] $OutputPath = "deploy-artifacts\ai-study-assistant-eb.zip"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ResolvedSourceDir = Join-Path $Root $SourceDir
$ResolvedOutputPath = Join-Path $Root $OutputPath
$OutputDir = Split-Path -Parent $ResolvedOutputPath

$DockerrunPath = Join-Path $ResolvedSourceDir "Dockerrun.aws.json"
$PlatformPath = Join-Path $Root ".platform"

if (-not (Test-Path $DockerrunPath)) {
    throw "Dockerrun.aws.json was not found in $ResolvedSourceDir"
}

if (-not (Test-Path $PlatformPath)) {
    throw ".platform was not found in $Root"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path $ResolvedOutputPath) {
    Remove-Item -Force $ResolvedOutputPath
}

Compress-Archive -Path $DockerrunPath, $PlatformPath -DestinationPath $ResolvedOutputPath
Write-Host "Created Elastic Beanstalk bundle: $ResolvedOutputPath"
