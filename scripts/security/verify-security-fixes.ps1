# AETHERMIND SECURITY VERIFICATION SCRIPT FOR WINDOWS
# Verifies all P0 security implementations

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host " AETHERMIND SECURITY VERIFICATION SCRIPT" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0
$PassCount = 0

function Test-SecurityCheck {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$SuccessMessage,
        [string]$FailureMessage,
        [string]$Level = "ERROR"
    )
    
    Write-Host "[CHECK] $Name..." -NoNewline
    
    try {
        $result = & $Test
        if ($result) {
            Write-Host " PASS" -ForegroundColor Green
            Write-Host "        $SuccessMessage" -ForegroundColor Gray
            $script:PassCount++
            return $true
        }
        else {
            if ($Level -eq "ERROR") {
                Write-Host " FAIL" -ForegroundColor Red
                Write-Host "        $FailureMessage" -ForegroundColor Red
                $script:ErrorCount++
            }
            else {
                Write-Host " WARN" -ForegroundColor Yellow
                Write-Host "        $FailureMessage" -ForegroundColor Yellow
                $script:WarningCount++
            }
            return $false
        }
    }
    catch {
        Write-Host " ERROR" -ForegroundColor Red
        Write-Host "        Exception: $_" -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
}

Write-Host ""
Write-Host "=== SECTION 1: P0 SECURITY FIXES ===" -ForegroundColor Magenta
Write-Host ""

# Check 1: JWT_SECRET validation in auth.ts
Test-SecurityCheck -Name "JWT_SECRET strict validation in auth.ts" -Test {
    $content = Get-Content "apps\api\src\routes\auth.ts" -Raw
    return ($content -match 'FATAL.*JWT_SECRET' -and 
        $content -match 'const JWT_SECRET = \(\(\) =>' -and
        $content -notmatch "JWT_SECRET \|\| 'your-jwt-secret")
} -SuccessMessage "No hardcoded JWT fallbacks found" `
    -FailureMessage "Hardcoded JWT_SECRET fallback still present!"

# Check 2: JWT_SECRET validation in jwt-auth.ts
Test-SecurityCheck -Name "JWT_SECRET strict validation in jwt-auth.ts" -Test {
    $content = Get-Content "apps\api\src\middleware\jwt-auth.ts" -Raw
    return ($content -match 'FATAL.*JWT_SECRET' -and
        $content -match 'const JWT_SECRET = \(\(\) =>')
} -SuccessMessage "JWT middleware properly validates secret" `
    -FailureMessage "JWT middleware has weak validation!"

# Check 3: JWT_SECRET validation in requireEmailVerified.ts
Test-SecurityCheck -Name "JWT_SECRET strict validation in requireEmailVerified.ts" -Test {
    $content = Get-Content "apps\api\src\middleware\requireEmailVerified.ts" -Raw
    return ($content -match 'FATAL.*JWT_SECRET' -and
        $content -match 'const JWT_SECRET = \(\(\) =>')
} -SuccessMessage "Email verification middleware secured" `
    -FailureMessage "Email verification middleware vulnerable!"

# Check 4: Rate limit reduced to 3
Test-SecurityCheck -Name "Auth rate limit reduced to 3 attempts" -Test {
    $content = Get-Content "apps\api\src\routes\auth.ts" -Raw
    return ($content -match 'max:\s*3' -and 
        $content -match 'skipSuccessfulRequests:\s*true')
} -SuccessMessage "Rate limit: 3 failed attempts per 15min (skipSuccessfulRequests: true)" `
    -FailureMessage "Rate limit not properly configured!"

# Check 5: Email verification middleware imported
Test-SecurityCheck -Name "requireEmailVerified middleware imported in index.ts" -Test {
    $content = Get-Content "apps\api\src\index.ts" -Raw
    return ($content -match "import.*requireEmailVerified.*from.*requireEmailVerified")
} -SuccessMessage "Email verification middleware available" `
    -FailureMessage "Email verification middleware not imported!"

# Check 6-9: Email verification applied to critical routes
Test-SecurityCheck -Name "Email verification applied to /api/agents" -Test {
    $content = Get-Content "apps\api\src\index.ts" -Raw
    return ($content -match "/api/agents.*requireEmailVerified.*agentRoutes")
} -SuccessMessage "Agents route protected" `
    -FailureMessage "Agents route not protected!"

Test-SecurityCheck -Name "Email verification applied to /api/budgets" -Test {
    $content = Get-Content "apps\api\src\index.ts" -Raw
    return ($content -match "/api/budgets.*requireEmailVerified.*budgetRoutes")
} -SuccessMessage "Budgets route protected" `
    -FailureMessage "Budgets route not protected!"

Test-SecurityCheck -Name "Email verification applied to /api/executions" -Test {
    $content = Get-Content "apps\api\src\index.ts" -Raw
    return ($content -match "/api/executions.*requireEmailVerified.*executionRoutes")
} -SuccessMessage "Executions route protected" `
    -FailureMessage "Executions route not protected!"

