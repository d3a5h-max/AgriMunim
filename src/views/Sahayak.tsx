import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { aiClient, AIInferenceError, ConversationMessage, defineTool } from '../platform/runtime';
import { useApp } from '../store';
import { C } from '../theme';
import { DB, Item } from '../types';
import { Badge, Btn, Chip, Field, Icon, inputStyle, PageHead, Panel } from '../ui';
import { currentSeason, stockOf } from '../utils';
import { SOILS, WATERS } from '../components/FarmerModal';

const MODEL = 'anthropic.claude-sonnet-4-6';
const LANGS = ['Hindi', 'Marathi', 'English', 'Telugu', 'Kannada', 'Tamil', 'Gujarati', 'Bengali', 'Punjabi'];
const SEASONS = ['Kharif', 'Rabi', 'Zaid (summer)'];

interface Land { farmerId: string; soil: string; water: string; waterLevel: string; acres: string; season: string; place: string; ph: string; lastCrop: string; lang: string }
interface Crop { crop: string; crop_english: string; fit_reason: string; water_need: string; sowing_window: string; seed_rate_per_acre: string; fertilizer_per_acre: string; key_risks: string }
interface InputRec { product: string; product_english: string; purpose: string; dose_per_acre: string; safety_note: string }
interface Advice { summary: string; crops: Crop[]; inputs: InputRec[]; cautions: string[] }

const adviceTool = defineTool('crop_advice', 'Ranked crop and input recommendations for one farm plot', {
    type: 'object',
    properties: {
        summary: { type: 'string', description: 'Two sentences on what the land suits, in the answer language' },
        crops: {
            type: 'array', minItems: 3, maxItems: 4, items: {
                type: 'object', properties: {
                    crop: { type: 'string', description: 'Crop name in the answer language' },
                    crop_english: { type: 'string', description: 'Plain English crop name, e.g. Chickpea, Wheat, Soybean' },
                    fit_reason: { type: 'string' }, water_need: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                    sowing_window: { type: 'string' }, seed_rate_per_acre: { type: 'string' }, fertilizer_per_acre: { type: 'string', description: 'N-P-K plan with product names and kg per acre' },
                    key_risks: { type: 'string', description: 'Main pests or diseases to watch' },
                }, required: ['crop', 'crop_english', 'fit_reason', 'water_need', 'sowing_window', 'seed_rate_per_acre', 'fertilizer_per_acre', 'key_risks'],
            },
        },
        inputs: {
            type: 'array', maxItems: 6, items: {
                type: 'object', properties: {
                    product: { type: 'string' }, product_english: { type: 'string', description: 'Generic English name, e.g. DAP, Urea, Mancozeb 75% WP' },
                    purpose: { type: 'string' }, dose_per_acre: { type: 'string' }, safety_note: { type: 'string' },
                }, required: ['product', 'product_english', 'purpose', 'dose_per_acre', 'safety_note'],
            },
        },
        cautions: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    },
    required: ['summary', 'crops', 'inputs', 'cautions'],
});

const stockList = (db: DB) => db.items.map(i => `${i.name}: ${stockOf(i.id, db.batches)} ${i.unit}`).join('; ');
const landText = (l: Land, farmerName?: string) =>
    `${farmerName ? `Farmer: ${farmerName}. ` : ''}Location: ${l.place}. Season: ${l.season}. Land: ${l.acres || 'unknown'} acre. Soil: ${l.soil}${l.ph ? `, pH ${l.ph}` : ''}. Water source: ${l.water}, availability ${l.waterLevel}. Previous crop: ${l.lastCrop || 'not given'}.`;
