// The local mirror of functions/api/*: the same handlers mounted on the Vite
// dev (and preview) server as connect middleware. Node specifics are passed
// in by vite.config.ts (fs) or reached through globals (fetch, WebSocket;
// Node 22+), so this file needs no Node type definitions.
//
// Differences from production, on purpose:
//   - feedback is stored in <cache_dir>/feedback.json instead of KV;
//   - TTS results are cached in <cache_dir>/tts/ instead of the Cache API;
//   - rate limits are off (it is the developer's own key) unless DEV_RATE_LIMITS=1;
//   - ALLOWED_MODELS defaults to "*" and the answer cache is off unless ANSWER_CACHE_TTL is set;
//   - accounts and uploaded courses are kept in <cache_dir>/mathnim.sqlite (Node's SQLite, the same SQL as D1)
//     and the uploaded files in <cache_dir>/files/ (instead of D1 and R2); without RESEND_API_KEY the
//     sign-in code is printed and returned instead of mailed;
//   - course generation hands each step to <cache_dir>/studio/ (ReplayModel) unless a model is plugged in.
import { auth, type AuthEnv } from './auth';
import type { BlobStore, SqlDb, SqlStmt } from './db';
import { deepseek, type DeepseekEnv } from './deepseek';
import { feedback, type FeedbackEnv } from './feedback';
import { handle, limit_for, RateLimiter, type KVLike, type Note, type TextCache } from './http';
import { providers, type ProvidersEnv } from './providers';
import { ReplayModel } from './studio/model';
import { MAX_FILE, studio } from './studio/routes';
import { events } from './events';
import { state } from './sync';
import { tts, type TtsHandlerEnv } from './tts/handler';
import type { Connect, WsLike } from './tts/protocol';

// ---------------------------------------------------------------- the Node bits we use (structural types)
export interface DevFs {
  readFile(p: string, enc: 'utf8'): Promise<string>;
  writeFile(p: string, data: string): Promise<void>;
  mkdir(p: string, o: { recursive: true }): Promise<unknown>;
  rename(from: string, to: string): Promise<void>;
}
/** The same functions for bytes (uploaded files). */
export interface BinFs {
  readFile(p: string): Promise<Uint8Array>;
  writeFile(p: string, data: Uint8Array): Promise<void>;
  mkdir(p: string, o: { recursive: true }): Promise<unknown>;
  rm(p: string, o: { force: true }): Promise<void>;
}
/** node:sqlite's DatabaseSync, the part we use. */
export interface NodeSqlite {
  exec(sql: string): void;
  prepare(sql: string): { get(...v: unknown[]): unknown; all(...v: unknown[]): unknown[]; run(...v: unknown[]): unknown };
}
interface NodeReq extends AsyncIterable<Uint8Array> {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}
interface NodeRes {
  statusCode: number;
  headersSent: boolean;
  writableFinished: boolean;
  setHeader(k: string, v: string | string[]): void;
  write(chunk: Uint8Array): boolean;
  end(chunk?: string): void;
  on(ev: 'close', fn: () => void): void;
}
type Middleware = (req: NodeReq, res: NodeRes, next: (err?: unknown) => void) => void;
type Env = Record<string, string | undefined>;

export interface DevOptions {
  /** .env.local + process.env */
  env: Env;
  fs: DevFs;
  /** Where feedback and TTS results are kept, e.g. apps/mathnim/node_modules/.cache/mathnim. */
  cache_dir: string;
  /** Opens <cache_dir>/mathnim.sqlite (accounts and uploaded courses); without it those routes are off. */
  sqlite?: (file: string) => NodeSqlite;
  /** For the uploaded files (<cache_dir>/files/). */
  bin_fs?: BinFs;
}

// ---------------------------------------------------------------- Node <-> Fetch API
const HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade', 'expect']);
const MAX_DEV_BODY = 1024 * 1024;

async function to_request(req: NodeReq, signal: AbortSignal, max = MAX_DEV_BODY): Promise<Request | null> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined && !HOP.has(k) && !k.startsWith(':')) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  headers.set('cf-connecting-ip', req.socket.remoteAddress ?? 'unknown'); // like Cloudflare: not what the client claims
  const method = req.method ?? 'GET';
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Uint8Array[] = [];
    let n = 0;
    for await (const c of req) {
      n += c.length;
      if (n > max) return null;
      chunks.push(c);
    }
    body = new Uint8Array(n);
    let o = 0;
    for (const c of chunks) {
      body.set(c, o);
      o += c.length;
    }
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, { method, headers, body, signal });
}

async function send(res: NodeRes, r: Response): Promise<void> {
  res.statusCode = r.status;
  r.headers.forEach((v, k) => res.setHeader(k, v));
  if (!r.body) return res.end();
  const reader = r.body.getReader();
  res.on('close', () => void reader.cancel().catch(() => undefined));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch {
    /* client went away */
  }
  res.end();
}

