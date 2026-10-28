// /api/studio/*: courses made from uploaded slides and practice exams.
//   GET    courses                      my courses
//   POST   courses {lang}               a new, empty course -> {id}
//   GET    courses/<id>                 files, plan, progress, coverage, the steps that can run
//   PATCH  courses/<id> {title?, lang?, public?}   rename; the language (before anything is made); publish (admins)
//   DELETE courses/<id>
//   POST   courses/<id>/files?kind=slides|exam&name=<file name>   body: the PDF (or plain text)
//   PATCH  courses/<id>/files/<file> {kind}   slides <-> practice exam (what was made from it is made again)
//   DELETE courses/<id>/files/<file>
//   GET    courses/<id>/export          the course as static files for a demo (tools/studio_export.mjs): {entry, lessons}
//   POST   courses/<id>/steps/<step>    run one step; answers NDJSON lines while it works:
//          {t:'progress', chars} ... then {t:'done'} | {t:'pending', prompt} | {t:'error', message}
//   GET    catalog                      the courses this visitor may take (own, and public finished ones)
//   GET    lessons/<course>/<lesson>    one finished lesson (Mathnim lesson data)
import { session_user, type AuthEnv, type User } from '../auth';
import { new_id, with_schema, type SqlDb } from '../db';
import { error, json, origin_ok, type Note } from '../http';
import { ModelMissing, ReplyPending, type StudioModel } from './model';
import { catalog_entry, coverage, drop_derived, exams_of, lesson_final, load_state, next_steps, run_step, slides_of, StepFailed, type CourseRow, type FileRow, type LessonPart, type State } from './pipeline';

export const MAX_FILE = 32 * 1024 * 1024;
const MAX_FILES = 60;
const MAX_COURSES = 30;

export interface StudioDeps {
  model: StudioModel;
  /** Where a blob is on disk (dev), passed to models that read files themselves. */
  blob_path?: (key: string) => string;
}

const can_see = (s: State, u: User | null) => s.course.owner === u?.id || !!s.course.public;
const can_edit = (s: State, u: User | null) => !!u && s.course.owner === u.id;

