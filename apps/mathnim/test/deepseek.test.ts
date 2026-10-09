import { describe, expect, it } from 'vitest';
import { allowed_models, check_chat, deepseek, extract_usage, MAX_TOKENS } from '../server/deepseek';
import { RateLimiter, type Note } from '../server/http';
import { MemoryCache } from '../server/dev';
import { post, SITE } from './fakes';

const ENV = { DEEPSEEK_API_KEY: 'sk-test' };
const chat = (o: Record<string, unknown> = {}) => ({ model: 'deepseek-flash', messages: [{ role: 'user', content: 'hi' }], ...o });
const SSE = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13,"prompt_cache_hit_tokens":8}}\n\ndata: [DONE]\n\n';

function upstream(body: string, ct: string, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status, headers: { 'content-type': ct } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe('check_chat', () => {
  it('allows listed models only, caps max_tokens, asks for stream usage', () => {
    expect(check_chat(JSON.stringify(chat({ model: 'gpt-x' })), allowed_models())).toMatchObject({ ok: false, status: 400 });
    expect(check_chat(JSON.stringify(chat({ model: 'gpt-x' })), ['*'])).toMatchObject({ ok: true });
    expect(check_chat('[1]', ['*'])).toMatchObject({ ok: false });
    expect(check_chat(JSON.stringify({ model: 'deepseek-flash' }), allowed_models())).toMatchObject({ ok: false });
    const r = check_chat(JSON.stringify(chat({ max_tokens: 10 ** 9, stream: true })), allowed_models());
    expect(r.ok && r.value).toMatchObject({ max_tokens: MAX_TOKENS, stream_options: { include_usage: true } });
    const d = check_chat(JSON.stringify(chat()), allowed_models());
    expect(d.ok && d.value.max_tokens).toBe(8000);
    expect(d.ok && d.value.stream_options).toBe(undefined);
  });
  it('reads ALLOWED_MODELS', () => expect(allowed_models('a, b')).toEqual(['a', 'b']));
});

describe('extract_usage', () => {
  it('from JSON and from the last SSE chunk with usage', () => {
    expect(extract_usage('{"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3,"completion_tokens_details":{"reasoning_tokens":1}}}', false))
      .toEqual({ prompt: 1, completion: 2, total: 3, reasoning: 1 });
    expect(extract_usage(SSE, true)).toEqual({ prompt: 10, completion: 3, total: 13, cache_hit: 8 });
    expect(extract_usage('data: {"choices":[]}\n\ndata: [DONE]', true)).toBe(undefined);
    expect(extract_usage('not json', false)).toBe(undefined);
  });
});

describe('/api/deepseek', () => {
  it('forwards chat with the key, streams back, logs usage', async () => {
    const u = upstream(SSE, 'text/event-stream');
    const note: Note = {};
    const res = await deepseek(post('/api/deepseek/chat/completions', chat({ stream: true })), ENV, 'chat/completions', { limiter: null, answers: null, fetch: u.fetch }, note);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SSE);
    expect(res.headers.get('x-mathnim-answer-id')).toMatch(/^[0-9a-f]{32}$/);
    expect(u.calls[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect((u.calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    await note.after;
    expect(note).toMatchObject({ model: 'deepseek-flash', usage: { total: 13 } });
  });
  it('refuses what the app does not need', async () => {
    const deps = { limiter: null, answers: null, fetch: upstream('{}', 'application/json').fetch };
    expect((await deepseek(post('/x', chat()), {}, 'chat/completions', deps, {})).status).toBe(503);
    expect((await deepseek(post('/x', chat()), ENV, 'embeddings', deps, {})).status).toBe(404);
    expect((await deepseek(post('/x', chat(), { origin: 'https://evil.example' }), ENV, 'chat/completions', deps, {})).status).toBe(403);
    expect((await deepseek(post('/x', chat({ model: 'deepseek-reasoner' })), ENV, 'chat/completions', deps, {})).status).toBe(400);
    expect((await deepseek(post('/x', 'x'.repeat(300 * 1024)), ENV, 'chat/completions', deps, {})).status).toBe(413);
    expect((await deepseek(new Request(`${SITE}/api/deepseek/models`), ENV, 'models', deps, {})).status).toBe(200);
  });
  it('rate limits per visitor', async () => {
    const deps = { limiter: new RateLimiter({ per_window: 1, per_day: 10 }), answers: null, fetch: upstream('{}', 'application/json').fetch };
    expect((await deepseek(post('/x', chat()), ENV, 'chat/completions', deps, {})).status).toBe(200);
    const r = await deepseek(post('/x', chat()), ENV, 'chat/completions', deps, {});
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBeTruthy();
  });
  it('answers identical requests from the cache when asked to', async () => {
    const u = upstream('{"choices":[{"message":{"content":"A"}}]}', 'application/json');
    const deps = { limiter: null, answers: new MemoryCache(), fetch: u.fetch };
    const opt = { 'x-mathnim-cache': '1' };
    const n1: { after?: Promise<unknown> } = {};
    const a = await deepseek(post('/x', chat(), opt), ENV, 'chat/completions', deps, n1);
    expect(a.headers.get('x-mathnim-cache')).toBe('miss');
    await a.text();
    await n1.after;
    const n2: { cached?: boolean } = {};
    const b = await deepseek(post('/x', chat(), opt), ENV, 'chat/completions', deps, n2);
    expect(b.headers.get('x-mathnim-cache')).toBe('hit');
    expect(await b.json()).toEqual({ choices: [{ message: { content: 'A' } }] });
    expect(b.headers.get('x-mathnim-answer-id')).toBe(a.headers.get('x-mathnim-answer-id'));
    expect(n2.cached).toBe(true);
    expect(u.calls).toHaveLength(1);
    // without the header, or with the cache off, it always asks upstream
    await deepseek(post('/x', chat()), ENV, 'chat/completions', deps, {});
    await deepseek(post('/x', chat(), opt), { ...ENV, ANSWER_CACHE_TTL: '0' }, 'chat/completions', deps, {});
    expect(u.calls).toHaveLength(3);
  });
  it('passes upstream errors through and notes them', async () => {
    const note: { error?: string } = {};
    const r = await deepseek(post('/x', chat()), ENV, 'chat/completions', { limiter: null, answers: null, fetch: upstream('{"error":"x"}', 'application/json', 402).fetch }, note);
    expect(r.status).toBe(402);
    expect(note.error).toBe('upstream 402');
  });
});