Test-SecurityCheck -Name "Email verification applied to /api/workflows" -Test {
    $content = Get-Content "apps\api\src\index.ts" -Raw
    return ($content -match "/api/workflows.*requireEmailVerified.*workflowRoutes")
} -SuccessMessage "Workflows route protected" `
    -FailureMessage "Workflows route not protected!"

Write-Host ""
Write-Host "=== SECTION 2: ENVIRONMENT CONFIGURATION ===" -ForegroundColor Magenta
Write-Host ""

# Check 10: cross-env is installed
Test-SecurityCheck -Name "cross-env package installed (for Windows)" -Test {
    $content = Get-Content "apps\api\package.json" -Raw
    return ($content -match '"cross-env"')
} -SuccessMessage "cross-env installed for Windows compatibility" `
    -FailureMessage "cross-env not installed - npm scripts won't work on Windows!"

# Check 11: Test script uses cross-env
Test-SecurityCheck -Name "Test script uses cross-env" -Test {
    $content = Get-Content "apps\api\package.json" -Raw
    return ($content -match '"test".*cross-env.*NODE_ENV=test')
} -SuccessMessage "Test script compatible with Windows" `
    -FailureMessage "Test script won't work on Windows!"

Write-Host ""
Write-Host "=== SECTION 3: ADDITIONAL SECURITY ===" -ForegroundColor Magenta
Write-Host ""

# Check 12: CORS is properly configured
Test-SecurityCheck -Name "CORS properly configured with whitelist" -Test {
    $content = Get-Content "apps\api\src\config\constants.ts" -Raw
    return ($content -match 'CORS_ORIGINS.*production' -and
        $content -match 'aethermind-page.vercel.app')
} -SuccessMessage "CORS whitelist configured" `
    -FailureMessage "CORS configuration may be too permissive"

# Check 13: Helmet security headers enabled
Test-SecurityCheck -Name "Helmet security headers enabled" -Test {
    $content = Get-Content "apps\api\src\index.ts" -Raw
    return ($content -match "import.*helmet" -and
        $content -match "app\.use\(helmet")
} -SuccessMessage "Helmet middleware active" `
    -FailureMessage "Helmet security headers not configured!"

# Check 14: Rate limiting configured globally
Test-SecurityCheck -Name "Global rate limiting enabled" -Test {
    $content = Get-Content "apps\api\src\index.ts" -Raw
    return ($content -match "rateLimit" -and
        $content -match "app\.use\(limiter")
} -SuccessMessage "Global rate limiter active" `
    -FailureMessage "Global rate limiting not configured" `
    -Level "WARN"

Write-Host ""
Write-Host "=== SECTION 4: CRITICAL AUDIT FINDINGS ===" -ForegroundColor Magenta
Write-Host ""

Write-Host "[!] Critical Issues from Security Audit:" -ForegroundColor Yellow
Write-Host ""

# P0-1: OAuth JWT in URL
Test-SecurityCheck -Name "P0-1: OAuth JWT not in URL (REQUIRES FIX)" -Test {
    $content = Get-Content "apps\api\src\routes\oauth.ts" -Raw
    return ($content -notmatch 'redirect.*token=')
} -SuccessMessage "OAuth uses secure token delivery" `
    -FailureMessage "JWT tokens exposed in OAuth redirect URLs (See SECURITY_AUDIT_REPORT.md)"

# P0-2: Session secret
Test-SecurityCheck -Name "P0-2: Separate SESSION_SECRET (REQUIRES FIX)" -Test {
    $content = Get-Content "apps\api\src\index.ts" -Raw
    return ($content -match 'SESSION_SECRET' -and
        $content -notmatch 'session.*secret.*JWT_SECRET')
} -SuccessMessage "Session uses dedicated secret" `
    -FailureMessage "Session reuses JWT_SECRET (See SECURITY_AUDIT_REPORT.md)"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host " VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [PASS] Passed:   $PassCount checks" -ForegroundColor Green
Write-Host "  [WARN] Warnings: $WarningCount checks" -ForegroundColor Yellow
Write-Host "  [FAIL] Failed:   $ErrorCount checks" -ForegroundColor Red
Write-Host ""

if ($ErrorCount -eq 0) {
    Write-Host "[SUCCESS] All P0 security fixes are properly implemented!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[NEXT STEPS]" -ForegroundColor Yellow
    Write-Host "  1. Review SECURITY_AUDIT_REPORT.md for P0 vulnerabilities" -ForegroundColor White
    Write-Host "  2. Fix P0-1: OAuth JWT in URL" -ForegroundColor White
    Write-Host "  3. Fix P0-2: Separate SESSION_SECRET" -ForegroundColor White
    Write-Host "  4. Run: pnpm typecheck" -ForegroundColor Cyan
    Write-Host "  5. Set JWT_SECRET in .env (min 32 chars)" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}
else {
    Write-Host "[FAILED] VERIFICATION FAILED - Fix errors before deployment!" -ForegroundColor Red
    Write-Host ""
    Write-Host "[ACTION REQUIRED]" -ForegroundColor Yellow
    Write-Host "  - Review SECURITY_AUDIT_REPORT.md for details" -ForegroundColor White
    Write-Host "  - Fix all [FAIL] items above" -ForegroundColor White
    Write-Host ""
    exit 1
}
