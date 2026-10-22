@echo off
chcp 65001 > nul
cd /d "%~dp0"
set "NODE_PATH=D:\FILETONG\aaaaa\node_modules;%NODE_PATH%"
echo ========================================================
echo  CHAY BO KIEM THU TU DONG (QA): DNKN-174
echo  Kiem tra: Chuyen lead da chot thanh ho so hoc vien,
echo            sinh ma HV, tao tai khoan, gui email, khoa sua
echo ========================================================
echo.
node --test tests/leadConversion.test.js
echo.
pause
