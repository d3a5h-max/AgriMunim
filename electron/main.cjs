// AgriMunim Windows app shell. The screens are the same web app, loaded from local files.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const DEV_URL = process.env.VITE_DEV_SERVER_URL || '';
let win = null;

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    });
}

function isOurPage(url) {
    return url.startsWith('file://') || (DEV_URL && url.startsWith(DEV_URL));
}

function createWindow() {
    win = new BrowserWindow({
        width: 1366,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        title: 'AgriMunim',
        backgroundColor: '#F4F7F2',
        icon: path.join(__dirname, '../dist/icons/icon-512.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
        },
    });
    Menu.setApplicationMenu(null);
    if (DEV_URL) win.loadURL(DEV_URL);
    else win.loadFile(path.join(__dirname, '../dist/index.html'));

    // WhatsApp, phone and web links open in the right Windows app, never inside AgriMunim.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^(https:|tel:|mailto:)/i.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => { if (!isOurPage(url)) e.preventDefault(); });
    win.on('closed', () => { win = null; });
}

function checkSender(event) {
    const url = event.senderFrame && event.senderFrame.url;
    if (!url || !isOurPage(url)) throw new Error('Blocked');
}

const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

ipcMain.handle('am:save-file', async (event, { name, data }) => {
    checkSender(event);
    const safe = path.basename(String(name || 'AgriMunim-file')).replace(/[<>:"|?*\\/]/g, '_');
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
        defaultPath: path.join(app.getPath('documents'), safe),
    });
    if (r.canceled || !r.filePath) return { saved: false };
    await fs.writeFile(r.filePath, Buffer.from(data));
    return { saved: true, path: r.filePath };
});

ipcMain.handle('am:auto-backup', async (event, json) => {
    checkSender(event);
    if (typeof json !== 'string' || json.length > 200 * 1024 * 1024) throw new Error('Invalid backup data');
    const dir = path.join(app.getPath('documents'), 'AgriMunim Backups');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `AgriMunim-${localDate()}.json`);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, json, 'utf8');
    await fs.rename(tmp, file);
    const all = (await fs.readdir(dir)).filter(f => /^AgriMunim-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 30))) await fs.unlink(path.join(dir, old)).catch(() => {});
    return { path: file };
});

app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', e => e.preventDefault());
});

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
