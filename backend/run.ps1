Write-Host "Starting Tourist Safety App..." -ForegroundColor Cyan
Set-Location -Path $PSScriptRoot
& "$PSScriptRoot\.venv\Scripts\uvicorn.exe" api.main:app --reload --host 0.0.0.0 --port 8000
