// AgriMunim AI server. Keeps the AI provider key off shop devices, checks each shop's key,
// applies a daily limit per shop, and forwards AI Sahayak requests. No dependencies (Node 18+).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, '.env');
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
}

const env = process.env;
const PORT = Number(env.PORT || 8787);
const API_KEY = env.ANTHROPIC_API_KEY || '';
const MODEL = env.ANTHROPIC_MODEL || '';
const MODEL_FAST = env.ANTHROPIC_MODEL_FAST || MODEL;
const DAILY_LIMIT = Number(env.DAILY_LIMIT_PER_SHOP || 300);
const ALLOWED = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const SHOPS = new Map();
for (const entry of (env.SHOP_KEYS || '').split(',')) {
    const [key, ...name] = entry.trim().split(':');
    if (key && key.length >= 16) SHOPS.set(key, name.join(':') || key.slice(0, 6));
}
const missing = [
    !API_KEY && 'ANTHROPIC_API_KEY',
    !MODEL && 'ANTHROPIC_MODEL',
    !SHOPS.size && 'SHOP_KEYS (each key at least 16 characters)',
].filter(Boolean);
if (missing.length) {
    console.error(`Missing settings: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
}

const usage = new Map();
const utcDay = () => new Date().toISOString().slice(0, 10);
function allow(key) {
    const d = utcDay();
    const u = usage.get(key);
    if (!u || u.day !== d) { usage.set(key, { day: d, count: 1 }); return true; }
    if (u.count >= DAILY_LIMIT) return false;
    u.count++;
    return true;
}

function cors(req, res) {
    const origin = req.headers.origin;
    const ok = ALLOWED.includes('*') ? '*' : (origin && ALLOWED.includes(origin) ? origin : '');
    if (ok) res.setHeader('Access-Control-Allow-Origin', ok);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-shop-key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
}

function readBody(req, limit = 200 * 1024) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', c => {
            size += c.length;
            if (size > limit) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); }
            else chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

// The AI API needs turns to alternate and start with the user.
function cleanMessages(list) {
    if (!Array.isArray(list)) return null;
    const out = [];
    for (const m of list.slice(-24)) {
        const role = m && m.role === 'assistant' ? 'assistant' : 'user';
        const text = typeof m?.text === 'string' ? m.text.slice(0, 8000).trim() : '';
        if (!text) continue;
        if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n\n' + text;
        else out.push({ role, content: text });
    }
    while (out.length && out[0].role !== 'user') out.shift();
    return out.length && out[out.length - 1].role === 'user' ? out : null;
}

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

async function handleAi(req, res) {
    const key = String(req.headers['x-shop-key'] || '');
    const shop = SHOPS.get(key);
    if (!shop) return send(res, 401, { error: 'This shop key is not valid. Check it in Settings or contact support.' });
    if (!allow(key)) return send(res, 429, { error: "Today's AI limit for this shop is used up. It resets tomorrow." });

    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch (e) { return send(res, e.status || 400, { error: e.status ? e.message : 'Invalid request' }); }

    const messages = cleanMessages(body.messages);
    if (!messages) return send(res, 400, { error: 'The question is empty.' });
    const tier = body.tier === 'fast' ? 'fast' : 'smart';
    const payload = {
        model: tier === 'fast' ? MODEL_FAST : MODEL,
        max_tokens: Math.min(Math.max(Number(body.maxTokens) || 1500, 100), 3000),
        messages,
    };
    if (typeof body.temperature === 'number') payload.temperature = Math.min(Math.max(body.temperature, 0), 1);
    if (typeof body.system === 'string') payload.system = body.system.slice(0, 20000);
    if (body.tool && typeof body.tool.name === 'string' && body.tool.schema && typeof body.tool.schema === 'object') {
        payload.tools = [{ name: body.tool.name.slice(0, 64), description: String(body.tool.description || '').slice(0, 1000), input_schema: body.tool.schema }];
        payload.tool_choice = { type: 'tool', name: payload.tools[0].name };
    }

    let upstream;
    try {
        upstream = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(55000),
        });
    } catch (e) {
        log(`shop="${shop}" upstream_error=${e.name}`);
        return send(res, 504, { error: 'The AI service took too long. Please try again.' });
    }
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
        log(`shop="${shop}" upstream_status=${upstream.status} type=${data?.error?.type || 'unknown'}`);
        return send(res, upstream.status === 429 || upstream.status === 529 ? 503 : 502, { error: 'The AI service is busy. Please try again in a minute.' });
    }
    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const tool = blocks.find(b => b.type === 'tool_use');
    // Logs usage for billing and cost tracking. Never logs the questions or answers.
    log(`shop="${shop}" tier=${tier} in=${data.usage?.input_tokens ?? 0} out=${data.usage?.output_tokens ?? 0}`);
    send(res, 200, { stopReason: data.stop_reason || 'end_turn', text, toolUse: tool ? { name: tool.name, input: tool.input } : undefined });
}

const server = http.createServer(async (req, res) => {
    cors(req, res);
    const url = (req.url || '/').split('?')[0];
    try {
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
        if (req.method === 'GET' && url === '/health') return send(res, 200, { ok: true });
        if (req.method === 'POST' && url === '/api/ai') return await handleAi(req, res);
        send(res, 404, { error: 'Not found' });
    } catch (e) {
        log(`error=${e?.message || e}`);
        if (!res.headersSent) send(res, 500, { error: 'Server error' });
    }
});
server.requestTimeout = 70000;
server.listen(PORT, () => log(`AgriMunim AI server on port ${PORT}, ${SHOPS.size} shop keys loaded, limit ${DAILY_LIMIT}/shop/day`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
