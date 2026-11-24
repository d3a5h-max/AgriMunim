export type Lang = 'hi' | 'mr' | 'en';
export type Category = 'Seeds' | 'Fertilizers' | 'Pesticides' | 'Equipment';
export const CATEGORIES: Category[] = ['Seeds', 'Fertilizers', 'Pesticides', 'Equipment'];

export interface Farmer {
    id: string;
    name: string;
    phone: string;
    village: string;
    acres: number;
    soil: string;
    water: string;
    crops: string;
    lang: Lang;
    consent: boolean;
    sample?: boolean;
    createdAt: string;
}

export interface Item {
    id: string;
    name: string;
    category: Category;
    unit: string;
    hsn: string;
    gst: number; // percent, price is inclusive of GST
    price: number; // selling price per unit incl. GST
    lowAt: number;
    sample?: boolean;
}

export interface Batch {
    id: string;
    itemId: string;
    batchNo: string;
    expiry: string; // YYYY-MM-DD or ''
    qty: number;
    cost: number; // purchase cost per unit
    addedAt: string;
    sample?: boolean;
}

export interface SaleLine {
    itemId: string;
    name: string;
    hsn: string;
    batchId: string;
    batchNo: string;
    qty: number;
    rate: number;
    gst: number;
    amount: number;
    cost: number;
}

export type PayMode = 'Cash' | 'UPI' | 'Udhaar' | 'Part';

export interface EwayInfo {
    status: 'needed' | 'prepared';
    number?: string;
    vehicle?: string;
    distance?: number;
    transport?: 'Road' | 'Rail';
    validTill?: string;
}

export interface Sale {
    id: string;
    billNo: number;
    date: string; // ISO datetime
    farmerId: string | null;
    customerName: string;
    customerGstin?: string;
    lines: SaleLine[];
    total: number;
    paid: number;
    mode: PayMode;
    paidVia?: 'Cash' | 'UPI';
    dueDate?: string;
    ewb?: EwayInfo;
    sample?: boolean;
}

export interface Payment {
    id: string;
    farmerId: string;
    date: string;
    amount: number;
    mode: 'Cash' | 'UPI';
    note?: string;
    sample?: boolean;
}

export interface PurchaseLine {
    itemId: string;
    name: string;
    batchNo: string;
    expiry: string;
    qty: number;
    cost: number;
}

export interface Purchase {
    id: string;
    date: string;
    supplier: string;
    invoiceNo: string;
    lines: PurchaseLine[];
    total: number;
    sample?: boolean;
}

export interface Licence {
    name: string;
    number: string;
    expiry: string;
}

export interface Settings {
    shopName: string;
    ownerName: string;
    phone: string;
    gstin: string;
    address: string;
    district: string;
    state: string;
    reminderLang: Lang;
    ewbLimit: number;
    creditDays: number;
    nextBill: number;
    licences: Licence[];
    hasSample: boolean;
    aiServerUrl?: string;
    shopKey?: string;
}

export interface DB {
    farmers: Farmer[];
    items: Item[];
    batches: Batch[];
    sales: Sale[];
    payments: Payment[];
    purchases: Purchase[];
    settings: Settings;
}

export type TableName = 'farmers' | 'items' | 'batches' | 'sales' | 'payments' | 'purchases';
