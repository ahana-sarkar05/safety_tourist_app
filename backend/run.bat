@echo off
echo ========================================================
echo  Starting Trevora Backend (FastAPI + AI + Safety)
echo ========================================================
cd /d "%~dp0"
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
)
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
pause