const system = (db: DB, l: Land, name?: string) =>
    `You are AI Sahayak inside AgriMunim, an assistant for an agriculture input shop in India. You are an expert agronomist and agrochemical specialist (seeds, fertilizers, pesticides, IPM, soil and water management) for Indian conditions. Answer in ${l.lang}, in simple words a shopkeeper can repeat to a farmer. Give practical per-acre quantities. Only suggest pesticide molecules registered with CIB&RC for that crop in India, at label dose, and always mention waiting period and protective gear for chemicals. Never suggest banned or restricted chemicals, or mixing chemicals without label support. Prefer seed treatment and IPM before sprays. When a product is in the shop's stock, say so. If unsure, say so and advise checking with the local KVK or agriculture officer. Keep answers short, use bullet points.\nLand: ${landText(l, name)}\nShop stock: ${stockList(db)}`;

function matchItem(db: DB, english: string, seedsOnly: boolean): Item | undefined {
    const words = english.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 3 && !['seed', 'seeds', 'and'].includes(w));
    if (!words.length) return undefined;
    const pool = db.items.filter(i => (seedsOnly ? i.category === 'Seeds' : i.category !== 'Seeds'));
    return pool.find(i => i.name.toLowerCase().includes(words[0])) || (seedsOnly ? undefined : pool.find(i => words.some(w => i.name.toLowerCase().includes(w))));
}
const errText = (e: unknown) => (e instanceof AIInferenceError || e instanceof Error ? e.message : String(e));

