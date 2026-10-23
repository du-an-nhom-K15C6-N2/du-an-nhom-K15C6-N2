@echo off
setlocal
cd /d "%~dp0"
node preview-server.js
if errorlevel 1 pause
