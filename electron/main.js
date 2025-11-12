// electron/main.js

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);

// Enable hot reload in development
try {
  require('electron-reload')(path.join(__dirname, '..'), {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
    // Watch for changes in these file types
    awaitWriteFinish: true
  });
} catch (_) { 
  // electron-reload not installed
}

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#111827',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
    show: false
  });

  // Show window when content is ready to prevent white flash
  win.once('ready-to-show', () => {
    win.show();
  });

  // Load the HTML file from the root directory
  win.loadFile('../index.html');
}

// Set up IPC handlers
function setupIpcHandlers() {
    // Handle file save dialog
    ipcMain.handle('save-file-dialog', async (event, options) => {
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showSaveDialog(win, {
            title: 'Save File',
            defaultPath: options.defaultPath,
            filters: options.filters,
            properties: ['createDirectory', 'showOverwriteConfirmation']
        });
        return result;
    });

    // Handle file save operation
    ipcMain.handle('save-file', async (event, { content, filePath }) => {
        try {
            await writeFile(filePath, content, 'utf8');
            return { success: true };
        } catch (error) {
            console.error('Error saving file:', error);
            return { success: false, error: error.message };
        }
    });
}

// Called when Electron has finished initialization
app.whenReady().then(() => {
    setupIpcHandlers();
    createWindow();
});

// Quit app when all windows are closed (for macOS compatibility)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});