// /api/admin/*: the data centre's numbers (pages/admin.ts). Everything is read with SQL from what the site already
// keeps: page views (hits) and what the routes cost (usage, both server/stats.ts), accounts, signed-in learners'
// events (server/events.ts), uploaded courses, and the answers' feedback (KV). Ranges are the site's local days
// (STATS_TZ): ?days=1|7|30|90|365, 0 for everything. Who sees what (NEED): the summaries, with no person in them,
// to everyone while DATA_CENTRE is "public" (else to teachers and admins); each learner, their record and their
// words to teachers and admins; exports, uploads and naming teachers to admins. Every answer says the viewer's
// `level` (1 summaries, 2 teacher, 3 admin).
//   GET overview              headline numbers for the range and the one before it, and each day
//   GET traffic               pages, sources, countries, devices, languages, hours of the day
//   GET learning              per course and lesson; the hardest questions; misconceptions
//   GET lesson?id=            one lesson step by step: who reached it, time, answers, where learners stopped
//   GET questions?lesson=&q=&before=   what learners asked the tutor, newest first
//   GET ai                    the tutor and the other paid routes: calls, tokens, cost, errors
//   GET feedback?cursor=      "did this answer help?"
//   GET users?q=&offset=      accounts with what each has done; GET user?id= one learner's record
//   GET uploads               courses made from uploaded slides
//   GET export?kind=events|hits|usage|users   the rows as CSV
//   POST role {id, role: 'teacher' | 'learner'}   name a teacher (an admin is one by ADMIN_EMAILS)
import { data_public, role_of, session_user } from './auth';
import { with_schema, type SqlDb } from './db';
import { list_feedback, type FeedbackEnv } from './feedback';
import { error, json, origin_ok, read_text } from './http';
import { DEFAULT_TZ, day_start, days_before, local_day, tz_offset, type StatsEnv } from './stats';

export type AdminEnv = StatsEnv & FeedbackEnv;
type Row = Record<string, string | number | null>;

/** A step's time counts at most half an hour (a tab left open is not someone reading). */
const STAY = 'MIN(duration_ms, 1800000)';
const MAX_DAYS = 3660;

export interface Range {
  days: number;
  tz: string;
  /** Local days, inclusive. */
  from: string;
  to: string;
  /** The same range in ms, [since, until). */
  since: number;
  until: number;
  /** The range before it, for comparison (none for "everything"). */
  prev?: { from: string; to: string; since: number; until: number };
  /** Added to a time in ms to get local time (the offset now; old days near a clock change are off by an hour). */
  off: number;
}
export function range_of(url: URL, tz: string, now = Date.now()): Range {
  const n = Math.floor(Number(url.searchParams.get('days') ?? 30));
  const days = Number.isFinite(n) && n > 0 ? Math.min(n, MAX_DAYS) : 0;
  const to = local_day(now, tz);
  const until = day_start(days_before(to, -1), tz);
  const off = tz_offset(now, tz);
  if (!days) return { days, tz, from: '2000-01-01', to, since: 0, until, off };
  const from = days_before(to, days - 1);
  const pfrom = days_before(from, days), pto = days_before(from, 1);
  return { days, tz, from, to, since: day_start(from, tz), until, off, prev: { from: pfrom, to: pto, since: day_start(pfrom, tz), until: day_start(from, tz) } };
}

const all = async (db: SqlDb, sql: string, ...v: unknown[]) => (await db.prepare(sql).bind(...v).all<Row>()).results;
const first = async (db: SqlDb, sql: string, ...v: unknown[]) => (await db.prepare(sql).bind(...v).first<Row>()) ?? {};
/** The local day of a time column, in SQL. */
const day_sql = (col: string) => `date((${col} + ?) / 1000, 'unixepoch')`;

/** The level each section needs: 1 the summaries, 2 a teacher (each learner and their words), 3 an admin. */
export const NEED: Record<string, number> = { overview: 1, traffic: 1, learning: 1, lesson: 1, ai: 1, questions: 2, feedback: 2, users: 2, user: 2, uploads: 3, export: 3, role: 3 };

