import { useState } from 'react';
import * as XLSX from 'xlsx';
import { downloadFile } from '../platform/runtime';
import { useApp } from '../store';
import { C } from '../theme';
import { Btn, Chip, Empty, Icon, num, PageHead, Panel, Stat, TableWrap, td, th, grid } from '../ui';
import { addDays, billNo, daysSince, dueRows, fmtDate, inr, inr2, isExpired, parseDate, splitGst, stockOf } from '../utils';

const PERIODS = [['Today', 0], ['7 days', 6], ['30 days', 29], ['90 days', 89]] as const;

export default function Reports() {
    const { db, notify, notifyError } = useApp();
    const [days, setDays] = useState<number>(6);
    const start = addDays(new Date(), -days); start.setHours(0, 0, 0, 0);
    const sales = db.sales.filter(s => parseDate(s.date) >= start);
    const pays = db.payments.filter(p => parseDate(p.date) >= start);
    const revenue = sales.reduce((a, s) => a + s.total, 0);
    const cost = sales.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.cost, 0), 0);
    const credit = sales.reduce((a, s) => a + (s.total - s.paid), 0);
    const collected = sales.reduce((a, s) => a + s.paid, 0) + pays.reduce((a, p) => a + p.amount, 0);
    const split = { Cash: 0, UPI: 0, Udhaar: 0 };
    sales.forEach(s => {
        if (s.paidVia === 'UPI') split.UPI += s.paid; else split.Cash += s.paid;
        split.Udhaar += s.total - s.paid;
    });

    const byItem: Record<string, { name: string; qty: number; amount: number; profit: number }> = {};
    sales.forEach(s => s.lines.forEach(l => {
        const r = byItem[l.itemId] || (byItem[l.itemId] = { name: l.name, qty: 0, amount: 0, profit: 0 });
        r.qty += l.qty; r.amount += l.amount; r.profit += splitGst(l.amount, l.gst).taxable - l.cost;
    }));
    const top = Object.values(byItem).sort((a, b) => b.amount - a.amount).slice(0, 6);
    const topMax = Math.max(...top.map(t => t.amount), 1);

    const lastSold: Record<string, string> = {};
    db.sales.forEach(s => s.lines.forEach(l => { if (!lastSold[l.itemId] || s.date > lastSold[l.itemId]) lastSold[l.itemId] = s.date; }));
    const slow = db.items.filter(i => stockOf(i.id, db.batches) > 0 && (!lastSold[i.id] || daysSince(lastSold[i.id]) >= 45));

    const gst: Record<number, { taxable: number; tax: number }> = {};
    sales.forEach(s => s.lines.forEach(l => {
        const g = splitGst(l.amount, l.gst);
        const r = gst[l.gst] || (gst[l.gst] = { taxable: 0, tax: 0 });
        r.taxable += g.taxable; r.tax += g.tax;
    }));
    const gstRows = Object.entries(gst).sort((a, b) => Number(a[0]) - Number(b[0]));
    const profit = revenue - gstRows.reduce((a, [, v]) => a + v.tax, 0) - cost;

    const exportXlsx = async () => {
        try {
            const wb = XLSX.utils.book_new();
            const saleRows = sales.flatMap(s => s.lines.map(l => ({
                Date: fmtDate(s.date), Bill: billNo(s.billNo), Customer: s.customerName, GSTIN: s.customerGstin || '', Item: l.name, HSN: l.hsn, Batch: l.batchNo,
                Qty: l.qty, Rate: l.rate, 'GST %': l.gst, Taxable: +splitGst(l.amount, l.gst).taxable.toFixed(2), GST: +splitGst(l.amount, l.gst).tax.toFixed(2), Amount: l.amount, Payment: s.mode,
            })));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(saleRows), 'Sales');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gstRows.map(([r, v]) => ({ 'GST %': Number(r), Taxable: +v.taxable.toFixed(2), CGST: +(v.tax / 2).toFixed(2), SGST: +(v.tax / 2).toFixed(2), Total: +(v.taxable + v.tax).toFixed(2) }))), 'GST summary');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.items.map(i => ({ Item: i.name, Category: i.category, Qty: stockOf(i.id, db.batches), Unit: i.unit, Price: i.price, 'Expired qty': db.batches.filter(b => b.itemId === i.id && isExpired(b)).reduce((a, b) => a + b.qty, 0) }))), 'Stock');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dueRows(db).map(r => ({ Farmer: r.farmer.name, Village: r.farmer.village, Phone: r.farmer.phone, Due: Math.round(r.ledger.balance), 'Oldest due': fmtDate(r.ledger.oldestDue || ''), Status: r.age.label }))), 'Udhaar');
            const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const ok = await downloadFile(`AgriMunim-report-${new Date().toISOString().slice(0, 10)}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            if (ok) notify('Excel report saved');
        } catch (e) { notifyError(`Couldn't export: ${e instanceof Error ? e.message : String(e)}`); }
    };

    return (
        <div>
            <PageHead title="Reports" sub={days === 0 ? 'Today' : `Last ${days + 1} days`} actions={<Btn kind="accent" onClick={exportXlsx}><Icon name="download" size={16} />Export Excel</Btn>} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {PERIODS.map(([l, d]) => <Chip key={l} active={days === d} onClick={() => setDays(d)}>{l}</Chip>)}
            </div>
            <div style={grid(180)}>
                <Stat label="Sales" value={inr(revenue)} sub={`${sales.length} bills`} />
                <Stat label="Gross profit" value={inr(profit)} tone="green" sub={revenue ? `${Math.round((profit / Math.max(revenue, 1)) * 100)}% of sales, before expenses` : 'No sales'} />
                <Stat label="Money collected" value={inr(collected)} sub="Counter payments and repayments" />
                <Stat label="Udhaar given" value={inr(credit)} tone="red" />
            </div>
            <div style={{ ...grid(340, 16), marginTop: 16 }}>
                <Panel title="Top products">
                    {top.length === 0 ? <Empty>No sales in this period.</Empty> : top.map(t => (
                        <div key={t.name} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 15 }}><span>{t.name.split(' (')[0]} <span style={{ color: C.muted }}>× {t.qty}</span></span><b style={num}>{inr(t.amount)}</b></div>
                            <div style={{ height: 10, background: C.grayTint, borderRadius: 6, marginTop: 5 }}><div style={{ width: `${(t.amount / topMax) * 100}%`, height: '100%', background: C.green, borderRadius: 6 }} /></div>
                        </div>
                    ))}
                </Panel>
                <Panel title="How customers paid">
                    {(['Cash', 'UPI', 'Udhaar'] as const).map(k => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                            <span>{k}</span><span style={{ ...num, fontWeight: 700, color: k === 'Udhaar' ? C.red : C.text }}>{inr(split[k])} <span style={{ color: C.muted, fontWeight: 400 }}>({revenue ? Math.round((split[k] / revenue) * 100) : 0}%)</span></span>
                        </div>
                    ))}
                    <h3 style={{ fontSize: 16, margin: '18px 0 6px' }}>Slow-moving stock</h3>
                    {slow.length === 0 ? <div style={{ color: C.muted }}>Everything in stock sold in the last 45 days.</div> : slow.map(i => (
                        <div key={i.id} style={{ fontSize: 15, padding: '4px 0' }}>{i.name}: {stockOf(i.id, db.batches)} {i.unit}, {lastSold[i.id] ? `no sale in ${daysSince(lastSold[i.id])} days` : 'never sold'}</div>
                    ))}
                </Panel>
            </div>
            <Panel title="GST summary" style={{ marginTop: 16 }} pad={false}>
                {gstRows.length === 0 ? <Empty>No sales in this period.</Empty> : (
                    <TableWrap>
                        <thead><tr><th style={th}>GST rate</th><th style={{ ...th, textAlign: 'right' }}>Taxable value</th><th style={{ ...th, textAlign: 'right' }}>CGST</th><th style={{ ...th, textAlign: 'right' }}>SGST</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                        <tbody>{gstRows.map(([r, v]) => (
                            <tr key={r}><td style={td}>{Number(r) === 0 ? 'Exempt (0%)' : `${r}%`}</td><td style={{ ...td, ...num }}>{inr2(v.taxable)}</td><td style={{ ...td, ...num }}>{inr2(v.tax / 2)}</td><td style={{ ...td, ...num }}>{inr2(v.tax / 2)}</td><td style={{ ...td, ...num, fontWeight: 700 }}>{inr2(v.taxable + v.tax)}</td></tr>
                        ))}</tbody>
                    </TableWrap>
                )}
            </Panel>
        </div>
    );
}
