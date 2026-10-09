// Cloudflare Pages Function: POST /api/feedback (learners), GET /api/feedback
// (teachers, Authorization: Bearer <ADMIN_TOKEN>). Stored in the KV namespace
// bound as FEEDBACK (wrangler.toml). Logic in server/feedback.ts.
import { feedback, type FeedbackEnv } from '../../server/feedback';
import { EdgeCache, limiter, pages } from '../../server/workers';

type Env = FeedbackEnv & { RATE_LIMITS?: string };

export const onRequest = pages<Env>('feedback', ['GET', 'POST'], ({ request, env }, note) =>
  feedback(request, env, { limiter: limiter('feedback', env), answers: new EdgeCache(new URL(request.url).origin, 'mathnim') }, note));
