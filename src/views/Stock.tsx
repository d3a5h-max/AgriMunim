import { useState } from 'react';
import { useApp } from '../store';
import { C } from '../theme';
import { CATEGORIES, Category, Item } from '../types';
import { Badge, Btn, Chip, Empty, Field, Icon, inputStyle, Modal, num, PageHead, Panel, Stat, TableWrap, td, th, grid, Tone } from '../ui';
import { daysUntil, inr, inr2, isExpired, itemStatus, StockStatus, stockOf, uid } from '../utils';

const ST: Record<StockStatus, [string, Tone]> = {
    ok: ['In stock', 'green'], low: ['Low stock', 'amber'], out: ['Out of stock', 'red'], expiring: ['Expires soon', 'amber'], expired: ['Expired batch', 'red'],
};

export function ItemModal({ item, onClose }: { item?: Item; onClose: () => void }) {
    const { apply, notify, db } = useApp();
    const [f, setF] = useState({
        name: item?.name || '', category: (item?.category || 'Seeds') as Category, unit: item?.unit || 'bag', hsn: item?.hsn || '',
        gst: String(item?.gst ?? 0), price: String(item?.price ?? ''), lowAt: String(item?.lowAt ?? 5),
    });
    const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
    const valid = f.name.trim().length > 1 && Number(f.price) > 0;
    const batches = item ? db.batches.filter(b => b.itemId === item.id && b.qty > 0) : [];
    const save = () => {
        const rec: Item = { ...(item || {}), id: item?.id || uid(), name: f.name.trim(), category: f.category, unit: f.unit.trim() || 'unit', hsn: f.hsn.trim(), gst: Number(f.gst) || 0, price: Number(f.price), lowAt: Number(f.lowAt) || 0 };
        apply([{ table: 'items', rec }]);
        notify(item ? `${rec.name} updated` : `${rec.name} added. Add stock through a purchase.`);
        onClose();
    };
    return (
        <Modal title={item ? 'Edit item' : 'Add item'} onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!valid} onClick={save}>Save item</Btn></>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <Field label="Item name" style={{ gridColumn: '1 / -1' }}><input style={inputStyle} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
                <Field label="Category"><select style={inputStyle} value={f.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Unit"><input style={inputStyle} value={f.unit} onChange={e => set('unit', e.target.value)} /></Field>
                <Field label="HSN code"><input style={inputStyle} value={f.hsn} onChange={e => set('hsn', e.target.value)} /></Field>
                <Field label="GST %"><select style={inputStyle} value={f.gst} onChange={e => set('gst', e.target.value)}>{['0', '5', '12', '18', '28'].map(g => <option key={g}>{g}</option>)}</select></Field>
                <Field label="Selling price incl. GST (₹)"><input style={inputStyle} inputMode="decimal" value={f.price} onChange={e => set('price', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                <Field label="Low stock alert at"><input style={inputStyle} inputMode="numeric" value={f.lowAt} onChange={e => set('lowAt', e.target.value.replace(/\D/g, ''))} /></Field>
            </div>
            {batches.length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Batches in stock</div>
                    {batches.map(b => <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 14 }}><span>{b.batchNo}{b.expiry ? ` · expires ${b.expiry}` : ''}</span><span>{b.qty} · cost {inr2(b.cost)}</span></div>)}
                </div>
            )}
        </Modal>
    );
}

