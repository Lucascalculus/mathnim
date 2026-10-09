import { describe, expect, it } from 'vitest';
import { client_tag, error, handle, limit_for, origin_ok, RateLimiter, read_text, same_secret, to_base64 } from '../server/http';
import { capture_logs, post, SITE } from './fakes';

describe('RateLimiter', () => {
  it('limits a 10-minute window', () => {
    const l = new RateLimiter({ per_window: 2, per_day: 100 });
    const t = 1_000_000_000_000;
    expect(l.hit('a', t).ok).toBe(true);
    expect(l.hit('a', t + 1).ok).toBe(true);
    const v = l.hit('a', t + 2);
    expect(v).toMatchObject({ ok: false, scope: 'window' });
    expect(v.ok || v.retry_after).toBe(600);
    expect(l.hit('b', t + 2).ok).toBe(true); // per client
    expect(l.hit('a', t + 600_001).ok).toBe(true); // window slid
  });
  it('caps a day, resetting at UTC midnight', () => {
    const l = new RateLimiter({ per_window: 100, per_day: 3 });
    const day = 86_400_000 * 20_000;
    for (let i = 0; i < 3; i++) expect(l.hit('a', day + i * 1000).ok).toBe(true);
    expect(l.hit('a', day + 10_000)).toMatchObject({ ok: false, scope: 'day' });
    expect(l.hit('a', day + 86_400_000).ok).toBe(true);
  });
  it('stays bounded', () => {
    const l = new RateLimiter({ per_window: 1, per_day: 1 }, 10);
    for (let i = 0; i < 25; i++) l.hit(`ip${i}`);
    expect((l as unknown as { hits: Map<string, unknown> }).hits.size).toBeLessThanOrEqual(10);
  });
});

it('reads RATE_LIMITS overrides', () => {
  expect(limit_for('tts')).toEqual({ per_window: 80, per_day: 600 });
  expect(limit_for('tts', 'deepseek=1/2, tts=5/50')).toEqual({ per_window: 5, per_day: 50 });
  expect(limit_for('tts', 'tts=garbage')).toEqual({ per_window: 80, per_day: 600 });
});

describe('guards', () => {
  it('checks Origin', () => {
    expect(origin_ok(post('/api/x', {}))).toBe(true);
    expect(origin_ok(post('/api/x', {}, { origin: 'https://other.example' }))).toBe(false);
    expect(origin_ok(post('/api/x', {}, { origin: 'https://lab.penghaolun.com' }), 'https://lab.penghaolun.com')).toBe(true);
    expect(origin_ok(new Request(`${SITE}/api/x`))).toBe(true); // GET without Origin (curl, same-origin GET)
    expect(origin_ok(new Request(`${SITE}/api/x`, { method: 'POST', body: '{}' }))).toBe(false);
  });
  it('compares secrets', () => {
    expect(same_secret('abc', 'abc')).toBe(true);
    expect(same_secret('abc', 'abd')).toBe(false);
    expect(same_secret('abc', 'abcd')).toBe(false);
  });
  it('caps bodies', async () => {
    expect(await read_text(post('/x', 'hello'), 10)).toBe('hello');
    expect(await read_text(post('/x', 'x'.repeat(11)), 10)).toBe(null);
  });
  it('tags clients without their address, per day', () => {
    const t = Date.UTC(2026, 8, 30);
    expect(client_tag('1.2.3.4', t)).toMatch(/^[0-9a-f]{8}$/);
    expect(client_tag('1.2.3.4', t)).toBe(client_tag('1.2.3.4', t + 1000));
    expect(client_tag('1.2.3.4', t)).not.toBe(client_tag('1.2.3.4', t + 86_400_000));
    expect(client_tag('1.2.3.4', t)).not.toContain('1.2.3.4');
  });
});

describe('handle (logs)', () => {
  it('writes one JSON line per call, after streamed work', async () => {
    const lines = capture_logs();
    let finish!: () => void;
    const after = new Promise<void>((r) => (finish = r));
    const res = await handle('x', post('/api/x', {}), {}, async (note) => {
      note.model = 'm';
      note.after = after.then(() => (note.usage = { total: 5 }));
      return new Response('ok');
    });
    expect(res.status).toBe(200);
    expect(lines).toHaveLength(0);
    finish();
    await after;
    await new Promise((r) => setTimeout(r, 0));
    expect(lines[0]).toMatchObject({ route: 'x', method: 'POST', status: 200, model: 'm', usage: { total: 5 }, level: 'info' });
    expect(JSON.stringify(lines[0])).not.toContain('203.0.113.7');
  });
  it('turns exceptions into a 500 and logs the error', async () => {
    const lines = capture_logs();
    const res = await handle('y', post('/api/y', {}), {}, async () => {
      throw new Error('boom');
    });
    expect(res.status).toBe(500);
    expect(lines[0]).toMatchObject({ route: 'y', status: 500, error: 'boom', level: 'error' });
    expect((await error(400, 'x').json()).error).toBe('x');
  });
});

it('base64-encodes large buffers', () => {
  const b = new Uint8Array(100_000).map((_, i) => i % 256);
  expect(atob(to_base64(b)).length).toBe(100_000);
});
