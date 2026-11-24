import { Batch, DB, Farmer, Item, Payment, Purchase, Sale, SaleLine, Settings } from './types';
import { addDays, ymd } from './utils';

type ItemDef = [string, string, Item['category'], string, string, number, number, number, number, [string, number | null, number][]];

const ITEMS: ItemDef[] = [
    ['soy', 'Soybean seed JS-335 (30 kg)', 'Seeds', 'bag', '1201', 0, 3200, 2750, 10, [['B-101', 200, 42]]],
    ['tur', 'Tur seed BDN-711 (5 kg)', 'Seeds', 'bag', '0713', 0, 1150, 960, 8, [['B-087', 260, 6]]],
    ['cotton', 'Cotton seed BG-II (475 g)', 'Seeds', 'packet', '1207', 0, 864, 780, 10, [['B-066', 20, 18]]],
    ['maize', 'Maize hybrid seed (4 kg)', 'Seeds', 'bag', '1005', 0, 1450, 1220, 6, [['B-120', 320, 30]]],
    ['gram', 'Chickpea seed JAKI-9218 (20 kg)', 'Seeds', 'bag', '0713', 0, 2400, 2050, 8, [['B-131', 240, 26]]],
    ['wheat', 'Wheat seed Lok-1 (40 kg)', 'Seeds', 'bag', '1001', 0, 1800, 1500, 8, [['B-133', 250, 20]]],
    ['urea', 'Urea neem coated (45 kg)', 'Fertilizers', 'bag', '3102', 5, 266.5, 254, 40, [['U-2611', null, 180]]],
    ['dap', 'DAP 18:46:0 (50 kg)', 'Fertilizers', 'bag', '3105', 5, 1350, 1290, 30, [['D-2610', null, 95]]],
    ['npk', 'NPK 10:26:26 (50 kg)', 'Fertilizers', 'bag', '3105', 5, 1470, 1400, 20, [['N-2609', null, 22]]],
    ['mop', 'MOP potash (50 kg)', 'Fertilizers', 'bag', '3104', 5, 1700, 1620, 15, [['M-2608', null, 12]]],
    ['zinc', 'Zinc sulphate 21% (10 kg)', 'Fertilizers', 'bag', '2833', 5, 650, 520, 10, [['Z-118', 500, 25]]],
    ['ema', 'Emamectin benzoate 5% SG (100 g)', 'Pesticides', 'pack', '3808', 18, 380, 300, 15, [['E-551', 380, 40]]],
    ['chlor', 'Chlorantraniliprole 18.5% SC (60 ml)', 'Pesticides', 'bottle', '3808', 18, 560, 470, 10, [['C-210', 410, 24]]],
    ['imida', 'Imidacloprid 17.8% SL (250 ml)', 'Pesticides', 'bottle', '3808', 18, 420, 340, 10, [['I-332', 25, 14]]],
    ['manco', 'Mancozeb 75% WP (500 g)', 'Pesticides', 'pack', '3808', 18, 320, 250, 15, [['MZ-77', -10, 6], ['MZ-91', 300, 30]]],
    ['hexa', 'Hexaconazole 5% SC (500 ml)', 'Pesticides', 'bottle', '3808', 18, 390, 310, 10, [['H-140', 350, 18]]],
    ['sprayer', 'Battery sprayer (16 L)', 'Equipment', 'piece', '8424', 5, 2800, 2300, 3, [['SP-12', null, 5]]],
    ['nozzle', 'Sprayer nozzle set', 'Equipment', 'set', '8424', 5, 180, 120, 5, [['NZ-4', null, 22]]],
];

const FARMERS: [string, string, string, string, number, string, string, string, Farmer['lang'], boolean][] = [
    ['f1', 'Ramesh Patil', '98765 43210', 'Borgaon', 5, 'Black', 'Borewell', 'Soybean, Tur, Chickpea', 'hi', true],
    ['f2', 'Suresh Jadhav', '94221 56781', 'Wadhona', 3, 'Medium black', 'Open well', 'Soybean, Wheat', 'mr', true],
    ['f3', 'Anil Shinde', '97300 11872', 'Kasar Shirsi', 8, 'Black', 'Canal', 'Cotton, Soybean, Chickpea', 'mr', true],
    ['f4', 'Vikas More', '88880 42519', 'Nilanga', 4, 'Medium black', 'Rainfed', 'Cotton, Tur', 'mr', false],
    ['f5', 'Sunita Kamble', '90110 27384', 'Hangarga', 2.5, 'Black', 'Borewell', 'Soybean, Wheat', 'hi', true],
    ['f6', 'Mahesh Pawar', '95525 60917', 'Devarjan', 6, 'Red', 'Drip', 'Tur, Maize, Chickpea', 'mr', true],
    ['f7', 'Ganesh Biradar', '99229 38146', 'Tondar', 10, 'Black', 'Canal', 'Sugarcane, Soybean', 'hi', true],
    ['f8', 'Prakash Jogdand', '93712 04458', 'Lohara', 3.5, 'Medium black', 'Borewell', 'Soybean, Chickpea', 'mr', true],
];

