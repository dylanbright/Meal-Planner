@echo off
cd /d "%~dp0"
echo Checking dependencies...
call npm install
npm start
pause
