@echo off
setlocal enabledelayedexpansion

title STARK AI — JARVIS & ULTRON Standalone Desktop Companion

echo ===============================================================================
echo               STARK AI -- AUTONOMOUS JARVIS & ULTRON PLATFORM                  
echo                      Standalone Desktop Application                            
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Verify Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js v18 or newer.
    pause
    exit /b 1
)

:: 2. Pre-flight health check on port 3000
echo [*] Checking local server status on port 3000...
powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue) | Select-Object -First 1" >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Starting background STARK AI Server Gateway on port 3000...
    start "STARK AI Gateway Server" /b node server.js
    timeout /t 2 /nobreak >nul
) else (
    echo [OK] STARK AI Gateway Server is already operational.
)

:: 3. Launch Electron Desktop GUI with Arc Reactor System Tray
echo [*] Launching STARK AI Living Code Eye Desktop Interface...
call npx electron .

echo.
echo STARK AI Desktop session completed.