export async function admin(request: Request, env: AdminEnv, path: string): Promise<Response> {
  if (!env.DB) return error(503, 'Accounts are not configured on this server.');
  const need = NEED[path];
  if (!need) return error(404, 'Unknown section.');
  const user = await session_user(request, env);
  const level = user?.role === 'admin' ? 3 : user?.role === 'teacher' ? 2 : data_public(env) ? 1 : 0;
  if (level < need) return level || user ? error(403, need === 3 ? 'Only an admin can see this.' : 'Only teachers and admins can see this.') : error(401, 'Sign in first.');
  const db = await with_schema(env.DB);
  if (path === 'role') return name_role(request, env, db);
  if (request.method !== 'GET') return error(405, 'Use GET.', { allow: 'GET' });
  const url = new URL(request.url);
  const tz = env.STATS_TZ || DEFAULT_TZ;
  const r = range_of(url, tz);
  const q = (k: string) => url.searchParams.get(k) ?? '';
  const meta = { range: { days: r.days, from: r.from, to: r.to, tz }, now: Date.now(), level };
  switch (path) {
    case 'overview':
      return json(200, { ...meta, ...(await overview(db, r)) });
    case 'traffic':
      return json(200, { ...meta, ...(await traffic(db, r)) });
    case 'learning':
      return json(200, { ...meta, ...(await learning(db, r)) });
    case 'lesson':
      // (what learners asked, and who, is a teacher's to read)
      return q('id') ? json(200, { ...meta, ...(await lesson(db, r, q('id'), level >= 2)) }) : error(400, 'id: a lesson id.');
    case 'questions':
      return json(200, { ...meta, items: await questions(db, r, { lesson: q('lesson'), text: q('q'), before: Number(q('before')) || 0 }) });
    case 'ai':
      return json(200, { ...meta, ...(await ai_usage(db, r)) });
    case 'feedback': {
      if (!env.FEEDBACK) return json(200, { ...meta, items: [], off: true });
      return json(200, { ...meta, ...(await list_feedback(env.FEEDBACK, 50, q('cursor') || undefined)) });
    }
    case 'users':
      return json(200, { ...meta, ...(await users(db, env, q('q'), Math.max(0, Number(q('offset')) || 0))) });
    case 'user': {
      const found = await one_user(db, q('id'), Number(q('before')) || 0);
      return found ? json(200, { ...meta, ...found }) : error(404, 'No such user.');
    }
    case 'uploads':
      return json(200, { ...meta, items: await uploads(db) });
    case 'export':
      return csv_export(db, r, q('kind'));
    default:
      return error(404, 'Unknown section.');
  }
}

