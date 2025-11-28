# Smoke Test v2.0 - Enhanced Security & Rollback
# Run: .\scripts\smoke-test.ps1 [-ApiKey <key>] [-Verbose] [-SkipCleanup]

param(
    [string]$ApiKey = $env:API_KEY,
    [string]$ApiUrl = "http://localhost:3001",
    [string]$DashboardUrl = "http://localhost:3000",
    [switch]$Verbose,
    [switch]$SkipCleanup,
    [int]$Timeout = 30
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# ============================================
# CONFIGURATION
# ============================================

$Config = @{
    API_URL       = $ApiUrl
    DASHBOARD_URL = $DashboardUrl
    API_KEY       = $ApiKey
    TIMEOUT       = $Timeout
    RETRY_COUNT   = 3
    RETRY_DELAY   = 2
}

# Track created resources for cleanup
$CreatedResources = @{
    Agents     = @()
    Workflows  = @()
    Executions = @()
}

# ============================================
# LOGGING SETUP
# ============================================

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir "smoke_test_$timestamp.log"

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$ts] [$Level] $Message"
    
    $logEntry | Out-File -FilePath $script:logFile -Append -Encoding UTF8 -ErrorAction SilentlyContinue
    
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "DEBUG" { "Gray" }
        default { "White" }
    }
    
    $prefix = switch ($Level) {
        "SUCCESS" { "[✓]" }
        "ERROR" { "[✗]" }
        "WARN" { "[!]" }
        "DEBUG" { "[•]" }
        default { "[i]" }
    }
    
    if ($Level -eq "DEBUG" -and -not $Verbose) {
        return
    }
    
    Write-Host "$prefix $Message" -ForegroundColor $color
}

function Invoke-ApiRequest {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [object]$Body = $null,
        [int]$ExpectedStatus = 200,
        [switch]$ValidateJson,
        [switch]$AllowNotFound
    )
    
    $url = "$($Config.API_URL)$Endpoint"
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($Config.API_KEY) {
        $headers["Authorization"] = "Bearer $($Config.API_KEY)"
    }
    
    Write-Log "Request: $Method $url" "DEBUG"
    
    try {
        $params = @{
            Uri             = $url
            Method          = $Method
            Headers         = $headers
            TimeoutSec      = $Config.TIMEOUT
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $params["Body"] = $jsonBody
            Write-Log "Body: $jsonBody" "DEBUG"
        }
        
        $response = Invoke-WebRequest @params -ErrorAction Stop
        
        Write-Log "Response: HTTP $($response.StatusCode)" "DEBUG"
        
        if ($response.StatusCode -ne $ExpectedStatus) {
            throw "Expected HTTP $ExpectedStatus but got $($response.StatusCode)"
        }
        
        $result = @{
            Success    = $true
            StatusCode = $response.StatusCode
            Response   = $response
        }
        
        if ($ValidateJson -and $response.Content) {
            try {
                $data = $response.Content | ConvertFrom-Json
                $result["Data"] = $data
                Write-Log "Response data: $($data | ConvertTo-Json -Compress)" "DEBUG"
            }
            catch {
                throw "Invalid JSON response: $($_.Exception.Message)"
            }
        }
        
        return $result
    }
    catch {
        $errorMessage = $_.Exception.Message
        
        # Handle 404 gracefully if allowed
        if ($AllowNotFound -and $errorMessage -match "404") {
            Write-Log "Resource not found (404) - allowed" "DEBUG"
            return @{
                Success    = $true
                StatusCode = 404
                NotFound   = $true
            }
        }
        
        Write-Log "Request failed: $errorMessage" "DEBUG"
        
        return @{
            Success = $false
            Error   = $errorMessage
        }
    }
}

function Test-SmokeTest {
    param(
        [string]$Name,
        [scriptblock]$TestBlock
    )
    
    Write-Log "`nRunning: $Name" "INFO"
    
    try {
        $startTime = Get-Date
        & $TestBlock
        $duration = ((Get-Date) - $startTime).TotalSeconds
        
        Write-Log "$Name [PASSED] (${duration}s)" "SUCCESS"
        $script:testsPassed++
        return $true
    }
    catch {
        Write-Log "$Name [FAILED]" "ERROR"
        Write-Log "Error: $($_.Exception.Message)" "ERROR"
        
        # Log stack trace in verbose mode
        if ($Verbose) {
            Write-Log "Stack: $($_.ScriptStackTrace)" "DEBUG"
        }
        
        $script:testsFailed++
        return $false
    }
}

