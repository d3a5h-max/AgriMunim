import { Capacitor } from '@capacitor/core';

export interface DesktopBridge {
    saveFile(name: string, data: Uint8Array): Promise<{ saved: boolean; path?: string }>;
    autoBackup(json: string): Promise<{ path: string }>;
}
declare global {
    interface Window { agrimunimDesktop?: DesktopBridge }
}

/** Present only inside the Windows app (exposed by electron/preload.cjs). */
export const desktop = window.agrimunimDesktop;
export const isDesktop = !!desktop;
/** True inside the Android app. */
export const isNative = Capacitor.isNativePlatform();

const SAFE = /^(https:|tel:|mailto:)/i;
export function openExternal(url: string) {
    if (!SAFE.test(url)) return;
    if (isNative) {
        // Capacitor hands non-app URLs to Android, which opens WhatsApp, the dialer or the browser.
        window.location.href = url;
        return;
    }
    window.open(url, '_blank', 'noopener');
}

const BACKUP_KEY = 'am_last_backup';
export const markBackup = () => localStorage.setItem(BACKUP_KEY, new Date().toISOString());
export const backupAgeDays = (): number | null => {
    const v = localStorage.getItem(BACKUP_KEY);
    return v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : null;
};
