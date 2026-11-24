import { useRef, useState } from 'react';
import { downloadFile } from '../platform/runtime';
import { Del, Put, useApp } from '../store';
import { C } from '../theme';
import { isDesktop, markBackup } from '../platform/platform';
import { DB, Lang, Licence, Settings as S, TableName } from '../types';
import { Btn, Chip, Field, Icon, inputStyle, Modal, PageHead, Panel } from '../ui';
import { LANG_LABEL } from '../utils';

const TABLES: TableName[] = ['farmers', 'items', 'batches', 'sales', 'payments', 'purchases'];

export default function Settings() {
    const { db, saveSettings, apply, notify, notifyError } = useApp();
    const [s, setS] = useState<S>(db.settings);
    const [wipe, setWipe] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const set = (k: keyof S, v: any) => setS({ ...s, [k]: v });
    const setLic = (i: number, k: keyof Licence, v: string) => set('licences', s.licences.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
    const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);
    const gstOk = !s.gstin || /^[0-9]{2}[A-Z0-9]{13}$/.test(s.gstin.toUpperCase());

    const save = () => {
        const prev = db.settings;
        saveSettings({ ...s, gstin: s.gstin.toUpperCase(), nextBill: db.settings.nextBill });
        notify('Settings saved', () => { saveSettings(prev); setS(prev); });
    };

    const backup = async () => {
        try {
            const ok = await downloadFile(`AgriMunim-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(db)], { type: 'application/json' }));
            if (ok) { markBackup(); notify('Backup saved'); }
        } catch (e) { notifyError(`Couldn't download: ${e instanceof Error ? e.message : String(e)}`); }
    };

    const restore = async (file: File) => {
        try {
            const data = JSON.parse(await file.text()) as DB;
            if (!data.settings || !TABLES.every(t => Array.isArray((data as any)[t]))) throw new Error('This is not an AgriMunim backup file');
            const puts: Put[] = [];
            const dels: Del[] = [];
            TABLES.forEach(t => {
                const incoming = (data[t] as { id: string }[]);
                const ids = new Set(incoming.map(r => r.id));
                incoming.forEach(r => puts.push({ table: t, rec: r }));
                (db[t] as { id: string }[]).forEach(r => { if (!ids.has(r.id)) dels.push({ table: t, id: r.id }); });
            });
            apply(puts, dels);
            saveSettings(data.settings);
            setS(data.settings);
            notify(`Backup restored: ${data.farmers.length} farmers, ${data.sales.length} bills`);
        } catch (e) { notifyError(`Couldn't restore: ${e instanceof Error ? e.message : String(e)}`); }
    };

    const removeSample = () => {
        const dels: Del[] = [];
        TABLES.forEach(t => (db[t] as { id: string; sample?: boolean }[]).forEach(r => { if (r.sample) dels.push({ table: t, id: r.id }); }));
        apply([], dels);
        const ownBills = db.sales.filter(x => !x.sample).map(x => x.billNo);
        const next = { ...db.settings, hasSample: false, nextBill: ownBills.length ? Math.max(...ownBills) + 1 : 1 };
        saveSettings(next);
        setS(next);
        setWipe(false);
        notify(`Sample data removed (${dels.length} records). Your own entries are kept.`);
    };

    const txt = (k: keyof S, label: string, extra?: { hint?: string; mode?: 'numeric' }) => (
        <Field label={label} hint={extra?.hint}>
            <input style={inputStyle} inputMode={extra?.mode} value={String(s[k] ?? '')} onChange={e => set(k, extra?.mode ? Number(e.target.value.replace(/\D/g, '')) : e.target.value)} />
        </Field>
    );

    return (
        <div>
            <PageHead title="Settings" actions={<Btn kind="primary" disabled={!dirty || !gstOk} onClick={save}>Save changes</Btn>} />
            <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
                <Panel title="Shop details">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        {txt('shopName', 'Shop name')}
                        {txt('ownerName', 'Owner name')}
                        {txt('phone', 'Shop phone')}
                        <Field label="GSTIN" hint={gstOk ? undefined : 'GSTIN has 15 characters, starting with the 2-digit state code'}>
                            <input style={inputStyle} value={s.gstin} maxLength={15} onChange={e => set('gstin', e.target.value.toUpperCase())} />
                        </Field>
                        {txt('address', 'Address')}
                        {txt('district', 'District', { hint: 'Used by AI Sahayak for local advice' })}
                        {txt('state', 'State')}
                    </div>
                </Panel>
                <Panel title="Licences" action={<Btn small onClick={() => set('licences', [...s.licences, { name: '', number: '', expiry: '' }])}><Icon name="plus" size={14} />Add licence</Btn>}>
                    <div style={{ fontSize: 14, color: C.muted, marginBottom: 10 }}>You get a reminder on the dashboard 60 days before a licence expires.</div>
                    {s.licences.map((l, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end', marginBottom: 10 }}>
                            <Field label="Licence"><input style={inputStyle} value={l.name} onChange={e => setLic(i, 'name', e.target.value)} /></Field>
                            <Field label="Number"><input style={inputStyle} value={l.number} onChange={e => setLic(i, 'number', e.target.value)} /></Field>
                            <Field label="Valid till"><input type="date" style={inputStyle} value={l.expiry} onChange={e => setLic(i, 'expiry', e.target.value)} /></Field>
                            <Btn small kind="ghost" onClick={() => set('licences', s.licences.filter((_, j) => j !== i))}><Icon name="trash" size={14} />Remove</Btn>
                        </div>
                    ))}
                </Panel>
                <Panel title="Billing and reminders">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        {txt('creditDays', 'Default udhaar days', { mode: 'numeric' })}
                        {txt('ewbLimit', 'E-way bill limit (₹)', { mode: 'numeric', hint: '₹50,000 between states. Some states set a higher limit within the state.' })}
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, margin: '14px 0 6px' }}>Default reminder language for new farmers</div>
                    <div style={{ display: 'flex', gap: 8 }}>{(Object.keys(LANG_LABEL) as Lang[]).map(l => <Chip key={l} active={s.reminderLang === l} onClick={() => set('reminderLang', l)}>{LANG_LABEL[l]}</Chip>)}</div>
                </Panel>
                <Panel title="AI Sahayak connection">
                    <div style={{ fontSize: 14, color: C.muted, marginBottom: 10 }}>AI Sahayak needs internet. Billing, udhaar and stock work without it.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                        {txt('aiServerUrl', 'AI server address', { hint: 'Starts with https://, given with your plan' })}
                        <Field label="Shop key" hint="Keep this private">
                            <input type="password" autoComplete="off" style={inputStyle} value={s.shopKey || ''} onChange={e => set('shopKey', e.target.value.trim())} />
                        </Field>
                    </div>
                </Panel>
                <Panel title="Your data">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn onClick={backup}><Icon name="download" size={16} />Download backup</Btn>
                        <Btn onClick={() => fileRef.current?.click()}>Restore from backup</Btn>
                        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
                        {db.settings.hasSample && <Btn kind="danger" onClick={() => setWipe(true)}>Remove sample data</Btn>}
                    </div>
                    <div style={{ fontSize: 14, color: C.muted, marginTop: 10 }}>
                        {db.farmers.length} farmers, {db.items.length} items, {db.sales.length} bills, {db.payments.length} repayments saved on this device.{isDesktop ? ' A copy is also saved automatically every day in Documents > AgriMunim Backups.' : ' Download a backup at least once a week.'}
                    </div>
                </Panel>
            </div>
            {wipe && (
                <Modal title="Remove sample data?" onClose={() => setWipe(false)} footer={<><Btn onClick={() => setWipe(false)}>Keep it</Btn><Btn kind="danger" onClick={removeSample}>Remove sample data</Btn></>}>
                    This removes the sample farmers, items, bills, repayments and purchases. Entries you made yourself stay. Your shop details stay too.
                </Modal>
            )}
        </div>
    );
}
