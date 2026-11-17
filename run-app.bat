@echo off
title Trevora - Unified Launcher
echo ======================================================================
echo   Trevora - Smart Travel Companion Launcher
echo ======================================================================
echo.
echo [1/4] Starting FastAPI Safety ^& AI Assistant Backend on http://localhost:8000 ...
start "Trevora Backend" cmd /k "cd /d "%~dp0backend" && run.bat"

echo.
echo [2/4] Starting Trevora AI Chatbot on http://localhost:8001 ...
start "Trevora Chatbot" cmd /k "cd /d "%~dp0chatbot" && run.bat"

echo.
echo [3/4] Starting Trevora Live Location Tracker on http://localhost:8080 ...
start "Trevora Tracker" cmd /k "cd /d "%~dp0tracker" && node server.mjs"

echo.
echo [4/4] Starting Trevora Mobile Web Client on http://localhost:8081 ...
cd /d "%~dp0mobile"
npm run web
pause
