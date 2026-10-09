// Cloudflare Workers adapters (used by functions/api/*): outbound websockets
// and the Cache API. Types are declared here so no Workers type package is needed.
import { error, handle, LIMITS, limit_for, RateLimiter, type Ctx, type Note, type PagesContext, type TextCache } from './http';
import type { Connect, WsLike } from './tts/protocol';

interface WorkersSocket extends WsLike {
  accept(): void;
  binaryType?: string;
}
/** Workers open a client websocket with fetch + "Upgrade: websocket" (the URL must be http(s)). */
export const workers_connect: Connect = async (url, headers) => {
  const res = await fetch(url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), { headers: { ...headers, Upgrade: 'websocket' } });
  const ws = (res as unknown as { webSocket?: WorkersSocket | null }).webSocket;
  if (!ws) throw new Error(`websocket upgrade refused (${res.status})`);
  ws.binaryType = 'arraybuffer'; // newer compatibility dates default to Blob (protocol.ts reads both)
  ws.accept();
  return ws;
};

/**
 * The Cache API (caches.default): per Cloudflare data centre, entries can be
 * evicted early. Keys become URLs under the site's own origin.
 */
export class EdgeCache implements TextCache {
  constructor(private origin: string, private ns: string) {}
  private get store(): Cache | undefined {
    return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  }
  private req(key: string) {
    return new Request(`${this.origin}/__cache/${this.ns}/${key.split('/').map(encodeURIComponent).join('/')}`);
  }
  async get(key: string): Promise<string | null> {
    const r = await this.store?.match(this.req(key));
    return r ? r.text() : null;
  }
  async put(key: string, value: string, ttl_s: number): Promise<void> {
    await this.store?.put(this.req(key), new Response(value, { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttl_s}` } }));
  }
  async delete(key: string): Promise<void> {
    await this.store?.delete(this.req(key));
  }
}

/** One limiter per route and isolate, built on first use (limits may come from RATE_LIMITS). */
const limiters = new Map<string, RateLimiter>();
export function limiter(route: keyof typeof LIMITS, env: { RATE_LIMITS?: string }): RateLimiter {
  let l = limiters.get(route);
  if (!l) limiters.set(route, (l = new RateLimiter(limit_for(route, env.RATE_LIMITS))));
  return l;
}

/** Wrap a handler as a Pages Function: logging, waitUntil, and a 405 for other methods. */
export function pages<E>(route: string | ((c: PagesContext<E>) => string), methods: string[], run: (c: PagesContext<E>, note: Note) => Promise<Response>) {
  return (c: PagesContext<E>): Promise<Response> =>
    handle(typeof route === 'string' ? route : route(c), c.request, c as Ctx, (note) =>
      methods.includes(c.request.method) ? run(c, note) : Promise.resolve(error(405, `Use ${methods.join(' or ')}.`, { allow: methods.join(', ') })));
}
