# Unity AI Desktop Workspace Bootstrapper (PowerShell Edition)
$ErrorActionPreference = "Stop"

Write-Host "`n[Desktop Boot] Starting Unity AI Desktop Workspace..." -ForegroundColor Cyan

# 1. Build C# / TS Server
Write-Host "[Desktop Boot] Verifying Node server compilation..."
Set-Location -Path "$PSScriptRoot\mcp-server"
& npm run build

# 2. Launch MCP Inspector in background
Write-Host "[Desktop Boot] Starting MCP Inspector proxy..."
$logPath = Join-Path $PSScriptRoot "inspector.log"
if (Test-Path $logPath) { Remove-Item $logPath }

# Launch inspector, redirecting stdout/stderr to a temporary log file
$inspectorProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx @modelcontextprotocol/inspector node dist/index.js > `"$logPath`" 2>&1" -WorkingDirectory "$PSScriptRoot\mcp-server" -WindowStyle Hidden -PassThru

# 3. Poll log file to parse URL with auth token
$inspectorUrl = $null
$timeout = 15
$elapsed = 0

Write-Host "[Desktop Boot] Waiting for authentication URL..."
while ($null -eq $inspectorUrl -and $elapsed -lt $timeout) {
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
    if (Test-Path $logPath) {
        try {
            $content = Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue
            if ($content -and $content -match "http://localhost:6274/\?MCP_PROXY_AUTH_TOKEN=\w+") {
                $inspectorUrl = $Matches[0]
                break
            }
        } catch {}
    }
}

if ($null -eq $inspectorUrl) {
    Write-Host "[Warning] Could not parse URL in time. Defaulting to standard URL." -ForegroundColor Yellow
    $inspectorUrl = "http://localhost:6274"
} else {
    Write-Host "[Desktop Boot] Parsed auth URL successfully!" -ForegroundColor Green
}

# 4. Launch Electron Desktop application
Write-Host "[Desktop Boot] Starting Electron UI..."
$env:MCP_INSPECTOR_URL = $inspectorUrl

Set-Location -Path "$PSScriptRoot\desktop-app"
if (-not (Test-Path "node_modules")) {
    Write-Host "[Desktop Boot] Installing Electron dependencies (first-time setup)..."
    & npm install
}

# Run electron
& npm start

# 5. Clean up background process when Electron exits
Write-Host "`n[Desktop Boot] Shutting down background processes..." -ForegroundColor Cyan
if (-not $inspectorProcess.HasExited) {
    Stop-Process -Id $inspectorProcess.Id -Force -ErrorAction SilentlyContinue
}

# Clean up temporary log file
if (Test-Path $logPath) { Remove-Item $logPath -ErrorAction SilentlyContinue }

Write-Host "[Desktop Boot] Shutdown complete. Goodbye!" -ForegroundColor Green
