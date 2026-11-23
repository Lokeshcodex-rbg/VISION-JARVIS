@echo off
echo ======================================================================
echo STARK AI — AUTOMATED POST-BOOT EMERGENCY STOP VERIFICATION
echo ======================================================================
cd /d "%~dp0\.."
node scripts\verify_after_reboot.js
echo.
pause

