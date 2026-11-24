import { useState } from 'react';
import { useApp } from '../store';
import { Farmer, Payment } from '../types';
import { Btn, Chip, Field, inputStyle, Modal } from '../ui';
import { C } from '../theme';
import { dueRows, inr, ledgerFor, todayYmd, uid } from '../utils';

export function PaymentModal({ farmerId, onClose }: { farmerId?: string; onClose: () => void }) {
    const { db, apply, notify } = useApp();
    const rows = dueRows(db);
    const [fid, setFid] = useState(farmerId || rows[0]?.farmer.id || db.farmers[0]?.id || '');
    const ledger = fid ? ledgerFor(fid, db) : null;
    const [amount, setAmount] = useState(() => (ledger && ledger.balance > 0 ? String(Math.round(ledger.balance)) : ''));
    const [mode, setMode] = useState<'Cash' | 'UPI'>('Cash');
    const [date, setDate] = useState(todayYmd());
    const [note, setNote] = useState('');
    const farmer = db.farmers.find(f => f.id === fid);
    const amt = Number(amount);
    const valid = !!farmer && amt > 0;

    const save = () => {
        if (!farmer) return;
        const now = new Date();
        const d = new Date(date + 'T' + now.toTimeString().slice(0, 8));
        const p: Payment = { id: uid(), farmerId: farmer.id, date: d.toISOString(), amount: amt, mode, note: note.trim() || undefined };
        apply([{ table: 'payments', rec: p }]);
        notify(`${inr(amt)} received from ${farmer.name}`, () => apply([], [{ table: 'payments', id: p.id }]));
        onClose();
    };

    return (
        <Modal title="Receive payment" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!valid} onClick={save}>Save payment</Btn></>}>
            <div style={{ display: 'grid', gap: 14 }}>
                {!farmerId && (
                    <Field label="Farmer">
                        <select style={inputStyle} value={fid} onChange={e => {
                            setFid(e.target.value);
                            const l = ledgerFor(e.target.value, db);
                            setAmount(l.balance > 0 ? String(Math.round(l.balance)) : '');
                        }}>
                            {[...rows.map(r => r.farmer), ...db.farmers.filter(f => !rows.some(r => r.farmer.id === f.id))].map((f: Farmer) => (
                                <option key={f.id} value={f.id}>{f.name} · {f.village}</option>
                            ))}
                        </select>
                    </Field>
                )}
                {farmer && ledger && (
                    <div style={{ background: C.bg, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span>{farmer.name}</span>
                        <span>Current due <b style={{ color: ledger.balance > 0 ? C.red : C.greenText }}>{inr(ledger.balance)}</b></span>
                    </div>
                )}
                <Field label="Amount received (₹)">
                    <input style={inputStyle} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
                </Field>
                <div>
                    <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginBottom: 6 }}>Paid by</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Chip active={mode === 'Cash'} onClick={() => setMode('Cash')}>Cash</Chip>
                        <Chip active={mode === 'UPI'} onClick={() => setMode('UPI')}>UPI</Chip>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Date"><input type="date" style={inputStyle} value={date} max={todayYmd()} onChange={e => setDate(e.target.value || todayYmd())} /></Field>
                    <Field label="Note (optional)"><input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} /></Field>
                </div>
            </div>
        </Modal>
    );
}
