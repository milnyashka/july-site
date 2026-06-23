@echo off
cd /d "%~dp0"
echo Stopping old servers...
taskkill /F /IM node.exe >nul 2>&1
echo Starting dev mode with hot reload on http://localhost:3000
echo Press Ctrl+C to stop.
call npm run dev:clean