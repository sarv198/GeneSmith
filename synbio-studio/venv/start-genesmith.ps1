# Start GeneSmith backend + frontend from the correct project venv.
$Root = $PSScriptRoot

# Prefer Python 3.11 from this project; fall back to py launcher.
$Python = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $py311 = & py -3.11 -c "import sys; print(sys.executable)" 2>$null
    if ($py311) { $Python = $py311.Trim() }
}
if (-not $Python) { $Python = "python" }

Write-Host "Using Python: $Python"
Write-Host "Starting GeneSmith backend on http://127.0.0.1:8000 ..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$Root'; & '$Python' -m uvicorn backend.api.main:app --reload --port 8000"
)

Start-Sleep -Seconds 3

Write-Host "Starting GeneSmith frontend on http://localhost:3000 ..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$Root\frontend'; npm start"
)

Write-Host "Done. Open http://localhost:3000 after both windows show ready."
