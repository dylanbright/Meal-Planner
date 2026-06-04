@echo off
cd /d "%~dp0"
echo Checking dependencies...
npm install
echo.
echo Starting Dinner Repertoire on http://localhost:3007
echo Press Ctrl+C to stop the server
echo.
node server.js
echo.
echo Server stopped.
pause
