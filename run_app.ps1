# Unity AI Desktop Workspace Bootstrapper (PowerShell Edition)
$ErrorActionPreference = "Stop"

Write-Host "`n[Desktop Boot] Starting Unity AI Desktop Workspace..." -ForegroundColor Cyan

# Launch Electron Desktop application
Write-Host "[Desktop Boot] Starting Electron UI..."
Set-Location -Path "$PSScriptRoot\desktop-app"
if (-not (Test-Path "node_modules")) {
    Write-Host "[Desktop Boot] Installing Electron dependencies (first-time setup)..."
    & npm install
}

# Run electron
& npm start

# Restore path to root directory
Set-Location -Path $PSScriptRoot

Write-Host "[Desktop Boot] Shutdown complete. Goodbye!" -ForegroundColor Green
