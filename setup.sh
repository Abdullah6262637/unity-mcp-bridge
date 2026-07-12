#!/bin/bash
set -e

echo "========================================="
echo "   Setting up Unity MCP Bridge Server   "
echo "========================================="

# 1. Install Node.js dependencies
echo -e "\n[1/3] Installing Node.js dependencies..."
cd mcp-server
npm install

# 2. Build TypeScript project
echo -e "\n[2/3] Building TypeScript project..."
npm run build
cd ..

# 3. Configure Claude Desktop
echo -e "\n[3/3] Configuring Claude Desktop..."

# Determine Claude config path based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
else
    CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
fi

CLAUDE_CONFIG_PATH="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
BACKUP_CONFIG_PATH="$CLAUDE_CONFIG_DIR/claude_desktop_config.json.bak"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
SERVER_PATH="$SCRIPT_DIR/mcp-server/dist/index.js"

mkdir -p "$CLAUDE_CONFIG_DIR"

# Initialize config structure
CONFIG_JSON='{"mcpServers": {}}'

if [ -f "$CLAUDE_CONFIG_PATH" ]; then
    echo "Found existing Claude Desktop configuration. Creating backup at: $BACKUP_CONFIG_PATH"
    cp "$CLAUDE_CONFIG_PATH" "$BACKUP_CONFIG_PATH"
    CONFIG_JSON=$(cat "$CLAUDE_CONFIG_PATH")
fi

# Use node to merge the JSON to avoid complex bash parsing
UPDATED_CONFIG=$(node -e "
try {
    const config = $CONFIG_JSON;
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers['unity-bridge'] = {
        command: 'node',
        args: ['$SERVER_PATH']
    };
    console.log(JSON.stringify(config, null, 2));
} catch (e) {
    console.error('Error merging JSON:', e);
    process.exit(1);
}
")

echo "$UPDATED_CONFIG" > "$CLAUDE_CONFIG_PATH"
echo "Successfully updated Claude Desktop configuration at: $CLAUDE_CONFIG_PATH"

echo "========================================="
echo " Setup Completed Successfully!"
echo " Please restart Claude Desktop to apply changes."
echo "========================================="