// ---------------------------------------------------------------- overview
async function totals(db: SqlDb, from: string, to: string, since: number, until: number) {
  const [h, e, l, u, a] = await Promise.all([
    first(db, 'SELECT COUNT(DISTINCT day || tag) AS visitors, COUNT(*) AS views FROM hits WHERE day BETWEEN ? AND ?', from, to),
    first(
      db,
      `SELECT SUM(verb = 'asked') AS asked, SUM(verb = 'answered') AS answered, SUM(verb = 'answered' AND correct = 1) AS correct,
       COUNT(DISTINCT CASE WHEN verb = 'completed' THEN user_id || ' ' || lesson END) AS completed, SUM(CASE WHEN verb = 'left' THEN ${STAY} ELSE 0 END) AS time_ms
       FROM events WHERE t >= ? AND t < ?`,
      since, until,
    ),
    first(db, 'SELECT COUNT(DISTINCT user_id) AS learners FROM events WHERE t >= ? AND t < ?', since, until),
    first(db, 'SELECT COUNT(*) AS signups FROM users WHERE created >= ? AND created < ?', since, until),
    first(db, "SELECT SUM(CASE WHEN route = 'ai' THEN calls ELSE 0 END) AS ai_calls, SUM(cost) AS cost FROM usage WHERE day BETWEEN ? AND ?", from, to),
  ]);
  return { ...h, ...e, ...l, ...u, ...a };
}
async function overview(db: SqlDb, r: Range) {
  const [now, before, all_users, hits, ev, su, us, firsts] = await Promise.all([
    totals(db, r.from, r.to, r.since, r.until),
    r.prev ? totals(db, r.prev.from, r.prev.to, r.prev.since, r.prev.until) : Promise.resolve(null),
    first(db, 'SELECT COUNT(*) AS users FROM users'),
    all(db, 'SELECT day, COUNT(DISTINCT tag) AS visitors, COUNT(*) AS views FROM hits WHERE day BETWEEN ? AND ? GROUP BY day', r.from, r.to),
    all(
      db,
      `SELECT ${day_sql('t')} AS day, COUNT(DISTINCT user_id) AS learners, SUM(verb = 'asked') AS asked, SUM(verb = 'answered') AS answered,
       SUM(verb = 'answered' AND correct = 1) AS correct FROM events WHERE t >= ? AND t < ? GROUP BY day`,
      r.off, r.since, r.until,
    ),
    all(db, `SELECT ${day_sql('created')} AS day, COUNT(*) AS signups FROM users WHERE created >= ? AND created < ? GROUP BY day`, r.off, r.since, r.until),
    all(db, "SELECT day, SUM(CASE WHEN route = 'ai' THEN calls ELSE 0 END) AS ai_calls, SUM(cost) AS cost FROM usage WHERE day BETWEEN ? AND ? GROUP BY day", r.from, r.to),
    // where "everything" starts: the first day anything was kept
    first(
      db,
      `SELECT MIN(d) AS day FROM (SELECT MIN(day) AS d FROM hits UNION ALL SELECT MIN(day) FROM usage UNION ALL SELECT ${day_sql('MIN(t)')} FROM events UNION ALL SELECT ${day_sql('MIN(created)')} FROM users)`,
      r.off, r.off,
    ),
  ]);
  const by = new Map<string, Row>();
  for (const list of [hits, ev, su, us]) for (const row of list) by.set(String(row.day), { ...by.get(String(row.day)), ...row });
  const from = r.days ? r.from : String(firsts.day ?? r.to);
  return { totals: { ...now, users: all_users.users }, previous: before, daily: fill_days(from, r.to, by) };
}
/** One row per day of the range, empty days included (at most ten years). */
function fill_days(from: string, to: string, by: Map<string, Row>): Row[] {
  const out: Row[] = [];
  for (let d = from, i = 0; d <= to && i < MAX_DAYS; d = days_before(d, -1), i++) out.push({ ...by.get(d), day: d });
  return out;
}

// ---------------------------------------------------------------- traffic
async function traffic(db: SqlDb, r: Range) {
  const where = 'FROM hits WHERE day BETWEEN ? AND ?';
  const who = 'COUNT(DISTINCT day || tag) AS visitors';
  const [daily, pages, entries, refs, countries, devices, langs, members, hours] = await Promise.all([
    all(db, `SELECT day, COUNT(DISTINCT tag) AS visitors, COUNT(*) AS views ${where} GROUP BY day`, r.from, r.to),
    all(db, `SELECT path, COUNT(*) AS views, ${who} ${where} GROUP BY path ORDER BY visitors DESC, views DESC LIMIT 300`, r.from, r.to),
    // the first page of a visit (it carries where the visit came from)
    all(db, `SELECT path, ${who} ${where} AND ref IS NOT NULL GROUP BY path ORDER BY visitors DESC LIMIT 50`, r.from, r.to),
    all(db, `SELECT ref, ${who} ${where} AND ref IS NOT NULL GROUP BY ref ORDER BY visitors DESC LIMIT 50`, r.from, r.to),
    all(db, `SELECT country, ${who} ${where} GROUP BY country ORDER BY visitors DESC LIMIT 60`, r.from, r.to),
    all(db, `SELECT device, ${who} ${where} GROUP BY device ORDER BY visitors DESC`, r.from, r.to),
    all(db, `SELECT lang, ${who} ${where} GROUP BY lang ORDER BY visitors DESC`, r.from, r.to),
    all(db, `SELECT member, ${who} ${where} GROUP BY member`, r.from, r.to),
    all(db, `SELECT CAST(((t + ?) / 3600000) % 24 AS INTEGER) AS hour, COUNT(*) AS views ${where} GROUP BY hour`, r.off, r.from, r.to),
  ]);
  const by = new Map(daily.map((d) => [String(d.day), d]));
  const from = r.days ? r.from : String(daily.reduce<string | null>((m, d) => (m === null || String(d.day) < m ? String(d.day) : m), null) ?? r.to);
  return { daily: fill_days(from, r.to, by), pages, entries, refs, countries, devices, langs, members, hours };
}

