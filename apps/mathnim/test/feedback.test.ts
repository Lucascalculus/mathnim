import { describe, expect, it } from 'vitest';
import { answer_cache_key } from '../server/deepseek';
import { MemoryCache } from '../server/dev';
import { feedback, feedback_key, parse_feedback, parse_limit } from '../server/feedback';
import { MemoryKV, post, SITE } from './fakes';

const GOOD = { question: 'Why is the area pi r squared?', answer_id: 'abc123', helpful: false, note: 'Too fast' };

describe('parse_feedback', () => {
  it('accepts the contract', () => {
    expect(parse_feedback(JSON.stringify(GOOD))).toEqual({ ok: true, value: GOOD });
    expect(parse_feedback(JSON.stringify({ ...GOOD, note: undefined, helpful: true }))).toEqual({ ok: true, value: { question: GOOD.question, answer_id: 'abc123', helpful: true } });
  });
  it('rejects bad input', () => {
    for (const bad of [{ ...GOOD, question: '' }, { ...GOOD, helpful: 'no' }, { ...GOOD, answer_id: 5 }, { ...GOOD, note: 3 }, [], null])
      expect(parse_feedback(JSON.stringify(bad)).ok).toBe(false);
    expect(parse_feedback(JSON.stringify({ ...GOOD, note: 'x'.repeat(2001) }))).toMatchObject({ ok: false, status: 413 });
    expect(parse_feedback('{')).toMatchObject({ ok: false, status: 400 });
  });
});

it('orders keys newest first and clamps limits', () => {
  expect(feedback_key(2000, 'a') < feedback_key(1000, 'a')).toBe(true);
  expect(parse_limit(null)).toBe(50);
  expect(parse_limit('500')).toBe(200);
  expect(parse_limit('0')).toBe(1);
  expect(parse_limit('x')).toBe(50);
});

describe('/api/feedback', () => {
  const admin = (token?: string, q = '') =>
    new Request(`${SITE}/api/feedback${q}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  it('stores feedback and lists it for the admin, newest first', async () => {
    const kv = new MemoryKV();
    const env = { FEEDBACK: kv, ADMIN_TOKEN: 'secret' };
    const deps = { limiter: null, answers: null };
    const r1 = await feedback(post('/api/feedback', { ...GOOD, question: 'first' }), env, deps, {});
    expect(r1.status).toBe(201);
    await new Promise((r) => setTimeout(r, 2));
    await feedback(post('/api/feedback', { ...GOOD, question: 'second' }), env, deps, {});
    const list = await (await feedback(admin('secret'), env, deps, {})).json();
    expect(list.items.map((i: { question: string }) => i.question)).toEqual(['second', 'first']);
    expect(list.items[0]).toMatchObject({ answer_id: 'abc123', helpful: false, note: 'Too fast' });
    expect(list.items[0].client).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(list)).not.toContain('203.0.113.7');
    const page = await (await feedback(admin('secret', '?limit=1'), env, deps, {})).json();
    expect(page.items).toHaveLength(1);
    expect(page.cursor).toBeTruthy();
  });
  it('refuses review without ADMIN_TOKEN, or with a wrong one', async () => {
    const kv = new MemoryKV();
    const deps = { limiter: null, answers: null };
    expect((await feedback(admin('anything'), { FEEDBACK: kv }, deps, {})).status).toBe(503);
    expect((await feedback(admin('wrong'), { FEEDBACK: kv, ADMIN_TOKEN: 'secret' }, deps, {})).status).toBe(401);
    expect((await feedback(admin(), { FEEDBACK: kv, ADMIN_TOKEN: 'secret' }, deps, {})).status).toBe(401);
  });
  it('guards submissions', async () => {
    const deps = { limiter: null, answers: null };
    expect((await feedback(post('/api/feedback', GOOD), {}, deps, {})).status).toBe(503);
    expect((await feedback(post('/api/feedback', GOOD, { origin: 'https://evil.example' }), { FEEDBACK: new MemoryKV() }, deps, {})).status).toBe(403);
    expect((await feedback(post('/api/feedback', { ...GOOD, helpful: 1 }), { FEEDBACK: new MemoryKV() }, deps, {})).status).toBe(400);
    expect((await feedback(new Request(`${SITE}/api/feedback`, { method: 'PUT' }), {}, deps, {})).status).toBe(405);
  });
  it('drops a cached answer that did not help', async () => {
    const answers = new MemoryCache();
    await answers.put(answer_cache_key('abc123'), 'x', 60);
    const note: { after?: Promise<unknown> } = {};
    await feedback(post('/api/feedback', GOOD), { FEEDBACK: new MemoryKV() }, { limiter: null, answers }, note);
    await note.after;
    expect(await answers.get(answer_cache_key('abc123'))).toBe(null);
  });
});