// ---------------------------------------------------------------- Node implementations of the runtime pieces
/** Node 22's global WebSocket (undici) accepts request headers as a second argument. */
export const node_connect: Connect = (url, headers) =>
  new Promise((resolve, reject) => {
    const WS = (globalThis as unknown as { WebSocket?: new (u: string, o: unknown) => WsLike & { binaryType: string; addEventListener(t: 'open', f: () => void): void } }).WebSocket;
    if (!WS) return reject(new Error('live narration in dev needs Node 22+ (global WebSocket)'));
    const ws = new WS(url, { headers });
    ws.binaryType = 'arraybuffer';
    let open = false;
    ws.addEventListener('open', () => {
      open = true;
      resolve(ws);
    });
    ws.addEventListener('error', (e) => !open && reject(new Error(`websocket connect failed${e.message ? `: ${e.message}` : ''}`)));
  });

const file_name = (key: string) => key.replace(/[^A-Za-z0-9._-]+/g, '_');

/** Small string cache in files (dev TTS cache). */
export class FileCache implements TextCache {
  constructor(private fs: DevFs, private dir: string) {}
  async get(key: string): Promise<string | null> {
    try {
      const e = JSON.parse(await this.fs.readFile(`${this.dir}/${file_name(key)}.json`, 'utf8')) as { exp: number; value: string };
      return e.exp > Date.now() ? e.value : null;
    } catch {
      return null;
    }
  }
  async put(key: string, value: string, ttl_s: number): Promise<void> {
    await this.fs.mkdir(this.dir, { recursive: true });
    const p = `${this.dir}/${file_name(key)}.json`;
    await this.fs.writeFile(`${p}.tmp`, JSON.stringify({ exp: Date.now() + ttl_s * 1000, value }));
    await this.fs.rename(`${p}.tmp`, p);
  }
  async delete(key: string): Promise<void> {
    await this.put(key, '', 0).catch(() => undefined);
  }
}

/** In-memory string cache (dev answer cache). */
export class MemoryCache implements TextCache {
  private m = new Map<string, { exp: number; value: string }>();
  constructor(private max = 500) {}
  async get(key: string): Promise<string | null> {
    const e = this.m.get(key);
    return e && e.exp > Date.now() ? e.value : null;
  }
  async put(key: string, value: string, ttl_s: number): Promise<void> {
    if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value!);
    this.m.set(key, { exp: Date.now() + ttl_s * 1000, value });
  }
  async delete(key: string): Promise<void> {
    this.m.delete(key);
  }
}

