@echo off
title Trevora Chatbot
echo ========================================================
echo  Starting Trevora Chatbot (Gemini AI, port 8001)
echo ========================================================
cd /d "%~dp0"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
pause
