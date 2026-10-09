import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from '../src/provider';

const req = { system: 'be brief', messages: [{ role: 'user' as const, content: 'hi' }] };
afterEach(() => vi.unstubAllGlobals());

describe('OpenAICompatibleProvider', () => {
  it('sends the system prompt first and returns the reply', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] })));
    vi.stubGlobal('fetch', fetch);
    const p = new OpenAICompatibleProvider({ name: 'deepseek', base_url: '/api/deepseek/', model: 'deepseek-chat' });
    expect(await p.complete(req)).toBe('hello');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/deepseek/chat/completions');
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be brief' });
    expect(body.model).toBe('deepseek-chat');
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('streams deltas split across chunks', async () => {
    const events = ['data: {"choices":[{"delta":{"content":"Hel"}}]}\n', 'data: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n'];
    // split the first event mid-line to test buffering
    const chunks = [events[0].slice(0, 20), events[0].slice(20), events[1]];
    const body = new ReadableStream({
      start(c) {
        for (const x of chunks) c.enqueue(new TextEncoder().encode(x));
        c.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    const p = new OpenAICompatibleProvider({ base_url: '/api/deepseek', model: 'deepseek-chat' });
    const seen: string[] = [];
    expect(await p.stream(req, (d) => seen.push(d))).toBe('Hello');
    expect(seen).toEqual(['Hel', 'lo']);
  });

  it('reports API errors with the status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"bad key"}', { status: 401 })));
    const p = new OpenAICompatibleProvider({ name: 'deepseek', base_url: '/api/deepseek', model: 'deepseek-chat' });
    await expect(p.complete(req)).rejects.toThrow(/deepseek API 401/);
  });
});
