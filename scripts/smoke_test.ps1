param(
    [string] $BaseUrl = "http://127.0.0.1:8000",
    [string] $AuthToken = "",
    [switch] $RunStudyApi
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

function Invoke-StudyAssistantJson {
    param(
        [string] $Method,
        [string] $Path,
        [object] $Body = $null,
        [bool] $RequireAuth = $false
    )

    $Headers = @{}
    if ($AuthToken) {
        $Headers["Authorization"] = "Bearer $AuthToken"
    } elseif ($RequireAuth) {
        throw "Auth token is required for $Path. Pass -AuthToken after logging in."
    }

    $Args = @{
        Method = $Method
        Uri = "$BaseUrl$Path"
        Headers = $Headers
    }

    if ($null -ne $Body) {
        $Args["ContentType"] = "application/json"
        $Args["Body"] = ($Body | ConvertTo-Json -Depth 10)
    }

    Invoke-RestMethod @Args
}

Write-Host "Checking AI Study Assistant at $BaseUrl"

$Health = Invoke-StudyAssistantJson -Method "GET" -Path "/api/health"
if ($Health.status -ne "ok") {
    throw "Health check failed."
}
Write-Host "OK: /api/health"

$AuthStatus = Invoke-StudyAssistantJson -Method "GET" -Path "/api/auth/status"
Write-Host "OK: /api/auth/status auth_mode=$($AuthStatus.auth_mode)"

if ($RunStudyApi) {
    $NeedsAuth = [bool] $AuthStatus.auth_required
    $SourceText = @"
Smoke test material for AI Study Assistant.

This text is intentionally long enough to create a study session without calling
the OpenAI API. It verifies that the deployed backend can accept JSON, persist a
session, list sessions, fetch the created session, and delete it afterward.
"@

    $Created = Invoke-StudyAssistantJson `
        -Method "POST" `
        -Path "/api/study/sessions" `
        -Body @{ title = "Smoke Test Session"; source_text = $SourceText } `
        -RequireAuth $NeedsAuth
    Write-Host "OK: created session $($Created.id)"

    $Fetched = Invoke-StudyAssistantJson `
        -Method "GET" `
        -Path "/api/study/sessions/$($Created.id)" `
        -RequireAuth $NeedsAuth
    if ($Fetched.id -ne $Created.id) {
        throw "Fetched session id did not match created session id."
    }
    Write-Host "OK: fetched created session"

    $Sessions = Invoke-StudyAssistantJson `
        -Method "GET" `
        -Path "/api/study/sessions" `
        -RequireAuth $NeedsAuth
    if (-not ($Sessions | Where-Object { $_.id -eq $Created.id })) {
        throw "Created session was not found in session list."
    }
    Write-Host "OK: listed sessions"

    Invoke-StudyAssistantJson `
        -Method "DELETE" `
        -Path "/api/study/sessions/$($Created.id)" `
        -RequireAuth $NeedsAuth | Out-Null
    Write-Host "OK: deleted smoke test session"
}

Write-Host "Smoke test passed."
