# Setup Script for Unity MCP Bridge

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Setting up Unity MCP Bridge Server   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Install Node.js dependencies
Write-Host "`n[1/3] Installing Node.js dependencies..." -ForegroundColor Yellow
Push-Location mcp-server
try {
    npm install
} catch {
    Write-Error "Failed to run 'npm install'. Please ensure Node.js and npm are installed and on your PATH."
    Pop-Location
    exit 1
}

# 2. Build TypeScript project
Write-Host "`n[2/3] Building TypeScript project..." -ForegroundColor Yellow
try {
    npm run build
} catch {
    Write-Error "Failed to build the TypeScript project."
    Pop-Location
    exit 1
}
Pop-Location

# 3. Configure Claude Desktop
Write-Host "`n[3/3] Configuring Claude Desktop..." -ForegroundColor Yellow
$claudeConfigDir = "$env:APPDATA\Claude"
$claudeConfigPath = "$claudeConfigDir\claude_desktop_config.json"
$backupConfigPath = "$claudeConfigDir\claude_desktop_config.json.bak"

$serverPath = "C:/Users/HP/Desktop/mcp-bridge/mcp-server/dist/index.js"

# Create Claude config directory if it doesn't exist
if (-not (Test-Path $claudeConfigDir)) {
    New-Item -ItemType Directory -Path $claudeConfigDir | Out-Null
}

$config = @{ "mcpServers" = @{} }

if (Test-Path $claudeConfigPath) {
    Write-Host "Found existing Claude Desktop configuration. Creating backup at: $backupConfigPath" -ForegroundColor Gray
    Copy-Item -Path $claudeConfigPath -Destination $backupConfigPath -Force
    try {
        $rawConfig = Get-Content -Raw -Path $claudeConfigPath
        if (-not [string]::IsNullOrWhiteSpace($rawConfig)) {
            $config = ConvertFrom-Json $rawConfig
            if ($null -eq $config.mcpServers) {
                $config | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value @{}
            }
        }
    } catch {
        Write-Warning "Could not parse existing Claude configuration. Overwriting it..."
    }
}

# Add or update the unity-bridge server entry
$unityBridgeConfig = @{
    "command" = "node"
    "args" = @($serverPath)
}

# Check if mcpServers is a PSCustomObject and update it
if ($config.mcpServers -is [System.Management.Automation.PSCustomObject]) {
    $config.mcpServers | Add-Member -MemberType NoteProperty -Name "unity-bridge" -Value $unityBridgeConfig -Force
} else {
    $config.mcpServers = @{
        "unity-bridge" = $unityBridgeConfig
    }
}

# Save the updated configuration
try {
    $jsonConfig = ConvertTo-Json $config -Depth 10
    Set-Content -Path $claudeConfigPath -Value $jsonConfig -Encoding utf8
    Write-Host "Successfully updated Claude Desktop configuration at: $claudeConfigPath" -ForegroundColor Green
} catch {
    Write-Error "Failed to write Claude Desktop configuration file."
    exit 1
}

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host " Setup Completed Successfully!" -ForegroundColor Green
Write-Host " Please restart Claude Desktop to apply the changes." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
