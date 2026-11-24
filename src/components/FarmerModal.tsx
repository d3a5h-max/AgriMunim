import { useState } from 'react';
import { useApp } from '../store';
import { Farmer, Lang } from '../types';
import { Btn, Chip, Field, inputStyle, Modal } from '../ui';
import { C } from '../theme';
import { LANG_LABEL, uid } from '../utils';

export const SOILS = ['Black', 'Medium black', 'Red', 'Alluvial', 'Sandy loam', 'Laterite', 'Clay loam'];
export const WATERS = ['Borewell', 'Open well', 'Canal', 'Drip', 'Farm pond', 'Rainfed'];

export function FarmerModal({ farmer, onClose, onSaved }: { farmer?: Farmer; onClose: () => void; onSaved?: (f: Farmer) => void }) {
    const { apply, notify, db } = useApp();
    const [f, setF] = useState<Farmer>(farmer || {
        id: uid(), name: '', phone: '', village: '', acres: 0, soil: 'Black', water: 'Borewell', crops: '',
        lang: db.settings.reminderLang, consent: false, createdAt: new Date().toISOString(),
    });
    const [acres, setAcres] = useState(farmer ? String(farmer.acres) : '');
    const set = (k: keyof Farmer, v: any) => setF({ ...f, [k]: v });
    const digits = f.phone.replace(/\D/g, '');
    const phoneOk = digits.length === 0 || digits.length === 10 || digits.length === 12;
    const valid = f.name.trim().length > 1 && phoneOk;

    const save = () => {
        const rec = { ...f, name: f.name.trim(), village: f.village.trim(), acres: Number(acres) || 0 };
        apply([{ table: 'farmers', rec }]);
        notify(farmer ? `${rec.name} updated` : `${rec.name} added`);
        onSaved?.(rec);
        onClose();
    };

    return (
        <Modal title={farmer ? 'Edit farmer' : 'Add farmer'} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!valid} onClick={save}>Save farmer</Btn></>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <Field label="Full name"><input style={inputStyle} value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></Field>
                <Field label="Mobile number" hint={phoneOk ? undefined : 'Enter a 10-digit number'}><input style={inputStyle} inputMode="tel" value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
                <Field label="Village"><input style={inputStyle} value={f.village} onChange={e => set('village', e.target.value)} /></Field>
                <Field label="Land (acres)"><input style={inputStyle} inputMode="decimal" value={acres} onChange={e => setAcres(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                <Field label="Soil type">
                    <select style={inputStyle} value={f.soil} onChange={e => set('soil', e.target.value)}>{SOILS.map(s => <option key={s}>{s}</option>)}</select>
                </Field>
                <Field label="Water source">
                    <select style={inputStyle} value={f.water} onChange={e => set('water', e.target.value)}>{WATERS.map(s => <option key={s}>{s}</option>)}</select>
                </Field>
                <Field label="Crops grown" style={{ gridColumn: '1 / -1' }}><input style={inputStyle} value={f.crops} onChange={e => set('crops', e.target.value)} /></Field>
            </div>
            <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginBottom: 6 }}>Message language</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(Object.keys(LANG_LABEL) as Lang[]).map(l => <Chip key={l} active={f.lang === l} onClick={() => set('lang', l)}>{LANG_LABEL[l]}</Chip>)}
                </div>
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 15, cursor: 'pointer' }}>
                <input type="checkbox" checked={f.consent} onChange={e => set('consent', e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
                <span>Farmer agreed to receive bills and reminders on WhatsApp</span>
            </label>
        </Modal>
    );
}
