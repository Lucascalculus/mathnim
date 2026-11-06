// The site's own statistics, for the data centre (/admin, server/admin.ts):
//   - /api/hit: one page view, sent by every page (signed in or not). No cookie and no address is kept: a visitor
//     is a hash of their address and browser with a salt that is made each day and thrown away the next, so the
//     same person is one visitor within a day and cannot be followed across days. Robots and admins are not counted.
//       POST {path, ref?, lang?, w?} -> 204
//   - the cost of the server's routes: every call of a route that costs money or mail (the tutor, narration,
//     sign-in codes, feedback, a course-making step) adds to a row per day, route, operation and model, with the tokens and the price
//     at that hour (record_usage, called by handle() in http.ts once the call has finished).
// Days are the site's local days (STATS_TZ, default Melbourne), so "today" ends at the owner's midnight.
import { session_user, type AuthEnv } from './auth';
import { with_schema, type SqlDb } from './db';
import { client_ip, error, origin_ok, read_text, sha256_hex, too_many, type LogLine, type Note, type RateLimiter } from './http';

export interface StatsEnv extends AuthEnv {
  /** An IANA time zone, e.g. "Australia/Melbourne". */
  STATS_TZ?: string;
}
export const DEFAULT_TZ = 'Australia/Melbourne';
const tz_of = (env: { STATS_TZ?: string }) => env.STATS_TZ || DEFAULT_TZ;

// ---------------------------------------------------------------- local days
const fmt = new Map<string, Intl.DateTimeFormat>();
function parts(t: number, tz: string): Record<string, number> {
  let f = fmt.get(tz);
  if (!f) fmt.set(tz, (f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })));
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(t))) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}
/** The local date of a moment, "2026-11-02". */
export function local_day(t: number, tz = DEFAULT_TZ): string {
  const p = parts(t, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
/** How far the zone is ahead of UTC at that moment, in ms (+11 h in a Melbourne summer). */
export function tz_offset(t: number, tz = DEFAULT_TZ): number {
  const p = parts(t, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}
/** The first moment of a local day. */
export function day_start(day: string, tz = DEFAULT_TZ): number {
  const guess = Date.parse(`${day}T00:00:00Z`);
  // the offset at the guess, then once more at the answer (a day that starts on the other side of a clock change)
  const first = guess - tz_offset(guess, tz);
  return guess - tz_offset(first, tz);
}
/** The local day `n` days before `day`. */
export const days_before = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- page views
/** Crawlers, previews, monitors and headless browsers (tools, tests): not visitors. */
const ROBOT = /bot\b|bot\/|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\/|facebookexternalhit|embedly/i;
export const is_robot = (ua: string) => !ua || ROBOT.test(ua);

export interface HitInput {
  path: string;
  ref: string | null;
  lang: string | null;
  device: string | null;
}
/** The page as recorded: no query or anchor; an upload's private address becomes its page ("/studio/*"); null when not a page. */
export function hit_path(p: unknown): string | null {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//')) return null;
  const path = p.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path.length > 200 || path.startsWith('/api/') || path === '/admin' || path.startsWith('/admin/')) return null;
  return path.startsWith('/studio/') ? '/studio/*' : path;
}
export function parse_hit(text: string): HitInput | null {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(text);
  } catch {
    return null;
  }
  const path = hit_path(d?.path);
  if (!path) return null;
  // where the visit came from: a site's name or a campaign tag (?ref= / utm_source), in a few safe characters
  const ref = typeof d.ref === 'string' ? d.ref.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9._-]/g, '').slice(0, 80) || null : null;
  const lang = d.lang === 'en' || d.lang === 'zh' ? d.lang : null;
  const w = typeof d.w === 'number' && Number.isFinite(d.w) ? d.w : 0;
  const device = !w ? null : w < 700 ? 'phone' : w < 1100 ? 'tablet' : 'desktop';
  return { path, ref, lang, device };
}