// ---------------------------------------------------------------- learning
const LESSON_COLS = `COUNT(DISTINCT user_id) AS learners, COUNT(DISTINCT CASE WHEN verb = 'completed' THEN user_id END) AS completed,
  SUM(verb = 'answered') AS answered, SUM(verb = 'answered' AND correct = 1) AS correct, SUM(verb = 'revealed') AS revealed,
  SUM(verb = 'asked') AS asked, SUM(CASE WHEN verb = 'left' THEN ${STAY} ELSE 0 END) AS time_ms, MAX(t) AS last_t`;
/** Each learner's first answer to each question (SQLite keeps the other columns of the row with the smallest t). */
const first_answers = (and = '') => `SELECT user_id, lesson, step, correct, MIN(t) FROM events WHERE verb = 'answered' AND t >= ? AND t < ?${and} GROUP BY user_id, lesson, step`;

async function learning(db: SqlDb, r: Range) {
  const span = 't >= ? AND t < ?';
  const [courses, lessons, hardest, misconceptions, views, sections] = await Promise.all([
    all(db, `SELECT course, ${LESSON_COLS} FROM events WHERE ${span} AND lesson != '' GROUP BY course ORDER BY learners DESC`, r.since, r.until),
    all(db, `SELECT course, lesson, ${LESSON_COLS} FROM events WHERE ${span} AND lesson != '' GROUP BY course, lesson`, r.since, r.until),
    all(
      db,
      `SELECT lesson, step, COUNT(*) AS learners, SUM(correct) AS first_right FROM (${first_answers()}) GROUP BY lesson, step
       ORDER BY 1.0 * SUM(correct) / COUNT(*) ASC, learners DESC LIMIT 40`,
      r.since, r.until,
    ),
    all(
      db,
      `SELECT lesson, step, misconception, COUNT(*) AS n, COUNT(DISTINCT user_id) AS learners FROM events
       WHERE verb = 'answered' AND misconception IS NOT NULL AND ${span} GROUP BY lesson, step, misconception ORDER BY learners DESC, n DESC LIMIT 60`,
      r.since, r.until,
    ),
    // everyone who opened a page of the course, signed in or not
    all(db, 'SELECT path, COUNT(DISTINCT day || tag) AS visitors FROM hits WHERE day BETWEEN ? AND ? GROUP BY path', r.from, r.to),
    // ... and per course: the first part of the address (/<course-slug>/...)
    all(
      db,
      `SELECT CASE WHEN instr(substr(path, 2), '/') > 0 THEN substr(path, 2, instr(substr(path, 2), '/') - 1) ELSE substr(path, 2) END AS seg,
       COUNT(DISTINCT day || tag) AS visitors FROM hits WHERE day BETWEEN ? AND ? GROUP BY seg`,
      r.from, r.to,
    ),
  ]);
  return { courses, lessons, hardest, misconceptions, views, sections };
}

