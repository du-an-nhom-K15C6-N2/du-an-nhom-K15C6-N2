@echo off
chcp 65001 >nul
title [DNKN-86] Preview Quản Lý Hồ Sơ Cá Nhân

cd /d "%~dp0"

echo ================================================================
echo   DNKN-86: MODULE XEM VA CAP NHAT HO SO CA NHAN
echo ================================================================
echo.
echo [*] Dang khoi dong Preview Server tren cong 3086...
echo.

start "" http://localhost:3086

node preview-server.js

pause
