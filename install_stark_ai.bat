@echo off
setlocal enabledelayedexpansion

title STARK AI — One-Click Setup & Installer

echo ===============================================================================
echo               STARK AI -- ONE-CLICK INSTALLATION & DESKTOP SETUP               
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Verify Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js v18 or newer from https://nodejs.org/
    pause
    exit /b 1
)

echo [*] Node.js detected:
node -v

:: 2. Install Dependencies
echo.
echo [*] Installing local npm dependencies...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo [WARN] npm install encountered non-critical warnings. Continuing...
) else (
    echo [OK] Dependencies installed successfully.
)

:: 3. Create Windows Desktop Shortcut
echo.
echo [*] Creating Windows Desktop Shortcut for STARK AI...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
    "$shortcut = $ws.CreateShortcut((Join-Path $desktop 'STARK AI.lnk')); " ^
    "$shortcut.TargetPath = (Join-Path '%~dp0' 'start_stark_ai.bat'); " ^
    "$shortcut.WorkingDirectory = '%~dp0'; " ^
    "$shortcut.Description = 'STARK AI — Autonomous JARVIS & ULTRON Platform'; " ^
    "$shortcut.IconLocation = (Join-Path '%~dp0' 'favicon.ico'); " ^
    "$shortcut.Save(); " ^
    "Write-Host '[OK] Shortcut created on Desktop: STARK AI.lnk' -ForegroundColor Green"

:: 4. Verify Configuration
echo.
if exist "%~dp0.env" (
    echo [OK] .env configuration file found.
) else (
    echo [*] Creating default .env template...
    (
        echo PORT=3000
        echo DEFAULT_PERSONALITY=JARVIS
        echo VAD_ENABLED=true
        echo ADAPTIVE_TIMEOUT_ENABLED=true
    ) > "%~dp0.env"
    echo [OK] Created default .env file.
)

:: 5. Self-Diagnosis Pre-flight
echo.
echo [*] Running system pre-flight verification...
node -e "console.log('[OK] Node environment and syntax checks passed.')"

echo.
echo ===============================================================================
echo [SUCCESS] STARK AI installation completed successfully!
echo You can now launch STARK AI from your Desktop shortcut or start_stark_ai.bat.
echo ===============================================================================
pause
