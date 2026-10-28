// Accounts (emailed codes, sessions), progress sync, and making a course from
// uploads with a scripted model, against Node's SQLite through the D1 adapter.
import { describe, expect, it } from 'vitest';
import { auth, normal_email, type AuthEnv } from '../server/auth';
import type { BlobStore } from '../server/db';
import { d1_of, type NodeSqlite } from '../server/dev';
import { check_lesson } from '../server/studio/format';
import type { StudioModel, StudioRequest } from '../server/studio/model';
import { studio } from '../server/studio/routes';
import { state } from '../server/sync';

// (a variable specifier: the server's type project has no Node types)
const SQLITE = 'node:sqlite';
const { DatabaseSync } = (await import(/* @vite-ignore */ SQLITE)) as { DatabaseSync: new (f: string) => NodeSqlite };
const ORIGIN = 'http://localhost';

function memblobs(): BlobStore {
  const m = new Map<string, Uint8Array>();
  return {
    async put(k, v) {
      m.set(k, v instanceof Uint8Array ? v : new Uint8Array(v));
    },
    async get(k) {
      const b = m.get(k);
      return b ? { size: b.byteLength, arrayBuffer: async () => b.slice().buffer } : null;
    },
    async delete(k) {
      m.delete(k);
    },
  };
}
const env = (): AuthEnv => ({ DB: d1_of(new DatabaseSync(':memory:')), FILES: memblobs(), ADMIN_EMAILS: 'boss@example.com' });
const req = (path: string, o: { method?: string; body?: unknown; cookie?: string; raw?: Uint8Array<ArrayBuffer> } = {}) =>
  new Request(`${ORIGIN}/api/${path}`, {
    method: o.method ?? (o.body !== undefined || o.raw ? 'POST' : 'GET'),
    headers: { origin: ORIGIN, 'content-type': o.raw ? 'application/pdf' : 'application/json', ...(o.cookie ? { cookie: o.cookie } : {}) },
    body: o.raw ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
  });

async function sign_in(e: AuthEnv, email = 'a@example.com'): Promise<string> {
  const start = await auth(req('auth/start', { body: { email } }), e, 'start', { limiter: null, dev: true }, {});
  const { dev_code } = (await start.json()) as { dev_code: string };
  const v = await auth(req('auth/verify', { body: { email, code: dev_code } }), e, 'verify', { limiter: null }, {});
  expect(v.status).toBe(200);
  return v.headers.get('set-cookie')!.split(';')[0];
}

describe('accounts', () => {
  it('normalises addresses', () => {
    expect(normal_email(' A@Example.COM ')).toBe('a@example.com');
    expect(normal_email('nope')).toBe(null);
  });

  it('signs in with the emailed code, once, and knows the session', async () => {
    const e = env();
    const sent: string[] = [];
    const deps = { limiter: null, send: async (_: AuthEnv, m: { text: string }) => void sent.push(m.text) };
    const live = { ...e, RESEND_API_KEY: 'k', MAIL_FROM: 'Mathnim <x@example.com>' };
    const r = await auth(req('auth/start', { body: { email: 'boss@example.com', lang: 'zh' } }), live, 'start', deps, {});
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true }); // the code is mailed, not returned
    const code = /(\d{6})/.exec(sent[0])![1];
    expect((await auth(req('auth/verify', { body: { email: 'boss@example.com', code: code === '000000' ? '111111' : '000000' } }), live, 'verify', deps, {})).status).toBe(400);
    const ok = await auth(req('auth/verify', { body: { email: 'boss@example.com', code } }), live, 'verify', deps, {});
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get('set-cookie')!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(((await ok.json()) as { user: { admin: boolean } }).user.admin).toBe(true);
    // the code is used up
    expect((await auth(req('auth/verify', { body: { email: 'boss@example.com', code } }), live, 'verify', deps, {})).status).toBe(400);
    const me = await auth(req('auth/me', { cookie: cookie.split(';')[0] }), live, 'me', deps, {});
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe('boss@example.com');
    await auth(req('auth/logout', { body: {}, cookie: cookie.split(';')[0] }), live, 'logout', deps, {});
    const after = await auth(req('auth/me', { cookie: cookie.split(';')[0] }), live, 'me', deps, {});
    expect(((await after.json()) as { user: unknown }).user).toBe(null);
  });

  it('refuses without mail in production, and rate-limits re-sends', async () => {
    const e = env();
    expect((await auth(req('auth/start', { body: { email: 'a@example.com' } }), e, 'start', { limiter: null }, {})).status).toBe(503);
    await auth(req('auth/start', { body: { email: 'a@example.com' } }), e, 'start', { limiter: null, dev: true }, {});
    expect((await auth(req('auth/start', { body: { email: 'a@example.com' } }), e, 'start', { limiter: null, dev: true }, {})).status).toBe(429);
  });

  it('locks a code after five wrong tries', async () => {
    const e = env();
    const r = await auth(req('auth/start', { body: { email: 'a@example.com' } }), e, 'start', { limiter: null, dev: true }, {});
    const { dev_code } = (await r.json()) as { dev_code: string };
    const wrong = dev_code === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) await auth(req('auth/verify', { body: { email: 'a@example.com', code: wrong } }), e, 'verify', { limiter: null }, {});
    expect((await auth(req('auth/verify', { body: { email: 'a@example.com', code: dev_code } }), e, 'verify', { limiter: null }, {})).status).toBe(400);
  });
});

