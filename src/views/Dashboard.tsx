import { useState } from 'react';
import { useApp } from '../store';
import { C } from '../theme';
import { Badge, Btn, Empty, Icon, num, PageHead, Panel, Stat, TableWrap, td, th, grid } from '../ui';
import { addDays, daysUntil, dueRows, fmtDate, fmtShort, inr, isExpired, itemStatus, sameDay } from '../utils';
import { PaymentModal } from '../components/PaymentModal';
import { backupAgeDays, isDesktop } from '../platform/platform';
import { FarmerModal } from '../components/FarmerModal';

export default function Dashboard() {
    const { db, go } = useApp();
    const [pay, setPay] = useState(false);
    const [addFarmer, setAddFarmer] = useState(false);
    const now = new Date();
    const todays = db.sales.filter(s => sameDay(s.date, now));
    const salesToday = todays.reduce((a, s) => a + s.total, 0);
    const receivedToday = todays.reduce((a, s) => a + s.paid, 0) + db.payments.filter(p => sameDay(p.date, now)).reduce((a, p) => a + p.amount, 0);
    const dues = dueRows(db);
    const udhaar = dues.reduce((a, r) => a + r.ledger.balance, 0);
    const statuses = db.items.map(i => ({ item: i, st: itemStatus(i, db.batches) }));
    const low = statuses.filter(s => s.st === 'low' || s.st === 'out');
    const expiring = db.batches.filter(b => b.qty > 0 && b.expiry && !isExpired(b) && daysUntil(b.expiry) <= 30);
    const expired = db.batches.filter(b => b.qty > 0 && isExpired(b));
    const overdue = dues.filter(r => r.age.days >= 30);
    const ewbPending = db.sales.filter(s => s.ewb?.status === 'needed');
    const licences = db.settings.licences.filter(l => l.expiry && daysUntil(l.expiry) <= 60);

    const days = Array.from({ length: 7 }, (_, i) => addDays(now, i - 6));
    const totals = days.map(d => db.sales.filter(s => sameDay(s.date, d)).reduce((a, s) => a + s.total, 0));
    const max = Math.max(...totals, 1);

    const tasks: { text: string; tone: 'red' | 'amber' | 'green'; action: string; onClick: () => void }[] = [];
    if (overdue.length) tasks.push({ text: `${overdue.length} farmers have dues older than 30 days (${inr(overdue.reduce((a, r) => a + r.ledger.balance, 0))})`, tone: 'red', action: 'Review reminders', onClick: () => go('udhaar', { filter: 30 }) });
    if (low.length) tasks.push({ text: `${low.length} items are low or out of stock: ${low.slice(0, 2).map(l => l.item.name.split(' (')[0]).join(', ')}${low.length > 2 ? '…' : ''}`, tone: 'amber', action: 'Reorder list', onClick: () => go('stock', { filter: 'low' }) });
    if (expiring.length || expired.length) tasks.push({ text: `${expiring.length} batches expire within 30 days${expired.length ? `, ${expired.length} already expired` : ''}`, tone: expired.length ? 'red' : 'amber', action: 'See batches', onClick: () => go('stock', { filter: 'expiry' }) });
    if (ewbPending.length) tasks.push({ text: `${ewbPending.length} bill${ewbPending.length > 1 ? 's need' : ' needs'} an e-way bill before goods leave`, tone: 'amber', action: 'Open e-way bills', onClick: () => go('eway') });
    licences.forEach(l => tasks.push({ text: `${l.name} ${daysUntil(l.expiry) < 0 ? 'expired on' : 'expires on'} ${fmtDate(l.expiry)}`, tone: daysUntil(l.expiry) < 15 ? 'red' : 'amber', action: 'Update', onClick: () => go('settings') }));

    const bAge = backupAgeDays();
    if (!isDesktop && (bAge === null || bAge >= 7)) tasks.push({ text: bAge === null ? 'Your data on this device has never been backed up' : `Last backup was ${bAge} days ago`, tone: 'amber', action: 'Back up now', onClick: () => go('settings') });

    return (
        <div>
            <PageHead title={`Namaste${db.settings.ownerName ? ', ' + db.settings.ownerName : ''}`} sub={now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                actions={<>
                    <Btn kind="accent" onClick={() => go('billing')}><Icon name="plus" size={16} />New sale</Btn>
                    <Btn onClick={() => setPay(true)}>Receive payment</Btn>
                    <Btn onClick={() => setAddFarmer(true)}>Add farmer</Btn>
                    <Btn onClick={() => go('purchases', { add: true })}>Add stock</Btn>
                </>} />
            <div style={grid(190)}>
                <Stat label="Today's sales" value={inr(salesToday)} sub={`${todays.length} bills`} onClick={() => go('reports')} />
                <Stat label="Received today" value={inr(receivedToday)} tone="green" sub="Cash, UPI and repayments" />
                <Stat label="Udhaar pending" value={inr(udhaar)} tone="red" sub={`${dues.length} farmers`} onClick={() => go('udhaar')} />
                <Stat label="Stock alerts" value={`${low.length + expiring.length + expired.length} items`} tone="amber" sub="Low, expiring or expired" onClick={() => go('stock', { filter: 'alerts' })} />
            </div>
            <div style={{ ...grid(360, 16), marginTop: 16 }}>
                <Panel title="Sales, last 7 days">
                    <svg viewBox="0 0 700 230" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Sales for the last 7 days">
                        {totals.map((t, i) => {
                            const h = (t / max) * 150;
                            const x = 20 + i * 97;
                            return (
                                <g key={i}>
                                    <rect x={x} y={180 - h} width={62} height={Math.max(h, 2)} rx={6} fill={i === 6 ? C.green : '#7DB894'} />
                                    <text x={x + 31} y={172 - h} textAnchor="middle" fontSize="17" fill={C.text}>{t >= 1000 ? `₹${Math.round(t / 1000)}k` : inr(t)}</text>
                                    <text x={x + 31} y={205} textAnchor="middle" fontSize="17" fill={C.muted}>{i === 6 ? 'Today' : days[i].toLocaleDateString('en-IN', { weekday: 'short' })}</text>
                                </g>
                            );
                        })}
                    </svg>
                </Panel>
                <section style={{ background: C.amberTint, border: `1px solid ${C.amberBorder}`, borderRadius: 14, padding: '14px 18px' }}>
                    <h2 style={{ margin: '0 0 10px', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="spark" color={C.amberText} />Needs your attention</h2>
                    {tasks.length === 0 && <div style={{ color: C.text }}>All clear. No overdue dues, stock alerts or pending e-way bills.</div>}
                    <div style={{ display: 'grid', gap: 10 }}>
                        {tasks.map((t, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', paddingBottom: 10, borderBottom: i < tasks.length - 1 ? `1px solid ${C.amberBorder}` : 'none' }}>
                                <span style={{ flex: '1 1 220px', fontSize: 15 }}>{t.text}</span>
                                <Btn small kind={i === 0 ? 'primary' : 'outline'} onClick={t.onClick}>{t.action}</Btn>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
            <Panel title="Overdue farmers" action={<Btn small kind="ghost" onClick={() => go('udhaar')}>View all</Btn>} style={{ marginTop: 16 }} pad={false}>
                {dues.length === 0 ? <Empty>No pending udhaar.</Empty> : (
                    <TableWrap>
                        <thead><tr><th style={th}>Farmer</th><th style={th}>Village</th><th style={th}>Oldest due</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr></thead>
                        <tbody>
                            {dues.slice(0, 6).map(r => (
                                <tr key={r.farmer.id} onClick={() => go('farmers', { id: r.farmer.id })} style={{ cursor: 'pointer' }}>
                                    <td style={{ ...td, fontWeight: 600 }}>{r.farmer.name}</td>
                                    <td style={td}>{r.farmer.village}</td>
                                    <td style={td}>{r.ledger.oldestDue ? fmtShort(r.ledger.oldestDue) : ''}</td>
                                    <td style={td}><Badge tone={r.age.tone}>{r.age.label}</Badge></td>
                                    <td style={{ ...td, ...num, fontWeight: 700 }}>{inr(r.ledger.balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </TableWrap>
                )}
            </Panel>
            {pay && <PaymentModal onClose={() => setPay(false)} />}
            {addFarmer && <FarmerModal onClose={() => setAddFarmer(false)} />}
        </div>
    );
}
