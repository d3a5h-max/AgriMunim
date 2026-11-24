import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { desktop, isNative } from './platform';

async function toBase64(blob: Blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
}

/** Saves a file. Windows: save dialog. Android: share sheet (WhatsApp, Files, Drive). Browser: download. Returns false if cancelled. */
export async function saveFile(name: string, blob: Blob): Promise<boolean> {
    if (desktop) {
        const r = await desktop.saveFile(name, new Uint8Array(await blob.arrayBuffer()));
        return r.saved;
    }
    if (isNative) {
        const r = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache });
        try {
            await Share.share({ title: name, url: r.uri, dialogTitle: 'Save or send' });
            return true;
        } catch {
            return false; // user closed the share sheet
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
}
