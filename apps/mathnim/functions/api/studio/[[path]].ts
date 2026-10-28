// Cloudflare Pages Function: /api/studio/* (courses made from uploaded slides
// and practice exams). Files in the R2 bucket bound as FILES, everything else
// in D1 (DB). No model is connected yet, so generation steps answer that it
// is not configured (server/studio/model.ts is where one plugs in).
import type { AuthEnv } from '../../../server/auth';
import { NO_MODEL } from '../../../server/studio/model';
import { studio } from '../../../server/studio/routes';
import { pages } from '../../../server/workers';

const path = (p: string | string[] | undefined) => (Array.isArray(p) ? p.join('/') : p ?? '');

export const onRequest = pages<AuthEnv>((c) => `studio/${path(c.params.path).split('/')[0]}`, ['GET', 'POST', 'PATCH', 'DELETE'], ({ request, env, params }, note) =>
  studio(request, env, path(params.path), { model: NO_MODEL }, note));
