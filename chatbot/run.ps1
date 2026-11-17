Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Starting Trevora Chatbot (Gemini AI, port 8001)"      -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Set-Location -Path $PSScriptRoot
if (Test-Path "$PSScriptRoot\.venv\Scripts\Activate.ps1") {
    & "$PSScriptRoot\.venv\Scripts\Activate.ps1"
}
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
