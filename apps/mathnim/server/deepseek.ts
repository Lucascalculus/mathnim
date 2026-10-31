// DeepSeek with the key (DEEPSEEK_API_KEY), so it never reaches the browser. There is no open proxy: the site asks
// for the tutor's fixed operations at /api/ai (ai.ts), whose prompts are written on the server, and forward_chat sends
// them on, guarded:
//   - requests from this site's own pages only (Origin check, in ai.ts)
//   - allowed models only (ALLOWED_MODELS, default deepseek-flash), max_tokens capped, request body capped
//   - per-visitor rate limits: a 10-minute window and a daily cap (best effort)
// Spend is bounded by the DeepSeek account's prepaid balance; for a hard limit
// add a Cloudflare rate-limiting rule on /api/ai as well.
//
// Answer cache (for operations whose answer is the same for everyone, such as the starter questions): an identical
// request body (same model, prompt, context) is answered from the edge cache for ANSWER_CACHE_TTL seconds (default
// one day; 0 = off). Every response carries `x-mathnim-answer-id` (a hash of the request), which /api/feedback
// accepts as answer_id; "not helpful" feedback drops the cached answer.
import { client_ip, list, sha256_hex, too_many, type Note, type RateLimiter, type TextCache, type Usage } from './http';

export interface DeepseekEnv {
  DEEPSEEK_API_KEY?: string;
  /** Comma-separated, e.g. "deepseek-flash,deepseek-v4-pro"; "*" allows any. */
  ALLOWED_MODELS?: string;
  /** Extra allowed origins, comma-separated (the deployment's own origin is always allowed). */
  ALLOWED_ORIGINS?: string;
  /** Seconds; default 86400; 0 turns the answer cache off. */
  ANSWER_CACHE_TTL?: string;
}
export interface DeepseekDeps {
  limiter: RateLimiter | null;
  answers: TextCache | null;
  fetch?: typeof fetch;
}

export const MAX_BODY = 256 * 1024;
export const MAX_TOKENS = 32000;
const UPSTREAM = 'https://api.deepseek.com';

export const allowed_models = (spec?: string): string[] => (list(spec).length ? list(spec) : ['deepseek-flash']);

/** Token usage from a chat/completions response body (JSON, or the last SSE chunk that has it). */
export function extract_usage(text: string, sse: boolean): Usage | undefined {
  let u: Record<string, unknown> | undefined;
  try {
    if (!sse) u = JSON.parse(text).usage;
    else {
      const lines = text.split('\n');
      for (let i = lines.length - 1; i >= 0 && !u; i--) {
        const l = lines[i].trim();
        if (!l.startsWith('data:') || l.includes('[DONE]') || !l.includes('"usage"')) continue;
        u = JSON.parse(l.slice(5)).usage ?? undefined;
      }
    }
  } catch {
    return undefined;
  }
  if (!u) return undefined;
  const n = (x: unknown) => (typeof x === 'number' ? x : undefined);
  const out: Usage = {
    prompt: n(u.prompt_tokens),
    completion: n(u.completion_tokens),
    total: n(u.total_tokens),
    cache_hit: n(u.prompt_cache_hit_tokens),
    reasoning: n((u.completion_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens),
  };
  for (const k of Object.keys(out) as (keyof Usage)[]) if (out[k] === undefined) delete out[k];
  return out;
}
export const answer_cache_key = (id: string) => `answers/${id}`;

/**
 * Send a chat body (written on the server) to DeepSeek with the key: per-visitor limits, the answer cache when
 * `cache`, the (possibly streamed) reply passed straight back, its usage logged.
 */
export async function forward_chat(request: Request, body: Record<string, unknown>, env: DeepseekEnv, deps: DeepseekDeps, note: Note, o: { cache?: boolean } = {}): Promise<Response> {
  const f = deps.fetch ?? fetch;
  const headers = { authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'content-type': 'application/json' };
  const limit = () => {
    const v = deps.limiter?.hit(client_ip(request));
    return v && !v.ok ? too_many(v, 'questions') : null;
  };
  body.max_tokens = Math.min(Number(body.max_tokens) || 8000, MAX_TOKENS);
  note.model = body.model as string;
  const payload = JSON.stringify(body);
  const answer_id = (await sha256_hex(payload)).slice(0, 32);
  const ttl = Number(env.ANSWER_CACHE_TTL ?? 86_400) || 0;
  const cache = deps.answers && ttl > 0 && o.cache ? deps.answers : null;
  if (cache) {
    const hit = await cache.get(answer_cache_key(answer_id)).catch(() => null);
    if (hit) {
      const { ct, body: cached } = JSON.parse(hit) as { ct: string; body: string };
      note.cached = true;
      return new Response(cached, { headers: { 'content-type': ct, 'cache-control': 'no-store', 'x-mathnim-cache': 'hit', 'x-mathnim-answer-id': answer_id } });
    }
  }
  const blocked = limit();
  if (blocked) return blocked;

  const upstream = await f(`${UPSTREAM}/chat/completions`, { method: 'POST', headers, body: payload, signal: request.signal });
  const ct = upstream.headers.get('content-type') ?? 'application/json';
  const out_headers = { 'content-type': ct, 'cache-control': 'no-store', 'x-mathnim-answer-id': answer_id, ...(cache ? { 'x-mathnim-cache': 'miss' } : {}) };
  if (!upstream.ok || !upstream.body) {
    note.error = `upstream ${upstream.status}`;
    return new Response(upstream.body, { status: upstream.status, headers: out_headers });
  }
  // pass the (possibly streamed) body straight through; read a copy for the usage log (and the cache)
  const [to_client, copy] = upstream.body.tee();
  const sse = ct.includes('event-stream');
  note.after = new Response(copy).text().then(async (all) => {
    note.usage = extract_usage(all, sse);
    const complete = sse ? /data:\s*\[DONE\]/.test(all) : true;
    if (cache && complete) await cache.put(answer_cache_key(answer_id), JSON.stringify({ ct, body: all }), ttl).catch(() => undefined);
  });
  return new Response(to_client, { status: upstream.status, headers: out_headers });
}
