# Start GeneSmith backend + frontend from the correct project venv.
$Root = $PSScriptRoot

Write-Host "Starting GeneSmith backend on http://127.0.0.1:8000 ..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$Root'; python -m uvicorn backend.api.main:app --reload --port 8000"
)

Start-Sleep -Seconds 3

Write-Host "Starting GeneSmith frontend on http://localhost:3000 ..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$Root\frontend'; npm start"
)

Write-Host "Done. Open http://localhost:3000 after both windows show ready."