function Invoke-Cleanup {
    if ($SkipCleanup) {
        Write-Log "Cleanup skipped (--SkipCleanup)" "WARN"
        return
    }
    
    Write-Log "`nCleaning up test resources..." "INFO"
    
    # Delete agents (cascades to executions)
    foreach ($agentId in $CreatedResources.Agents) {
        Write-Log "Deleting agent $agentId..." "DEBUG"
        $result = Invoke-ApiRequest -Method DELETE `
            -Endpoint "/api/agents/$agentId" `
            -ExpectedStatus 204 `
            -AllowNotFound
        
        if ($result.Success) {
            Write-Log "Agent $agentId deleted" "SUCCESS"
        }
        else {
            Write-Log "Failed to delete agent $agentId" "WARN"
        }
    }
    
    # Delete workflows
    foreach ($workflowId in $CreatedResources.Workflows) {
        Write-Log "Deleting workflow $workflowId..." "DEBUG"
        $result = Invoke-ApiRequest -Method DELETE `
            -Endpoint "/api/workflows/$workflowId" `
            -ExpectedStatus 204 `
            -AllowNotFound
        
        if ($result.Success) {
            Write-Log "Workflow $workflowId deleted" "SUCCESS"
        }
        else {
            Write-Log "Failed to delete workflow $workflowId" "WARN"
        }
    }
    
    Write-Log "Cleanup completed" "SUCCESS"
}

# ============================================
# HEADER
# ============================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          AETHERMIND SMOKE TEST v2.0" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "API:       $($Config.API_URL)" -ForegroundColor Gray
Write-Host "Dashboard: $($Config.DASHBOARD_URL)" -ForegroundColor Gray
Write-Host "Log:       $logFile" -ForegroundColor Gray
Write-Host ""

$testsPassed = 0
$testsFailed = 0
$testStartTime = Get-Date

# Validate API Key
if (-not $Config.API_KEY) {
    Write-Log "WARNING: No API Key provided" "WARN"
    Write-Log "Set: `$env:API_KEY='your-api-key'" "WARN"
    Write-Log "Some tests may fail without authentication" "WARN"
    Write-Host ""
    
    $response = Read-Host "Continue without API Key? (y/N)"
    if ($response -ne "y") {
        Write-Log "Aborted by user" "ERROR"
        exit 1
    }
}

# ============================================
# TEST 1: API Health
# ============================================

Test-SmokeTest "API Health Check" {
    $result = Invoke-ApiRequest -Endpoint "/health" -ValidateJson
    
    if (-not $result.Success) {
        throw "API not responding: $($result.Error)"
    }
    
    $health = $result.Data
    
    if ($health.status -ne "ok") {
        throw "API status is not OK: $($health.status)"
    }
    
    # Validate health response structure
    $requiredFields = @("status", "timestamp", "uptime")
    foreach ($field in $requiredFields) {
        if (-not $health.$field) {
            throw "Health response missing field: $field"
        }
    }
    
    Write-Log "API status: $($health.status)" "DEBUG"
    Write-Log "Uptime: $($health.uptime)s" "DEBUG"
}

# ============================================
# TEST 2: Create Agent
# ============================================

$agentId = $null
Test-SmokeTest "Create Agent" {
    $agentData = @{
        name         = "smoke-test-agent-$timestamp"
        model        = "gpt-4o-mini"
        systemPrompt = "You are a test agent for smoke testing"
        temperature  = 0.7
        maxTokens    = 100
    }
    
    $result = Invoke-ApiRequest -Method POST `
        -Endpoint "/api/agents" `
        -Body $agentData `
        -ExpectedStatus 201 `
        -ValidateJson
    
    if (-not $result.Success) {
        throw "Failed to create agent: $($result.Error)"
    }
    
    $agent = $result.Data
    
    if (-not $agent.id) {
        throw "Agent created but no ID returned"
    }
    
    $script:agentId = $agent.id
    $CreatedResources.Agents += $agent.id
    
    Write-Log "Agent created: $($agent.id)" "DEBUG"
    Write-Log "Agent name: $($agent.name)" "DEBUG"
    
    # Validate agent structure
    if ($agent.model -ne $agentData.model) {
        throw "Agent model mismatch: expected $($agentData.model), got $($agent.model)"
    }
}

# ============================================
# TEST 3: List Agents
# ============================================

Test-SmokeTest "List Agents" {
    $result = Invoke-ApiRequest -Endpoint "/api/agents" -ValidateJson
    
    if (-not $result.Success) {
        throw "Failed to list agents: $($result.Error)"
    }
    
    $agents = $result.Data
    
    if (-not $agents -or $agents.Count -eq 0) {
        throw "No agents returned (expected at least our test agent)"
    }
    
    # Verify our agent is in the list
    $foundAgent = $agents | Where-Object { $_.id -eq $script:agentId }
    if (-not $foundAgent) {
        throw "Created agent not found in list"
    }
    
    Write-Log "Found $($agents.Count) agents" "DEBUG"
}