/** Today's salt (made on the first visit of the day); the salts of earlier days are deleted. */
async function salt_of(db: SqlDb, day: string): Promise<string> {
  const row = await db.prepare('SELECT salt FROM salts WHERE day = ?').bind(day).first<{ salt: string }>();
  if (row) return row.salt;
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  await db.batch([db.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)').bind(day, fresh), db.prepare('DELETE FROM salts WHERE day < ?').bind(day)]);
  return (await db.prepare('SELECT salt FROM salts WHERE day = ?').bind(day).first<{ salt: string }>())?.salt ?? fresh;
}

export async function hit(request: Request, env: StatsEnv, deps: { limiter: RateLimiter | null }, _note: Note): Promise<Response> {
  const none = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (!env.DB) return none();
  if (request.method !== 'POST') return error(405, 'Use POST.', { allow: 'POST' });
  if (!origin_ok(request, env.ALLOWED_ORIGINS)) return error(403, 'Requests must come from the Mathium site.');
  const ua = request.headers.get('user-agent') ?? '';
  if (is_robot(ua)) return none();
  const text = await read_text(request, 2048);
  const input = text === null ? null : parse_hit(text);
  if (!input) return error(400, 'Expected {path, ref?, lang?, w?}.');
  const v = deps.limiter?.hit(client_ip(request));
  if (v && !v.ok) return too_many(v, 'page views');
  const user = await session_user(request, env);
  if (user?.admin) return none(); // the owner looking at their own site
  const db = await with_schema(env.DB);
  const now = Date.now();
  const day = local_day(now, tz_of(env));
  const tag = (await sha256_hex(`${await salt_of(db, day)}|${client_ip(request)}|${ua}`)).slice(0, 16);
  const c = request.headers.get('cf-ipcountry');
  const country = c && /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : null;
  await db
    .prepare('INSERT INTO hits (t, day, tag, path, ref, country, device, lang, member) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(now, day, tag, input.path, input.ref, country, input.device, input.lang, user ? 1 : 0)
    .run();
  return none();
}

// ---------------------------------------------------------------- what the routes cost
/**
 * USD per million tokens at peak hours (api-docs.deepseek.com/quick_start/pricing, read 2026-11-02); off-peak
 * is half. A model not listed costs nothing here (a stand-in model in development).
 */
export const PRICES: Record<string, { hit: number; miss: number; out: number }> = {
  'deepseek-flash': { hit: 0.006, miss: 0.3, out: 1.2 },
  'deepseek-v4-flash': { hit: 0.006, miss: 0.3, out: 1.2 }, // the old name, billed as flash
  'deepseek-v4-pro': { hit: 0.044, miss: 1.32, out: 3.96 },
};
/** DeepSeek's peak hours: 01-04 and 06-10 UTC, Monday to Friday (their Chinese public holidays are off-peak too; not known here). */
export function is_peak(t: number): boolean {
  const d = new Date(t);
  const h = d.getUTCHours(), wd = d.getUTCDay();
  return wd >= 1 && wd <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
}
/** What one call cost in USD, from its token counts. */
export function call_cost(model: string | undefined, u: LogLine['usage'], t: number): number {
  const p = model ? PRICES[model] : undefined;
  if (!p || !u) return 0;
  const prompt = u.prompt ?? 0, hit = Math.min(u.cache_hit ?? 0, prompt), out = u.completion ?? 0;
  const usd = (hit * p.hit + (prompt - hit) * p.miss + out * p.out) / 1e6;
  return is_peak(t) ? usd : usd / 2;
}

/**
 * The calls counted: the ones that cost money or mail. Of the upload routes only a step a model ran (the rest, e.g.
 * the catalog every page asks for, cost nothing); page views, sync and the data centre itself are not counted.
 */
export const COUNTED = (line: Pick<LogLine, 'route' | 'model'>) =>
  ['ai', 'tts', 'feedback', 'auth/start', 'auth/verify'].includes(line.route) || (line.route.startsWith('studio/') && !!line.model);

/** Add one finished call to its row of the day. */
export async function record_usage(db: SqlDb, line: LogLine, tz = DEFAULT_TZ): Promise<void> {
  if (!COUNTED(line)) return;
  const t = Date.parse(line.t) || Date.now();
  const u = line.usage ?? {};
  const failed = line.status >= 500 || !!line.error ? 1 : 0;
  await (await with_schema(db))
    .prepare(
      `INSERT INTO usage (day, route, op, model, calls, errors, limited, cached, prompt, cache_hit, completion, chars, ms, cost) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, route, op, model) DO UPDATE SET calls = calls + 1, errors = errors + excluded.errors, limited = limited + excluded.limited, cached = cached + excluded.cached,
       prompt = prompt + excluded.prompt, cache_hit = cache_hit + excluded.cache_hit, completion = completion + excluded.completion, chars = chars + excluded.chars, ms = ms + excluded.ms, cost = cost + excluded.cost`,
    )
    .bind(
      local_day(t, tz), line.route, line.op ?? '', line.model ?? line.provider ?? '', failed, line.status === 429 ? 1 : 0, line.cached ? 1 : 0,
      u.prompt ?? 0, u.cache_hit ?? 0, u.completion ?? 0, line.chars ?? 0, line.total_ms ?? line.ms, call_cost(line.model, u, t),
    )
    .run();
}
/** The recorder handle() calls for a deployment with a database (none without one). */
export const usage_recorder = (env: { DB?: SqlDb; STATS_TZ?: string }) => (env.DB ? (line: LogLine) => record_usage(env.DB!, line, tz_of(env)) : undefined);
