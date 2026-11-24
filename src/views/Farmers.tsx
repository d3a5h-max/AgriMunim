import { useState } from 'react';
import { useApp } from '../store';
import { C } from '../theme';
import { Farmer } from '../types';
import { Badge, Btn, Chip, Empty, Icon, inputStyle, num, PageHead, Panel, Stat, TableWrap, td, th, grid } from '../ui';
import { aging, billNo, fmtDate, inr, LANG_LABEL, ledgerFor, openLink, waLink } from '../utils';
import { FarmerModal } from '../components/FarmerModal';
import { PaymentModal } from '../components/PaymentModal';
import { statementPdf } from '../pdf';

function Profile({ farmer }: { farmer: Farmer }) {
    const { db, go, notifyError } = useApp();
    const [tab, setTab] = useState<'buy' | 'pay'>('buy');
    const [edit, setEdit] = useState(false);
    const [pay, setPay] = useState(false);
    const L = ledgerFor(farmer.id, db);
    const age = aging(L.oldestDue);
    const habit = L.avgDaysToPay === null ? 'No repayments yet' : L.avgDaysToPay > 45 ? 'Pays after harvest' : 'Pays within a month';
    const bills = [...L.bills].reverse();
    const allocs = [...L.allocs].reverse();

    return (
        <div>
            <PageHead title={farmer.name} onBack={() => go('farmers')} sub={`${farmer.village}${farmer.phone ? ' · +91 ' + farmer.phone : ''}`}
                actions={<>
                    <Btn kind="accent" onClick={() => go('billing', { farmerId: farmer.id })}>New sale</Btn>
                    <Btn kind="primary" onClick={() => setPay(true)}>Receive payment</Btn>
                    <Btn onClick={() => go('sahayak', { farmerId: farmer.id })}><Icon name="spark" size={15} />Ask Sahayak</Btn>
                    {farmer.phone && <Btn onClick={() => openLink(waLink(farmer.phone, ''))}><Icon name="msg" size={15} />WhatsApp</Btn>}
                    <Btn onClick={() => setEdit(true)}><Icon name="edit" size={15} />Edit</Btn>
                </>} />
            <Panel>
                <div style={{ ...grid(150, 12) }}>
                    {[['Land', `${farmer.acres} acre`], ['Soil', farmer.soil], ['Water', farmer.water], ['Crops', farmer.crops || 'Not recorded'], ['Language', LANG_LABEL[farmer.lang]], ['WhatsApp consent', farmer.consent ? 'Given' : 'Not given']].map(([k, v]) => (
                        <div key={k}><div style={{ fontSize: 13, color: C.muted }}>{k}</div><div style={{ fontWeight: 700, marginTop: 2 }}>{v}</div></div>
                    ))}
                </div>
            </Panel>
            <div style={{ ...grid(180), marginTop: 14 }}>
                <Stat label="Lifetime purchases" value={inr(L.totalBought)} sub={`${L.bills.length} bills`} />
                <Stat label="Paid so far" value={inr(L.paidAtCounter + L.repaid)} tone="green" sub={`${inr(L.paidAtCounter)} at counter, ${inr(L.repaid)} later`} />
                <Stat label="Current due" value={inr(L.balance)} tone={L.balance > 0 ? 'red' : 'green'} sub={L.balance > 0 ? `Oldest due ${age.days} days` : 'Nothing due'} />
                <Stat label="Average days to repay" value={L.avgDaysToPay === null ? 'No data' : `${L.avgDaysToPay} days`} sub={habit} />
            </div>
            <Panel style={{ marginTop: 14 }} pad={false} title={
                <div style={{ display: 'flex', gap: 8 }}>
                    <Chip active={tab === 'buy'} onClick={() => setTab('buy')}>Purchase history</Chip>
                    <Chip active={tab === 'pay'} onClick={() => setTab('pay')}>Repayment history</Chip>
                </div>} action={<Btn small onClick={() => statementPdf(farmer, db).catch(e => notifyError(`Couldn't create the statement: ${e instanceof Error ? e.message : e}`))}><Icon name="download" size={15} />Statement PDF</Btn>}>
                <div style={{ marginTop: 8 }}>
                    {tab === 'buy' ? (bills.length === 0 ? <Empty>No purchases yet.</Empty> : (
                        <TableWrap>
                            <thead><tr><th style={th}>Date</th><th style={th}>Bill</th><th style={th}>Items</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Paid at counter</th><th style={th}>Status</th></tr></thead>
                            <tbody>{bills.map(b => (
                                <tr key={b.sale.id}>
                                    <td style={td}>{fmtDate(b.sale.date)}</td>
                                    <td style={td}>{billNo(b.sale.billNo)}</td>
                                    <td style={{ ...td, fontSize: 14 }}>{b.sale.lines.map(l => `${l.name.split(' (')[0]} × ${l.qty}`).join(', ')}</td>
                                    <td style={{ ...td, ...num, fontWeight: 700 }}>{inr(b.sale.total)}</td>
                                    <td style={td}>{b.sale.paid > 0 ? `${inr(b.sale.paid)} ${b.sale.paidVia || ''}` : 'Udhaar'}</td>
                                    <td style={td}>{b.remaining > 0.5 ? <Badge tone={aging(b.sale.date).tone === 'green' ? 'amber' : aging(b.sale.date).tone}>{inr(b.remaining)} due</Badge> : <Badge tone="green">Paid</Badge>}</td>
                                </tr>))}</tbody>
                        </TableWrap>
                    )) : (allocs.length === 0 ? <Empty>No repayments yet.</Empty> : (
                        <TableWrap>
                            <thead><tr><th style={th}>Date</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Mode</th><th style={th}>Bills settled</th><th style={th}>Days after bill</th></tr></thead>
                            <tbody>{allocs.map(a => (
                                <tr key={a.payment.id}>
                                    <td style={td}>{fmtDate(a.payment.date)}</td>
                                    <td style={{ ...td, ...num, fontWeight: 700, color: C.greenText }}>{inr(a.payment.amount)}</td>
                                    <td style={td}>{a.payment.mode}</td>
                                    <td style={td}>{a.bills.length ? a.bills.map(billNo).join(', ') : 'Advance'}</td>
                                    <td style={td}>{a.daysAfterBill === null ? '' : `${a.daysAfterBill} days`}</td>
                                </tr>))}</tbody>
                        </TableWrap>
                    ))}
                </div>
            </Panel>
            {edit && <FarmerModal farmer={farmer} onClose={() => setEdit(false)} />}
            {pay && <PaymentModal farmerId={farmer.id} onClose={() => setPay(false)} />}
        </div>
    );
}