describe('progress sync', () => {
  it('keeps the newer value of each record and never the settings', async () => {
    const e = env();
    const cookie = await sign_in(e);
    const put = (items: unknown[]) => state(req('me/state', { method: 'PUT', body: { items }, cookie }), e);
    await put([{ key: 'mathnim.learner', value: 'v2', t: 200 }, { key: 'mathnim.settings', value: 'secret', t: 1 }, { key: 'other', value: 'x', t: 1 }]);
    await put([{ key: 'mathnim.learner', value: 'v1', t: 100 }]);
    const got = (await (await state(req('me/state', { cookie }), e)).json()) as { items: Record<string, { value: string }> };
    expect(Object.keys(got.items)).toEqual(['mathnim.learner']);
    expect(got.items['mathnim.learner'].value).toBe('v2');
    expect((await state(req('me/state'), e)).status).toBe(401);
  });
});

// ---------------------------------------------------------------- making a course
const PDF = new TextEncoder().encode('%PDF-1.4 test');
const lesson_json = (skills: string[], n = 1) => ({
  title: `Lesson ${n}`,
  description: 'What the learner will understand.',
  minutes: 20,
  skills: skills.map((id) => ({ id, name: id })),
  misconceptions: [{ id: 'm1', description: 'A wrong belief.' }],
  steps: [
    { kind: 'checkpoint', id: 'guess', title: 'Guess', skill: skills[0], purpose: 'predict', prompt: 'What happens?', auto_advance: true, question: { type: 'choice', options: [{ id: 'a', label: 'This', correct: true }, { id: 'b', label: 'That', feedback: 'No.', misconception: 'm1' }] } },
    { kind: 'read', id: 'why', title: 'Why', blocks: [{ type: 'p', text: 'Because $x^2$ grows.' }, { type: 'svg', svg: '<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>', alt: 'a square' }] },
    { kind: 'derive', id: 'calc', title: 'Calc', lines: [{ tex: 'a=b' }, { tex: 'b=c', why: 'since' }] },
    { kind: 'checkpoint', id: 'num', title: 'Number', skill: skills[skills.length - 1], purpose: 'check', prompt: 'How many?', question: { type: 'number', answer: 4, tolerance: 0 }, explain: '2+2.' },
  ],
});

