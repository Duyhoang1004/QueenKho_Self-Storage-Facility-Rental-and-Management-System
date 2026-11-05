param(
    [string]$MockitoAgent = '',
    [string]$TestPattern = '*Test',
    [switch]$SqlServer,
    [switch]$Api
)

$ErrorActionPreference = 'Stop'
$businessRoot = Split-Path -Parent $PSScriptRoot
$businessBackend = Join-Path $businessRoot 'backend/api'
$businessFrontend = Join-Path $businessRoot 'frontend'
$businessStarted = Get-Date

if ($SqlServer -and -not $env:QK_SQLSERVER_TEST_SERVER) {
    throw 'Set QK_SQLSERVER_TEST_SERVER, QK_SQLSERVER_TEST_USER, QK_SQLSERVER_TEST_PASSWORD first.'
}
if ($Api -and -not $env:QK_API_BASE_URL) {
    throw 'Set QK_API_BASE_URL and the QK_API_* test-account credentials first.'
}
if (-not $SqlServer -and $env:QK_SQLSERVER_TEST_SERVER) {
    throw 'SQL environment is set. Add -SqlServer explicitly or unset QK_SQLSERVER_TEST_SERVER.'
}
if (-not $Api -and $env:QK_API_BASE_URL) {
    throw 'API environment is set. Add -Api explicitly or unset QK_API_BASE_URL.'
}

# Attaching the agent explicitly works in Windows sandboxes where dynamic attach is blocked.
if (-not $MockitoAgent) {
    $businessCache = Join-Path $env:USERPROFILE '.m2/repository/org/mockito/mockito-core'
    $businessJar = Get-ChildItem $businessCache -Filter 'mockito-core-*.jar' -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch '(sources|javadoc)' } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($businessJar) { $MockitoAgent = $businessJar.FullName }
}

$businessMavenArgs = @("-Dtest=$TestPattern", 'test')
if ($MockitoAgent) {
    if (-not (Test-Path -LiteralPath $MockitoAgent)) { throw 'Mockito agent jar does not exist.' }
    $businessMavenArgs = @("-Dtest=$TestPattern", "-DargLine=-javaagent:`"$MockitoAgent`"", 'test')
}

Push-Location $businessBackend
try {
    $businessMaven = if ($IsWindows -or $env:OS -eq 'Windows_NT') { '.\mvnw.cmd' } else { './mvnw' }
    & $businessMaven @businessMavenArgs
    $businessBackendExit = $LASTEXITCODE
    $businessRows = @(Get-ChildItem 'target/surefire-reports/TEST-*.xml' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $businessStarted } | ForEach-Object {
            [xml]$businessXml = Get-Content -LiteralPath $_.FullName
            [pscustomobject]@{
                suite = $businessXml.testsuite.name
                tests = [int]$businessXml.testsuite.tests
                failures = [int]$businessXml.testsuite.failures
                errors = [int]$businessXml.testsuite.errors
                skipped = [int]$businessXml.testsuite.skipped
            }
        })
    $businessRows | ConvertTo-Json -Depth 3 | Set-Content 'target/business-test-results.json' -Encoding utf8
} finally { Pop-Location }

# Still run frontend tests when backend regressions fail; do not hide either result.
Push-Location $businessFrontend
try {
    if ($IsWindows -or $env:OS -eq 'Windows_NT') { & npm.cmd test } else { & npm test }
    $businessFrontendExit = $LASTEXITCODE
} finally { Pop-Location }

Write-Host "Backend exit: $businessBackendExit; frontend exit: $businessFrontendExit"
Write-Host 'Backend summary: backend/api/target/business-test-results.json'
Write-Host 'Failures are real failures; known regressions are not disabled or counted as passes.'
if ($businessBackendExit -ne 0 -or $businessFrontendExit -ne 0) { exit 1 }
exit 0