export default function Farmers() {
    const { db, view, go } = useApp();
    const [q, setQ] = useState('');
    const [add, setAdd] = useState(false);
    const open = view.params?.id ? db.farmers.find(f => f.id === view.params!.id) : undefined;
    if (open) return <Profile farmer={open} />;
    const list = db.farmers
        .filter(f => !q || [f.name, f.village, f.phone, f.crops].join(' ').toLowerCase().includes(q.toLowerCase()))
        .map(f => ({ f, L: ledgerFor(f.id, db) }))
        .sort((a, b) => a.f.name.localeCompare(b.f.name));

    return (
        <div>
            <PageHead title="Farmers" sub={`${db.farmers.length} farmers`} actions={<Btn kind="accent" onClick={() => setAdd(true)}><Icon name="plus" size={16} />Add farmer</Btn>} />
            <input aria-label="Search farmers" placeholder="Search by name, village, phone or crop" value={q} onChange={e => setQ(e.target.value)} style={{ ...inputStyle, maxWidth: 420, marginBottom: 14 }} />
            <Panel pad={false}>
                {list.length === 0 ? <Empty>{db.farmers.length ? 'No farmer matches this search.' : 'No farmers yet. Add your first farmer.'}</Empty> : (
                    <TableWrap>
                        <thead><tr><th style={th}>Name</th><th style={th}>Village</th><th style={th}>Phone</th><th style={th}>Land</th><th style={th}>Crops</th><th style={{ ...th, textAlign: 'right' }}>Due</th></tr></thead>
                        <tbody>{list.map(({ f, L }) => (
                            <tr key={f.id} onClick={() => go('farmers', { id: f.id })} style={{ cursor: 'pointer' }}>
                                <td style={{ ...td, fontWeight: 700 }}>{f.name}</td>
                                <td style={td}>{f.village}</td>
                                <td style={td}>{f.phone}</td>
                                <td style={td}>{f.acres} acre · {f.soil}</td>
                                <td style={{ ...td, fontSize: 14 }}>{f.crops}</td>
                                <td style={{ ...td, ...num, fontWeight: 700, color: L.balance > 0 ? C.red : C.muted }}>{L.balance > 0 ? inr(L.balance) : 'Clear'}</td>
                            </tr>))}</tbody>
                    </TableWrap>
                )}
            </Panel>
            {add && <FarmerModal onClose={() => setAdd(false)} onSaved={f => go('farmers', { id: f.id })} />}
        </div>
    );
}
