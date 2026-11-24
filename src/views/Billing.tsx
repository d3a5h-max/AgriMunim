import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { C } from '../theme';
import { Batch, PayMode, Sale, SaleLine } from '../types';
import { Badge, Btn, Chip, Field, Icon, inputStyle, Modal, num, PageHead, Panel, td, th } from '../ui';
import { addDays, allocate, billNo, inr, inr2, ledgerFor, openLink, splitGst, stockOf, uid, waLink, ymd } from '../utils';
import { billPdf } from '../pdf';

interface Draft { itemId: string; qty: string; rate: string }

export default function Billing() {
    const { db, apply, saveSettings, notify, notifyError, view, go } = useApp();
    const p = view.params || {};
    const [farmerId, setFarmerId] = useState<string>(p.farmerId || '');
    const [walkin, setWalkin] = useState('');
    const [gstin, setGstin] = useState('');
    const [lines, setLines] = useState<Draft[]>(() =>
        (p.itemIds || []).map((id: string) => ({ itemId: id, qty: '1', rate: String(db.items.find(i => i.id === id)?.price ?? '') })));
    const [q, setQ] = useState('');
    const [mode, setMode] = useState<PayMode>('Cash');
    const [partPaid, setPartPaid] = useState('');
    const [partVia, setPartVia] = useState<'Cash' | 'UPI'>('Cash');
    const [due, setDue] = useState(ymd(addDays(new Date(), db.settings.creditDays)));
    const [transport, setTransport] = useState(true);
    const [saved, setSaved] = useState<Sale | null>(null);

    const farmer = db.farmers.find(f => f.id === farmerId);
    const ledger = farmer ? ledgerFor(farmer.id, db) : null;
    const matches = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return [];
        return db.items.filter(i => i.name.toLowerCase().includes(s) || i.category.toLowerCase().includes(s)).slice(0, 8);
    }, [q, db.items]);

    const rows = lines.map(l => {
        const item = db.items.find(i => i.id === l.itemId);
        const qty = Number(l.qty) || 0;
        const rate = Number(l.rate) || 0;
        const avail = stockOf(l.itemId, db.batches);
        const alloc = qty > 0 ? allocate(l.itemId, qty, db.batches) : null;
        return { l, item, qty, rate, amount: qty * rate, avail, alloc };
    });
    const total = rows.reduce((a, r) => a + r.amount, 0);
    const tax = rows.reduce((a, r) => a + (r.item ? splitGst(r.amount, r.item.gst).tax : 0), 0);
    const short = rows.some(r => r.qty <= 0 || !r.alloc);
    const paidNow = mode === 'Cash' || mode === 'UPI' ? total : mode === 'Part' ? Math.min(Number(partPaid) || 0, total) : 0;
    const credit = total - paidNow;
    const needsEwb = total > db.settings.ewbLimit;
    const canSave = rows.length > 0 && !short && (credit <= 0 || !!farmer) && (mode !== 'Part' || paidNow > 0);

    const addItem = (id: string) => {
        setQ('');
        if (lines.some(l => l.itemId === id)) {
            setLines(lines.map(l => (l.itemId === id ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l)));
        } else {
            const it = db.items.find(i => i.id === id);
            setLines([...lines, { itemId: id, qty: '1', rate: String(it?.price ?? 0) }]);
        }
    };
    const upd = (i: number, k: keyof Draft, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v.replace(/[^\d.]/g, '') } : l)));

    const save = () => {
        if (!canSave) return;
        const saleLines: SaleLine[] = [];
        const changed: Record<string, Batch> = {};
        rows.forEach(r => {
            if (!r.item || !r.alloc) return;
            r.alloc.forEach(a => {
                const amount = a.qty * r.rate;
                saleLines.push({ itemId: r.item!.id, name: r.item!.name, hsn: r.item!.hsn, batchId: a.batch.id, batchNo: a.batch.batchNo, qty: a.qty, rate: r.rate, gst: r.item!.gst, amount, cost: a.qty * a.batch.cost });
                const cur = changed[a.batch.id] || a.batch;
                changed[a.batch.id] = { ...cur, qty: cur.qty - a.qty };
            });
        });
        const originals = Object.keys(changed).map(id => db.batches.find(b => b.id === id)!);
        const sale: Sale = {
            id: uid(), billNo: db.settings.nextBill, date: new Date().toISOString(), farmerId: farmer?.id || null,
            customerName: farmer ? farmer.name : walkin.trim() || 'Walk-in customer', customerGstin: gstin.trim().toUpperCase() || undefined,
            lines: saleLines, total, paid: paidNow, mode, paidVia: mode === 'UPI' ? 'UPI' : mode === 'Part' ? partVia : mode === 'Cash' ? 'Cash' : undefined,
            dueDate: credit > 0 ? due : undefined, ewb: needsEwb && transport ? { status: 'needed' } : undefined,
        };
        try {
            apply([{ table: 'sales', rec: sale }, ...Object.values(changed).map(b => ({ table: 'batches' as const, rec: b }))]);
            const settingsBefore = db.settings;
            saveSettings({ ...db.settings, nextBill: db.settings.nextBill + 1 });
            notify(`Bill ${billNo(sale.billNo)} saved`, () => {
                apply(originals.map(b => ({ table: 'batches' as const, rec: b })), [{ table: 'sales', id: sale.id }]);
                saveSettings(settingsBefore);
                setSaved(null);
            });
            setSaved(sale);
            setLines([]); setWalkin(''); setGstin(''); setPartPaid(''); setMode('Cash');
        } catch (e) {
            notifyError(`Couldn't save the bill: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const shareText = (s: Sale) => {
        const items = s.lines.map(l => `${l.name} x ${l.qty} = ${inr(l.amount)}`).join('\n');
        const bal = s.farmerId ? ledgerFor(s.farmerId, db).balance : s.total - s.paid;
        return `${db.settings.shopName}\nBill ${billNo(s.billNo)}\n${items}\nTotal ${inr(s.total)}, paid ${inr(s.paid)}${bal > 0 ? `\nTotal due now ${inr(bal)}` : ''}\nThank you.`;
    };

    return (
        <div>
            <PageHead title="New sale" sub={`Bill no. ${billNo(db.settings.nextBill)}`} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gap: 16, flex: '2 1 520px', minWidth: 0 }}>
                    <Panel>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
                            <Field label="Customer">
                                <select style={inputStyle} value={farmerId} onChange={e => setFarmerId(e.target.value)}>
                                    <option value="">Walk-in customer</option>
                                    {[...db.farmers].sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name} · {f.village}</option>)}
                                </select>
                            </Field>
                            {!farmer && <Field label="Name (optional)"><input style={inputStyle} value={walkin} onChange={e => setWalkin(e.target.value)} /></Field>}
                            <Field label="Buyer GSTIN (optional)"><input style={inputStyle} value={gstin} maxLength={15} onChange={e => setGstin(e.target.value)} /></Field>
                        </div>
                        {farmer && ledger && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap', fontSize: 15 }}>
                                <span style={{ color: C.muted }}>{farmer.village} · {farmer.acres} acre · {farmer.crops}</span>
                                <span>Current due <b style={{ color: ledger.balance > 0 ? C.red : C.greenText }}>{inr(ledger.balance)}</b></span>
                            </div>
                        )}
                    </Panel>
                    <Panel pad={false}>
                        <div style={{ padding: '14px 18px', position: 'relative' }}>
                            <Field label="Add item">
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 11, top: 10 }}><Icon name="search" color={C.muted} /></span>
                                    <input style={{ ...inputStyle, paddingLeft: 36 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search urea, DAP, soybean seed…"
                                        onKeyDown={e => { if (e.key === 'Enter' && matches[0]) addItem(matches[0].id); }} />
                                </div>
                            </Field>
                            {matches.length > 0 && (
                                <div style={{ position: 'absolute', left: 18, right: 18, top: 78, background: '#fff', border: `1px solid ${C.borderStrong}`, borderRadius: 12, zIndex: 5, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                    {matches.map(i => {
                                        const st = stockOf(i.id, db.batches);
                                        return (
                                            <button key={i.id} onClick={() => addItem(i.id)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, padding: '10px 14px', border: 'none', borderBottom: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 15, textAlign: 'left', color: C.text }}>
                                                <span>{i.name}</span>
                                                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                    <Badge tone={st === 0 ? 'red' : st <= i.lowAt ? 'amber' : 'green'}>{st} {i.unit}</Badge>{inr2(i.price)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                                <thead><tr><th style={th}>Item</th><th style={th}>Batch (first expiry)</th><th style={th}>Qty</th><th style={th}>Rate ₹</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}></th></tr></thead>
                                <tbody>
                                    {rows.length === 0 && <tr><td colSpan={6} style={{ ...td, color: C.muted, textAlign: 'center', padding: 24 }}>No items yet. Search above to add the first item.</td></tr>}
                                    {rows.map((r, i) => (
                                        <tr key={r.l.itemId}>
                                            <td style={{ ...td, fontWeight: 600 }}>{r.item?.name}<div style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}>GST {r.item?.gst}% · {r.avail} {r.item?.unit} in stock</div></td>
                                            <td style={{ ...td, fontSize: 14 }}>{r.alloc ? r.alloc.map(a => `${a.batch.batchNo}${a.batch.expiry ? ' · ' + a.batch.expiry.slice(0, 7) : ''}${r.alloc!.length > 1 ? ` (${a.qty})` : ''}`).join(', ') : <span style={{ color: C.red, fontWeight: 600 }}>{r.qty > 0 ? `Only ${r.avail} in stock` : 'Enter quantity'}</span>}</td>
                                            <td style={td}><input aria-label="Quantity" style={{ ...inputStyle, width: 72, padding: '7px 9px' }} inputMode="decimal" value={r.l.qty} onChange={e => upd(i, 'qty', e.target.value)} /></td>
                                            <td style={td}><input aria-label="Rate" style={{ ...inputStyle, width: 96, padding: '7px 9px' }} inputMode="decimal" value={r.l.rate} onChange={e => upd(i, 'rate', e.target.value)} /></td>
                                            <td style={{ ...td, ...num, fontWeight: 700 }}>{inr2(r.amount)}</td>
                                            <td style={td}><button aria-label="Remove item" onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><Icon name="trash" color={C.muted} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </div>
                <Panel style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted }}><span>Taxable value</span><span style={num}>{inr2(total - tax)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, marginTop: 4 }}><span>GST (CGST + SGST)</span><span style={num}>{inr2(tax)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 16 }}>Total (incl. GST)</span><span style={{ fontSize: 30, fontWeight: 800, ...num }}>{inr(total)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                        {(['Cash', 'UPI', 'Udhaar', 'Part'] as PayMode[]).map(m => (
                            <Btn key={m} kind={mode === m ? 'primary' : 'outline'} onClick={() => setMode(m)}>{m === 'Part' ? 'Part payment' : m}</Btn>
                        ))}
                    </div>
                    {mode === 'Part' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 12, alignItems: 'end' }}>
                            <Field label="Paid now (₹)"><input style={inputStyle} inputMode="decimal" value={partPaid} onChange={e => setPartPaid(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                            <div style={{ display: 'flex', gap: 6 }}><Chip active={partVia === 'Cash'} onClick={() => setPartVia('Cash')}>Cash</Chip><Chip active={partVia === 'UPI'} onClick={() => setPartVia('UPI')}>UPI</Chip></div>
                        </div>
                    )}
                    {credit > 0 && rows.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <Field label={`Udhaar ${inr(credit)}, due by`}><input type="date" style={inputStyle} value={due} onChange={e => setDue(e.target.value)} /></Field>
                            {!farmer && <div style={{ color: C.red, fontSize: 14, marginTop: 8 }}>Pick a farmer to give udhaar.</div>}
                        </div>
                    )}
                    {needsEwb && (
                        <div style={{ marginTop: 14, background: C.amberTint, border: `1px solid ${C.amberBorder}`, borderRadius: 12, padding: '10px 12px', fontSize: 14 }}>
                            <b>E-way bill may be needed.</b> This bill is above {inr(db.settings.ewbLimit)}.
                            <label style={{ display: 'flex', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={transport} onChange={e => setTransport(e.target.checked)} /> Goods will move by vehicle
                            </label>
                        </div>
                    )}
                    <Btn kind="accent" disabled={!canSave} onClick={save} style={{ width: '100%', marginTop: 16, padding: '13px 18px', fontSize: 16 }}>Save bill</Btn>
                </Panel>
            </div>

            {saved && (
                <Modal title={`Bill ${billNo(saved.billNo)} saved`} onClose={() => setSaved(null)} footer={<>
                    <Btn onClick={() => billPdf(saved, db).catch(e => notifyError(`Couldn't create the PDF: ${e instanceof Error ? e.message : e}`))}><Icon name="download" size={16} />Download bill PDF</Btn>
                    {(() => { const f = db.farmers.find(x => x.id === saved.farmerId); return f?.phone ? <Btn onClick={() => openLink(waLink(f.phone, shareText(saved)))}><Icon name="msg" size={16} />Share on WhatsApp</Btn> : null; })()}
                    {saved.ewb && <Btn onClick={() => go('eway', { id: saved.id })}>Prepare e-way bill</Btn>}
                    <Btn kind="primary" onClick={() => setSaved(null)}>Next bill</Btn>
                </>}>
                    <div style={{ display: 'grid', gap: 6 }}>
                        <div><b>{saved.customerName}</b></div>
                        {saved.lines.map((l, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{l.name} × {l.qty} <span style={{ color: C.muted }}>({l.batchNo})</span></span><span style={num}>{inr2(l.amount)}</span></div>)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, fontWeight: 700 }}><span>Total</span><span>{inr(saved.total)}</span></div>
                        <div style={{ color: C.muted }}>Paid {inr(saved.paid)}{saved.total > saved.paid ? ` · udhaar ${inr(saved.total - saved.paid)} due ${saved.dueDate}` : ''}</div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
