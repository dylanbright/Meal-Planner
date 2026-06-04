@echo off
cd /d "%~dp0"
echo Checking dependencies...
npm install
npm start
pause
