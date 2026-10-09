import { describe, expect, it } from 'vitest';
import { dev_api, FileCache, FileKV, type DevFs } from '../server/dev';
import { capture_logs } from './fakes';

function memfs(): DevFs & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    async readFile(p) {
      const v = files.get(p);
      if (v === undefined) throw new Error('ENOENT');
      return v;
    },
    async writeFile(p, d) {
      files.set(p, d);
    },
    async mkdir() {},
    async rename(a, b) {
      files.set(b, files.get(a)!);
      files.delete(a);
    },
  };
}

describe('dev stores', () => {
  it('FileKV lists by prefix in key order, with cursors and expiry', async () => {
    const kv = new FileKV(memfs(), '/c/feedback.json');
    await Promise.all([kv.put('fb:2', 'b'), kv.put('fb:1', 'a'), kv.put('x:1', 'x'), kv.put('fb:0', 'old', { expirationTtl: -1 })]);
    expect(await kv.get('fb:1')).toBe('a');
    expect(await kv.get('fb:0')).toBe(null);
    const p1 = await kv.list({ prefix: 'fb:', limit: 1 });
    expect(p1.keys.map((k) => k.name)).toEqual(['fb:1']);
    const p2 = await kv.list({ prefix: 'fb:', limit: 1, cursor: p1.cursor });
    expect(p2).toMatchObject({ keys: [{ name: 'fb:2' }], list_complete: true });
    await kv.delete('fb:1');
    expect(await kv.get('fb:1')).toBe(null);
  });
  it('FileCache expires entries', async () => {
    const c = new FileCache(memfs(), '/c/tts');
    await c.put('tts/v/+0%/k', 'value', 60);
    expect(await c.get('tts/v/+0%/k')).toBe('value');
    await c.delete('tts/v/+0%/k');
    expect(await c.get('tts/v/+0%/k')).toBe(null);
  });
});

describe('dev_api middleware', () => {
  function call(mw: ReturnType<typeof dev_api>, url: string, o: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
    return new Promise<{ status: number; headers: Record<string, string>; body: string; next: boolean }>((resolve) => {
      const chunks = o.body ? [new TextEncoder().encode(o.body)] : [];
      const req = {
        method: o.method ?? 'GET', url, headers: { host: 'localhost:5176', ...o.headers }, socket: { remoteAddress: '127.0.0.1' },
        async *[Symbol.asyncIterator]() {
          yield* chunks;
        },
      };
      const out = { status: 200, headers: {} as Record<string, string>, body: '', next: false };
      const res = {
        statusCode: 200, headersSent: false, writableFinished: false,
        setHeader: (k: string, v: string) => void (out.headers[k] = v),
        write: (c: Uint8Array) => ((out.body += new TextDecoder().decode(c)), true),
        end: (c?: string) => {
          out.status = res.statusCode;
          if (c) out.body += c;
          resolve(out);
        },
        on() {},
      };
      mw(req, res, () => resolve({ ...out, next: true }));
    });
  }
  it('serves /api/providers and /api/feedback, passes other paths on', async () => {
    const lines = capture_logs();
    const mw = dev_api({ env: { DEEPSEEK_API_KEY: 'k', ADMIN_TOKEN: 't' }, fs: memfs(), cache_dir: '/c' });
    const p = await call(mw, '/api/providers');
    expect(JSON.parse(p.body)).toEqual({ anthropic: false, deepseek: true, tts: true });
    expect((await call(mw, '/src/main.ts')).next).toBe(true);
    expect((await call(mw, '/api/anthropic/v1/messages')).next).toBe(true);
    const body = JSON.stringify({ question: 'q', answer_id: 'a', helpful: true });
    const f = await call(mw, '/api/feedback', { method: 'POST', body, headers: { origin: 'http://localhost:5176', 'content-type': 'application/json' } });
    expect(f.status).toBe(201);
    const g = await call(mw, '/api/feedback?limit=5', { headers: { authorization: 'Bearer t' } });
    expect(JSON.parse(g.body).items).toHaveLength(1);
    expect(lines.map((l) => `${l.route} ${l.status}`)).toEqual(['providers 200', 'feedback 201', 'feedback 200']);
    expect((await call(mw, '/api/tts', { method: 'GET' })).status).toBe(405);
  });
});
