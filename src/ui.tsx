import { CSSProperties, ReactNode, useEffect } from 'react';
import { C, font } from './theme';

const P: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    bill: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4',
    ledger: 'M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2zM5 17a2 2 0 0 1 2-2h12M9 7h6',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
    box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
    cart: 'M3 4h2l2.4 11h11L21 7H6.2M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01',
    spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    truck: 'M2 6h11v10H2zM13 9h4l4 4v3h-8M6 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
    leaf: 'M5 21c0-9 5-15 15-17-1 10-6 15-13 15M5 21c2-5 5-8 9-10',
    menu: 'M4 6h16M4 12h16M4 18h16',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6 6 18',
    back: 'M15 18l-6-6 6-6',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    msg: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z',
    download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    rupee: 'M6 4h12M6 9h12M14 4c3 0 4 2.2 4 5s-2 5-6 5H7l8 7',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
};

export function Icon({ name, size = 18, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d={P[name] || ''} />
        </svg>
    );
}

type Kind = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
export function Btn({ kind = 'outline', small, children, onClick, disabled, style, title }: {
    kind?: Kind; small?: boolean; children: ReactNode; onClick?: () => void; disabled?: boolean; style?: CSSProperties; title?: string;
}) {
    const base: CSSProperties = {
        fontFamily: font, fontSize: small ? 14 : 15, fontWeight: 600, borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
        padding: small ? '6px 14px' : '10px 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        border: '1px solid transparent', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', lineHeight: 1.2,
    };
    const k: Record<Kind, CSSProperties> = {
        primary: { background: C.green, color: '#fff' },
        accent: { background: C.amber, color: '#2A1E00' },
        outline: { background: '#fff', color: C.text, borderColor: C.borderStrong },
        ghost: { background: 'transparent', color: C.greenDark },
        danger: { background: '#fff', color: C.redText, borderColor: '#E3A9A4' },
    };
    return <button title={title} disabled={disabled} onClick={disabled ? undefined : onClick} style={{ ...base, ...k[kind], ...style }}>{children}</button>;
}

export const inputStyle: CSSProperties = {
    fontFamily: font, fontSize: 15, padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.borderStrong}`,
    background: '#fff', color: C.text, width: '100%', boxSizing: 'border-box', outline: 'none', minWidth: 0,
};

export function Field({ label, children, hint, style }: { label: string; children: ReactNode; hint?: string; style?: CSSProperties }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: C.muted, fontWeight: 600, minWidth: 0, ...style }}>
            {label}
            {children}
            {hint && <span style={{ fontWeight: 400, fontSize: 12, color: C.muted }}>{hint}</span>}
        </label>
    );
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
    return (
        <button onClick={onClick} style={{
            fontFamily: font, fontSize: 14, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `1px solid ${active ? C.green : C.borderStrong}`, background: active ? C.green : '#fff',
            color: active ? '#fff' : C.text, fontWeight: active ? 600 : 500,
        }}>{children}</button>
    );
}

export type Tone = 'green' | 'amber' | 'red' | 'gray';
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
    const t = {
        green: [C.greenTint, C.greenText], amber: ['#F6E3B4', C.amberText], red: [C.redTint, C.redText], gray: [C.grayTint, C.muted],
    }[tone];
    return <span style={{ background: t[0], color: t[1], fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', display: 'inline-block' }}>{children}</span>;
}

export function Panel({ title, action, children, style, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; style?: CSSProperties; pad?: boolean }) {
    return (
        <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, minWidth: 0, ...style }}>
            {(title || action) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px 4px', flexWrap: 'wrap' }}>
                    {title && <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>}
                    {action}
                </div>
            )}
            <div style={{ padding: pad ? '10px 18px 16px' : 0 }}>{children}</div>
        </section>
    );
}

export function Stat({ label, value, tone, sub, onClick }: { label: string; value: ReactNode; tone?: 'green' | 'red' | 'amber'; sub?: string; onClick?: () => void }) {
    const color = tone === 'green' ? C.greenText : tone === 'red' ? C.red : tone === 'amber' ? C.amberText : C.text;
    return (
        <div onClick={onClick} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px', cursor: onClick ? 'pointer' : 'default', minWidth: 0 }}>
            <div style={{ fontSize: 14, color: C.muted }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{value}</div>
            {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

export function PageHead({ title, sub, actions, onBack }: { title: string; sub?: ReactNode; actions?: ReactNode; onBack?: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onBack && (
                    <button aria-label="Back" onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                        <Icon name="back" size={24} color={C.greenDark} />
                    </button>
                )}
                <div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.greenDark }}>{title}</h1>
                    {sub && <div style={{ color: C.muted, fontSize: 14, marginTop: 3 }}>{sub}</div>}
                </div>
            </div>
            {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
    );
}

export const th: CSSProperties = { textAlign: 'left', fontSize: 13, color: C.muted, fontWeight: 600, padding: '9px 12px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' };
export const td: CSSProperties = { padding: '11px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 15, verticalAlign: 'middle' };
export const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

export function TableWrap({ children }: { children: ReactNode }) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>{children}</table>
        </div>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div style={{ padding: '22px 6px', color: C.muted, fontSize: 15, textAlign: 'center' }}>{children}</div>;
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
    useEffect(() => {
        const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', f);
        return () => window.removeEventListener('keydown', f);
    }, [onClose]);
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,24,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 12px', overflowY: 'auto' }}>
            <div role="dialog" aria-label={title} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: wide ? 860 : 520, fontFamily: font, color: C.text, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
                    <h2 style={{ margin: 0, fontSize: 19 }}>{title}</h2>
                    <button aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={22} color={C.muted} /></button>
                </div>
                <div style={{ padding: 20 }}>{children}</div>
                {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>{footer}</div>}
            </div>
        </div>
    );
}

export function Toast({ msg, undo, error, onClose, mobile }: { msg: string; undo?: () => void; error?: boolean; onClose: () => void; mobile: boolean }) {
    return (
        <div role="status" style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: mobile ? 86 : 24, zIndex: 60,
            background: error ? C.redText : '#1C2B22', color: '#fff', borderRadius: 12, padding: '11px 14px 11px 18px',
            display: 'flex', alignItems: 'center', gap: 14, fontSize: 15, maxWidth: 'calc(100vw - 24px)', fontFamily: font,
            boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
        }}>
            <span>{msg}</span>
            {undo && <button onClick={() => { undo(); onClose(); }} style={{ background: 'none', border: 'none', color: C.amber, fontWeight: 700, cursor: 'pointer', fontSize: 15, fontFamily: font }}>Undo</button>}
            <button aria-label="Dismiss" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={18} color="#fff" /></button>
        </div>
    );
}

export const grid = (min: number, gap = 14): CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap });
