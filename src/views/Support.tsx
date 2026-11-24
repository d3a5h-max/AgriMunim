import { useState } from 'react';
import { useApp } from '../store';
import { C } from '../theme';
import { Btn, Chip, Field, Icon, inputStyle, PageHead, Panel } from '../ui';
import { openLink, waLink } from '../utils';

const SUPPORT = '8275249118';
const TOPICS = ['Billing', 'Udhaar', 'Stock', 'AI advice', 'E-way bill', 'Something else'];

export default function Support() {
    const { db, notify } = useApp();
    const [topic, setTopic] = useState('Billing');
    const [text, setText] = useState('');
    const send = () => {
        openLink(waLink(SUPPORT, `AgriMunim support (${topic})\nShop: ${db.settings.shopName}${db.settings.phone ? ', ' + db.settings.phone : ''}\n\n${text.trim()}`));
        notify('Your message opened in WhatsApp. Tap Send there.');
    };
    const card = (title: string, sub: string, action: JSX.Element) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', border: `1px solid ${C.border}`, borderRadius: 14, background: '#fff', flexWrap: 'wrap' }}>
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div><div style={{ color: C.muted, fontSize: 14 }}>{sub}</div></div>
            {action}
        </div>
    );
    return (
        <div>
            <PageHead title="Contact support" sub="Help in Hindi, Marathi, Telugu, Kannada, Tamil, Gujarati and English" />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gap: 12, flex: '1 1 320px' }}>
                    {card('Call us', '+91 82752 49118', <Btn kind="primary" onClick={() => openLink('tel:+918275249118')}><Icon name="phone" size={16} color="#fff" />Call</Btn>)}
                    {card('WhatsApp chat', 'Reply in your language', <Btn kind="primary" onClick={() => openLink(waLink(SUPPORT, `Namaste, I need help with AgriMunim. Shop: ${db.settings.shopName}`))}><Icon name="msg" size={16} color="#fff" />Chat</Btn>)}
                    {card('Request a call back', 'We call you at a time that suits you', <Btn kind="accent" onClick={() => openLink(waLink(SUPPORT, `Please call me back about AgriMunim. Shop: ${db.settings.shopName}${db.settings.phone ? ', phone ' + db.settings.phone : ''}`))}>Request</Btn>)}
                </div>
                <Panel title="Send us a message" style={{ flex: '1 1 360px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>{TOPICS.map(t => <Chip key={t} active={topic === t} onClick={() => setTopic(t)}>{t}</Chip>)}</div>
                    <Field label="Your problem">
                        <textarea rows={5} style={{ ...inputStyle, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} />
                    </Field>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                        <Btn kind="primary" disabled={!text.trim()} onClick={send}>Send on WhatsApp</Btn>
                    </div>
                </Panel>
            </div>
        </div>
    );
}
