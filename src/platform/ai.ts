// Talks to the AgriMunim AI server (server/server.mjs). The AI provider key stays on that server, never on shop devices.
import type { Settings } from '../types';

export class AIInferenceError extends Error {}
export interface ContentBlock { text?: string; toolUse?: { toolUseId: string; name: string; input: string } }
export interface ConversationMessage { role: 'user' | 'assistant'; content: ContentBlock[] }
export interface ToolDefinition { toolSpec: { name: string; description: string; inputSchema: { json: string } } }
type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'guardrail_intervened';
interface InvokeRequest {
    modelId: string;
    systemPrompt?: string;
    messages: ConversationMessage[];
    tools?: ToolDefinition[];
    inferenceConfig?: { maxTokens?: number; temperature?: number };
}

export const defineTool = (name: string, description: string, jsonSchema: Record<string, unknown>): ToolDefinition =>
    ({ toolSpec: { name, description, inputSchema: { json: JSON.stringify(jsonSchema) } } });

let cfg = { url: '', key: '' };
export function configureAi(s: Pick<Settings, 'aiServerUrl' | 'shopKey'>) {
    cfg = { url: (s.aiServerUrl || '').trim().replace(/\/+$/, ''), key: (s.shopKey || '').trim() };
}
export const aiConfigured = () => !!cfg.url && !!cfg.key;

async function call(body: unknown): Promise<{ text?: string; toolUse?: { name: string; input: unknown }; stopReason?: string }> {
    if (!aiConfigured()) throw new AIInferenceError('AI Sahayak is not set up yet. Add the AI server address and shop key in Settings.');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    let res: Response;
    try {
        res = await fetch(cfg.url + '/api/ai', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-shop-key': cfg.key },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
    } catch {
        throw new AIInferenceError(navigator.onLine
            ? "Couldn't reach the AI server. Check the address in Settings, or try again."
            : 'No internet connection. AI Sahayak needs internet; billing, udhaar and stock still work.');
    } finally {
        clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AIInferenceError(data.error || `AI server error (${res.status})`);
    return data;
}

export const aiClient = {
    async invoke(req: InvokeRequest): Promise<{ content: ContentBlock[]; stopReason: StopReason }> {
        const tool = req.tools?.[0];
        const data = await call({
            tier: /haiku/i.test(req.modelId) ? 'fast' : 'smart',
            system: req.systemPrompt,
            messages: req.messages.map(m => ({ role: m.role, text: m.content.map(c => c.text || '').join('') })),
            tool: tool ? { name: tool.toolSpec.name, description: tool.toolSpec.description, schema: JSON.parse(tool.toolSpec.inputSchema.json) } : undefined,
            maxTokens: req.inferenceConfig?.maxTokens,
            temperature: req.inferenceConfig?.temperature,
        });
        const content: ContentBlock[] = [];
        if (data.text) content.push({ text: data.text });
        if (data.toolUse) content.push({ toolUse: { toolUseId: 't1', name: data.toolUse.name, input: JSON.stringify(data.toolUse.input) } });
        const stopReason: StopReason = data.toolUse ? 'tool_use'
            : data.stopReason === 'refusal' ? 'guardrail_intervened'
            : data.stopReason === 'max_tokens' ? 'max_tokens' : 'end_turn';
        return { content, stopReason };
    },
    async prompt(modelId: string, text: string, systemPrompt?: string): Promise<string> {
        const r = await aiClient.invoke({ modelId, systemPrompt, messages: [{ role: 'user', content: [{ text }] }] });
        return r.content.map(c => c.text || '').join('');
    },
};