/** KV in one JSON file (dev feedback store). */
export class FileKV implements KVLike {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private fs: DevFs, private file: string) {}
  private async load(): Promise<Record<string, { value: string; exp?: number }>> {
    try {
      return JSON.parse(await this.fs.readFile(this.file, 'utf8'));
    } catch {
      return {};
    }
  }
  private update(f: (d: Record<string, { value: string; exp?: number }>) => void): Promise<void> {
    const run = this.queue.then(async () => {
      const d = await this.load();
      f(d);
      await this.fs.mkdir(this.file.replace(/\/[^/]*$/, ''), { recursive: true });
      await this.fs.writeFile(`${this.file}.tmp`, JSON.stringify(d, null, 1));
      await this.fs.rename(`${this.file}.tmp`, this.file);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
  private live(d: Record<string, { value: string; exp?: number }>) {
    const now = Date.now();
    return Object.keys(d).filter((k) => !d[k].exp || d[k].exp! > now).sort();
  }
  async get(key: string): Promise<string | null> {
    const d = await this.load();
    return this.live(d).includes(key) ? d[key].value : null;
  }
  put(key: string, value: string, o?: { expirationTtl?: number }): Promise<void> {
    return this.update((d) => void (d[key] = { value, exp: o?.expirationTtl ? Date.now() + o.expirationTtl * 1000 : undefined }));
  }
  delete(key: string): Promise<void> {
    return this.update((d) => void delete d[key]);
  }
  async list(o: { prefix?: string; limit?: number; cursor?: string } = {}) {
    const keys = this.live(await this.load()).filter((k) => k.startsWith(o.prefix ?? ''));
    const start = Number(o.cursor ?? 0) || 0, end = start + (o.limit ?? 1000);
    return { keys: keys.slice(start, end).map((name) => ({ name })), list_complete: end >= keys.length, cursor: end < keys.length ? String(end) : undefined };
  }
}

/** D1's interface over node:sqlite (D1 binds undefined as an error; here it becomes NULL). */
export function d1_of(db: NodeSqlite): SqlDb {
  const stmt = (sql: string, values: unknown[] = []): SqlStmt => {
    const args = () => values.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
    return {
      bind: (...v) => stmt(sql, v),
      first: async <T>() => (db.prepare(sql).get(...args()) as T | undefined) ?? null,
      all: async <T>() => ({ results: db.prepare(sql).all(...args()) as T[] }),
      run: async () => db.prepare(sql).run(...args()),
    };
  };
  return {
    prepare: (sql) => stmt(sql),
    exec: async (sql) => db.exec(sql),
    batch: async (stmts) => {
      db.exec('BEGIN');
      try {
        const out: unknown[] = [];
        for (const st of stmts) out.push(await st.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

/** R2's interface over a folder. */
export class FileBlobs implements BlobStore {
  constructor(private fs: BinFs, readonly dir: string) {}
  path(key: string): string {
    return `${this.dir}/${file_name(key)}`;
  }
  async put(key: string, value: ArrayBuffer | Uint8Array): Promise<void> {
    await this.fs.mkdir(this.dir, { recursive: true });
    await this.fs.writeFile(this.path(key), value instanceof Uint8Array ? value : new Uint8Array(value));
  }
  async get(key: string) {
    try {
      const b = await this.fs.readFile(this.path(key));
      return { size: b.byteLength, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
    } catch {
      return null;
    }
  }
  async delete(key: string): Promise<void> {
    await this.fs.rm(this.path(key), { force: true });
  }
}

// ---------------------------------------------------------------- the middleware
export function dev_api(o: DevOptions): Middleware {
  const env = o.env;
  const limited = env.DEV_RATE_LIMITS === '1';
  const limiter = (route: string) => (limited ? new RateLimiter(limit_for(route, env.RATE_LIMITS)) : null);
  const limits = { deepseek: limiter('deepseek'), tts: limiter('tts'), feedback: limiter('feedback') };
  const answers = env.ANSWER_CACHE_TTL ? new MemoryCache() : null;
  const tts_cache = new FileCache(o.fs, `${o.cache_dir}/tts`);
  const kv = new FileKV(o.fs, `${o.cache_dir}/feedback.json`);
  const ds_env: DeepseekEnv = { ...env, ALLOWED_MODELS: env.ALLOWED_MODELS || '*' };
  const fb_env: FeedbackEnv = { FEEDBACK: kv, ADMIN_TOKEN: env.ADMIN_TOKEN, ALLOWED_ORIGINS: env.ALLOWED_ORIGINS };
  const blobs = o.bin_fs ? new FileBlobs(o.bin_fs, `${o.cache_dir}/files`) : undefined;
  let db: Promise<SqlDb | undefined> | null = null;
  const data_env = async (): Promise<AuthEnv> => {
    db ??= o.sqlite ? o.fs.mkdir(o.cache_dir, { recursive: true }).then(() => d1_of(o.sqlite!(`${o.cache_dir}/mathnim.sqlite`))) : Promise.resolve(undefined);
    return { DB: await db, FILES: blobs, ALLOWED_ORIGINS: env.ALLOWED_ORIGINS, RESEND_API_KEY: env.RESEND_API_KEY, MAIL_FROM: env.MAIL_FROM, ADMIN_EMAILS: env.ADMIN_EMAILS };
  };
  const studio_deps = { model: new ReplayModel(o.fs, `${o.cache_dir}/studio`), blob_path: blobs && ((k: string) => blobs.path(k)) };

  const routes: [RegExp, string, (req: Request, m: RegExpExecArray, note: Note) => Promise<Response>][] = [
    [/^\/api\/providers\/?$/, 'providers', async () => providers(env as ProvidersEnv, !!env.ANTHROPIC_API_KEY)],
    [/^\/api\/tts\/?$/, 'tts', (req, _m, note) => tts(req, env as TtsHandlerEnv, { connect: node_connect, cache: tts_cache, limiter: limits.tts }, note)],
    [/^\/api\/feedback\/?$/, 'feedback', (req, _m, note) => feedback(req, fb_env, { limiter: limits.feedback, answers }, note)],
    [/^\/api\/deepseek\/(.*)$/, 'deepseek', (req, m, note) => deepseek(req, ds_env, m[1].replace(/\/$/, ''), { limiter: limits.deepseek, answers }, note)],
    [/^\/api\/auth\/(.*)$/, 'auth', async (req, m, note) => auth(req, await data_env(), m[1].replace(/\/$/, ''), { limiter: limiter('auth'), dev: true, generate: true }, note)],
    [/^\/api\/me\/state\/?$/, 'me/state', async (req) => state(req, await data_env())],
    [/^\/api\/me\/events\/?$/, 'me/events', async (req) => events(req, await data_env())],
    [/^\/api\/studio\/(.*)$/, 'studio', async (req, m, note) => studio(req, await data_env(), m[1].replace(/\/$/, ''), studio_deps, note)],
  ];
  return (req, res, next) => {
    const path = (req.url ?? '/').split('?')[0];
    for (const [re, name, run] of routes) {
      const m = re.exec(path);
      if (!m) continue;
      const abort = new AbortController();
      res.on('close', () => !res.writableFinished && abort.abort());
      void (async () => {
        const request = await to_request(req, abort.signal, name === 'studio' ? MAX_FILE + 1024 : name === 'me/state' ? 5 * 1024 * 1024 : MAX_DEV_BODY);
        if (!request) {
          res.statusCode = 413;
          return res.end('{"error":"Request too large."}');
        }
        const route = name === 'deepseek' || name === 'auth' ? `${name}/${m[1]}` : name;
        await send(res, await handle(route, request, {}, (note) => run(request, m, note)));
      })().catch((e) => {
        if (!res.headersSent) next(e);
      });
      return;
    }
    next();
  };
}
