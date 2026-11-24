// On-device database (IndexedDB). Works the same in the Windows app, the Android app and the browser.
import type { Settings, TableName } from '../types';

export const TABLES: TableName[] = ['farmers', 'items', 'batches', 'sales', 'payments', 'purchases'];
const DB_NAME = 'agrimunim';
const VERSION = 1;
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
    if (!dbp) {
        dbp = new Promise((resolve, reject) => {
            const r = indexedDB.open(DB_NAME, VERSION);
            r.onupgradeneeded = () => {
                const d = r.result;
                [...TABLES, 'meta'].forEach(t => { if (!d.objectStoreNames.contains(t)) d.createObjectStore(t); });
            };
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error || new Error('Could not open the shop database'));
            r.onblocked = () => reject(new Error('Close other AgriMunim windows and try again'));
        });
        dbp.catch(() => { dbp = null; });
    }
    return dbp;
}

const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Save failed'));
    tx.onabort = () => reject(tx.error || new Error('Save was cancelled'));
});

export async function getSettings(): Promise<Settings | null> {
    const d = await open();
    return new Promise((resolve, reject) => {
        const r = d.transaction('meta').objectStore('meta').get('settings');
        r.onsuccess = () => resolve((r.result as Settings) || null);
        r.onerror = () => reject(r.error);
    });
}

export async function putSettings(s: Settings) {
    const d = await open();
    const tx = d.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(s, 'settings');
    return done(tx);
}

export async function listAll<T>(table: TableName): Promise<T[]> {
    const d = await open();
    return new Promise((resolve, reject) => {
        const r = d.transaction(table).objectStore(table).getAll();
        r.onsuccess = () => resolve(r.result as T[]);
        r.onerror = () => reject(r.error);
    });
}

/** Writes all changes in one transaction, so a bill and its stock change are saved together or not at all. */
export async function write(puts: { table: TableName; rec: { id: string } }[], dels: { table: TableName; id: string }[]) {
    const tables = Array.from(new Set([...puts.map(p => p.table), ...dels.map(x => x.table)]));
    if (!tables.length) return;
    const d = await open();
    const tx = d.transaction(tables, 'readwrite');
    dels.forEach(x => tx.objectStore(x.table).delete(x.id));
    puts.forEach(p => tx.objectStore(p.table).put(p.rec, p.rec.id));
    return done(tx);
}

/** Asks the browser not to clear the data when the device is low on space. */
export async function requestPersistence() {
    try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
}
