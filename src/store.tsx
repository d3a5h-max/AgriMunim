import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DB, Settings, TableName } from './types';
import { buildSample } from './seed';
import { getSettings, listAll, putSettings, requestPersistence, TABLES, write } from './platform/storage';
import { configureAi } from './platform/ai';
import { desktop, markBackup } from './platform/platform';

export type ViewName =
    | 'dashboard' | 'billing' | 'udhaar' | 'farmers' | 'stock' | 'purchases'
    | 'sahayak' | 'reports' | 'eway' | 'settings' | 'support';
export interface View { name: ViewName; params?: Record<string, any> }
export interface Put { table: TableName; rec: { id: string } & Record<string, any> }
export interface Del { table: TableName; id: string }
interface ToastState { msg: string; undo?: () => void; error?: boolean }

interface Ctx {
    db: DB;
    status: 'loading' | 'ready';
    loadError: string | null;
    view: View;
    go: (name: ViewName, params?: Record<string, any>) => void;
    apply: (puts: Put[], dels?: Del[]) => void;
    saveSettings: (s: Settings) => void;
    toast: ToastState | null;
    notify: (msg: string, undo?: () => void) => void;
    notifyError: (msg: string) => void;
    clearToast: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
    const c = useContext(AppCtx);
    if (!c) throw new Error('App context missing');
    return c;
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AppProvider({ children }: { children: ReactNode }) {
    const [db, setDb] = useState<DB>(() => buildSample());
    const [status, setStatus] = useState<'loading' | 'ready'>('loading');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [view, setView] = useState<View>({ name: 'dashboard' });
    const [toast, setToast] = useState<ToastState | null>(null);
    const timer = useRef<number | undefined>(undefined);

    const clearToast = useCallback(() => setToast(null), []);
    const show = useCallback((t: ToastState) => {
        setToast(t);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setToast(null), t.undo ? 8000 : 5000);
    }, []);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const notify = useCallback((msg: string, undo?: () => void) => show({ msg, undo }), [show]);
    const notifyError = useCallback((msg: string) => show({ msg, error: true }), [show]);

    // Load from the device; first run gets sample data the owner can remove in Settings.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await requestPersistence();
                const s = await getSettings();
                if (!s) {
                    const sample = buildSample();
                    const puts = TABLES.flatMap(t => (sample[t] as { id: string }[]).map(rec => ({ table: t, rec })));
                    await write(puts, []);
                    await putSettings(sample.settings);
                    if (!cancelled) setDb(sample);
                } else {
                    const lists = await Promise.all(TABLES.map(t => listAll(t)));
                    const next: any = { settings: s };
                    TABLES.forEach((t, i) => (next[t] = lists[i]));
                    if (!cancelled) setDb(next as DB);
                }
            } catch (e) {
                if (!cancelled) setLoadError(errMsg(e));
            } finally {
                if (!cancelled) setStatus('ready');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { configureAi(db.settings); }, [db.settings]);

    // Windows app: write a dated backup file 20 seconds after the last change (keeps 30 days).
    useEffect(() => {
        if (status !== 'ready' || !desktop || loadError) return;
        const t = window.setTimeout(() => {
            desktop.autoBackup(JSON.stringify(db)).then(markBackup).catch(e => notifyError(`Automatic backup failed: ${errMsg(e)}`));
        }, 20000);
        return () => window.clearTimeout(t);
    }, [db, status, loadError, notifyError]);

    const apply = useCallback((puts: Put[], dels: Del[] = []) => {
        setDb(prev => {
            const next: any = { ...prev };
            TABLES.forEach(t => {
                const p = puts.filter(x => x.table === t);
                const d = dels.filter(x => x.table === t);
                if (!p.length && !d.length) return;
                let arr = [...(prev[t] as { id: string }[])];
                if (d.length) {
                    const ids = new Set(d.map(x => x.id));
                    arr = arr.filter(r => !ids.has(r.id));
                }
                p.forEach(({ rec }) => {
                    const i = arr.findIndex(r => r.id === rec.id);
                    if (i >= 0) arr[i] = rec; else arr.push(rec);
                });
                next[t] = arr;
            });
            return next as DB;
        });
        write(puts, dels).catch(e => notifyError(`Couldn't save: ${errMsg(e)}`));
    }, [notifyError]);

    const saveSettings = useCallback((s: Settings) => {
        setDb(prev => ({ ...prev, settings: s }));
        putSettings(s).catch(e => notifyError(`Couldn't save settings: ${errMsg(e)}`));
    }, [notifyError]);

    const go = useCallback((name: ViewName, params?: Record<string, any>) => {
        setView({ name, params });
        window.scrollTo(0, 0);
    }, []);

    return (
        <AppCtx.Provider value={{ db, status, loadError, view, go, apply, saveSettings, toast, notify, notifyError, clearToast }}>
            {children}
        </AppCtx.Provider>
    );
}
