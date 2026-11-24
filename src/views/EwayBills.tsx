import { useState } from 'react';
import { useApp } from '../store';
import { C } from '../theme';
import { Sale } from '../types';
import { Badge, Btn, Chip, Empty, Field, Icon, inputStyle, num, PageHead, Panel, Stat, grid } from '../ui';
import { addDays, billNo, daysUntil, fmtDate, inr, openLink, ymd } from '../utils';

function Detail({ sale }: { sale: Sale }) {
    const { db, apply, notify } = useApp();
    const e = sale.ewb!;
    const [vehicle, setVehicle] = useState(e.vehicle || '');
    const [distance, setDistance] = useState(e.distance ? String(e.distance) : '');
    const [transport, setTransport] = useState<'Road' | 'Rail'>(e.transport || 'Road');
    const [number, setNumber] = useState(e.number || '');
    const km = Number(distance) || 0;
    const validDays = km > 0 ? Math.ceil(km / 200) : 1;
    const main = [...sale.lines].sort((a, b) => b.amount - a.amount)[0];
    const digits = number.replace(/\D/g, '');
    const partA: [string, string][] = [
        ['From GSTIN', db.settings.gstin || 'Add your GSTIN in Settings'], ['To', sale.customerName], ['To GSTIN', sale.customerGstin || 'Unregistered buyer (URP)'],
        ['Invoice', `${billNo(sale.billNo)} · ${fmtDate(sale.date)}`], ['Value', inr(sale.total)], ['Goods and HSN', main ? `${main.name.split(' (')[0]} · ${main.hsn}` : ''],
    ];
    const copy = () => {
        const text = [...partA.map(([k, v]) => `${k}: ${v}`), `Vehicle: ${vehicle}`, `Distance: ${km} km`, `Mode: ${transport}`].join('\n');
        navigator.clipboard?.writeText(text).then(() => notify('E-way bill details copied'), () => notify('Copy is not available here. Select the details and copy them.'));
    };
    const record = () => {
        const prev = sale;
        const rec: Sale = { ...sale, ewb: { status: 'prepared', number: digits, vehicle: vehicle.trim().toUpperCase(), distance: km, transport, validTill: ymd(addDays(new Date(), validDays)) } };
        apply([{ table: 'sales', rec }]);
        notify(`E-way bill ${digits} saved for bill ${billNo(sale.billNo)}`, () => apply([{ table: 'sales', rec: prev }]));
    };
    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <Panel title="Part A (from the bill)">
                {partA.map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ color: C.muted }}>{k}</span><b style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</b>
                    </div>
                ))}
            </Panel>
            <Panel title="Part B (vehicle)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                    <Field label="Vehicle number"><input style={inputStyle} value={vehicle} onChange={ev => setVehicle(ev.target.value)} placeholder="MH 24 AB 1234" /></Field>
                    <Field label="Distance (km)"><input style={inputStyle} inputMode="numeric" value={distance} onChange={ev => setDistance(ev.target.value.replace(/\D/g, ''))} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><Chip active={transport === 'Road'} onClick={() => setTransport('Road')}>Road</Chip><Chip active={transport === 'Rail'} onClick={() => setTransport('Rail')}>Rail</Chip></div>
                <div style={{ fontSize: 14, color: C.muted, marginTop: 10 }}>Valid for {validDays} day{validDays > 1 ? 's' : ''} ({km || 'up to 200'} km): 1 day per 200 km or part of it.</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    <Btn onClick={copy}>Copy details</Btn>
                    <Btn kind="accent" onClick={() => openLink('https://ewaybillgst.gov.in')}>Open e-way bill portal</Btn>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 16, alignItems: 'end' }}>
                    <Field label="E-way bill number from the portal"><input style={inputStyle} inputMode="numeric" value={number} onChange={ev => setNumber(ev.target.value)} placeholder="12 digits" /></Field>
                    <Btn kind="primary" disabled={digits.length !== 12 || !vehicle.trim()} onClick={record}>Save</Btn>
                </div>
            </Panel>
        </div>
    );
}

export default function EwayBills() {
    const { db, view } = useApp();
    const list = db.sales.filter(s => s.ewb).sort((a, b) => b.date.localeCompare(a.date));
    const [sel, setSel] = useState<string>(view.params?.id || list.find(s => s.ewb?.status === 'needed')?.id || list[0]?.id || '');
    const cur = list.find(s => s.id === sel);
    const needed = list.filter(s => s.ewb?.status === 'needed');
    const active = list.filter(s => s.ewb?.status === 'prepared' && s.ewb.validTill && daysUntil(s.ewb.validTill) >= 0);

    return (
        <div>
            <PageHead title="E-way bills" sub={`Needed for goods above ${inr(db.settings.ewbLimit)} moved by vehicle`} />
            <div style={grid(180)}>
                <Stat label="Need an e-way bill" value={needed.length} tone="amber" />
                <Stat label="Valid now" value={active.length} tone="green" />
                <Stat label="Total recorded" value={list.length - needed.length} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 16 }}>
                <Panel title="Bills" pad={false} style={{ flex: '2 1 360px' }}>
                    {list.length === 0 ? <Empty>No bills above the limit yet.</Empty> : list.map(s => {
                        const e = s.ewb!;
                        const expired = e.status === 'prepared' && e.validTill && daysUntil(e.validTill) < 0;
                        return (
                            <button key={s.id} onClick={() => setSel(s.id)} style={{ display: 'flex', width: '100%', gap: 12, alignItems: 'center', padding: '12px 18px', border: 'none', borderBottom: `1px solid ${C.border}`, background: sel === s.id ? C.greenTint : '#fff', textAlign: 'left', cursor: 'pointer', color: C.text, fontSize: 15 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700 }}>Bill {billNo(s.billNo)} · {s.customerName}</div>
                                    <div style={{ fontSize: 14, color: C.muted }}>{fmtDate(s.date)}{e.number ? ` · EWB ${e.number}` : ''}</div>
                                </div>
                                <span style={num}>{inr(s.total)}</span>
                                <Badge tone={e.status === 'needed' ? 'amber' : expired ? 'gray' : 'green'}>{e.status === 'needed' ? 'Needed' : expired ? 'Used' : `Valid till ${fmtDate(e.validTill || '')}`}</Badge>
                            </button>
                        );
                    })}
                </Panel>
                <div style={{ flex: '3 1 420px', minWidth: 0 }}>
                    {cur ? <Detail key={cur.id} sale={cur} /> : <Panel><Empty>Select a bill.</Empty></Panel>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: C.muted, marginTop: 12 }}>
                        <Icon name="alert" size={16} color={C.muted} />
                        <span>Generate the e-way bill on the government portal, then save its number here. State limits differ for movement within the state, so check yours in Settings.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