async function lesson(db: SqlDb, r: Range, id: string, words: boolean) {
  const span = 'lesson = ? AND t >= ? AND t < ?';
  const [summary, steps, first_try, stops, misconceptions, asked, views] = await Promise.all([
    first(db, `SELECT ${LESSON_COLS} FROM events WHERE ${span}`, id, r.since, r.until),
    all(
      db,
      `SELECT step, COUNT(DISTINCT CASE WHEN verb = 'viewed' THEN user_id END) AS reached, SUM(verb = 'viewed') AS views,
       SUM(CASE WHEN verb = 'left' THEN ${STAY} ELSE 0 END) AS time_ms, SUM(verb = 'left' AND duration_ms IS NOT NULL) AS stays,
       SUM(verb = 'answered') AS answered, SUM(verb = 'answered' AND correct = 1) AS correct, SUM(verb = 'revealed') AS revealed,
       SUM(verb = 'hinted') AS hinted, SUM(verb = 'asked') AS asked, SUM(verb = 'interacted' OR verb = 'explored') AS played
       FROM events WHERE ${span} AND step IS NOT NULL GROUP BY step`,
      id, r.since, r.until,
    ),
    all(db, `SELECT step, COUNT(*) AS learners, SUM(correct) AS first_right FROM (${first_answers(' AND lesson = ?')}) GROUP BY step`, r.since, r.until, id),
    // where learners who did not finish the lesson were last
    all(
      db,
      `SELECT step, COUNT(*) AS learners FROM (SELECT user_id, step, MAX(t) FROM events WHERE ${span} AND verb = 'viewed' GROUP BY user_id)
       WHERE user_id NOT IN (SELECT user_id FROM events WHERE lesson = ? AND verb = 'completed') GROUP BY step`,
      id, r.since, r.until, id,
    ),
    all(
      db,
      `SELECT step, misconception, COUNT(*) AS n, COUNT(DISTINCT user_id) AS learners FROM events
       WHERE ${span} AND verb = 'answered' AND misconception IS NOT NULL GROUP BY step, misconception ORDER BY learners DESC`,
      id, r.since, r.until,
    ),
    words ? questions(db, r, { lesson: id, text: '', before: 0 }) : Promise.resolve([]),
    first(db, "SELECT COUNT(*) AS views, COUNT(DISTINCT day || tag) AS visitors FROM hits WHERE day BETWEEN ? AND ? AND (path LIKE ? ESCAPE '\\')", r.from, r.to, `%/${like(id)}`),
  ]);
  return { id, summary, steps, first_try, stops, misconceptions, questions: asked, views };
}
const like = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ---------------------------------------------------------------- the tutor
interface Asked {
  t: number;
  user: string | null;
  email: string | null;
  course: string | null;
  lesson: string;
  step: string | null;
  q: string;
  a: string;
  selected?: string;
}
async function questions(db: SqlDb, r: Range, o: { lesson: string; text: string; before: number }): Promise<Asked[]> {
  const where = ["e.verb = 'asked'", 'e.t >= ?', 'e.t < ?'];
  const v: unknown[] = [r.since, o.before ? Math.min(o.before, r.until) : r.until];
  if (o.lesson) where.push('e.lesson = ?'), v.push(o.lesson);
  if (o.text) where.push("e.data LIKE ? ESCAPE '\\'"), v.push(`%${like(o.text)}%`);
  const rows = await all(
    db,
    `SELECT e.t AS t, e.user_id AS user, u.email AS email, e.course AS course, e.lesson AS lesson, e.step AS step, e.data AS data
     FROM events e LEFT JOIN users u ON u.id = e.user_id WHERE ${where.join(' AND ')} ORDER BY e.t DESC LIMIT 50`,
    ...v,
  );
  return rows.map((row) => {
    let d: { data?: { q?: unknown; a?: unknown; selected?: unknown } } = {};
    try {
      d = JSON.parse(String(row.data ?? '{}'));
    } catch {
      /* a damaged row: shown without its words */
    }
    const x = d.data ?? {};
    return {
      t: Number(row.t), user: row.user as string | null, email: row.email as string | null, course: row.course as string | null, lesson: String(row.lesson), step: row.step as string | null,
      q: typeof x.q === 'string' ? x.q : '', a: typeof x.a === 'string' ? x.a.slice(0, 1500) : '', ...(typeof x.selected === 'string' && x.selected ? { selected: x.selected } : {}),
    };
  });
}

