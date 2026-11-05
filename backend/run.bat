@echo off
echo Starting Tourist Safety App...
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
pause