export async function studio(request: Request, env: AuthEnv, path: string, deps: StudioDeps, note: Note): Promise<Response> {
  if (!env.DB || !env.FILES) return error(503, 'Course uploads are not configured on this server.');
  if (request.method !== 'GET' && !origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathnim site.');
  const db = await with_schema(env.DB);
  const user = await session_user(request, env);
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const m = request.method;

  if (parts[0] === 'catalog' && m === 'GET') return catalog(db, user);
  if (parts[0] === 'lessons' && parts.length === 3 && m === 'GET') {
    const s = await load_state(db, parts[1]);
    if (!s || !can_see(s, user)) return error(404, 'No such course.');
    const lid = parts[2].startsWith(`${s.course.id}-`) ? parts[2].slice(s.course.id.length + 1) : parts[2];
    if (!lesson_final(s, lid)) return error(404, 'No such lesson.');
    return json(200, (s.parts.get(`lesson.${lid}`) as LessonPart).lesson);
  }
  if (parts[0] !== 'courses') return error(404, 'No such route.');
  if (!user) return error(401, 'Sign in first.');

  if (parts.length === 1) {
    if (m === 'GET') {
      const { results } = await db.prepare('SELECT * FROM studio_courses WHERE owner = ? ORDER BY updated DESC').bind(user.id).all<CourseRow>();
      const out = [];
      for (const c of results) {
        const s = (await load_state(db, c.id))!;
        out.push(summary(s));
      }
      return json(200, { courses: out });
    }
    if (m === 'POST') {
      const n = (await db.prepare('SELECT COUNT(*) AS n FROM studio_courses WHERE owner = ?').bind(user.id).first<{ n: number }>())?.n ?? 0;
      if (n >= MAX_COURSES) return error(429, `At most ${MAX_COURSES} courses per account.`);
      const d = (await request.json().catch(() => ({}))) as { lang?: string; title?: string };
      const lang = d.lang === 'en' ? 'en' : 'zh';
      const title = typeof d.title === 'string' ? d.title.trim().slice(0, 120) : '';
      const id = new_id(10), now = Date.now();
      await db.prepare('INSERT INTO studio_courses (id, owner, lang, title, named, public, created, updated) VALUES (?, ?, ?, ?, ?, 0, ?, ?)').bind(id, user.id, lang, title, title ? 1 : 0, now, now).run();
      return json(201, { id });
    }
    return error(405, 'Use GET or POST.');
  }

  const s = await load_state(db, parts[1]);
  if (!s || !can_edit(s, user)) return error(404, 'No such course.');
  const rest = parts.slice(2);
  if (!rest.length) {
    if (m === 'GET') return json(200, detail(s, user));
    if (m === 'PATCH') {
      const d = (await request.json().catch(() => ({}))) as { public?: unknown; title?: unknown; lang?: unknown };
      if (typeof d.title === 'string') {
        const title = d.title.trim().slice(0, 120);
        await db.prepare('UPDATE studio_courses SET title = ?, named = 1 WHERE id = ?').bind(title, s.course.id).run();
        s.course.title = title;
      }
      // the language is chosen before anything is made (everything is written in it)
      if ((d.lang === 'zh' || d.lang === 'en') && !s.parts.size) {
        await db.prepare('UPDATE studio_courses SET lang = ? WHERE id = ?').bind(d.lang, s.course.id).run();
        s.course.lang = d.lang;
      }
      if (typeof d.public === 'boolean') {
        if (!user.admin) return error(403, 'Only an admin can publish a course to everyone.');
        await db.prepare('UPDATE studio_courses SET public = ? WHERE id = ?').bind(d.public ? 1 : 0, s.course.id).run();
        s.course.public = d.public ? 1 : 0;
      }
      return json(200, detail(s, user));
    }
    if (m === 'DELETE') {
      for (const f of s.files) await env.FILES.delete(f.blob);
      for (const t of ['studio_parts', 'studio_files']) await db.prepare(`DELETE FROM ${t} WHERE course_id = ?`).bind(s.course.id).run();
      await db.prepare('DELETE FROM studio_courses WHERE id = ?').bind(s.course.id).run();
      return json(200, { ok: true });
    }
    return error(405, 'Use GET, PATCH or DELETE.');
  }
  if (rest[0] === 'files' && rest.length === 1 && m === 'POST') return upload(request, env, db, s, user);
  if (rest[0] === 'files' && rest.length === 2 && m === 'PATCH') {
    const f = s.files.find((x) => x.id === rest[1]);
    if (!f) return error(404, 'No such file.');
    const kind = ((await request.json().catch(() => ({}))) as { kind?: unknown }).kind;
    if (kind !== 'slides' && kind !== 'exam') return error(400, 'kind: slides or exam.');
    if (kind !== f.kind) {
      await db.prepare('UPDATE studio_files SET kind = ? WHERE id = ?').bind(kind, f.id).run();
      await drop_derived(db, s.course.id, { exam: true, file: f.id });
    }
    return json(200, detail((await load_state(db, s.course.id))!, user));
  }
  if (rest[0] === 'files' && rest.length === 2 && m === 'DELETE') {
    const f = s.files.find((x) => x.id === rest[1]);
    if (!f) return error(404, 'No such file.');
    await env.FILES.delete(f.blob);
    await db.prepare('DELETE FROM studio_files WHERE id = ?').bind(f.id).run();
    await drop_derived(db, s.course.id, { exam: f.kind === 'exam', file: f.id });
    return json(200, detail((await load_state(db, s.course.id))!, user));
  }
  if (rest[0] === 'steps' && rest.length === 2 && m === 'POST') return step(db, env, s, rest[1], deps, note, request.signal);
  if (rest[0] === 'export' && m === 'GET') {
    const entry = catalog_entry(s, null, { all: true });
    if (!entry) return error(409, 'The course has no plan yet.');
    const lessons = Object.fromEntries([...s.parts].filter(([k]) => k.startsWith('lesson.')).map(([, v]) => [(v as LessonPart).lesson.id, (v as LessonPart).lesson]));
    return json(200, { entry: { ...entry, mine: false, public: true, demo: true }, lessons });
  }
  return error(404, 'No such route.');
}

async function upload(request: Request, env: AuthEnv, db: SqlDb, s: State, user: User): Promise<Response> {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') === 'exam' ? 'exam' : 'slides';
  const name = (url.searchParams.get('name') ?? '').trim().slice(0, 200) || 'file.pdf';
  if (s.files.length >= MAX_FILES) return error(429, `At most ${MAX_FILES} files per course.`);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FILE) return error(413, 'Each file can be at most 32 MB.');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_FILE) return error(413, 'Each file can be at most 32 MB.');
  if (!buf.byteLength) return error(400, 'The file is empty.');
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(5, buf.byteLength)));
  const type = head === '%PDF-' ? 'application/pdf' : /\.(txt|md)$/i.test(name) ? 'text/plain' : '';
  if (!type) return error(415, 'Upload a PDF (export slides and Word files as PDF first).');
  const id = new_id(6);
  const blob = `studio/${s.course.id}/${id}.${type === 'application/pdf' ? 'pdf' : 'txt'}`; // (an extension: dev keeps blobs as files that tools open by type)
  await env.FILES!.put(blob, buf, { httpMetadata: { contentType: type } });
  const row: FileRow = { id, course_id: s.course.id, kind, name, type, size: buf.byteLength, blob, remote: null, created: Date.now() };
  await db.prepare('INSERT INTO studio_files (id, course_id, kind, name, type, size, blob, remote, created) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)').bind(id, row.course_id, kind, name, type, row.size, blob, row.created).run();
  await drop_derived(db, s.course.id, { exam: kind === 'exam' });
  return json(201, detail((await load_state(db, s.course.id))!, user));
}

