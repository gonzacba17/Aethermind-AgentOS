# fix-orchestrator.ps1
Write-Host "[*] Aplicando fixes a Orchestrator.ts..." -ForegroundColor Cyan

$orchestratorPath = "packages/core/src/orchestrator/Orchestrator.ts"
$queueServicePath = "packages/core/src/queue/TaskQueueService.ts"

# Backup
Copy-Item $orchestratorPath "$orchestratorPath.backup"
Copy-Item $queueServicePath "$queueServicePath.backup"

# Fix 1: TaskQueueMetrics → TaskQueueStats en import
$content = Get-Content $orchestratorPath -Raw
$content = $content -replace 'TaskQueueMetrics', 'TaskQueueStats'
Set-Content $orchestratorPath $content

# Fix 2: process → onProcess
$content = Get-Content $orchestratorPath -Raw
$content = $content -replace '\.process\(async \(job\)', '.onProcess(async (job)'
Set-Content $orchestratorPath $content

# Fix 3: getMetrics → getStats
$content = Get-Content $orchestratorPath -Raw
$content = $content -replace '\.getMetrics\(\)', '.getStats()'
$content = $content -replace 'metrics =', 'stats ='
$content = $content -replace 'metrics\.', 'stats.'
Set-Content $orchestratorPath $content

# Fix 4: Extender TaskQueueItem con agentId e input
$queueContent = Get-Content $queueServicePath -Raw
$interfaceToReplace = @"
export interface TaskQueueItem {
  id: string;
  type: string;
  data: any;
  priority?: number;
  attempts?: number;
  timestamp: number;
}
"@

$newInterface = @"
export interface TaskQueueItem {
  id: string;
  type: string;
  data: any;
  priority?: number;
  attempts?: number;
  timestamp: number;
  // Fields for Orchestrator compatibility
  agentId?: string;
  input?: any;
}
"@

$queueContent = $queueContent -replace [regex]::Escape($interfaceToReplace), $newInterface
Set-Content $queueServicePath $queueContent

Write-Host "[OK] Fixes aplicados correctamente" -ForegroundColor Green
Write-Host ""
Write-Host "Archivos modificados:"
Write-Host "  - $orchestratorPath"
Write-Host "  - $queueServicePath"
Write-Host ""
Write-Host "Backups guardados:"
Write-Host "  - ${orchestratorPath}.backup"
Write-Host "  - ${queueServicePath}.backup"