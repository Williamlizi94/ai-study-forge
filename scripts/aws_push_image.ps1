param(
    [Parameter(Mandatory = $true)]
    [string] $AwsAccountId,

    [Parameter(Mandatory = $true)]
    [string] $Region,

    [string] $RepositoryName = "ai-study-assistant",
    [string] $LocalImage = "ai-study-assistant:local",
    [string] $ImageTag = "latest"
)

$ErrorActionPreference = "Stop"

$EcrRegistry = "$AwsAccountId.dkr.ecr.$Region.amazonaws.com"
$RemoteImage = "$EcrRegistry/$RepositoryName`:$ImageTag"

function Invoke-NativeChecked {
    param(
        [string] $Tool,
        [string[]] $ArgsList
    )

    & $Tool @ArgsList
    if ($LASTEXITCODE -ne 0) {
        throw "$Tool failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Checking AWS CLI identity..."
Invoke-NativeChecked "aws" @("sts", "get-caller-identity")

Write-Host "Ensuring ECR repository exists: $RepositoryName"
$RepoExists = $false
$PreviousNativePreference = $PSNativeCommandUseErrorActionPreference
$PreviousErrorActionPreference = $ErrorActionPreference
$PSNativeCommandUseErrorActionPreference = $false
$ErrorActionPreference = "Continue"
& aws ecr describe-repositories `
    --repository-names $RepositoryName `
    --region $Region *> $null
$DescribeExitCode = $LASTEXITCODE
$PSNativeCommandUseErrorActionPreference = $PreviousNativePreference
$ErrorActionPreference = $PreviousErrorActionPreference
if ($DescribeExitCode -eq 0) {
    $RepoExists = $true
}

if (-not $RepoExists) {
    Invoke-NativeChecked "aws" @(
        "ecr",
        "create-repository",
        "--repository-name",
        $RepositoryName,
        "--image-scanning-configuration",
        "scanOnPush=true",
        "--region",
        $Region
    )
}

Write-Host "Logging in to ECR..."
$Password = & aws ecr get-login-password --region $Region
if ($LASTEXITCODE -ne 0) {
    throw "aws ecr get-login-password failed with exit code $LASTEXITCODE."
}
$Password | docker login --username AWS --password-stdin $EcrRegistry
if ($LASTEXITCODE -ne 0) {
    throw "docker login failed with exit code $LASTEXITCODE."
}

Write-Host "Tagging image: $RemoteImage"
Invoke-NativeChecked "docker" @("tag", $LocalImage, $RemoteImage)

Write-Host "Pushing image..."
Invoke-NativeChecked "docker" @("push", $RemoteImage)

Write-Host "Pushed: $RemoteImage"
