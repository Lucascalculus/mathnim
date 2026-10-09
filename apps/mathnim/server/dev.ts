// The local mirror of functions/api/*: the same handlers mounted on the Vite
// dev (and preview) server as connect middleware. Node specifics are passed
// in by vite.config.ts (fs) or reached through globals (fetch, WebSocket;
// Node 22+), so this file needs no Node type definitions.
//
// Differences from production, on purpose:
//   - feedback is stored in <cache_dir>/feedback.json instead of KV;
//   - TTS results are cached in <cache_dir>/tts/ instead of the Cache API;
//   - rate limits are off (it is the developer's own key) unless DEV_RATE_LIMITS=1;
//   - ALLOWED_MODELS defaults to "*" and the answer cache is off unless ANSWER_CACHE_TTL is set.
import { deepseek, type DeepseekEnv } from './deepseek';
import { feedback, type FeedbackEnv } from './feedback';
import { handle, limit_for, RateLimiter, type KVLike, type Note, type TextCache } from './http';
import { providers, type ProvidersEnv } from './providers';
import { tts, type TtsHandlerEnv } from './tts/handler';
import type { Connect, WsLike } from './tts/protocol';

// ---------------------------------------------------------------- the Node bits we use (structural types)
export interface DevFs {
  readFile(p: string, enc: 'utf8'): Promise<string>;
  writeFile(p: string, data: string): Promise<void>;
  mkdir(p: string, o: { recursive: true }): Promise<unknown>;
  rename(from: string, to: string): Promise<void>;
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
}

// ---------------------------------------------------------------- Node <-> Fetch API
const HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade', 'expect']);
const MAX_DEV_BODY = 1024 * 1024;

async function to_request(req: NodeReq, signal: AbortSignal): Promise<Request | null> {
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
      if (n > MAX_DEV_BODY) return null;
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

  const routes: [RegExp, string, (req: Request, m: RegExpExecArray, note: Note) => Promise<Response>][] = [
    [/^\/api\/providers\/?$/, 'providers', async () => providers(env as ProvidersEnv, !!env.ANTHROPIC_API_KEY)],
    [/^\/api\/tts\/?$/, 'tts', (req, _m, note) => tts(req, env as TtsHandlerEnv, { connect: node_connect, cache: tts_cache, limiter: limits.tts }, note)],
    [/^\/api\/feedback\/?$/, 'feedback', (req, _m, note) => feedback(req, fb_env, { limiter: limits.feedback, answers }, note)],
    [/^\/api\/deepseek\/(.*)$/, 'deepseek', (req, m, note) => deepseek(req, ds_env, m[1].replace(/\/$/, ''), { limiter: limits.deepseek, answers }, note)],
  ];
  return (req, res, next) => {
    const path = (req.url ?? '/').split('?')[0];
    for (const [re, name, run] of routes) {
      const m = re.exec(path);
      if (!m) continue;
      const abort = new AbortController();
      res.on('close', () => !res.writableFinished && abort.abort());
      void (async () => {
        const request = await to_request(req, abort.signal);
        if (!request) {
          res.statusCode = 413;
          return res.end('{"error":"Request too large."}');
        }
        const route = name === 'deepseek' ? `deepseek/${m[1]}` : name;
        await send(res, await handle(route, request, {}, (note) => run(request, m, note)));
      })().catch((e) => {
        if (!res.headersSent) next(e);
      });
      return;
    }
    next();
  };
}
