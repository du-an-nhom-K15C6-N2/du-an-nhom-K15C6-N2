@echo off
chcp 65001 > nul
cd /d "%~dp0"
set "NODE_PATH=D:\FILETONG\aaaaa\node_modules;%NODE_PATH%"
echo ========================================================
echo  KHOI DONG MAY CHU XEM TRUOC GIAO DIEN (PREVIEW): DNKN-174
echo  Chuyen Lead da chot thanh ho so hoc vien
echo ========================================================
echo.
echo Dang khoi dong may chu tai http://localhost:3174 ...
start "" "http://localhost:3174"
node preview-server.js
pause