type SaleDef = [number, string | null, [string, number][], Sale['mode'], number?, string?, string?];
const SALES: SaleDef[] = [
    [140, 'f1', [['soy', 2], ['dap', 2], ['ema', 1]], 'Udhaar'],
    [75, 'f1', [['urea', 4], ['chlor', 1]], 'Cash'],
    [26, 'f1', [['gram', 2], ['npk', 2]], 'Udhaar'],
    [9, 'f1', [['gram', 1], ['zinc', 1], ['hexa', 1]], 'Udhaar'],
    [120, 'f2', [['soy', 1], ['urea', 2]], 'Udhaar'],
    [44, 'f2', [['wheat', 2], ['dap', 2], ['mop', 1]], 'Udhaar'],
    [95, 'f3', [['cotton', 8], ['dap', 4], ['ema', 2]], 'Udhaar'],
    [68, 'f3', [['chlor', 3], ['npk', 3]], 'Udhaar'],
    [80, 'f4', [['cotton', 6], ['urea', 4], ['imida', 2]], 'Udhaar'],
    [15, 'f4', [['tur', 2]], 'Part', 1000],
    [130, 'f5', [['soy', 1], ['dap', 1]], 'UPI'],
    [10, 'f5', [['wheat', 1], ['urea', 2]], 'Part', 1500],
    [110, 'f6', [['maize', 3], ['npk', 2], ['ema', 1]], 'Udhaar'],
    [5, 'f6', [['gram', 3], ['zinc', 1]], 'UPI'],
    [60, 'f7', [['soy', 4], ['mop', 2], ['hexa', 2]], 'Udhaar'],
    [38, 'f8', [['gram', 2], ['dap', 1]], 'Cash'],
    [3, 'f8', [['hexa', 1], ['nozzle', 1]], 'Udhaar'],
    [25, null, [['urea', 200]], 'UPI', undefined, 'Kisan Seva Kendra, Nilanga', '27AAKFK4521R1Z2'],
    [6, null, [['dap', 60]], 'UPI', undefined, 'Anil Traders, Latur', '27AAKFA1234B1Z5'],
    [0, null, [['urea', 2]], 'Cash'], [0, null, [['ema', 1], ['nozzle', 1]], 'UPI'], [0, null, [['gram', 1]], 'Cash'],
    [0, null, [['dap', 3], ['zinc', 1]], 'UPI'],
    [1, null, [['wheat', 1]], 'UPI'], [1, null, [['dap', 1], ['urea', 1]], 'Cash'],
    [2, null, [['hexa', 2]], 'Cash'], [2, null, [['gram', 1], ['zinc', 1]], 'UPI'], [2, null, [['urea', 3]], 'Cash'],
    [3, null, [['npk', 1]], 'Cash'], [3, null, [['manco', 2]], 'UPI'],
    [4, null, [['wheat', 2], ['urea', 2]], 'UPI'], [4, null, [['chlor', 1]], 'Cash'], [4, null, [['gram', 3]], 'Cash'],
    [5, null, [['sprayer', 1]], 'UPI'], [5, null, [['urea', 2]], 'Cash'],
    [6, null, [['gram', 2]], 'Cash'], [6, null, [['mop', 1]], 'UPI'],
];

const PAYMENTS: [number, string, number, Payment['mode']][] = [
    [100, 'f1', 6000, 'UPI'], [70, 'f1', 3480, 'Cash'],
    [65, 'f2', 3733, 'Cash'],
    [50, 'f3', 5000, 'UPI'],
    [35, 'f6', 7670, 'Cash'],
    [20, 'f7', 10000, 'UPI'],
];