export default function Sahayak() {
    const { db, view, go } = useApp();
    const init = (fid: string): Land => {
        const f = db.farmers.find(x => x.id === fid);
        return {
            farmerId: fid, soil: f?.soil || 'Black', water: f?.water || 'Borewell', waterLevel: f?.water === 'Rainfed' ? 'Low' : 'Medium', acres: f ? String(f.acres) : '',
            season: currentSeason(), place: [db.settings.district, db.settings.state].filter(Boolean).join(', ') || 'India', ph: '', lastCrop: f?.crops.split(',')[0]?.trim() || '',
            lang: f?.lang === 'mr' ? 'Marathi' : f?.lang === 'en' ? 'English' : 'Hindi',
        };
    };
    const [land, setLand] = useState<Land>(() => init(view.params?.farmerId || ''));
    const [advice, setAdvice] = useState<Advice | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [chat, setChat] = useState<ConversationMessage[]>([]);
    const [msg, setMsg] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const [chatErr, setChatErr] = useState('');
    const endRef = useRef<HTMLDivElement>(null);
    const farmer = db.farmers.find(f => f.id === land.farmerId);
    const set = (k: keyof Land, v: string) => setLand({ ...land, [k]: v });
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [chat.length, chatBusy]);

    const suggest = async () => {
        setBusy(true); setErr('');
        try {
            const res = await aiClient.invoke({
                modelId: MODEL, systemPrompt: system(db, land, farmer?.name), tools: [adviceTool], inferenceConfig: { maxTokens: 3000, temperature: 0.3 },
                messages: [{ role: 'user', content: [{ text: `Suggest the best 3 or 4 crops and seeds for this land for the coming ${land.season} sowing, ranked best first, plus the key inputs. Use the crop_advice tool. Answer language: ${land.lang}.` }] }],
            });
            const tu = res.content.find(b => b.toolUse)?.toolUse;
            if (res.stopReason === 'guardrail_intervened') throw new Error(res.content[0]?.text || 'The request was blocked.');
            if (!tu) throw new Error('The assistant did not return suggestions. Try again.');
            const data = JSON.parse(tu.input) as Advice;
            setAdvice({ summary: data.summary || '', crops: data.crops || [], inputs: data.inputs || [], cautions: data.cautions || [] });
        } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
    };

    const send = async (text: string) => {
        const t = text.trim();
        if (!t || chatBusy) return;
        const next: ConversationMessage[] = [...chat, { role: 'user', content: [{ text: t }] }];
        setChat(next); setMsg(''); setChatBusy(true); setChatErr('');
        try {
            const res = await aiClient.invoke({ modelId: MODEL, systemPrompt: system(db, land, farmer?.name), messages: next.slice(-11), inferenceConfig: { maxTokens: 1500, temperature: 0.4 } });
            const reply = res.content.map(b => b.text || '').join('').trim();
            if (res.stopReason === 'guardrail_intervened') { setChat(chat); setChatErr(reply || 'That question was blocked. Try asking differently.'); return; }
            setChat([...next, { role: 'assistant', content: [{ text: reply || 'No answer. Please ask again.' }] }]);
        } catch (e) { setChat(chat); setMsg(t); setChatErr(errText(e)); } finally { setChatBusy(false); }
    };

    const addToBill = (item: Item) => go('billing', { farmerId: land.farmerId || undefined, itemIds: [item.id] });
    const sel = (k: keyof Land, opts: string[], label: string) => (
        <Field label={label}><select style={inputStyle} value={land[k]} onChange={e => set(k, e.target.value)}>{opts.map(o => <option key={o}>{o}</option>)}</select></Field>
    );

    return (
        <div>
            <PageHead title="AI Sahayak" sub="Crop, seed, fertilizer and spray advice for each farmer's land" />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Panel title="Land details" style={{ flex: '1 1 280px' }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <Field label="Farmer">
                            <select style={inputStyle} value={land.farmerId} onChange={e => { setLand(init(e.target.value)); setAdvice(null); }}>
                                <option value="">Not a saved farmer</option>
                                {db.farmers.map(f => <option key={f.id} value={f.id}>{f.name} · {f.village}</option>)}
                            </select>
                        </Field>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {sel('soil', SOILS, 'Soil')}
                            <Field label="Soil pH (optional)"><input style={inputStyle} inputMode="decimal" value={land.ph} onChange={e => set('ph', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                            {sel('water', WATERS, 'Water source')}
                            {sel('waterLevel', ['Low', 'Medium', 'High'], 'Water available')}
                            <Field label="Land (acres)"><input style={inputStyle} inputMode="decimal" value={land.acres} onChange={e => set('acres', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                            {sel('season', SEASONS, 'Season')}
                        </div>
                        <Field label="Village or district"><input style={inputStyle} value={land.place} onChange={e => set('place', e.target.value)} /></Field>
                        <Field label="Previous crop"><input style={inputStyle} value={land.lastCrop} onChange={e => set('lastCrop', e.target.value)} /></Field>
                        {sel('lang', LANGS, 'Answer language')}
                        <Btn kind="primary" onClick={suggest} disabled={busy} style={{ marginTop: 4 }}><Icon name="spark" size={16} />{busy ? 'Finding the best crops…' : 'Suggest crops'}</Btn>
                    </div>
                </Panel>
                <div style={{ flex: '3 1 480px', minWidth: 0, display: 'grid', gap: 16 }}>
                    {err && <div role="alert" style={{ background: C.redTint, color: C.redText, padding: '12px 14px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><span>{err}</span><Btn small onClick={suggest}>Try again</Btn></div>}
                    {busy && !advice && <Panel><div style={{ color: C.muted }}>Checking soil, water and season for {farmer?.name || 'this land'}…</div></Panel>}
                    {!advice && !busy && !err && (
                        <Panel><div style={{ color: C.muted, lineHeight: 1.6 }}>Pick a farmer or fill the land details, then press Suggest crops. You can also ask any question below, for example about fertilizer doses, pests or a chemical's safe use.</div></Panel>
                    )}
                    {advice && (
                        <Panel title="Suggestions for this land" action={busy ? <span style={{ color: C.muted, fontSize: 14 }}>Updating…</span> : undefined}>
                            <p style={{ margin: '0 0 12px', lineHeight: 1.55 }}>{advice.summary}</p>
                            <div style={{ display: 'grid', gap: 10 }}>
                                {advice.crops.map((c, i) => {
                                    const item = matchItem(db, c.crop_english, true);
                                    const qty = item ? stockOf(item.id, db.batches) : 0;
                                    return (
                                        <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                                <div style={{ fontSize: 17, fontWeight: 800 }}>{i + 1}. {c.crop}{c.crop !== c.crop_english ? <span style={{ color: C.muted, fontWeight: 500 }}> ({c.crop_english})</span> : null}</div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <Badge tone="gray">Water: {c.water_need}</Badge>
                                                    {item ? <Badge tone={qty === 0 ? 'red' : qty <= item.lowAt ? 'amber' : 'green'}>{qty === 0 ? 'Out of stock' : qty <= item.lowAt ? `Low stock (${qty})` : `In stock (${qty})`}</Badge> : <Badge tone="gray">Not stocked</Badge>}
                                                    {item && qty > 0 && <Btn small kind="primary" onClick={() => addToBill(item)}>Add to bill</Btn>}
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 6, lineHeight: 1.5 }}>{c.fit_reason}</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, marginTop: 8, fontSize: 14 }}>
                                                <div><span style={{ color: C.muted }}>Sowing:</span> {c.sowing_window}</div>
                                                <div><span style={{ color: C.muted }}>Seed per acre:</span> {c.seed_rate_per_acre}</div>
                                                <div><span style={{ color: C.muted }}>Fertilizer per acre:</span> {c.fertilizer_per_acre}</div>
                                                <div><span style={{ color: C.muted }}>Watch for:</span> {c.key_risks}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {advice.inputs.length > 0 && (
                                <>
                                    <h3 style={{ fontSize: 16, margin: '16px 0 8px' }}>Inputs to offer</h3>
                                    {advice.inputs.map((p, i) => {
                                        const item = matchItem(db, p.product_english, false);
                                        const qty = item ? stockOf(item.id, db.batches) : 0;
                                        return (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                                                <div style={{ flex: '1 1 260px' }}>
                                                    <b>{p.product}</b> · {p.purpose}<div style={{ fontSize: 14, color: C.muted }}>{p.dose_per_acre}. {p.safety_note}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    {item ? <Badge tone={qty > 0 ? 'green' : 'red'}>{qty > 0 ? `${item.name.split(' (')[0]}: ${qty}` : 'Out of stock'}</Badge> : <Badge tone="gray">Not stocked</Badge>}
                                                    {item && qty > 0 && <Btn small onClick={() => addToBill(item)}>Add to bill</Btn>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                            {advice.cautions.length > 0 && <ul style={{ margin: '12px 0 0', paddingLeft: 20, color: C.text, lineHeight: 1.5 }}>{advice.cautions.map((c, i) => <li key={i}>{c}</li>)}</ul>}
                            <div style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>AI advice is a suggestion. Please verify with your local agri officer or KVK, and follow the product label.</div>
                        </Panel>
                    )}
                    <Panel title="Ask Sahayak">
                        <div style={{ display: 'grid', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
                            {chat.length === 0 && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {['Fertilizer plan for chickpea on this land', 'How to control pod borer safely?', 'Is urea and DAP together fine at sowing?', 'इस खेत के लिए कौन सा बीज अच्छा रहेगा?'].map(s => <Chip key={s} onClick={() => send(s)}>{s}</Chip>)}
                                </div>
                            )}
                            {chat.map((m, i) => (
                                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', background: m.role === 'user' ? C.greenTint : C.bg, borderRadius: 12, padding: '8px 14px', lineHeight: 1.5, fontSize: 15 }}>
                                    {m.role === 'user' ? m.content[0]?.text : <ReactMarkdown>{m.content[0]?.text || ''}</ReactMarkdown>}
                                </div>
                            ))}
                            {chatBusy && <div style={{ color: C.muted }}>Sahayak is thinking…</div>}
                            <div ref={endRef} />
                        </div>
                        {chatErr && <div role="alert" style={{ color: C.redText, marginTop: 8, fontSize: 14 }}>{chatErr}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <input aria-label="Ask a question" style={inputStyle} value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(msg); }} placeholder="Type in any language" />
                            <Btn kind="accent" onClick={() => send(msg)} disabled={chatBusy || !msg.trim()}>Ask</Btn>
                        </div>
                        <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Answers use this land's details and your current stock.</div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
