@echo off
chcp 65001 >nul
title [DNKN-86] Chay Kiem Thu Tu Dong 15 Test Cases

cd /d "%~dp0"

echo ================================================================
echo   DNKN-86: CHAY BIEU DIEN KIEM THU TU DONG (15 TEST CASES)
echo ================================================================
echo.

node --test tests/profile.test.js

echo.
echo ================================================================
echo Hoan thanh kiem thu. Nhan phim bat ky de thoat.
echo ================================================================
pause
