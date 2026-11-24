// Exposes only two narrow functions to the screens: save a file, and write the daily backup.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agrimunimDesktop', {
    saveFile: (name, data) => ipcRenderer.invoke('am:save-file', { name, data }),
    autoBackup: json => ipcRenderer.invoke('am:auto-backup', json),
});
