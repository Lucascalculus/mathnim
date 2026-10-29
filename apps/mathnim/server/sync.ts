// /api/me/state: a signed-in learner's progress, so it follows them to other
// devices. The browser keeps its records in localStorage under "mathnim.*";
// it sends the ones that changed and reads the rest back.
//   GET              -> 200 {items: {[key]: {value, t}}}
//   PUT {items: [{key, value, t}]} -> 200 {ok, kept}  (a newer stored value wins)
import { session_user, type AuthEnv } from './auth';
import { with_schema } from './db';
import { error, json, origin_ok, read_text } from './http';

export const MAX_STATE_BODY = 4 * 1024 * 1024;
export const MAX_VALUE = 1024 * 1024;
const MAX_ITEMS = 200;
const MAX_KEYS = 3000;
/**
 * What may be stored: the app's own records (settings stay per browser: they can hold model keys; the event
 * log goes to its own table, /api/me/events).
 */
export const syncable_key = (k: unknown): k is string =>
  typeof k === 'string' && k.length <= 160 && k.startsWith('mathnim.') && k !== 'mathnim.settings' && k !== 'mathnim.events' && !k.startsWith('mathnim.sync');

export async function state(request: Request, env: AuthEnv): Promise<Response> {
  if (!env.DB) return error(503, 'Accounts are not configured on this server.');
  const user = await session_user(request, env);
  if (!user) return error(401, 'Sign in first.');
  const db = await with_schema(env.DB);
  if (request.method === 'GET') {
    const { results } = await db.prepare('SELECT key, value, t FROM user_state WHERE user_id = ?').bind(user.id).all<{ key: string; value: string; t: number }>();
    return json(200, { items: Object.fromEntries(results.map((r) => [r.key, { value: r.value, t: r.t }])) });
  }
  if (request.method !== 'PUT') return error(405, 'Use GET or PUT.', { allow: 'GET, PUT' });
  if (!origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathnim site.');
  const text = await read_text(request, MAX_STATE_BODY);
  if (text === null) return error(413, 'Request too large.');
  let items: unknown;
  try {
    items = JSON.parse(text).items;
  } catch {
    return error(400, 'Invalid JSON.');
  }
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return error(400, `items: an array of at most ${MAX_ITEMS}.`);
  const count = (await db.prepare('SELECT COUNT(*) AS n FROM user_state WHERE user_id = ?').bind(user.id).first<{ n: number }>())?.n ?? 0;
  let kept = 0;
  for (const it of items as { key?: unknown; value?: unknown; t?: unknown }[]) {
    if (!syncable_key(it?.key) || typeof it.value !== 'string' || it.value.length > MAX_VALUE || typeof it.t !== 'number' || !Number.isFinite(it.t)) continue;
    if (count + kept >= MAX_KEYS) break;
    // only a newer value replaces the stored one (two devices, last writer wins per record)
    await db
      .prepare('INSERT INTO user_state (user_id, key, value, t) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, t = excluded.t WHERE excluded.t > user_state.t')
      .bind(user.id, it.key, it.value, Math.min(it.t, Date.now() + 60_000))
      .run();
    kept++;
  }
  return json(200, { ok: true, kept });
}
