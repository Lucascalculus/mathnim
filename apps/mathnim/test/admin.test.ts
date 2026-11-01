// The data centre: page views (no address or cookie kept), what the paid routes cost, and the admin's numbers,
// against Node's SQLite through the D1 adapter.
import { describe, expect, it } from 'vitest';
import { admin, csv_cell, range_of } from '../server/admin';
import { auth, type AuthEnv } from '../server/auth';
import { d1_of, type NodeSqlite } from '../server/dev';
import { events } from '../server/events';
import { handle, set_log_sink, type LogLine } from '../server/http';
import { call_cost, day_start, hit, hit_path, is_peak, is_robot, local_day, parse_hit, record_usage, tz_offset } from '../server/stats';

const SQLITE = 'node:sqlite';
const { DatabaseSync } = (await import(/* @vite-ignore */ SQLITE)) as { DatabaseSync: new (f: string) => NodeSqlite };
const ORIGIN = 'http://localhost';
set_log_sink(() => {}); // (the calls' log lines are not what is tested here)
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const env = (): AuthEnv => ({ DB: d1_of(new DatabaseSync(':memory:')), ADMIN_EMAILS: 'boss@example.com' });
const req = (path: string, o: { body?: unknown; cookie?: string; ip?: string; ua?: string } = {}) =>
  new Request(`${ORIGIN}/api/${path}`, {
    method: o.body !== undefined ? 'POST' : 'GET',
    headers: { origin: ORIGIN, 'content-type': 'application/json', 'user-agent': o.ua ?? BROWSER, 'cf-connecting-ip': o.ip ?? '1.2.3.4', ...(o.cookie ? { cookie: o.cookie } : {}) },
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
async function sign_in(e: AuthEnv, email: string): Promise<string> {
  const start = await auth(req('auth/start', { body: { email } }), e, 'start', { limiter: null, dev: true }, {});
  const { dev_code } = (await start.json()) as { dev_code: string };
  const v = await auth(req('auth/verify', { body: { email, code: dev_code } }), e, 'verify', { limiter: null }, {});
  return v.headers.get('set-cookie')!.split(';')[0];
}
const view = (e: AuthEnv, path: string, o: { ip?: string; ua?: string; cookie?: string; ref?: string } = {}) =>
  hit(req('hit', { body: { path, ref: o.ref, lang: 'zh', w: 390 }, ...o }), e, { limiter: null }, {});
const get = async <T = Record<string, unknown>>(e: AuthEnv, path: string, cookie: string) => {
  const r = await admin(req(`admin/${path}`, { cookie }), e, path.split('?')[0]);
  return { status: r.status, body: (r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text()) as T };
};

describe('local days', () => {
  it('follows Melbourne time, clock changes included', () => {
    // 2026-11-01 14:00 UTC is 01:00 on the 2nd in Melbourne (summer time, +11)
    expect(local_day(Date.UTC(2026, 10, 1, 14), 'Australia/Melbourne')).toBe('2026-11-02');
    expect(tz_offset(Date.UTC(2026, 10, 1, 14), 'Australia/Melbourne')).toBe(11 * 3600_000);
    expect(tz_offset(Date.UTC(2026, 6, 1), 'Australia/Melbourne')).toBe(10 * 3600_000);
    expect(day_start('2026-11-02', 'Australia/Melbourne')).toBe(Date.UTC(2026, 10, 1, 13));
    // the day summer time starts (4 October 2026) begins at standard time
    expect(day_start('2026-10-04', 'Australia/Melbourne')).toBe(Date.UTC(2026, 9, 3, 14));
  });
  it('makes a range and the one before it', () => {
    const r = range_of(new URL('http://x/?days=7'), 'Australia/Melbourne', Date.UTC(2026, 10, 1, 14));
    expect([r.from, r.to, r.prev?.from, r.prev?.to]).toEqual(['2026-10-27', '2026-11-02', '2026-10-20', '2026-10-26']);
    expect(r.until - r.since).toBe(7 * 86_400_000);
    expect(range_of(new URL('http://x/?days=0'), 'UTC').prev).toBeUndefined();
  });
});

describe('page views', () => {
  it('keeps the page, not the query or a private address', () => {
    expect(hit_path('/mpc/mpc-m1?x=1#top')).toBe('/mpc/mpc-m1');
    expect(hit_path('/studio/abc123')).toBe('/studio/*');
    expect(hit_path('/admin')).toBe(null);
    expect(hit_path('/api/ai')).toBe(null);
    expect(hit_path('https://evil.example/')).toBe(null);
    expect(parse_hit(JSON.stringify({ path: '/', ref: 'WWW.Google.com/<x>', lang: 'fr', w: 1400 }))).toEqual({ path: '/', ref: 'google.comx', lang: null, device: 'desktop' });
    expect(is_robot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(is_robot('Mozilla/5.0 HeadlessChrome/141.0')).toBe(true);
    expect(is_robot(BROWSER)).toBe(false);
  });

  it('counts a visitor once a day without keeping the address, and not robots or admins', async () => {
    const e = env();
    expect((await view(e, '/mpc', { ref: 'google.com' })).status).toBe(204);
    await view(e, '/mpc/mpc-m1');
    await view(e, '/', { ip: '5.6.7.8' });
    await view(e, '/', { ua: 'Googlebot/2.1' });
    const boss = await sign_in(e, 'boss@example.com');
    await view(e, '/', { cookie: boss });
    const learner = await sign_in(e, 'a@example.com');
    await view(e, '/math', { cookie: learner, ip: '9.9.9.9' });
    const rows = (await e.DB!.prepare('SELECT * FROM hits ORDER BY t').all<Record<string, unknown>>()).results;
    expect(rows.length).toBe(4);
    expect(new Set(rows.map((r) => r.tag)).size).toBe(3);
    expect(JSON.stringify(rows)).not.toMatch(/1\.2\.3\.4|5\.6\.7\.8/);
    expect(rows.map((r) => r.member)).toEqual([0, 0, 0, 1]);
    expect(rows[0]).toMatchObject({ path: '/mpc', ref: 'google.com', device: 'phone', lang: 'zh' });
    // a new day, a new salt: yesterday's tags cannot be matched again
    await e.DB!.prepare("UPDATE salts SET day = '2000-01-01'").run();
    await view(e, '/mpc');
    const salts = (await e.DB!.prepare('SELECT day FROM salts').all<{ day: string }>()).results;
    expect(salts.map((s) => s.day)).toEqual([local_day(Date.now())]);
    const tags = (await e.DB!.prepare("SELECT tag FROM hits WHERE path = '/mpc'").all<{ tag: string }>()).results;
    expect(tags[0].tag).not.toBe(tags[1].tag);
  });
});

describe('what the routes cost', () => {
  it('prices tokens by the hour', () => {
    expect(is_peak(Date.UTC(2026, 10, 2, 2))).toBe(true); // Monday 02:00 UTC
    expect(is_peak(Date.UTC(2026, 10, 1, 2))).toBe(false); // Sunday
    const u = { prompt: 1_000_000, cache_hit: 200_000, completion: 100_000 };
    expect(call_cost('deepseek-flash', u, Date.UTC(2026, 10, 2, 2))).toBeCloseTo(0.2 * 0.006 + 0.8 * 0.3 + 0.1 * 1.2);
    expect(call_cost('deepseek-flash', u, Date.UTC(2026, 10, 2, 12))).toBeCloseTo((0.2 * 0.006 + 0.8 * 0.3 + 0.1 * 1.2) / 2);
    expect(call_cost('stand-in', u, 0)).toBe(0);
  });

  it('adds each paid call to its row of the day, through handle()', async () => {
    const e = env();
    const record = (line: LogLine) => record_usage(e.DB!, line);
    for (const usage of [{ prompt: 1000, completion: 200 }, { prompt: 500, completion: 100, cache_hit: 400 }])
      await handle('ai', req('ai', { body: {} }), { record }, async (note) => {
        note.op = 'tutor';
        note.model = 'deepseek-flash';
        note.usage = usage;
        return new Response('{}');
      });
    await handle('ai', req('ai', { body: {} }), { record }, async (note) => ((note.op = 'tutor'), (note.model = 'deepseek-flash'), new Response('{}', { status: 429 })));
    await handle('me/state', req('me/state'), { record }, async () => new Response('{}'));
    await new Promise((r) => setTimeout(r, 0));
    const rows = (await e.DB!.prepare('SELECT * FROM usage').all<Record<string, number | string>>()).results;
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ route: 'ai', op: 'tutor', model: 'deepseek-flash', calls: 3, limited: 1, prompt: 1500, cache_hit: 400, completion: 300 });
    expect(Number(rows[0].cost)).toBeGreaterThan(0);
  });
});

describe('the data centre', () => {
  it('is for admins only', async () => {
    const e = env();
    expect((await get(e, 'overview', '')).status).toBe(401);
    expect((await get(e, 'overview', await sign_in(e, 'a@example.com'))).status).toBe(403);
    expect((await get(e, 'overview', await sign_in(e, 'boss@example.com'))).status).toBe(200);
  });

  it('reads learning from the events: answers, first tries, where learners stopped, questions', async () => {
    const e = env();
    const now = Date.now();
    const learn = async (email: string, list: Record<string, unknown>[]) => {
      const cookie = await sign_in(e, email);
      const r = await events(req('me/events', { body: { events: list.map((x, i) => ({ id: `${email}-${i}`, t: now - 60_000 + i * 1000, lesson: 'l1', course: 'c1', ...x })) }, cookie }), e);
      expect(r.status).toBe(200);
    };
    await learn('a@example.com', [
      { verb: 'started' },
      { verb: 'viewed', step: 's1' },
      { verb: 'left', step: 's1', result: { duration_ms: 30_000 } },
      { verb: 'viewed', step: 's2' },
      { verb: 'answered', step: 's2', object: 'k', result: { correct: false, misconception: 'm1' } },
      { verb: 'answered', step: 's2', object: 'k', result: { correct: true } },
      { verb: 'asked', step: 's2', data: { q: 'why, "this"?', a: 'because' } },
      { verb: 'completed' },
    ]);
    await learn('b@example.com', [
      { verb: 'viewed', step: 's1' },
      { verb: 'left', step: 's1', result: { duration_ms: 99_000_000 } }, // a tab left open counts half an hour
    ]);
    const boss = await sign_in(e, 'boss@example.com');
    const ov = (await get(e, 'overview?days=7', boss)).body as { totals: Record<string, number>; daily: Record<string, number>[] };
    expect(ov.totals).toMatchObject({ learners: 2, asked: 1, answered: 2, correct: 1, completed: 1, users: 3, signups: 3 });
    expect(ov.daily.length).toBe(7);
    expect(ov.daily.at(-1)).toMatchObject({ learners: 2, asked: 1 });

    const le = (await get(e, 'learning?days=7', boss)).body as { lessons: Record<string, number>[]; hardest: Record<string, number>[]; misconceptions: Record<string, unknown>[] };
    expect(le.lessons[0]).toMatchObject({ course: 'c1', lesson: 'l1', learners: 2, completed: 1, answered: 2, correct: 1, time_ms: 30_000 + 1_800_000 });
    expect(le.hardest[0]).toMatchObject({ lesson: 'l1', step: 's2', learners: 1, first_right: 0 });
    expect(le.misconceptions[0]).toMatchObject({ misconception: 'm1', learners: 1 });

    const one = (await get(e, 'lesson?id=l1&days=7', boss)).body as { steps: Record<string, unknown>[]; stops: Record<string, unknown>[]; questions: Record<string, unknown>[] };
    expect(one.steps.find((s) => s.step === 's1')).toMatchObject({ reached: 2, stays: 2 });
    expect(one.stops).toEqual([{ step: 's1', learners: 1 }]); // b stopped at s1; a finished
    expect(one.questions[0]).toMatchObject({ q: 'why, "this"?', a: 'because', email: 'a@example.com', step: 's2' });

    const found = (await get<{ items: unknown[] }>(e, 'questions?days=7&q=this', boss)).body;
    expect(found.items.length).toBe(1);
    expect(((await get<{ items: unknown[] }>(e, 'questions?days=7&q=nothing', boss)).body).items.length).toBe(0);

    const us = (await get(e, 'users', boss)).body as { items: Record<string, unknown>[]; total: number };
    expect(us.total).toBe(3);
    const a = us.items.find((u) => u.email === 'a@example.com')!;
    expect(a).toMatchObject({ completed: 1, answered: 2, asked: 1 });
    const rec = (await get(e, `user?id=${a.id}`, boss)).body as { events: Record<string, unknown>[]; lessons: unknown[] };
    expect(rec.events.find((x) => x.verb === 'asked')?.data).toBe('why, "this"?');
    expect(rec.lessons.length).toBe(1);

    const csv = (await get<string>(e, 'export?kind=events&days=7', boss)).body;
    expect(csv.split('\n')[0]).toBe('t,user_id,course,lesson,step,verb,skill,correct,misconception,duration_ms,attempt,data');
    expect(csv.trim().split('\n').length).toBe(1 + 10);
    expect(csv_cell('a,"b"')).toBe('"a,""b"""');
  });
});
