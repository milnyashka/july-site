@echo off
set "PATH=D:\nodejs;%PATH%"
cd /d "%~dp0"
echo Installing project dependencies...
call npm install
pause
