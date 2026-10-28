// Cloudflare Pages Function: /api/me/state (a signed-in learner's progress,
// kept in D1 so it follows them to other devices). Logic in server/sync.ts.
import type { AuthEnv } from '../../../server/auth';
import { state } from '../../../server/sync';
import { pages } from '../../../server/workers';

export const onRequest = pages<AuthEnv>('me/state', ['GET', 'PUT'], ({ request, env }) => state(request, env));
