Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Trevora - Smart Travel Companion Launcher" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Start FastAPI backend
Write-Host "`n[1/4] Starting Trevora FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\backend\run.ps1"

# 2. Start the Gemini AI chatbot
Write-Host "[2/4] Starting Trevora AI Chatbot on http://localhost:8001 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\chatbot\run.ps1"

# 3. Start the live-location tracker server (SOS / live sharing feature)
Write-Host "[3/4] Starting Trevora Live Location Tracker on http://localhost:8080 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\tracker'; node server.mjs"

# 4. Start mobile web
Write-Host "[4/4] Starting Trevora Mobile Web Client on http://localhost:8081 ..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\mobile"
npm run web
