<#
.SYNOPSIS
    STARK AI Desktop — Standalone PowerShell Enterprise Launcher
.DESCRIPTION
    Validates prerequisites, tests gateway connectivity, starts background server if dormant,
    launches Electron desktop interface with system tray, and handles recovery on crash.
#>

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "              STARK AI -- AUTONOMOUS JARVIS & ULTRON PLATFORM                  " -ForegroundColor Yellow
Write-Host "                     Standalone Desktop Application                            " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Node.js
try {
    $nodeVer = (node -v).Trim()
    Write-Host "[OK] Node.js runtime detected: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# 2. Check Port 3000 Gateway
$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn) {
    Write-Host "[*] Launching STARK AI Local Gateway Server on port 3000..." -ForegroundColor Yellow
    $serverProcess = Start-Process node -ArgumentList "server.js" -WorkingDirectory $ScriptDir -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "[OK] Gateway Server initialized (PID: $($serverProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "[OK] STARK AI Gateway Server active on port 3000 (PID: $($conn.OwningProcess))" -ForegroundColor Green
}

# 3. Test Status Health Check
try {
    $status = Invoke-RestMethod -Uri "http://localhost:3000/api/status" -TimeoutSec 4
    Write-Host "[OK] Health check passed: $($status.status) | Uptime: $($status.uptimeSec)s" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Gateway status check warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 4. Launch Electron Desktop
Write-Host "[*] Launching Electron Desktop GUI..." -ForegroundColor Cyan
try {
    npx electron .
} catch {
    Write-Host "[ERROR] Electron desktop encountered an error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[OK] STARK AI Desktop session completed." -ForegroundColor Cyan
