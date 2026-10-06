@echo off
title He Thong Quan Ly Du Lieu Lop Hoc An Toan - EP-01

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo ================================================================
    echo    LOI: Khong tim thay Node.js trong PATH.
    echo    Hay cai Node.js LTS va mo lai VS Code.
    echo ================================================================
    pause
    exit /b 1
)

echo ================================================================
echo    He Thong Quan Ly Lop Hoc - Module Xac Thuc ^& Phan Quyen (EP-01)
echo    Dang khoi dong server tai http://localhost:3000 ...
echo ================================================================
echo.

start "" /b node server.js

timeout /t 2 /nobreak >nul
start "" http://localhost:3000

pause
