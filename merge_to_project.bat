@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo  GHEP MA NGUON DNKN-174 VAO DU AN CHINH D:\FILETONG\aaaaa
echo ========================================================
echo.
node merge_to_project.js "D:\FILETONG\aaaaa"
echo.
pause
