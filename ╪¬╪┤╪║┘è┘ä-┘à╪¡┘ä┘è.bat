@echo off
cd /d "%~dp0"
echo.
echo  فتح زاد المعرفة محليًا...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js غير مثبت. ثبّت Node.js ثم شغّل الملف مرة أخرى.
  pause
  exit /b 1
)
start "زاد المعرفة" cmd /k "npx --yes http-server . -p 5500 -c-1"
timeout /t 3 >nul
start "" "http://localhost:5500/"
