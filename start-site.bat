@echo off
cd /d "%~dp0"
echo Stopping old node processes...
taskkill /F /IM node.exe >nul 2>&1
echo Cleaning .next cache...
if exist .next rmdir /s /q .next
echo Building site...
call npm run build
if errorlevel 1 exit /b 1
echo Starting on http://localhost:3000
call npm run start