/** A model that answers each kind of step; records what it was asked. */
function scripted(o: { bad_first_lesson?: boolean; revise_once?: boolean } = {}): StudioModel & { asked: StudioRequest[] } {
  const asked: StudioRequest[] = [];
  let reviews = 0;
  return {
    name: 'script',
    asked,
    async run(r) {
      asked.push(r);
      const kind = r.step.split('.')[0];
      if (kind === 'map') return JSON.stringify({ title: 'Deck', summary: 'About things.', points: [{ key: 'alpha', name: 'Alpha', pages: '1-3', gist: 'g', weight: 'core' }, { key: 'beta', name: 'Beta', pages: '4', gist: 'g', weight: 'minor' }] });
      if (kind === 'exam') return '```json\n' + JSON.stringify({ questions: [{ text: 'Q one?', answer: 'A', official: true, points: ['Alpha'] }] }) + '\n```';
      if (kind === 'plan') {
        const ids = [...r.prompt.matchAll(/^- ([a-z0-9]+\.alpha) /gm)].map((m) => m[1]);
        const decks = [...r.prompt.matchAll(/file "([a-z0-9]+)"/g)].map((m) => m[1]);
        return JSON.stringify({ course: { title: 'Networks', summary: 's', audience: 'a', outcomes: ['o1', 'o2', 'o3'] }, lessons: ids.map((p, i) => ({ id: `l${i + 1}`, title: `L${i + 1}`, question: 'why?', decks: [decks[i]], points: [p], arc: ['a', 'b'], exam: ['q1'], minutes: 20 })), practice: { title: 'Practice', exam: ['q1'], minutes: 10 } });
      }
      if (kind === 'lesson') {
        const skills = [...r.prompt.matchAll(/^(?:- |  )([a-z0-9]+\.[a-z0-9-]+)(?: \[|: )/gm)].map((m) => m[1]);
        if (o.bad_first_lesson && !r.step.endsWith('.fix') && r.step === 'lesson.l1') return JSON.stringify({ ...lesson_json(skills), steps: [] });
        return JSON.stringify(lesson_json(skills.length ? skills : ['x'], 1));
      }
      if (kind === 'review') {
        reviews++;
        const points = [...r.prompt.matchAll(/^- ([a-z0-9]+\.[a-z0-9-]+) \[/gm)].map((m) => ({ id: m[1], status: 'taught', where: 'why', note: '' }));
        return JSON.stringify({ points, issues: [], strengths: ['clear'], verdict: o.revise_once && reviews === 1 ? 'revise' : 'ok' });
      }
      throw new Error(`unexpected step ${r.step}`);
    },
  };
}

async function drive(e: AuthEnv, cookie: string, id: string, model: StudioModel) {
  for (let round = 0; round < 30; round++) {
    const d = (await (await studio(req(`studio/courses/${id}`, { cookie }), e, `courses/${id}`, { model }, {})).json()) as { next: string[] };
    if (!d.next.length) return;
    for (const k of d.next) {
      const r = await studio(req(`studio/courses/${id}/steps/${k}`, { body: {}, cookie }), e, `courses/${id}/steps/${encodeURIComponent(k)}`, { model }, {});
      const lines = (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
      expect(lines.at(-1)).toEqual({ t: 'done' });
    }
  }
  throw new Error('did not finish');
}

describe('studio', () => {
  it('turns two decks and an exam into a reviewed course, listed in the catalog', async () => {
    const e = env();
    const cookie = await sign_in(e);
    const model = scripted({ revise_once: true });
    const created = await studio(req('studio/courses', { body: { lang: 'zh' }, cookie }), e, 'courses', { model }, {});
    const { id } = (await created.json()) as { id: string };
    for (const [kind, name] of [['slides', 'Week2.pdf'], ['slides', 'Week10.pdf'], ['exam', 'mock.pdf']]) {
      const r = await studio(req(`studio/courses/${id}/files?kind=${kind}&name=${name}`, { raw: PDF, cookie }), e, `courses/${id}/files`, { model }, {});
      expect(r.status).toBe(201);
    }
    await drive(e, cookie, id, model);
    // decks are read in the lecturer's order (numeric), one lesson was revised after its review
    expect(model.asked.filter((r) => r.step.startsWith('map.')).map((r) => r.docs[0].name)).toEqual(['Week2.pdf', 'Week10.pdf']);
    expect(model.asked.some((r) => r.step === 'lesson.l1.r2' || r.step === 'lesson.l2.r2')).toBe(true);
    const d = (await (await studio(req(`studio/courses/${id}`, { cookie }), e, `courses/${id}`, { model }, {})).json()) as { coverage: { status: string; weight: string }[]; entry: { ready: boolean; lessons: { id: string }[] } };
    expect(d.entry.ready).toBe(true);
    expect(d.entry.lessons.map((l) => l.id)).toEqual([`${id}-l1`, `${id}-l2`, `${id}-practice`]);
    expect(d.coverage.filter((c) => c.weight === 'core').every((c) => c.status === 'taught')).toBe(true);
    // the owner sees it; a stranger does not until it is public
    const cat = (await (await studio(req('studio/catalog', { cookie }), e, 'catalog', { model }, {})).json()) as { courses: unknown[] };
    expect(cat.courses).toHaveLength(1);
    const anon = (await (await studio(req('studio/catalog'), e, 'catalog', { model }, {})).json()) as { courses: unknown[] };
    expect(anon.courses).toHaveLength(0);
    const lesson = await studio(req(`studio/lessons/${id}/${id}-l1`, { cookie }), e, `lessons/${id}/${id}-l1`, { model }, {});
    expect(((await lesson.json()) as { steps: unknown[] }).steps).toHaveLength(4);
    // only an admin may publish
    const pub = await studio(req(`studio/courses/${id}`, { method: 'PATCH', body: { public: true }, cookie }), e, `courses/${id}`, { model }, {});
    expect(pub.status).toBe(403);
  });

  it('asks again with the problems when a reply does not pass the checks', async () => {
    const e = env();
    const cookie = await sign_in(e);
    const model = scripted({ bad_first_lesson: true });
    const { id } = (await (await studio(req('studio/courses', { body: {}, cookie }), e, 'courses', { model }, {})).json()) as { id: string };
    await studio(req(`studio/courses/${id}/files?kind=slides&name=a.pdf`, { raw: PDF, cookie }), e, `courses/${id}/files`, { model }, {});
    await drive(e, cookie, id, model);
    const fix = model.asked.find((r) => r.step === 'lesson.l1.fix')!;
    expect(fix.prompt).toMatch(/did not pass these checks[\s\S]*at least 3 steps/);
  });

  it('refuses files that are not PDFs, and new files send the plan back', async () => {
    const e = env();
    const cookie = await sign_in(e);
    const model = scripted();
    const { id } = (await (await studio(req('studio/courses', { body: {}, cookie }), e, 'courses', { model }, {})).json()) as { id: string };
    const bad = await studio(req(`studio/courses/${id}/files?kind=slides&name=a.pptx`, { raw: new TextEncoder().encode('PK..'), cookie }), e, `courses/${id}/files`, { model }, {});
    expect(bad.status).toBe(415);
    await studio(req(`studio/courses/${id}/files?kind=slides&name=a.pdf`, { raw: PDF, cookie }), e, `courses/${id}/files`, { model }, {});
    await drive(e, cookie, id, model);
    const after = await studio(req(`studio/courses/${id}/files?kind=slides&name=b.pdf`, { raw: PDF, cookie }), e, `courses/${id}/files`, { model }, {});
    const d = (await after.json()) as { next: string[]; plan: unknown };
    expect(d.plan).toBe(null);
    expect(d.next).toHaveLength(1); // the new deck's map; the old map is kept
  });
});

describe('plan checks', () => {
  it('refuses a plan that splits a deck across lessons', async () => {
    const { check_plan } = await import('../server/studio/pipeline');
    const f = { id: 'd1', course_id: 'c', kind: 'slides' as const, name: 'a.pdf', type: 'application/pdf', size: 1, blob: 'b', remote: null, created: 0 };
    const map = { file: 'd1', name: 'a.pdf', title: 'A', summary: '', points: [{ id: 'd1.x', name: 'X', pages: '1', gist: '', weight: 'core' as const }, { id: 'd1.y', name: 'Y', pages: '2', gist: '', weight: 'core' as const }] };
    const s = { course: { id: 'c', owner: 'u', lang: 'zh' as const, title: '', public: 0, created: 0, updated: 0 }, files: [f], parts: new Map<string, unknown>([['map.d1', map]]) };
    const plan = (lessons: unknown[]) => ({ course: { title: 'T', summary: '', audience: '', outcomes: [] }, units: [{ title: 'U', lessons: ['l1', 'l2'] }], lessons, practice: null });
    const l = (id: string, points: string[]) => ({ id, title: id, question: '?', decks: ['d1'], points, arc: ['a'], minutes: 20 });
    expect(check_plan(plan([l('l1', ['d1.x']), l('l2', ['d1.y'])]), s).errors.join()).toMatch(/split across lessons/);
    expect(check_plan(plan([l('l1', ['d1.x', 'd1.y'])]), s).errors).toEqual([]);
  });
});

describe('lesson format', () => {
  it('accepts a good lesson and names what is wrong with a bad one', () => {
    expect(check_lesson(lesson_json(['p1']), { id: 'x', skills: ['p1'] }).errors).toEqual([]);
    const bad = lesson_json(['p1']);
    (bad.steps[1] as { blocks: unknown[] }).blocks.push({ type: 'p', text: 'costs $5' }, { type: 'svg', svg: '<svg viewBox="0 0 1 1"><script>x</script></svg>', alt: 'x' });
    (bad.steps[3] as { skill: string }).skill = 'nope';
    const errors = check_lesson(bad, { id: 'x', skills: ['p1'] }).errors.join('\n');
    expect(errors).toMatch(/unpaired \$/);
    expect(errors).toMatch(/scripts/);
    expect(errors).toMatch(/skill: one of/);
  });
});
