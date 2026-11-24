/* Build prompt
AgriMunim: shop software for agriculture input store owners in India (seeds, fertilizers,
pesticides, equipment). The owner uses it all day at the counter on a PC or phone.

Art direction: the "soft day" theme from the owner's approved mockups, like a clean ledger
book in a well-lit shop. Pale sage-white page (#F4F7F2), white framed panels with soft
sage borders (#D9E3D6), light sage sidebar (#E4F0E4) on desktop, a bottom tab bar on phone.
Dark charcoal-green text (#1C2B22), muted secondary text (#4B5E52). Mid green (#2E7D57)
for primary buttons with white text, warm yellow (#F2B84B) with dark text for the one main
action on a screen. Status badges are gentle tints with dark text: green (paid, in stock),
amber (30+ days, low stock), red (60+ days, expired, amounts due). System sans stack with
Devanagari fallback, 15px base, large tabular rupee figures in Indian digit grouping.
No emoji, no gradients, no colored header bar; inline SVG icons.

First screen: Dashboard filled with sample shop data (farmers from the Udgir/Latur area,
real product names, dates relative to today), so the owner sees a working shop at once.
Sample data can be removed from Settings.

Views and features:
- Dashboard: today's sales, money received today, udhaar pending, stock alerts; 7-day
  sales bars; "needs attention" list (overdue dues, low stock, expiring batches, pending
  e-way bills, licence expiry); overdue farmers; quick actions.
- Billing: pick farmer or walk-in (optional buyer GSTIN), search items, FEFO batch
  auto-pick, stock checks, GST-inclusive prices with CGST/SGST split, Cash/UPI/Udhaar/Part
  payment with due date, e-way bill warning above the limit, saved bill with Undo, bill
  PDF download and WhatsApp share.
- Udhaar: aging filters (all, 30+, 60+), FIFO-allocated dues, reminder preview in the
  farmer's language (Hindi, Marathi, English) with optional AI rewrite, WhatsApp send only
  with recorded consent, receive payment with Undo.
- Farmers: list, add/edit (land, soil, water, crops, language, consent), profile with
  lifetime totals, purchase history with per-bill status, repayment history with bills
  settled and days to pay, statement PDF.
- Stock: category and alert filters, batches with expiry, item add/edit; Purchases:
  supplier purchase entry creating batches.
- AI Sahayak: land details (from farmer or manual), structured ranked crop suggestions
  matched against the shop's stock with Add to bill, and an agronomy/chemical-safety chat
  in the chosen language, with a verify-with-agri-officer note.
- Reports: period chips, sales, gross profit, payment split, top products, slow-moving
  stock, GST summary by rate, Excel export.
- E-way bills: bills above the limit, Part A auto-filled, Part B vehicle and distance,
  validity, record the EWB number after generating on the portal.
- Settings: shop, GSTIN, licences, reminder language, limits, backup/restore, remove
  sample data. Contact support: call or WhatsApp +91 82752 49118.
States: loading, empty lists, save errors (data kept on screen), AI errors with retry.
Data: stored on the device (IndexedDB). Windows app also writes a daily automatic backup.
*/
import { useEffect, useState } from 'react';
import { AppProvider, useApp, ViewName } from './store';
import { C, font } from './theme';
import { Icon, Toast } from './ui';
import Dashboard from './views/Dashboard';
import Billing from './views/Billing';
import Udhaar from './views/Udhaar';
import Farmers from './views/Farmers';
import Stock from './views/Stock';
import Purchases from './views/Purchases';
import Sahayak from './views/Sahayak';
import Reports from './views/Reports';
import EwayBills from './views/EwayBills';
import Settings from './views/Settings';
import Support from './views/Support';

const NAV: { name: ViewName; label: string; icon: string }[] = [
    { name: 'dashboard', label: 'Dashboard', icon: 'home' },
    { name: 'billing', label: 'Billing', icon: 'bill' },
    { name: 'udhaar', label: 'Udhaar', icon: 'ledger' },
    { name: 'farmers', label: 'Farmers', icon: 'users' },
    { name: 'stock', label: 'Stock', icon: 'box' },
    { name: 'purchases', label: 'Purchases', icon: 'cart' },
    { name: 'sahayak', label: 'AI Sahayak', icon: 'spark' },
    { name: 'reports', label: 'Reports', icon: 'chart' },
    { name: 'eway', label: 'E-way bills', icon: 'truck' },
    { name: 'settings', label: 'Settings', icon: 'gear' },
];
const MOBILE_TABS: ViewName[] = ['dashboard', 'billing', 'udhaar', 'stock', 'sahayak'];

function useIsMobile() {
    const [m, setM] = useState(() => window.innerWidth < 860);
    useEffect(() => {
        const f = () => setM(window.innerWidth < 860);
        window.addEventListener('resize', f);
        return () => window.removeEventListener('resize', f);
    }, []);
    return m;
}

