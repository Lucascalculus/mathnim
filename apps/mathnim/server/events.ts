// /api/me/events: a signed-in learner's learning events (xAPI-like: answered,
// hinted, explored, asked the tutor, left a step...), appended to one table.
// It is the record that personalisation reads (what the tutor is told about a
// learner) and that analytics query in SQL; the columns analytics filter on
// are their own, the rest is JSON in `data`. The browser gives each event an
// id made from its content, so an event sent twice is stored once.
//   POST {events: [{id, t, lesson, verb, course?, step?, object?, result?, vars?, data?}]} -> 200 {ok, kept}
//
// e.g. where learners leave a lesson, and which steps they get wrong:
//   SELECT step, COUNT(*) FROM events WHERE lesson = ? AND verb = 'left' GROUP BY step;
//   SELECT step, AVG(correct) FROM events WHERE verb = 'answered' GROUP BY lesson, step;
import { session_user, type AuthEnv } from './auth';
import { with_schema } from './db';
import { error, json, origin_ok, read_text } from './http';

export const MAX_EVENTS_BODY = 1024 * 1024;
const MAX_EVENTS = 200;
/** The JSON kept per event: a tutor's answer is cut to 4 KB in the browser, the rest is small. */
const MAX_DATA = 12 * 1024;
const VERBS = new Set([
  'started', 'completed', 'viewed', 'left', 'answered', 'hinted', 'revealed', 'explored', 'interacted',
  'seeked', 'paused', 'resumed', 'replayed', 'detected', 'asked', 'set',
]);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

export async function events(request: Request, env: AuthEnv): Promise<Response> {
  if (!env.DB) return error(503, 'Accounts are not configured on this server.');
  if (request.method !== 'POST') return error(405, 'Use POST.', { allow: 'POST' });
  if (!origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathnim site.');
  const user = await session_user(request, env);
  if (!user) return error(401, 'Sign in first.');
  const text = await read_text(request, MAX_EVENTS_BODY);
  if (text === null) return error(413, 'Request too large.');
  let list: unknown;
  try {
    list = JSON.parse(text).events;
  } catch {
    return error(400, 'Invalid JSON.');
  }
  if (!Array.isArray(list) || list.length > MAX_EVENTS) return error(400, `events: an array of at most ${MAX_EVENTS}.`);
  const db = await with_schema(env.DB);
  const now = Date.now();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO events (user_id, id, t, course, lesson, step, verb, skill, correct, misconception, duration_ms, attempt, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const rows = [];
  for (const e of list as Record<string, unknown>[]) {
    const id = str(e?.id, 80), t = int(e?.t), lesson = str(e?.lesson, 160), verb = str(e?.verb, 20);
    if (!id || !t || t <= 0 || lesson === null || !verb || !VERBS.has(verb)) continue;
    const r = (e.result && typeof e.result === 'object' ? e.result : {}) as Record<string, unknown>;
    // the columns analytics filter on; everything else of the result, the variables and the data as JSON
    const { correct, misconception, duration_ms, attempt, ...rest } = r;
    const extra = { ...(Object.keys(rest).length ? { result: rest } : {}), ...(e.vars ? { vars: e.vars } : {}), ...(e.data ? { data: e.data } : {}) };
    const data = Object.keys(extra).length ? JSON.stringify(extra) : null;
    if (data && data.length > MAX_DATA) continue;
    rows.push(
      insert.bind(
        user.id, id, Math.min(t, now + 60_000), str(e.course, 160), lesson, str(e.step, 160), verb, str(e.object, 160),
        typeof correct === 'boolean' ? Number(correct) : null, str(misconception, 160), int(duration_ms), int(attempt), data,
      ),
    );
  }
  if (rows.length) await db.batch(rows);
  return json(200, { ok: true, kept: rows.length });
}
