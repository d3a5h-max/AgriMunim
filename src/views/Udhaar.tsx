import { useEffect, useState } from 'react';
import { aiClient, AIInferenceError } from '../platform/runtime';
import { useApp } from '../store';
import { C } from '../theme';
import { Lang } from '../types';
import { Badge, Btn, Chip, Empty, Icon, inputStyle, Modal, num, PageHead, Panel } from '../ui';
import { DueRow, dueRows, fmtDate, inr, LANG_LABEL, openLink, reminderText, waLink } from '../utils';
import { PaymentModal } from '../components/PaymentModal';

const LANG_NAME: Record<Lang, string> = { hi: 'Hindi', mr: 'Marathi', en: 'English' };

function ReminderPanel({ row }: { row: DueRow }) {
    const { db, apply, notify, go } = useApp();
    const f = row.farmer;
    const [lang, setLang] = useState<Lang>(f.lang);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [pay, setPay] = useState(false);
    useEffect(() => { setLang(f.lang); }, [f.id]);
    useEffect(() => { setText(reminderText(lang, f.name, row.ledger.balance, db.settings.shopName)); setErr(''); }, [lang, f.id, row.ledger.balance]);

    const improve = async () => {
        setBusy(true); setErr('');
        try {
            const out = await aiClient.prompt('anthropic.claude-haiku-4-5-20251001-v1:0',
                `Write one short, warm, respectful WhatsApp reminder in ${LANG_NAME[lang]} from the agri-input shop "${db.settings.shopName}" to farmer ${f.name} about a pending balance of ${inr(row.ledger.balance)}, oldest bill from ${fmtDate(row.ledger.oldestDue || '')}. Crops: ${f.crops}. Do not threaten or mention penalties. Under 45 words. Return only the message text.`,
                'You write polite payment reminders for rural Indian shopkeepers. Output only the message.');
            if (out.trim()) setText(out.trim());
        } catch (e) {
            setErr(e instanceof AIInferenceError || e instanceof Error ? e.message : String(e));
        } finally { setBusy(false); }
    };

    return (
        <Panel title={f.name} action={<Btn small kind="ghost" onClick={() => go('farmers', { id: f.id })}>Open profile</Btn>}>
            <div style={{ color: C.muted, fontSize: 14 }}>{f.village} · {f.phone || 'No phone'} · oldest bill {fmtDate(row.ledger.oldestDue || '')}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: C.red, margin: '6px 0 12px' }}>{inr(row.ledger.balance)}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {(Object.keys(LANG_LABEL) as Lang[]).map(l => <Chip key={l} active={lang === l} onClick={() => setLang(l)}>{LANG_LABEL[l]}</Chip>)}
            </div>
            <textarea aria-label="Reminder message" value={text} onChange={e => setText(e.target.value)} rows={4} style={{ ...inputStyle, background: C.greenTint, border: 'none', fontSize: 16, lineHeight: 1.5, resize: 'vertical' }} />
            {err && <div style={{ color: C.redText, fontSize: 14, marginTop: 6 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <Btn small onClick={improve} disabled={busy}><Icon name="spark" size={15} />{busy ? 'Writing…' : 'Rewrite with AI'}</Btn>
                <Btn small onClick={() => setPay(true)}>Receive payment</Btn>
                {f.consent && f.phone ? (
                    <Btn small kind="primary" onClick={() => { openLink(waLink(f.phone, text)); notify(`Reminder opened in WhatsApp for ${f.name}`); }}><Icon name="msg" size={15} />Send on WhatsApp</Btn>
                ) : (
                    <Btn small kind="outline" onClick={() => { apply([{ table: 'farmers', rec: { ...f, consent: true } }]); notify(`Consent recorded for ${f.name}`, () => apply([{ table: 'farmers', rec: f }])); }}>Record WhatsApp consent</Btn>
                )}
            </div>
            {!f.consent && <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Ask the farmer before sending reminders on WhatsApp.</div>}
            {pay && <PaymentModal farmerId={f.id} onClose={() => setPay(false)} />}
        </Panel>
    );
}

export default function Udhaar() {
    const { db, view } = useApp();
    const [filter, setFilter] = useState<number>(view.params?.filter || 0);
    const [sel, setSel] = useState<string>('');
    const [bulk, setBulk] = useState(false);
    const [q, setQ] = useState('');
    const all = dueRows(db);
    const rows = all.filter(r => r.age.days >= filter && (!q || r.farmer.name.toLowerCase().includes(q.toLowerCase()) || r.farmer.village.toLowerCase().includes(q.toLowerCase())));
    const total = all.reduce((a, r) => a + r.ledger.balance, 0);
    const overdue = all.filter(r => r.age.days >= 30);
    const current = rows.find(r => r.farmer.id === sel) || rows[0];

    return (
        <div>
            <PageHead title="Udhaar" sub={`Total pending ${inr(total)} from ${all.length} farmers`} actions={overdue.length > 0 && <Btn kind="accent" onClick={() => setBulk(true)}>Remind all overdue ({overdue.length})</Btn>} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                <Chip active={filter === 0} onClick={() => setFilter(0)}>All</Chip>
                <Chip active={filter === 30} onClick={() => setFilter(30)}>30+ days</Chip>
                <Chip active={filter === 60} onClick={() => setFilter(60)}>60+ days</Chip>
                <input aria-label="Search farmers" placeholder="Search farmer or village" value={q} onChange={e => setQ(e.target.value)} style={{ ...inputStyle, maxWidth: 260, marginLeft: 'auto' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Panel pad={false} style={{ flex: '3 1 440px' }}>
                    {rows.length === 0 ? <Empty>No farmers in this list.</Empty> : rows.map(r => {
                        const active = current?.farmer.id === r.farmer.id;
                        return (
                            <button key={r.farmer.id} onClick={() => setSel(r.farmer.id)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, padding: '13px 18px', border: 'none', borderBottom: `1px solid ${C.border}`, background: active ? C.greenTint : '#fff', cursor: 'pointer', textAlign: 'left', color: C.text, fontSize: 15 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700 }}>{r.farmer.name}</div>
                                    <div style={{ fontSize: 14, color: C.muted }}>{r.farmer.village} · last bill {fmtDate(r.ledger.lastBill || '')}</div>
                                </div>
                                <Badge tone={r.age.tone}>{r.age.label}</Badge>
                                <div style={{ ...num, fontWeight: 800, minWidth: 90, color: r.age.tone === 'red' ? C.red : C.text }}>{inr(r.ledger.balance)}</div>
                            </button>
                        );
                    })}
                </Panel>
                <div style={{ flex: '2 1 340px', minWidth: 0 }}>{current && <ReminderPanel row={current} />}</div>
            </div>
            {bulk && (
                <Modal title={`Remind ${overdue.length} overdue farmers`} onClose={() => setBulk(false)} footer={<Btn kind="primary" onClick={() => setBulk(false)}>Done</Btn>}>
                    <div style={{ fontSize: 14, color: C.muted, marginBottom: 10 }}>Each message opens in WhatsApp in the farmer's language. Tap Send there.</div>
                    {overdue.map(r => (
                        <div key={r.farmer.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                            <div><b>{r.farmer.name}</b><div style={{ fontSize: 14, color: C.muted }}>{inr(r.ledger.balance)} · {r.age.label} · {LANG_LABEL[r.farmer.lang]}</div></div>
                            {r.farmer.consent && r.farmer.phone
                                ? <Btn small kind="primary" onClick={() => openLink(waLink(r.farmer.phone, reminderText(r.farmer.lang, r.farmer.name, r.ledger.balance, db.settings.shopName)))}>Open WhatsApp</Btn>
                                : <Badge tone="gray">No consent</Badge>}
                        </div>
                    ))}
                </Modal>
            )}
        </div>
    );
}
