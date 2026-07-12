const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1600,
        height: 960,
        title: 'Unity AI Givelopment Studio',
        autoHideMenuBar: true,
        frame: false, // Make window frameless
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'), // Load preload bridge
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

// Window control IPC channels
ipcMain.on('window-minimize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
});

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
