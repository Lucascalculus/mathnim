// Cloudflare Pages Function: /api/hit (one page view, for the data centre; no cookie, no address kept).
// Logic in server/stats.ts.
import { hit, type StatsEnv } from '../../server/stats';
import { limiter, pages } from '../../server/workers';

export const onRequest = pages<StatsEnv>('hit', ['POST'], ({ request, env }, note) => hit(request, env, { limiter: limiter('hit', env) }, note));