function step(db: SqlDb, env: AuthEnv, s: State, key: string, deps: StudioDeps, note: Note, signal: AbortSignal): Response {
  if (!next_steps(s).includes(key)) return error(409, 'This step cannot run now.');
  const enc = new TextEncoder();
  let chars = 0, last = 0;
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      const line = (o: unknown) => c.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      // a line now and then keeps the connection open while the model writes
      const beat = setInterval(() => line({ t: 'progress', chars }), 5000);
      try {
        await run_step(db, s, key, {
          model: deps.model,
          files: env.FILES!,
          blob_path: deps.blob_path,
          signal,
          on_progress: (n) => {
            chars = n;
            if (Date.now() - last > 1500) {
              last = Date.now();
              line({ t: 'progress', chars });
            }
          },
        });
        line({ t: 'done' });
      } catch (e) {
        if (e instanceof ReplyPending) line({ t: 'pending', prompt: e.prompt });
        else {
          const known = e instanceof StepFailed || e instanceof ModelMissing;
          note.error = String((e as Error)?.message ?? e).slice(0, 200);
          line({ t: 'error', message: known ? (e as Error).message : 'The step failed. Try again.', model: e instanceof ModelMissing ? 'missing' : undefined });
        }
      } finally {
        clearInterval(beat);
        c.close();
      }
    },
  });
  note.model = deps.model.name;
  return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}

function summary(s: State) {
  const plan = s.parts.get('plan') as { lessons: { id: string }[] } | undefined;
  return {
    id: s.course.id,
    title: s.course.title,
    lang: s.course.lang,
    public: !!s.course.public,
    updated: s.course.updated,
    files: s.files.length,
    lessons: plan?.lessons.length ?? 0,
    done: plan ? plan.lessons.filter((l) => lesson_final(s, l.id)).length : 0,
    next: next_steps(s).length,
  };
}

function detail(s: State, user: User) {
  const plan = s.parts.get('plan') as import('./prompts').Plan | undefined;
  const steps: Record<string, unknown> = {};
  for (const [k, v] of s.parts) {
    if (k.startsWith('lesson.')) steps[k] = { rev: (v as LessonPart).rev, title: (v as LessonPart).lesson.title };
    else if (k.startsWith('review.')) steps[k] = { rev: (v as { rev: number }).rev, verdict: (v as { verdict: string }).verdict, issues: (v as { issues: unknown[] }).issues.length };
    else steps[k] = true;
  }
  return {
    course: { id: s.course.id, title: s.course.title, lang: s.course.lang, public: !!s.course.public },
    admin: user.admin,
    files: [...slides_of(s), ...exams_of(s)].map((f) => ({ id: f.id, kind: f.kind, name: f.name, size: f.size })),
    plan: plan
      ? {
          course: plan.course,
          units: plan.units,
          lessons: plan.lessons.map((l) => ({ id: l.id, title: l.title, question: l.question, decks: l.decks, minutes: l.minutes, final: lesson_final(s, l.id) })),
          practice: plan.practice ? { title: plan.practice.title, final: lesson_final(s, 'practice') } : null,
        }
      : null,
    steps,
    next: next_steps(s),
    coverage: coverage(s),
    entry: catalog_entry(s, user.id),
  };
}

async function catalog(db: SqlDb, user: User | null): Promise<Response> {
  const { results } = await db.prepare('SELECT id FROM studio_courses WHERE owner = ? OR public = 1 ORDER BY updated DESC LIMIT 100').bind(user?.id ?? '').all<{ id: string }>();
  const out = [];
  for (const r of results) {
    const s = await load_state(db, r.id);
    if (!s) continue;
    const e = catalog_entry(s, user?.id ?? null);
    // others see a public course once it is finished; its owner sees each lesson as soon as it is
    if (e && e.lessons.length && (e.mine || e.ready)) out.push(e);
  }
  return json(200, { courses: out });
}
