const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1600,
        height: 960,
        title: 'Unity AI Givelopment Studio',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Disabled to allow the iframe to load localhost:6274 without security blocks
        }
    });

    win.loadFile(path.join(__dirname, '../web-client/index.html'));

    // Pass the MCP Inspector URL with token once loaded
    win.webContents.on('did-finish-load', () => {
        const mcpUrl = process.env.MCP_INSPECTOR_URL || 'http://localhost:6274';
        win.webContents.executeJavaScript(`
            if (typeof window.initMCPUrl === 'function') {
                window.initMCPUrl(${JSON.stringify(mcpUrl)});
            } else {
                window.mcpUrlCached = ${JSON.stringify(mcpUrl)};
            }
        `);
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
