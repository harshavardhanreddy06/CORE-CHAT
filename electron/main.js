// electron/main.js

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const { spawn } = require('child_process');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);

// ── Ollama process management ─────────────────────────────────────────────────
let ollamaProcess = null;   // the child process we spawned (null if we didn't start it)
let ollamaReady   = false;  // true once the server responds on :11434

// Common install locations for the `ollama` binary (mac / linux / win)
const OLLAMA_BIN_CANDIDATES = [
    'ollama',                          // already in PATH
    '/usr/local/bin/ollama',
    '/opt/homebrew/bin/ollama',        // Homebrew on Apple Silicon
    '/usr/bin/ollama',
    path.join(process.env.HOME || '', '.local', 'bin', 'ollama'),
    // Windows
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
];

/** Returns true if Ollama is already answering on port 11434 */
function checkOllamaRunning() {
    return new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:11434', (res) => {
            res.resume();
            resolve(true);
        });
        req.setTimeout(1500, () => { req.destroy(); resolve(false); });
        req.on('error', () => resolve(false));
    });
}

/** Try each binary candidate until one spawns without ENOENT */
function spawnOllama() {
    for (const bin of OLLAMA_BIN_CANDIDATES) {
        try {
            const proc = spawn(bin, ['serve'], {
                detached: false,
                stdio: 'ignore',
                env: { ...process.env },
            });

            // ENOENT fires synchronously via 'error'; anything else = success
            let failed = false;
            proc.once('error', (err) => {
                if (err.code === 'ENOENT') failed = true;
            });

            // Give Node one tick to emit ENOENT
            if (!failed) {
                console.log(`[Ollama] Started with binary: ${bin} (pid ${proc.pid})`);
                return proc;
            }
            proc.kill();
        } catch (_) {
            // Try next candidate
        }
    }
    console.warn('[Ollama] Could not find ollama binary. Make sure Ollama is installed.');
    return null;
}

/** Wait up to `maxMs` for Ollama to start responding */
async function waitForOllama(maxMs = 30000) {
    const interval = 800;
    let elapsed = 0;
    while (elapsed < maxMs) {
        if (await checkOllamaRunning()) return true;
        await new Promise(r => setTimeout(r, interval));
        elapsed += interval;
    }
    return false;
}

/**
 * Main entry point for Ollama lifecycle.
 * 1. If already running  → do nothing, set ollamaReady.
 * 2. If not running      → spawn it, wait until it answers.
 * Sends IPC events to all renderer windows so the UI can update its status dot.
 */
async function ensureOllama() {
    broadcast('ollama-status', 'loading');

    const alreadyUp = await checkOllamaRunning();
    if (alreadyUp) {
        console.log('[Ollama] Already running — not spawning a new process.');
        ollamaReady = true;
        broadcast('ollama-status', 'online');
        return;
    }

    console.log('[Ollama] Not running — attempting to start…');
    ollamaProcess = spawnOllama();

    if (!ollamaProcess) {
        broadcast('ollama-status', 'offline');
        return;
    }

    ollamaProcess.on('exit', (code) => {
        console.log(`[Ollama] Process exited (code ${code})`);
        ollamaProcess = null;
        ollamaReady = false;
        broadcast('ollama-status', 'offline');
    });

    const ready = await waitForOllama(30000);
    ollamaReady = ready;
    broadcast('ollama-status', ready ? 'online' : 'offline');

    if (ready) {
        console.log('[Ollama] Server is up and responding.');
    } else {
        console.warn('[Ollama] Server did not become ready within 30 s.');
    }
}

/** Gracefully stop Ollama only if we spawned it */
function stopOllama() {
    if (!ollamaProcess) return;
    console.log('[Ollama] Shutting down Ollama process…');
    try {
        // SIGTERM first; on Windows use taskkill-style
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', ollamaProcess.pid.toString(), '/f', '/t']);
        } else {
            ollamaProcess.kill('SIGTERM');
        }
    } catch (e) {
        console.error('[Ollama] Error stopping process:', e.message);
    }
    ollamaProcess = null;
}

/** Send an IPC message to every renderer window */
function broadcast(channel, ...args) {
    BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) w.webContents.send(channel, ...args);
    });
}

// ── Hot reload (dev only) ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    try {
        require('electron-reload')(path.join(__dirname, '..'), {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit',
            awaitWriteFinish: true,
        });
    } catch (_) { /* not installed */ }
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#111827',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false,
        },
        show: false,
    });

    win.once('ready-to-show', () => win.show());
    win.loadFile(path.join(__dirname, '..', 'index.html'));
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
function setupIpcHandlers() {
    // Renderer asks for current Ollama status (e.g. on first load)
    ipcMain.handle('get-ollama-status', () => ({
        ready: ollamaReady,
        managed: !!ollamaProcess,
    }));

    // File save dialog
    ipcMain.handle('save-file-dialog', async (event, options) => {
        const win = BrowserWindow.getFocusedWindow();
        return dialog.showSaveDialog(win, {
            title: 'Save File',
            defaultPath: options.defaultPath,
            filters: options.filters,
            properties: ['createDirectory', 'showOverwriteConfirmation'],
        });
    });

    // File save
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

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    setupIpcHandlers();
    createWindow();
    // Start Ollama in the background after window is created
    ensureOllama();
});

// Stop Ollama before the app quits
app.on('before-quit', () => stopOllama());

// macOS: quit when all windows closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});