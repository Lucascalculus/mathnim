// Cloudflare Pages Function: /api/deepseek/* -> api.deepseek.com with the key
// (the Pages secret DEEPSEEK_API_KEY), guarded: allowed routes and models,
// capped tokens and body, Origin check, per-visitor limits, optional answer
// cache. Logic in server/deepseek.ts (shared with the dev server).
import { deepseek, type DeepseekEnv } from '../../../server/deepseek';
import { EdgeCache, limiter, pages } from '../../../server/workers';

type Env = DeepseekEnv & { RATE_LIMITS?: string };
const path = (p: string | string[] | undefined) => (Array.isArray(p) ? p.join('/') : p ?? '');

export const onRequest = pages<Env>((c) => `deepseek/${path(c.params.path)}`, ['GET', 'POST'], ({ request, env, params }, note) =>
  deepseek(request, env, path(params.path), { limiter: limiter('deepseek', env), answers: new EdgeCache(new URL(request.url).origin, 'mathnim') }, note));