# ============================================
# TEST 4: Get Agent by ID
# ============================================

Test-SmokeTest "Get Agent by ID" {
    if (-not $script:agentId) {
        throw "No agent ID from previous test"
    }
    
    $result = Invoke-ApiRequest -Endpoint "/api/agents/$script:agentId" -ValidateJson
    
    if (-not $result.Success) {
        throw "Failed to get agent: $($result.Error)"
    }
    
    $agent = $result.Data
    
    if ($agent.id -ne $script:agentId) {
        throw "Agent ID mismatch"
    }
    
    Write-Log "Agent retrieved: $($agent.name)" "DEBUG"
}

# ============================================
# TEST 5: Update Agent
# ============================================

Test-SmokeTest "Update Agent" {
    if (-not $script:agentId) {
        throw "No agent ID from previous test"
    }
    
    $updateData = @{
        name         = "smoke-test-agent-UPDATED-$timestamp"
        systemPrompt = "Updated system prompt for testing"
    }
    
    $result = Invoke-ApiRequest -Method PUT `
        -Endpoint "/api/agents/$script:agentId" `
        -Body $updateData `
        -ValidateJson
    
    if (-not $result.Success) {
        throw "Failed to update agent: $($result.Error)"
    }
    
    $agent = $result.Data
    
    if ($agent.name -ne $updateData.name) {
        throw "Agent name not updated"
    }
    
    Write-Log "Agent updated: $($agent.name)" "DEBUG"
}

# ============================================
# TEST 6: Execute Task
# ============================================

$executionId = $null
Test-SmokeTest "Execute Task" {
    if (-not $script:agentId) {
        throw "No agent ID from previous test"
    }
    
    $taskData = @{
        input = "Respond with 'SMOKE TEST PASSED' and nothing else"
    }
    
    Write-Log "Executing task (timeout: $($Config.TIMEOUT)s)..." "DEBUG"
    
    $result = Invoke-ApiRequest -Method POST `
        -Endpoint "/api/agents/$script:agentId/execute" `
        -Body $taskData `
        -ExpectedStatus 200 `
        -ValidateJson
    
    if (-not $result.Success) {
        throw "Task execution failed: $($result.Error)"
    }
    
    $execution = $result.Data
    
    if (-not $execution.executionId) {
        throw "No execution ID returned"
    }
    
    $script:executionId = $execution.executionId
    $CreatedResources.Executions += $execution.executionId
    
    Write-Log "Execution ID: $($execution.executionId)" "DEBUG"
    
    # Validate response structure
    if ($execution.status -notin @("pending", "running", "completed")) {
        throw "Invalid execution status: $($execution.status)"
    }
}

# ============================================
# TEST 7: Get Execution Status
# ============================================

Test-SmokeTest "Get Execution Status" {
    if (-not $script:executionId) {
        throw "No execution ID from previous test"
    }
    
    # Poll for completion (max 10 attempts)
    $maxAttempts = 10
    $pollDelay = 2
    $completed = $false
    
    for ($i = 1; $i -le $maxAttempts; $i++) {
        Write-Log "Polling execution status (attempt $i/$maxAttempts)..." "DEBUG"
        
        $result = Invoke-ApiRequest -Endpoint "/api/executions/$script:executionId" -ValidateJson
        
        if (-not $result.Success) {
            throw "Failed to get execution status: $($result.Error)"
        }
        
        $execution = $result.Data
        Write-Log "Status: $($execution.status)" "DEBUG"
        
        if ($execution.status -eq "completed") {
            $completed = $true
            Write-Log "Execution completed successfully" "DEBUG"
            break
        }
        elseif ($execution.status -eq "failed") {
            throw "Execution failed: $($execution.error)"
        }
        
        if ($i -lt $maxAttempts) {
            Start-Sleep -Seconds $pollDelay
        }
    }
    
    if (-not $completed) {
        throw "Execution did not complete within timeout"
    }
}

# ============================================
# TEST 8: Get Logs
# ============================================

Test-SmokeTest "Get Logs" {
    $result = Invoke-ApiRequest -Endpoint "/api/logs?limit=10" -ValidateJson
    
    if (-not $result.Success) {
        throw "Failed to get logs: $($result.Error)"
    }
    
    $logs = $result.Data
    
    if (-not $logs) {
        throw "No logs returned"
    }
    
    Write-Log "Retrieved $($logs.Count) logs" "DEBUG"
    
    # Validate log structure
    if ($logs.Count -gt 0) {
        $log = $logs[0]
        $requiredFields = @("id", "level", "message", "timestamp")
        foreach ($field in $requiredFields) {
            if (-not $log.$field) {
                throw "Log missing field: $field"
            }
        }
    }
}

# ============================================
# TEST 9: Get Costs
# ============================================

Test-SmokeTest "Get Costs" {
    $result = Invoke-ApiRequest -Endpoint "/api/costs" -ValidateJson
    
    if (-not $result.Success) {
        throw "Failed to get costs: $($result.Error)"
    }
    
    $costs = $result.Data
    
    # Costs may be empty if no executions have costs yet
    Write-Log "Retrieved costs data" "DEBUG"
    
    # Validate structure if costs exist
    if ($costs -and $costs.Count -gt 0) {
        $cost = $costs[0]
        if (-not $cost.amount) {
            throw "Cost data missing amount field"
        }
    }
}

# ============================================
# TEST 10: Dashboard Accessible
# ============================================

Test-SmokeTest "Dashboard Accessible" {
    try {
        $response = Invoke-WebRequest -Uri $Config.DASHBOARD_URL `
            -TimeoutSec 5 `
            -UseBasicParsing `
            -ErrorAction Stop
        
        if ($response.StatusCode -ne 200) {
            throw "Dashboard returned HTTP $($response.StatusCode)"
        }
        
        # Validate it's actually HTML (not error JSON)
        if ($response.Content -notmatch "<html|<!DOCTYPE") {
            throw "Dashboard response is not HTML"
        }
        
        Write-Log "Dashboard is accessible" "DEBUG"
    }
    catch {
        throw "Dashboard not accessible: $($_.Exception.Message)"
    }
}

