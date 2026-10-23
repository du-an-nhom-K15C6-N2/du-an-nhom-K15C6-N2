@echo off
chcp 65001 > nul
set "NODE_PATH=D:\FILETONG\aaaaa\node_modules;%NODE_PATH%"
echo ========================================================
echo  CHAY BO KIEM THU TU DONG (QA): DNKN-14
echo  Kiem tra: Menu dong theo role, Thong tin user, 403, 360px
echo ========================================================
echo.
node --test tests/navigation.test.js tests/rolePermissions.test.js
echo.
pause