function Shell() {
    const { view, go, db, status, loadError, toast, clearToast } = useApp();
    const mobile = useIsMobile();
    const [more, setMore] = useState(false);

    let body: JSX.Element;
    if (status === 'loading') {
        body = <div style={{ padding: 40, color: C.muted }}>Opening your shop books…</div>;
    } else {
        const v = view.name;
        body =
            v === 'billing' ? <Billing /> :
            v === 'udhaar' ? <Udhaar /> :
            v === 'farmers' ? <Farmers /> :
            v === 'stock' ? <Stock /> :
            v === 'purchases' ? <Purchases /> :
            v === 'sahayak' ? <Sahayak /> :
            v === 'reports' ? <Reports /> :
            v === 'eway' ? <EwayBills /> :
            v === 'settings' ? <Settings /> :
            v === 'support' ? <Support /> : <Dashboard />;
    }

    const navBtn = (n: typeof NAV[number]) => {
        const active = view.name === n.name;
        return (
            <button key={n.name} onClick={() => go(n.name)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 15,
                background: active ? '#fff' : 'transparent', color: active ? C.greenDark : C.text,
                fontWeight: active ? 700 : 500, fontFamily: font,
            }}>
                <Icon name={n.icon} size={18} color={active ? C.green : C.muted} />{n.label}
            </button>
        );
    };

    return (
        <div style={{ fontFamily: font, background: C.bg, color: C.text, minHeight: '100vh', display: 'flex', fontSize: 15 }}>
            {!mobile && (
                <aside style={{ width: 228, flexShrink: 0, background: C.side, borderRight: `1px solid ${C.border}`, padding: '18px 12px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box' }}>
                    <div style={{ padding: '0 10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon name="leaf" size={22} color={C.green} />
                            <span style={{ fontSize: 20, fontWeight: 800, color: C.greenDark }}>AgriMunim</span>
                        </div>
                        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{db.settings.shopName}</div>
                    </div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1 }}>{NAV.map(navBtn)}</nav>
                    <button onClick={() => go('support')} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.borderStrong}`, background: view.name === 'support' ? '#fff' : 'transparent', cursor: 'pointer', fontSize: 15, color: C.text, fontFamily: font }}>
                        <Icon name="phone" size={18} color={C.green} />Contact support
                    </button>
                </aside>
            )}
            <main style={{ flex: 1, minWidth: 0, paddingBottom: mobile ? 84 : 0 }}>
                {mobile && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon name="leaf" size={20} color={C.green} />
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800, color: C.greenDark, lineHeight: 1.1 }}>AgriMunim</div>
                                <div style={{ fontSize: 12, color: C.muted }}>{db.settings.shopName}</div>
                            </div>
                        </div>
                        <button onClick={() => go('support')} style={{ border: `1px solid ${C.borderStrong}`, background: '#fff', borderRadius: 999, padding: '7px 14px', fontSize: 14, cursor: 'pointer', color: C.text, fontFamily: font }}>Help</button>
                    </div>
                )}
                {loadError && (
                    <div role="alert" style={{ margin: mobile ? '8px 16px' : '16px 28px 0', padding: '10px 14px', background: C.redTint, color: C.redText, borderRadius: 10, fontSize: 14 }}>
                        Couldn't open saved data: {loadError}. Showing sample data; changes may not be saved.
                    </div>
                )}
                <div style={{ padding: mobile ? '8px 14px 20px' : '22px 28px 40px', maxWidth: 1400 }}>{body}</div>
            </main>
            {mobile && (
                <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${C.border}`, display: 'flex', zIndex: 20 }}>
                    {MOBILE_TABS.map(t => {
                        const n = NAV.find(x => x.name === t)!;
                        const active = view.name === t;
                        return (
                            <button key={t} onClick={() => { setMore(false); go(t); }} style={{ flex: 1, border: 'none', background: 'none', padding: '8px 2px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: active ? C.greenDark : C.muted, fontWeight: active ? 700 : 500, fontSize: 12, fontFamily: font }}>
                                <Icon name={n.icon} size={22} color={active ? C.green : C.muted} />{t === 'dashboard' ? 'Home' : t === 'billing' ? 'Sale' : t === 'sahayak' ? 'Sahayak' : n.label}
                            </button>
                        );
                    })}
                    <button onClick={() => setMore(!more)} style={{ flex: 1, border: 'none', background: 'none', padding: '8px 2px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: more ? C.greenDark : C.muted, fontSize: 12, fontFamily: font }}>
                        <Icon name="menu" size={22} color={more ? C.green : C.muted} />More
                    </button>
                </nav>
            )}
            {mobile && more && (
                <div onClick={() => setMore(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,24,0.35)', zIndex: 19 }}>
                    <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 70, left: 10, right: 10, background: '#fff', borderRadius: 16, padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        {NAV.filter(n => !MOBILE_TABS.includes(n.name)).concat([{ name: 'support', label: 'Contact support', icon: 'phone' }]).map(n => (
                            <button key={n.name} onClick={() => { setMore(false); go(n.name); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', border: 'none', background: view.name === n.name ? C.greenTint : 'transparent', borderRadius: 10, fontSize: 15, cursor: 'pointer', color: C.text, fontFamily: font, textAlign: 'left' }}>
                                <Icon name={n.icon} size={18} color={C.green} />{n.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {toast && <Toast msg={toast.msg} undo={toast.undo} error={toast.error} onClose={clearToast} mobile={mobile} />}
        </div>
    );
}

export const App = () => (
    <AppProvider>
        <Shell />
    </AppProvider>
);

export default App;
