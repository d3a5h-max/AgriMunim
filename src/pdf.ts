import { jsPDF } from 'jspdf';
import { downloadFile } from './platform/runtime';
import { DB, Farmer, Sale } from './types';
import { billNo, fmtDate, ledgerFor, splitGst } from './utils';

const rs = (n: number) => 'Rs. ' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, '');

async function save(doc: jsPDF, name: string) {
    const blob = doc.output('blob');
    await downloadFile(name, blob);
}

export async function billPdf(sale: Sale, db: DB) {
    const s = db.settings;
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    let y = 14;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(ascii(s.shopName), 10, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    y += 5; doc.text(ascii(`${s.address}${s.phone ? '  |  Ph ' + s.phone : ''}`), 10, y);
    if (s.gstin) { y += 4; doc.text(`GSTIN ${s.gstin}`, 10, y); }
    y += 7; doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('TAX INVOICE', 10, y);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Bill ${billNo(sale.billNo)}   ${fmtDate(sale.date)}`, 138, y, { align: 'right' });
    y += 6; doc.text(ascii(`To: ${sale.customerName}${sale.customerGstin ? '  GSTIN ' + sale.customerGstin : ''}`), 10, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 10, y); doc.text('HSN', 72, y); doc.text('Qty', 88, y); doc.text('Rate', 108, y, { align: 'right' }); doc.text('Amount', 138, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 2; doc.line(10, y, 138, y); y += 5;
    const byRate: Record<number, { taxable: number; tax: number }> = {};
    sale.lines.forEach(l => {
        const name = doc.splitTextToSize(ascii(`${l.name} (${l.batchNo})`), 60) as string[];
        doc.text(name, 10, y); doc.text(l.hsn, 72, y); doc.text(String(l.qty), 88, y);
        doc.text(l.rate.toFixed(2), 108, y, { align: 'right' }); doc.text(l.amount.toFixed(2), 138, y, { align: 'right' });
        y += 4.5 * name.length + 1.5;
        const g = splitGst(l.amount, l.gst);
        byRate[l.gst] = byRate[l.gst] || { taxable: 0, tax: 0 };
        byRate[l.gst].taxable += g.taxable; byRate[l.gst].tax += g.tax;
        if (y > 185) { doc.addPage(); y = 14; }
    });
    doc.line(10, y, 138, y); y += 5;
    Object.entries(byRate).forEach(([rate, v]) => {
        const r = Number(rate);
        doc.text(r === 0 ? `Exempt (0%) taxable ${v.taxable.toFixed(2)}` : `GST ${r}%: taxable ${v.taxable.toFixed(2)}, CGST ${(v.tax / 2).toFixed(2)}, SGST ${(v.tax / 2).toFixed(2)}`, 10, y);
        y += 4.5;
    });
    y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(`Total ${rs(sale.total)}`, 138, y, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    y += 5; doc.text(`Paid ${rs(sale.paid)}   Balance on this bill ${rs(sale.total - sale.paid)}`, 138, y, { align: 'right' });
    if (sale.dueDate && sale.total > sale.paid) { y += 4.5; doc.text(`Due by ${fmtDate(sale.dueDate)}`, 138, y, { align: 'right' }); }
    y += 10; doc.text('Prices include GST. Thank you for your purchase.', 10, y);
    await save(doc, `Bill-${billNo(sale.billNo)}.pdf`);
}

export async function statementPdf(farmer: Farmer, db: DB) {
    const L = ledgerFor(farmer.id, db);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 16;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(ascii(db.settings.shopName), 14, y);
    doc.setFontSize(11); y += 7; doc.text(ascii(`Account statement: ${farmer.name}, ${farmer.village}`), 14, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); y += 5; doc.text(`Printed ${fmtDate(new Date().toISOString())}`, 14, y);
    y += 8;
    const rows: { date: string; text: string; debit: number; credit: number }[] = [];
    L.bills.forEach(b => {
        rows.push({ date: b.sale.date, text: `Bill ${billNo(b.sale.billNo)} (${b.sale.lines.length} items)`, debit: b.sale.total, credit: 0 });
        if (b.sale.paid > 0) rows.push({ date: b.sale.date, text: `Paid at counter, bill ${billNo(b.sale.billNo)}`, debit: 0, credit: b.sale.paid });
    });
    L.allocs.forEach(a => rows.push({ date: a.payment.date, text: `Payment (${a.payment.mode})`, debit: 0, credit: a.payment.amount }));
    rows.sort((a, b) => a.date.localeCompare(b.date));
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 14, y); doc.text('Details', 44, y); doc.text('Bill amount', 150, y, { align: 'right' }); doc.text('Paid', 172, y, { align: 'right' }); doc.text('Balance', 196, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); y += 2; doc.line(14, y, 196, y); y += 5;
    let bal = 0;
    rows.forEach(r => {
        bal += r.debit - r.credit;
        doc.text(fmtDate(r.date), 14, y); doc.text(r.text, 44, y);
        if (r.debit) doc.text(r.debit.toFixed(2), 150, y, { align: 'right' });
        if (r.credit) doc.text(r.credit.toFixed(2), 172, y, { align: 'right' });
        doc.text(bal.toFixed(2), 196, y, { align: 'right' });
        y += 5.5;
        if (y > 280) { doc.addPage(); y = 16; }
    });
    doc.line(14, y, 196, y); y += 6; doc.setFont('helvetica', 'bold');
    doc.text(`Balance due ${rs(L.balance)}`, 196, y, { align: 'right' });
    await save(doc, `Statement-${ascii(farmer.name).replace(/\s+/g, '-')}.pdf`);
}
