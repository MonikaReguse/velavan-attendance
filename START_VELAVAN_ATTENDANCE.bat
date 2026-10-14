@echo off
title Velavan Properties Attendance App
color 0F

echo =====================================================================
echo          VELAVAN PROPERTIES ATTENDANCE ^& PAYROLL APP
echo =====================================================================
echo.
echo Starting all office services...
echo.
echo   [1] Backend API Server   : http://localhost:5000
echo   [2] Office FaceLock App  : http://localhost:5173
echo   [3] Staff Portal         : http://localhost:5174
echo.
echo LAN / Wi-Fi Access for Office Staff Phones:
echo   Employee Portal          : http://192.168.1.28:5174
echo   Admin / FaceLock Kiosk   : http://192.168.1.28:5173
echo.
echo =====================================================================
echo.

:: Automatically open default browser windows after 4 seconds
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:5173'; Start-Process 'http://localhost:5174'"

:: Start the services
node start.js

pause
