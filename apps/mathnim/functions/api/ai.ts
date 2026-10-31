// Cloudflare Pages Function: /api/ai, the tutor's fixed operations, answered by DeepSeek with the key (the Pages
// secret DEEPSEEK_API_KEY). Logic in server/ai.ts (shared with the dev server).
import { ai } from '../../server/ai';
import type { DeepseekEnv } from '../../server/deepseek';
import { EdgeCache, limiter, pages } from '../../server/workers';

type Env = DeepseekEnv & { RATE_LIMITS?: string };

export const onRequest = pages<Env>('ai', ['POST'], ({ request, env }, note) =>
  ai(request, env, { limiter: limiter('deepseek', env), answers: new EdgeCache(new URL(request.url).origin, 'mathnim') }, note));