async function ai_usage(db: SqlDb, r: Range) {
  const [daily, rows] = await Promise.all([
    all(
      db,
      `SELECT day, SUM(CASE WHEN route = 'ai' THEN calls ELSE 0 END) AS ai_calls, SUM(cost) AS cost, SUM(prompt) AS prompt, SUM(completion) AS completion, SUM(errors) AS errors
       FROM usage WHERE day BETWEEN ? AND ? GROUP BY day`,
      r.from, r.to,
    ),
    all(
      db,
      `SELECT route, op, model, SUM(calls) AS calls, SUM(errors) AS errors, SUM(limited) AS limited, SUM(cached) AS cached, SUM(prompt) AS prompt,
       SUM(cache_hit) AS cache_hit, SUM(completion) AS completion, SUM(chars) AS chars, SUM(ms) AS ms, SUM(cost) AS cost
       FROM usage WHERE day BETWEEN ? AND ? GROUP BY route, op, model ORDER BY cost DESC, calls DESC`,
      r.from, r.to,
    ),
  ]);
  const by = new Map(daily.map((d) => [String(d.day), d]));
  const from = r.days ? r.from : String(daily.reduce<string | null>((m, d) => (m === null || String(d.day) < m ? String(d.day) : m), null) ?? r.to);
  return { daily: fill_days(from, r.to, by), rows };
}

// ---------------------------------------------------------------- people
const PERSON = `SELECT user_id, COUNT(*) AS events, MAX(t) AS last_t, COUNT(DISTINCT CASE WHEN lesson != '' THEN lesson END) AS lessons,
  COUNT(DISTINCT CASE WHEN verb = 'completed' THEN lesson END) AS completed, SUM(verb = 'answered') AS answered,
  SUM(verb = 'answered' AND correct = 1) AS correct, SUM(verb = 'asked') AS asked, SUM(CASE WHEN verb = 'left' THEN ${STAY} ELSE 0 END) AS time_ms
  FROM events`;
async function users(db: SqlDb, env: AdminEnv, text: string, offset: number) {
  const filter = text ? "WHERE u.email LIKE ? ESCAPE '\\'" : '';
  const v = text ? [`%${like(text.toLowerCase())}%`] : [];
  const [items, count] = await Promise.all([
    all(
      db,
      `SELECT u.id AS id, u.email AS email, u.role AS role, u.created AS created, a.events, a.last_t, a.lessons, a.completed, a.answered, a.correct, a.asked, a.time_ms,
       (SELECT COUNT(*) FROM studio_courses c WHERE c.owner = u.id) AS uploads
       FROM users u LEFT JOIN (${PERSON} GROUP BY user_id) a ON a.user_id = u.id ${filter}
       ORDER BY COALESCE(a.last_t, u.created) DESC LIMIT 100 OFFSET ?`,
      ...v, offset,
    ),
    first(db, `SELECT COUNT(*) AS n FROM users u ${filter}`, ...v),
  ]);
  for (const u of items) u.role = role_of(env, String(u.email), u.role);
  return { items, total: count.n ?? 0, offset };
}