export function buildSample(): DB {
    const now = new Date();
    const at = (daysAgo: number, hour: number) => {
        const d = addDays(now, -daysAgo);
        d.setHours(hour, (daysAgo * 7) % 60, 0, 0);
        return d.toISOString();
    };
    const exp = (n: number | null) => (n === null ? '' : ymd(addDays(now, n)));
    const items: Item[] = [];
    const batches: Batch[] = [];
    const byKey: Record<string, { item: Item; cost: number; batches: Batch[] }> = {};
    ITEMS.forEach(([key, name, category, unit, hsn, gst, price, cost, lowAt, bs]) => {
        const item: Item = { id: 'i_' + key, name, category, unit, hsn, gst, price, lowAt, sample: true };
        items.push(item);
        const mine = bs.map(([batchNo, e, qty], i) => ({
            id: `b_${key}_${i}`, itemId: item.id, batchNo, expiry: exp(e), qty, cost, addedAt: at(40 + i, 10), sample: true,
        }));
        batches.push(...mine);
        byKey[key] = { item, cost, batches: mine };
    });
    const farmers: Farmer[] = FARMERS.map(([k, name, phone, village, acres, soil, water, crops, lang, consent]) => ({
        id: k, name, phone, village, acres, soil, water, crops, lang, consent, sample: true, createdAt: at(200, 10),
    }));
    const sorted = SALES.map((s, i) => ({ s, i, date: at(s[0], 9 + (i % 9)) })).sort((a, b) => a.date.localeCompare(b.date));
    let bill = 101;
    const sales: Sale[] = sorted.map(({ s, i, date }) => {
        const [daysAgo, fid, lines, mode, partPaid, custName, gstin] = s;
        const saleLines: SaleLine[] = lines.map(([key, qty]) => {
            const { item, cost, batches: bs } = byKey[key];
            const b = bs.find(x => !x.expiry || x.expiry >= ymd(now)) || bs[0];
            return { itemId: item.id, name: item.name, hsn: item.hsn, batchId: b.id, batchNo: b.batchNo, qty, rate: item.price, gst: item.gst, amount: qty * item.price, cost: cost * qty };
        });
        const total = saleLines.reduce((a, l) => a + l.amount, 0);
        const paid = mode === 'Udhaar' ? 0 : mode === 'Part' ? partPaid || 0 : total;
        const f = farmers.find(x => x.id === fid);
        const sale: Sale = {
            id: 's_' + i, billNo: bill++, date, farmerId: fid, customerName: f ? f.name : custName || 'Walk-in customer',
            customerGstin: gstin, lines: saleLines, total, paid, mode, paidVia: mode === 'Cash' ? 'Cash' : mode === 'Part' ? 'Cash' : mode === 'UPI' ? 'UPI' : undefined,
            dueDate: mode === 'Udhaar' || mode === 'Part' ? ymd(addDays(new Date(date), 30)) : undefined, sample: true,
        };
        if (gstin && daysAgo === 25) sale.ewb = { status: 'prepared', number: '341087652190', vehicle: 'MH 24 AB 4417', distance: 64, transport: 'Road', validTill: ymd(addDays(new Date(date), 1)) };
        else if (gstin) sale.ewb = { status: 'needed' };
        return sale;
    });
    const payments: Payment[] = PAYMENTS.map(([d, fid, amount, mode], i) => ({ id: 'p_' + i, farmerId: fid, date: at(d, 17), amount, mode, sample: true }));
    const pl = (key: string, batchNo: string, e: number | null, qty: number) => ({
        itemId: byKey[key].item.id, name: byKey[key].item.name, batchNo, expiry: exp(e), qty, cost: byKey[key].cost,
    });
    const mkPurchase = (id: string, d: number, supplier: string, invoiceNo: string, lines: ReturnType<typeof pl>[]): Purchase => ({
        id, date: at(d, 15), supplier, invoiceNo, lines, total: lines.reduce((a, l) => a + l.qty * l.cost, 0), sample: true,
    });
    const purchases = [
        mkPurchase('pu_1', 9, 'Mahadhan Agro Distributors, Latur', 'MAD/482', [pl('urea', 'U-2611', null, 200), pl('dap', 'D-2610', null, 100)]),
        mkPurchase('pu_2', 21, 'Krishi Seeds Agency, Latur', 'KSA/1190', [pl('gram', 'B-131', 240, 30), pl('wheat', 'B-133', 250, 25)]),
        mkPurchase('pu_3', 40, 'Sahyadri Crop Care, Pune', 'SCC/2207', [pl('ema', 'E-551', 380, 48), pl('chlor', 'C-210', 410, 30), pl('hexa', 'H-140', 350, 24)]),
    ];
    const settings: Settings = {
        shopName: 'Shree Ganesh Krishi Kendra', ownerName: 'Krishna', phone: '82752 49118', gstin: '27ABCPK1234F1Z9',
        address: 'Main Road, Udgir', district: 'Latur', state: 'Maharashtra', reminderLang: 'mr', ewbLimit: 50000,
        creditDays: 30, nextBill: bill,
        licences: [
            { name: 'Fertilizer licence', number: 'LAT/FER/2023/118', expiry: exp(45) },
            { name: 'Seed licence', number: 'LAT/SD/2022/076', expiry: exp(400) },
            { name: 'Insecticide licence', number: 'LAT/INS/2024/033', expiry: exp(210) },
        ],
        hasSample: true,
    };
    return { farmers, items, batches, sales, payments, purchases, settings };
}

export const emptySettings = (prev?: Settings): Settings => ({
    shopName: prev?.shopName || 'My Krishi Kendra', ownerName: prev?.ownerName || '', phone: prev?.phone || '',
    gstin: prev?.gstin || '', address: prev?.address || '', district: prev?.district || '', state: prev?.state || 'Maharashtra',
    reminderLang: prev?.reminderLang || 'hi', ewbLimit: prev?.ewbLimit || 50000, creditDays: prev?.creditDays || 30,
    nextBill: 1, licences: prev?.licences || [], hasSample: false,
});
