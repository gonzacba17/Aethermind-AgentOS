# Smoke Test - PowerShell Version
# Run with: .\scripts\smoke-test.ps1

$API_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3001" }
$DASHBOARD_URL = if ($env:DASHBOARD_URL) { $env:DASHBOARD_URL } else { "http://localhost:3000" }

$testsPassed = 0
$testsFailed = 0

# Setup logging
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir "smoke_test_$timestamp.log"

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $Message | Out-File -FilePath $logFile -Append -Encoding UTF8
    if ($Color -ne "White") {
        Write-Host $Message -ForegroundColor $Color
    } else {
        Write-Host $Message
    }
}

function Test-Endpoint {
    param(
        [string]$Name,
        [scriptblock]$TestBlock
    )
    
    try {
        & $TestBlock
        Write-Log "[OK] $Name" "Green"
        $script:testsPassed++
    }
    catch {
        Write-Log "[FAIL] $Name" "Red"
        Write-Log "  Error: $($_.Exception.Message)" "Red"
        $script:testsFailed++
    }
}

Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting smoke tests" "Cyan"
Write-Log "Log file: $logFile`n" "Cyan"
Write-Log "[INFO] Running smoke tests...`n" "Cyan"

# Test 1: API Health
Test-Endpoint "API health check" {
    $response = Invoke-WebRequest -Uri "$API_URL/health" -TimeoutSec 2 -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }
}

# Test 2: Create Agent
$agentId = $null
Test-Endpoint "Create agent" {
    $body = @{
        name         = "smoke-test-agent"
        model        = "gpt-4"
        systemPrompt = "You are a test agent"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$API_URL/api/agents" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing
    
    $data = $response.Content | ConvertFrom-Json
    if (-not $data.id) {
        throw "No agent ID returned"
    }
    $script:agentId = $data.id
}

# Test 3: Get Agent
Test-Endpoint "Get agent" {
    if (-not $script:agentId) {
        throw "No agent ID from previous test"
    }
    $response = Invoke-WebRequest -Uri "$API_URL/api/agents/$script:agentId" -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }
}

# Test 4: Execute Task
$executionId = $null
Test-Endpoint "Execute task" {
    if (-not $script:agentId) {
        throw "No agent ID from previous test"
    }
    $body = @{
        input = "test"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$API_URL/api/agents/$script:agentId/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 30 `
        -UseBasicParsing
    
    $data = $response.Content | ConvertFrom-Json
    if (-not $data.executionId) {
        throw "No execution ID returned"
    }
    $script:executionId = $data.executionId
}

# Test 5: Get Logs
Test-Endpoint "Get logs" {
    $response = Invoke-WebRequest -Uri "$API_URL/api/logs?limit=10" -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }
}

# Test 6: Get Costs
Test-Endpoint "Get costs" {
    $response = Invoke-WebRequest -Uri "$API_URL/api/costs" -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }
}

# Test 7: Dashboard
Test-Endpoint "Dashboard accessible" {
    $response = Invoke-WebRequest -Uri $DASHBOARD_URL -TimeoutSec 2 -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }
}

# Test 8: Delete Agent
Test-Endpoint "Delete agent" {
    if (-not $script:agentId) {
        throw "No agent ID from previous test"
    }
    $response = Invoke-WebRequest -Uri "$API_URL/api/agents/$script:agentId" `
        -Method DELETE `
        -UseBasicParsing
    
    if ($response.StatusCode -ne 204 -and $response.StatusCode -ne 200) {
        throw "HTTP $($response.StatusCode)"
    }
}

# Summary
Write-Log "`n=================================================="
$total = $testsPassed + $testsFailed
$summary = "Tests: $total total, $testsPassed passed, $testsFailed failed"
Write-Log $summary

if ($testsFailed -eq 0) {
    Write-Log "`n[SUCCESS] All smoke tests passed!" "Green"
    Write-Log "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Smoke tests completed successfully"
    Write-Host "`nLog saved to: $logFile" -ForegroundColor Cyan
    exit 0
}
else {
    Write-Log "`n[FAILED] Some tests failed" "Red"
    Write-Log "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Smoke tests completed with failures"
    Write-Host "`nLog saved to: $logFile" -ForegroundColor Cyan
    exit 1
}