/** An admin names a teacher, or makes one a learner again. */
async function name_role(request: Request, env: AdminEnv, db: SqlDb): Promise<Response> {
  if (request.method !== 'POST') return error(405, 'Use POST.', { allow: 'POST' });
  if (!origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathium site.');
  let d: { id?: unknown; role?: unknown } = {};
  try {
    d = JSON.parse((await read_text(request, 1024)) ?? '');
  } catch {
    return error(400, 'Invalid JSON.');
  }
  if (typeof d.id !== 'string' || (d.role !== 'teacher' && d.role !== 'learner')) return error(400, "Expected {id, role: 'teacher' | 'learner'}.");
  const r = (await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(d.role === 'teacher' ? 'teacher' : '', d.id).run()) as { meta?: { changes?: number }; changes?: number };
  if (!(r.meta?.changes ?? r.changes)) return error(404, 'No such user.');
  return json(200, { ok: true });
}

async function one_user(db: SqlDb, id: string, before: number) {
  const user = await first(db, 'SELECT id, email, role, created FROM users WHERE id = ?', id);
  if (!user.id) return null;
  const [totals, lessons, events, uploads] = await Promise.all([
    first(db, `${PERSON} WHERE user_id = ?`, id),
    all(
      db,
      `SELECT course, lesson, MIN(t) AS first_t, ${LESSON_COLS} FROM events WHERE user_id = ? AND lesson != '' GROUP BY course, lesson ORDER BY last_t DESC`,
      id,
    ),
    all(
      db,
      `SELECT t, course, lesson, step, verb, skill, correct, misconception, duration_ms, data FROM events WHERE user_id = ? AND t < ? ORDER BY t DESC LIMIT 200`,
      id, before || Number.MAX_SAFE_INTEGER,
    ),
    all(db, 'SELECT id, title, lang, public, created, updated FROM studio_courses WHERE owner = ? ORDER BY updated DESC', id),
  ]);
  // the record keeps only what a reader needs: a question's words, a choice's value
  for (const e of events) {
    let d: { data?: Record<string, unknown> } = {};
    try {
      d = JSON.parse(String(e.data ?? '{}'));
    } catch {
      /* none */
    }
    const x = d.data ?? {};
    e.data = typeof x.q === 'string' ? x.q.slice(0, 400) : 'value' in x ? String(x.value).slice(0, 80) : null;
  }
  return { user, totals, lessons, events, uploads };
}

async function uploads(db: SqlDb) {
  return all(
    db,
    `SELECT c.id AS id, c.title AS title, c.lang AS lang, c.public AS public, c.created AS created, c.updated AS updated, u.email AS email, u.id AS owner,
     (SELECT COUNT(*) FROM studio_files f WHERE f.course_id = c.id) AS files, (SELECT COALESCE(SUM(size), 0) FROM studio_files f WHERE f.course_id = c.id) AS bytes,
     (SELECT COUNT(*) FROM studio_parts p WHERE p.course_id = c.id) AS parts
     FROM studio_courses c LEFT JOIN users u ON u.id = c.owner ORDER BY c.updated DESC LIMIT 300`,
  );
}

// ---------------------------------------------------------------- export
const EXPORTS: Record<string, { cols: string; table: string; where: (r: Range) => [string, unknown[]] }> = {
  events: { cols: 't, user_id, course, lesson, step, verb, skill, correct, misconception, duration_ms, attempt, data', table: 'events', where: (r) => ['t >= ? AND t < ?', [r.since, r.until]] },
  hits: { cols: 't, day, tag, path, ref, country, device, lang, member', table: 'hits', where: (r) => ['day BETWEEN ? AND ?', [r.from, r.to]] },
  usage: { cols: 'day, route, op, model, calls, errors, limited, cached, prompt, cache_hit, completion, chars, ms, cost', table: 'usage', where: (r) => ['day BETWEEN ? AND ?', [r.from, r.to]] },
  users: { cols: 'id, email, created', table: 'users', where: () => ['1 = 1', []] },
};
export const csv_cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** The rows as CSV, read a few thousand at a time so a large table streams instead of filling memory. */
function csv_export(db: SqlDb, r: Range, kind: string): Response {
  const x = EXPORTS[kind];
  if (!x) return error(400, `kind: one of ${Object.keys(EXPORTS).join(', ')}.`);
  const [where, v] = x.where(r);
  const names = x.cols.split(', ');
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      try {
        c.enqueue(enc.encode(`${names.join(',')}\n`));
        for (let last = 0; ; ) {
          const rows = await all(db, `SELECT rowid AS _r, ${x.cols} FROM ${x.table} WHERE ${where} AND rowid > ? ORDER BY rowid LIMIT 5000`, ...v, last);
          if (rows.length) c.enqueue(enc.encode(rows.map((row) => names.map((k) => csv_cell(row[k])).join(',')).join('\n') + '\n'));
          if (rows.length < 5000) break;
          last = Number(rows[rows.length - 1]._r);
        }
      } catch (e) {
        c.enqueue(enc.encode(`# stopped: ${String((e as Error)?.message ?? e).slice(0, 200)}\n`));
      }
      c.close();
    },
  });
  const name = `mathnim-${kind}-${r.days ? `${r.from}-to-` : ''}${r.to}.csv`;
  return new Response(body, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
}
