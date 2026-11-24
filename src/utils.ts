import { openExternal } from './platform/platform';
import { Batch, DB, Farmer, Item, Lang, Payment, Sale } from './types';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);

export const inr = (n: number) => {
    const v = Math.round(n || 0);
    return (v < 0 ? '-₹' : '₹') + Math.abs(v).toLocaleString('en-IN');
};
export const inr2 = (n: number) =>
    '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ymd = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
};
export const todayYmd = () => ymd(new Date());
export const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
};
export const parseDate = (s: string) => (s.length === 10 ? new Date(s + 'T12:00:00') : new Date(s));
export const fmtDate = (s: string) =>
    s ? parseDate(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
export const fmtShort = (s: string) =>
    s ? parseDate(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
export const daysSince = (s: string, now = new Date()) =>
    Math.floor((now.getTime() - parseDate(s).getTime()) / 86400000);
export const daysUntil = (s: string, now = new Date()) =>
    Math.ceil((parseDate(s).getTime() - now.getTime()) / 86400000);
export const sameDay = (s: string, d: Date) => ymd(parseDate(s)) === ymd(d);
export const billNo = (n: number) => String(n).padStart(4, '0');

// ---------- Stock ----------
export const isExpired = (b: Batch) => !!b.expiry && daysUntil(b.expiry) < 0;
export const sellableBatches = (itemId: string, batches: Batch[]) =>
    batches
        .filter(b => b.itemId === itemId && b.qty > 0 && !isExpired(b))
        .sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
export const stockOf = (itemId: string, batches: Batch[]) =>
    sellableBatches(itemId, batches).reduce((s, b) => s + b.qty, 0);

export type StockStatus = 'ok' | 'low' | 'out' | 'expiring' | 'expired';
export function itemStatus(item: Item, batches: Batch[]): StockStatus {
    const mine = batches.filter(b => b.itemId === item.id && b.qty > 0);
    const qty = stockOf(item.id, batches);
    if (mine.some(isExpired)) return 'expired';
    if (qty === 0) return 'out';
    if (mine.some(b => b.expiry && daysUntil(b.expiry) <= 30)) return 'expiring';
    if (qty <= item.lowAt) return 'low';
    return 'ok';
}

/** First-expiry-first-out allocation. Returns null when stock is short. */
export function allocate(itemId: string, qty: number, batches: Batch[]) {
    const out: { batch: Batch; qty: number }[] = [];
    let left = qty;
    for (const b of sellableBatches(itemId, batches)) {
        if (left <= 0) break;
        const take = Math.min(b.qty, left);
        out.push({ batch: b, qty: take });
        left -= take;
    }
    return left > 0 ? null : out;
}

// ---------- Udhaar ledger (FIFO) ----------
export interface BillDue { sale: Sale; credit: number; remaining: number }
export interface PaymentAlloc { payment: Payment; bills: number[]; daysAfterBill: number | null }
export interface Ledger {
    bills: BillDue[];
    allocs: PaymentAlloc[];
    totalBought: number;
    paidAtCounter: number;
    repaid: number;
    balance: number;
    oldestDue: string | null;
    avgDaysToPay: number | null;
    lastBill: string | null;
}

export function ledgerFor(farmerId: string, db: DB): Ledger {
    const sales = db.sales.filter(s => s.farmerId === farmerId).sort((a, b) => a.date.localeCompare(b.date));
    const pays = db.payments.filter(p => p.farmerId === farmerId).sort((a, b) => a.date.localeCompare(b.date));
    const bills: BillDue[] = sales.map(s => ({ sale: s, credit: Math.max(0, s.total - s.paid), remaining: Math.max(0, s.total - s.paid) }));
    const allocs: PaymentAlloc[] = [];
    let advance = 0;
    const gaps: number[] = [];
    for (const p of pays) {
        let left = p.amount;
        const touched: number[] = [];
        let firstBillDate: string | null = null;
        for (const b of bills) {
            if (left <= 0) break;
            if (b.remaining <= 0 || b.sale.date > p.date) continue;
            const take = Math.min(b.remaining, left);
            b.remaining -= take;
            left -= take;
            touched.push(b.sale.billNo);
            if (!firstBillDate) firstBillDate = b.sale.date;
        }
        advance += left;
        const gap = firstBillDate ? daysSince(firstBillDate, parseDate(p.date)) : null;
        if (gap !== null) gaps.push(gap);
        allocs.push({ payment: p, bills: touched, daysAfterBill: gap });
    }
    const open = bills.filter(b => b.remaining > 0.5);
    const balance = open.reduce((s, b) => s + b.remaining, 0) - advance;
    return {
        bills,
        allocs,
        totalBought: sales.reduce((s, x) => s + x.total, 0),
        paidAtCounter: sales.reduce((s, x) => s + x.paid, 0),
        repaid: pays.reduce((s, x) => s + x.amount, 0),
        balance,
        oldestDue: open.length ? open[0].sale.date : null,
        avgDaysToPay: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
        lastBill: sales.length ? sales[sales.length - 1].date : null,
    };
}

export function aging(oldestDue: string | null): { label: string; tone: 'green' | 'amber' | 'red'; days: number } {
    if (!oldestDue) return { label: 'Clear', tone: 'green', days: 0 };
    const d = daysSince(oldestDue);
    if (d >= 60) return { label: '60+ days', tone: 'red', days: d };
    if (d >= 30) return { label: '30+ days', tone: 'amber', days: d };
    return { label: 'Recent', tone: 'green', days: d };
}

export interface DueRow { farmer: Farmer; ledger: Ledger; age: ReturnType<typeof aging> }
export function dueRows(db: DB): DueRow[] {
    return db.farmers
        .map(f => {
            const ledger = ledgerFor(f.id, db);
            return { farmer: f, ledger, age: aging(ledger.oldestDue) };
        })
        .filter(r => r.ledger.balance > 0.5)
        .sort((a, b) => b.age.days - a.age.days || b.ledger.balance - a.ledger.balance);
}

// ---------- GST ----------
export const splitGst = (amount: number, gst: number) => {
    const taxable = amount / (1 + gst / 100);
    return { taxable, tax: amount - taxable };
};

// ---------- Reminders ----------
export const LANG_LABEL: Record<Lang, string> = { hi: 'हिंदी', mr: 'मराठी', en: 'English' };
export function reminderText(lang: Lang, name: string, amount: number, shop: string) {
    const first = name.split(' ')[0];
    const amt = inr(amount);
    if (lang === 'mr')
        return `नमस्कार ${first} जी, ${shop} कडे तुमचे ${amt} उधार बाकी आहे. कृपया सोयीनुसार भरावे. धन्यवाद.`;
    if (lang === 'en')
        return `Namaste ${first} ji, your pending balance at ${shop} is ${amt}. Please pay at your convenience. Thank you.`;
    return `नमस्ते ${first} जी, ${shop} पर आपका ${amt} का उधार बाकी है। कृपया सुविधा अनुसार भुगतान करें। धन्यवाद।`;
}

export const waLink = (phone: string, text: string) => {
    const digits = phone.replace(/\D/g, '');
    const full = digits.length === 10 ? '91' + digits : digits;
    return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};
export const openLink = (url: string) => openExternal(url);

export const currentSeason = (d = new Date()) => {
    const m = d.getMonth() + 1;
    if (m >= 6 && m <= 9) return 'Kharif';
    if (m >= 10 || m <= 2) return 'Rabi';
    return 'Zaid (summer)';
};
