// Shared plumbing for the API routes. The same handlers run as Cloudflare
// Pages Functions (functions/api/*, production) and inside the Vite dev server
// (server/dev.ts, local development); both speak the Fetch API
// (Request/Response), so everything here is runtime-neutral.
import { narration_key } from '../../../packages/core/src/narration';

// ---------------------------------------------------------------- runtime types (subset of the Workers types)
/** Cloudflare KV, the part we use (the dev server backs it with a JSON file). */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, o?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(o?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}
/** A string cache: the Cache API in production, memory or files in dev. */
export interface TextCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttl_s: number): Promise<void>;
  delete(key: string): Promise<void>;
}
/** Keeps work alive after the response (Workers' ctx.waitUntil). */
export interface Ctx {
  waitUntil?(p: Promise<unknown>): void;
}
/** The context a Pages Function receives (the part we use). */
export interface PagesContext<E> extends Ctx {
  request: Request;
  env: E;
  params: Record<string, string | string[] | undefined>;
}

// ---------------------------------------------------------------- responses
/** Result of validating a request body. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
export const error = (status: number, message: string, headers: Record<string, string> = {}) => json(status, { error: message }, headers);

/** Read a request body as text, refusing more than `max` bytes. */
export async function read_text(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > max) return null;
  const buf = await request.arrayBuffer();
  return buf.byteLength > max ? null : new TextDecoder().decode(buf);
}

// ---------------------------------------------------------------- guards
/** Browsers send Origin on POST; only this site's pages (and ALLOWED_ORIGINS) may call. GETs without Origin pass. */
export function origin_ok(request: Request, allowed_extra?: string): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.method === 'GET' || request.method === 'HEAD';
  const self = new URL(request.url).origin;
  return origin === self || list(allowed_extra).includes(origin);
}
export const list = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** The visitor's address (set by Cloudflare; by the dev adapter locally). */
export const client_ip = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'unknown';
/** A short tag for logs that tells visitors apart within a day without recording their address. */
export const client_tag = (ip: string, now = Date.now()) => narration_key(`${ip}|${Math.floor(now / 86_400_000)}`).slice(0, 8);

/** Compare secrets without an early exit. */
export function same_secret(a: string, b: string): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

// ---------------------------------------------------------------- rate limits
export interface Limit {
  /** Requests per 10-minute window. */
  per_window: number;
  /** Requests per UTC day. */
  per_day: number;
  window_ms?: number;
}
export type LimitVerdict = { ok: true } | { ok: false; scope: 'window' | 'day'; retry_after: number };

/**
 * Per-client sliding window plus a daily cap. Kept in memory: in production
 * that is per Cloudflare isolate, so it is best effort (a Cloudflare
 * rate-limiting rule is the hard limit, see docs/DEPLOY.md).
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private days = new Map<string, { day: number; n: number }>();
  constructor(readonly limit: Limit, private max_keys = 5000) {}
  hit(key: string, now = Date.now()): LimitVerdict {
    const win = this.limit.window_ms ?? 600_000;
    const day = Math.floor(now / 86_400_000);
    const d = this.days.get(key);
    const today = d && d.day === day ? d.n : 0;
    if (today >= this.limit.per_day) return { ok: false, scope: 'day', retry_after: Math.ceil(((day + 1) * 86_400_000 - now) / 1000) };
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < win);
    if (recent.length >= this.limit.per_window) {
      this.hits.set(key, recent);
      return { ok: false, scope: 'window', retry_after: Math.ceil((recent[0] + win - now) / 1000) };
    }
    recent.push(now);
    if (this.hits.size >= this.max_keys) this.hits.clear(); // keep memory bounded
    if (this.days.size >= this.max_keys) this.days.clear();
    this.hits.set(key, recent);
    this.days.set(key, { day, n: today + 1 });
    return { ok: true };
  }
}
export function too_many(v: Exclude<LimitVerdict, { ok: true }>, what: string): Response {
  const msg = v.scope === 'day' ? `Daily limit for ${what} reached - please come back tomorrow.` : `Too many ${what} in a short time - please wait a few minutes.`;
  return error(429, msg, { 'retry-after': String(v.retry_after) });
}

/** Default limits per route; override with RATE_LIMITS="deepseek=40/300,tts=80/600,feedback=20/100" (per 10 minutes / per day). */
export const LIMITS: Record<string, Limit> = {
  deepseek: { per_window: 40, per_day: 300 }, // a question uses 2-4 requests, a generated lesson 10-30
  tts: { per_window: 80, per_day: 600 }, // uncached sentences only
  feedback: { per_window: 20, per_day: 100 },
};
export function limit_for(route: string, spec?: string): Limit {
  const base = LIMITS[route] ?? { per_window: 60, per_day: 600 };
  for (const item of list(spec)) {
    const m = /^([a-z]+)\s*=\s*(\d+)\s*\/\s*(\d+)$/.exec(item);
    if (m && m[1] === route) return { per_window: +m[2], per_day: +m[3] };
  }
  return base;
}

// ---------------------------------------------------------------- logs
export interface Usage {
  prompt?: number;
  completion?: number;
  total?: number;
  cache_hit?: number;
  reasoning?: number;
}
/** What a handler adds to its log line. Never keys, prompts or answers. */
export interface Note {
  model?: string;
  usage?: Usage;
  cached?: boolean;
  provider?: string;
  chars?: number;
  error?: string;
  /** Set when the response streams: the log line is written when this settles. */
  after?: Promise<unknown>;
}
export interface LogLine extends Omit<Note, 'after'> {
  t: string;
  level: 'info' | 'warn' | 'error';
  route: string;
  method: string;
  status: number;
  /** Until the response started. */
  ms: number;
  /** Until a streamed response finished. */
  total_ms?: number;
  client: string;
}
export let log_sink: (line: LogLine) => void = (line) => console.log(JSON.stringify(line));
export const set_log_sink = (f: (line: LogLine) => void) => (log_sink = f);

/** Run a handler, then write one structured log line for the call. */
export async function handle(route: string, request: Request, ctx: Ctx, run: (note: Note) => Promise<Response>): Promise<Response> {
  const t0 = Date.now();
  const note: Note = {};
  let res: Response;
  try {
    res = await run(note);
  } catch (e) {
    note.error = String((e as Error)?.message ?? e).slice(0, 200);
    res = error(500, 'Server error.');
  }
  const ms = Date.now() - t0;
  const write = () => {
    const { after, ...rest } = note;
    const status = res.status;
    const line: LogLine = {
      t: new Date().toISOString(),
      level: status >= 500 || rest.error ? 'error' : status >= 400 ? 'warn' : 'info',
      route, method: request.method, status, ms, client: client_tag(client_ip(request)), ...rest,
    };
    if (after) line.total_ms = Date.now() - t0;
    log_sink(line);
  };
  if (note.after) {
    const done = note.after.then(write, (e) => {
      note.error ??= String((e as Error)?.message ?? e).slice(0, 200);
      write();
    });
    ctx.waitUntil?.(done);
  } else write();
  return res;
}

// ---------------------------------------------------------------- bytes
export function to_base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
export async function sha256_hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
