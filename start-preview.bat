@echo off
chcp 65001 > nul
set "NODE_PATH=D:\FILETONG\aaaaa\node_modules;%NODE_PATH%"
echo ========================================================
echo  KHOI DONG MAY CHU XEM THU: DNKN-14
echo  Menu dieu huong theo quyen ^& Toi uu man hinh 360px
echo  Cong dich vu: http://localhost:3014
echo ========================================================
echo.
start "" http://localhost:3014
node preview-server.js
pause