export default function Stock() {
    const { db, view, go } = useApp();
    const [cat, setCat] = useState<Category | 'All'>('All');
    const [filter, setFilter] = useState<string>(view.params?.filter || '');
    const [q, setQ] = useState('');
    const [edit, setEdit] = useState<Item | 'new' | null>(null);
    const rows = db.items.map(item => {
        const st = itemStatus(item, db.batches);
        const bs = db.batches.filter(b => b.itemId === item.id && b.qty > 0).sort((a, b) => (a.expiry || '9').localeCompare(b.expiry || '9'));
        return { item, st, qty: stockOf(item.id, db.batches), bs, value: bs.filter(b => !isExpired(b)).reduce((a, b) => a + b.qty * b.cost, 0) };
    });
    const shown = rows.filter(r =>
        (cat === 'All' || r.item.category === cat) &&
        (!q || r.item.name.toLowerCase().includes(q.toLowerCase())) &&
        (!filter || (filter === 'low' && (r.st === 'low' || r.st === 'out')) || (filter === 'expiry' && (r.st === 'expiring' || r.st === 'expired')) || (filter === 'alerts' && r.st !== 'ok')));
    const lowN = rows.filter(r => r.st === 'low' || r.st === 'out').length;
    const expN = rows.filter(r => r.st === 'expiring' || r.st === 'expired').length;

    return (
        <div>
            <PageHead title="Stock" sub={`${db.items.length} items`} actions={<><Btn onClick={() => setEdit('new')}><Icon name="plus" size={16} />Add item</Btn><Btn kind="accent" onClick={() => go('purchases', { add: true })}>Add purchase</Btn></>} />
            <div style={grid(180)}>
                <Stat label="Low or out of stock" value={`${lowN} items`} tone="amber" onClick={() => setFilter(filter === 'low' ? '' : 'low')} />
                <Stat label="Expiring in 30 days or expired" value={`${expN} items`} tone="red" onClick={() => setFilter(filter === 'expiry' ? '' : 'expiry')} />
                <Stat label="Stock value at cost" value={inr(rows.reduce((a, r) => a + r.value, 0))} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 12px', alignItems: 'center' }}>
                {(['All', ...CATEGORIES] as const).map(c => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
                {filter && <Btn small kind="ghost" onClick={() => setFilter('')}><Icon name="x" size={14} />Clear {filter === 'low' ? 'low stock' : filter === 'expiry' ? 'expiry' : 'alert'} filter</Btn>}
                <input aria-label="Search items" placeholder="Search items" value={q} onChange={e => setQ(e.target.value)} style={{ ...inputStyle, maxWidth: 240, marginLeft: 'auto' }} />
            </div>
            <Panel pad={false}>
                {shown.length === 0 ? <Empty>No items match.</Empty> : (
                    <TableWrap>
                        <thead><tr><th style={th}>Item</th><th style={th}>Category</th><th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={th}>Batches</th><th style={{ ...th, textAlign: 'right' }}>Price</th><th style={th}>Status</th></tr></thead>
                        <tbody>{shown.map(r => (
                            <tr key={r.item.id} onClick={() => setEdit(r.item)} style={{ cursor: 'pointer' }}>
                                <td style={{ ...td, fontWeight: 700 }}>{r.item.name}<div style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}>HSN {r.item.hsn || 'not set'} · GST {r.item.gst}%</div></td>
                                <td style={td}>{r.item.category}</td>
                                <td style={{ ...td, ...num, fontWeight: 700 }}>{r.qty} <span style={{ fontWeight: 400, color: C.muted }}>{r.item.unit}</span></td>
                                <td style={{ ...td, fontSize: 14 }}>{r.bs.length === 0 ? 'None' : r.bs.map(b => (
                                    <div key={b.id} style={{ color: isExpired(b) ? C.redText : C.text }}>{b.batchNo}{b.expiry ? ` · ${isExpired(b) ? 'expired' : daysUntil(b.expiry) <= 30 ? `${daysUntil(b.expiry)} days left` : b.expiry.slice(0, 7)}` : ''} · {b.qty}</div>))}</td>
                                <td style={{ ...td, ...num }}>{inr2(r.item.price)}</td>
                                <td style={td}><Badge tone={ST[r.st][1]}>{ST[r.st][0]}</Badge></td>
                            </tr>))}</tbody>
                    </TableWrap>
                )}
            </Panel>
            {edit && <ItemModal item={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
        </div>
    );
}