# ============================================
# TEST 11: Delete Agent (Cleanup)
# ============================================

Test-SmokeTest "Delete Agent" {
    if (-not $script:agentId) {
        throw "No agent ID from previous test"
    }
    
    $result = Invoke-ApiRequest -Method DELETE `
        -Endpoint "/api/agents/$script:agentId" `
        -ExpectedStatus 204
    
    if (-not $result.Success) {
        throw "Failed to delete agent: $($result.Error)"
    }
    
    # Verify deletion
    $verifyResult = Invoke-ApiRequest -Endpoint "/api/agents/$script:agentId" `
        -AllowNotFound
    
    if (-not $verifyResult.NotFound) {
        throw "Agent still exists after deletion"
    }
    
    Write-Log "Agent deleted and verified" "DEBUG"
    
    # Remove from cleanup list
    $CreatedResources.Agents = $CreatedResources.Agents | Where-Object { $_ -ne $script:agentId }
}

# ============================================
# CLEANUP
# ============================================

try {
    Invoke-Cleanup
}
catch {
    Write-Log "Cleanup failed: $($_.Exception.Message)" "ERROR"
}

# ============================================
# SUMMARY
# ============================================

$testDuration = ((Get-Date) - $testStartTime).TotalSeconds

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                    TEST SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$total = $testsPassed + $testsFailed
$passRate = if ($total -gt 0) { [math]::Round(($testsPassed / $total) * 100, 1) } else { 0 }

Write-Host "Total:    $total tests" -ForegroundColor White
Write-Host "Passed:   $testsPassed tests" -ForegroundColor Green
Write-Host "Failed:   $testsFailed tests" -ForegroundColor $(if ($testsFailed -gt 0) { "Red" } else { "Green" })
Write-Host "Duration: ${testDuration}s" -ForegroundColor Gray
Write-Host "Rate:     $passRate%" -ForegroundColor $(if ($passRate -eq 100) { "Green" } else { "Yellow" })
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Log "ALL SMOKE TESTS PASSED!" "SUCCESS"
    Write-Host ""
    Write-Host "✓ System is fully operational and ready for production" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  - Run unit tests: pnpm test" -ForegroundColor White
    Write-Host "  - Run integration tests: pnpm test:integration" -ForegroundColor White
    Write-Host "  - Review logs: Get-Content $logFile" -ForegroundColor White
    Write-Host ""
    exit 0
}
else {
    Write-Log "SMOKE TESTS FAILED" "ERROR"
    Write-Host ""
    Write-Host "✗ $testsFailed/$total tests failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Action required:" -ForegroundColor Yellow
    Write-Host "  - Review failed tests above" -ForegroundColor White
    Write-Host "  - Check logs: Get-Content $logFile" -ForegroundColor White
    Write-Host "  - Fix issues and re-run smoke tests" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Log saved to: $logFile" -ForegroundColor Gray
Write-Host ""