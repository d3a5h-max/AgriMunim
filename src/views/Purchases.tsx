import { useState } from 'react';
import { useApp } from '../store';
import { C } from '../theme';
import { Batch, Purchase, PurchaseLine } from '../types';
import { Btn, Empty, Field, Icon, inputStyle, Modal, num, PageHead, Panel, TableWrap, td, th } from '../ui';
import { fmtDate, inr, inr2, todayYmd, uid } from '../utils';
import { ItemModal } from './Stock';

interface Row { itemId: string; batchNo: string; expiry: string; qty: string; cost: string; price: string }
const blank = (itemId = ''): Row => ({ itemId, batchNo: '', expiry: '', qty: '', cost: '', price: '' });

function PurchaseModal({ onClose }: { onClose: () => void }) {
    const { db, apply, notify } = useApp();
    const [supplier, setSupplier] = useState('');
    const [invoice, setInvoice] = useState('');
    const [date, setDate] = useState(todayYmd());
    const [rows, setRows] = useState<Row[]>([blank(db.items[0]?.id)]);
    const suppliers = Array.from(new Set(db.purchases.map(p => p.supplier)));
    const upd = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => {
        if (j !== i) return r;
        const n = { ...r, [k]: k === 'qty' || k === 'cost' || k === 'price' ? v.replace(/[^\d.]/g, '') : v };
        if (k === 'itemId') {
            const last = [...db.batches].reverse().find(b => b.itemId === v);
            n.cost = last ? String(last.cost) : '';
        }
        return n;
    }));
    const good = rows.filter(r => r.itemId && Number(r.qty) > 0 && Number(r.cost) > 0 && r.batchNo.trim());
    const total = good.reduce((a, r) => a + Number(r.qty) * Number(r.cost), 0);
    const valid = supplier.trim() && good.length === rows.length && rows.length > 0;

    const save = () => {
        const when = new Date(date + 'T12:00:00').toISOString();
        const lines: PurchaseLine[] = good.map(r => ({ itemId: r.itemId, name: db.items.find(i => i.id === r.itemId)?.name || '', batchNo: r.batchNo.trim(), expiry: r.expiry, qty: Number(r.qty), cost: Number(r.cost) }));
        const p: Purchase = { id: uid(), date: when, supplier: supplier.trim(), invoiceNo: invoice.trim(), lines, total };
        const newBatches: Batch[] = lines.map(l => ({ id: uid(), itemId: l.itemId, batchNo: l.batchNo, expiry: l.expiry, qty: l.qty, cost: l.cost, addedAt: when }));
        const priceUpdates = good.filter(r => Number(r.price) > 0).map(r => ({ ...db.items.find(i => i.id === r.itemId)!, price: Number(r.price) }));
        const oldItems = priceUpdates.map(u => db.items.find(i => i.id === u.id)!);
        apply([{ table: 'purchases', rec: p }, ...newBatches.map(b => ({ table: 'batches' as const, rec: b })), ...priceUpdates.map(i => ({ table: 'items' as const, rec: i }))]);
        notify(`Purchase from ${p.supplier} saved, ${lines.length} batches added`, () =>
            apply(oldItems.map(i => ({ table: 'items' as const, rec: i })), [{ table: 'purchases', id: p.id }, ...newBatches.map(b => ({ table: 'batches' as const, id: b.id }))]));
        onClose();
    };

    return (
        <Modal wide title="Add purchase" onClose={onClose} footer={<><span style={{ marginRight: 'auto', fontWeight: 700, alignSelf: 'center' }}>Total {inr2(total)}</span><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!valid} onClick={save}>Save purchase</Btn></>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="Supplier"><input list="am-suppliers" style={inputStyle} value={supplier} onChange={e => setSupplier(e.target.value)} /><datalist id="am-suppliers">{suppliers.map(s => <option key={s} value={s} />)}</datalist></Field>
                <Field label="Supplier invoice no."><input style={inputStyle} value={invoice} onChange={e => setInvoice(e.target.value)} /></Field>
                <Field label="Date"><input type="date" style={inputStyle} value={date} max={todayYmd()} onChange={e => setDate(e.target.value || todayYmd())} /></Field>
            </div>
            <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                {rows.map((r, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, alignItems: 'end', padding: 12, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                        <Field label="Item" style={{ gridColumn: 'span 2' }}><select style={inputStyle} value={r.itemId} onChange={e => upd(i, 'itemId', e.target.value)}>{db.items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}</select></Field>
                        <Field label="Batch no."><input style={inputStyle} value={r.batchNo} onChange={e => upd(i, 'batchNo', e.target.value)} /></Field>
                        <Field label="Expiry"><input type="date" style={inputStyle} value={r.expiry} onChange={e => upd(i, 'expiry', e.target.value)} /></Field>
                        <Field label="Qty"><input style={inputStyle} inputMode="decimal" value={r.qty} onChange={e => upd(i, 'qty', e.target.value)} /></Field>
                        <Field label="Cost / unit ₹"><input style={inputStyle} inputMode="decimal" value={r.cost} onChange={e => upd(i, 'cost', e.target.value)} /></Field>
                        <Field label="New selling price"><input style={inputStyle} inputMode="decimal" placeholder={String(db.items.find(it => it.id === r.itemId)?.price ?? '')} value={r.price} onChange={e => upd(i, 'price', e.target.value)} /></Field>
                        {rows.length > 1 && <Btn small kind="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="trash" size={15} />Remove</Btn>}
                    </div>
                ))}
                <div><Btn small onClick={() => setRows([...rows, blank(db.items[0]?.id)])}><Icon name="plus" size={15} />Add another item</Btn></div>
            </div>
        </Modal>
    );
}

export default function Purchases() {
    const { db, view } = useApp();
    const [add, setAdd] = useState<boolean>(!!view.params?.add);
    const [newItem, setNewItem] = useState(false);
    const list = [...db.purchases].sort((a, b) => b.date.localeCompare(a.date));
    const month = list.filter(p => new Date(p.date).getMonth() === new Date().getMonth() && new Date(p.date).getFullYear() === new Date().getFullYear());
    return (
        <div>
            <PageHead title="Purchases" sub={`${inr(month.reduce((a, p) => a + p.total, 0))} bought this month`} actions={<><Btn onClick={() => setNewItem(true)}><Icon name="plus" size={16} />New item</Btn><Btn kind="accent" onClick={() => setAdd(true)}>Add purchase</Btn></>} />
            <Panel pad={false}>
                {list.length === 0 ? <Empty>No purchases yet. Add a supplier bill to bring stock in.</Empty> : (
                    <TableWrap>
                        <thead><tr><th style={th}>Date</th><th style={th}>Supplier</th><th style={th}>Invoice</th><th style={th}>Items</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                        <tbody>{list.map(p => (
                            <tr key={p.id}>
                                <td style={td}>{fmtDate(p.date)}</td>
                                <td style={{ ...td, fontWeight: 700 }}>{p.supplier}</td>
                                <td style={td}>{p.invoiceNo}</td>
                                <td style={{ ...td, fontSize: 14 }}>{p.lines.map(l => `${l.name.split(' (')[0]} × ${l.qty} (${l.batchNo})`).join(', ')}</td>
                                <td style={{ ...td, ...num, fontWeight: 700 }}>{inr(p.total)}</td>
                            </tr>))}</tbody>
                    </TableWrap>
                )}
            </Panel>
            {add && <PurchaseModal onClose={() => setAdd(false)} />}
            {newItem && <ItemModal onClose={() => setNewItem(false)} />}
        </div>
    );
}
